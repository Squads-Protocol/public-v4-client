import { useMultisigData } from './useMultisigData';
import { useSuspenseQuery } from '@tanstack/react-query';
import { AccountInfo, ParsedAccountData, PublicKey, RpcResponseAndContext } from '@solana/web3.js';
import invariant from 'invariant';

export interface SimplifiedProgramInfo {
  programAddress: string;
  programDataAddress: string;
  authority: string;
}

export const useProgram = (managedProgramId: string | null) => {
  const { connection, multisigAddress } = useMultisigData();

  const getParsed = (
    account: RpcResponseAndContext<AccountInfo<Buffer | ParsedAccountData> | null>
  ) => {
    const { value } = account;
    if (value && value.data && 'parsed' in value.data) {
      const {
        data: { parsed },
      } = value;
      return parsed;
    }
    return null;
  };

  const getParsedProgramAccount = async (address: PublicKey) => {
    const programAccountInfo = await connection.getParsedAccountInfo(address);
    return getParsed(programAccountInfo);
  };

  const getParsedProgramInfos = async (programAddress: PublicKey) => {
    const programParsed = await getParsedProgramAccount(programAddress);
    invariant(programParsed, `Program account ${programAddress.toBase58()} not found`);
    const programDataParsed = await getParsedProgramAccount(
      new PublicKey(programParsed.info.programData)
    );

    return { programParsed, programDataParsed };
  };

  return useSuspenseQuery({
    queryKey: ['managedProgramId', managedProgramId],
    queryFn: async (): Promise<SimplifiedProgramInfo | null> => {
      if (!multisigAddress || !managedProgramId) return null;
      try {
        const programInfos = await getParsedProgramInfos(new PublicKey(managedProgramId));
        return {
          programAddress: managedProgramId,
          programDataAddress: programInfos.programParsed.info.programData,
          authority: programInfos.programDataParsed.info.authority,
        };
      } catch (error) {
        return null;
      }
    },
  });
};

import * as multisig from '@sqds/multisig';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Connection, PublicKey } from '@solana/web3.js';
import { useMultisigData } from './useMultisigData';
import { useMultisigAddress } from './useMultisigAddress';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';

// load multisig
export const useMultisig = () => {
  const { connection } = useMultisigData();
  const { multisigAddress } = useMultisigAddress();

  return useSuspenseQuery({
    queryKey: ['multisig', multisigAddress],
    queryFn: async () => {
      if (!multisigAddress) return null;
      try {
        const multisigPubkey = new PublicKey(multisigAddress);
        // @ts-ignore
        return multisig.accounts.Multisig.fromAccountAddress(connection, multisigPubkey);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
  });
};

export const useBalance = () => {
  const { connection, multisigVault } = useMultisigData();

  return useSuspenseQuery({
    queryKey: ['balance', multisigVault?.toBase58()],
    queryFn: async () => {
      if (!multisigVault) return null;
      try {
        return connection.getBalance(multisigVault);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
  });
};

export const useGetTokens = () => {
  const { connection, multisigVault } = useMultisigData();

  return useSuspenseQuery({
    queryKey: ['tokenBalances', multisigVault?.toBase58()],
    queryFn: async () => {
      if (!multisigVault) return null;
      try {
        const classicTokens = await connection.getParsedTokenAccountsByOwner(multisigVault, {
          programId: TOKEN_PROGRAM_ID,
        });
        const t22Tokens = await connection.getParsedTokenAccountsByOwner(multisigVault, {
          programId: TOKEN_2022_PROGRAM_ID,
        });
        return classicTokens.value.concat(t22Tokens.value);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
  });
};

// Transactions
async function fetchTransactionData(
  connection: Connection,
  multisigPda: PublicKey,
  index: bigint,
  programId: PublicKey
) {
  const transactionPda = multisig.getTransactionPda({
    multisigPda,
    index,
    programId,
  });
  const proposalPda = multisig.getProposalPda({
    multisigPda,
    transactionIndex: index,
    programId,
  });

  let proposal;
  try {
    // @ts-ignore
    proposal = await multisig.accounts.Proposal.fromAccountAddress(connection, proposalPda[0]);
  } catch (error) {
    proposal = null;
  }

  return { transactionPda, proposal, index };
}

export const useTransactions = (startIndex: number, endIndex: number) => {
  const { connection, programId, multisigAddress } = useMultisigData();

  return useSuspenseQuery({
    queryKey: [
      'transactions',
      { startIndex, endIndex, multisigAddress, programId: programId.toBase58() },
    ],
    queryFn: async () => {
      if (!multisigAddress) return null;
      try {
        const multisigPda = new PublicKey(multisigAddress);
        const results: any[] = [];

        for (let i = 0; i <= startIndex - endIndex; i++) {
          const index = BigInt(startIndex - i);
          const transaction = await fetchTransactionData(connection, multisigPda, index, programId);
          results.push(transaction);
        }

        return results;
      } catch (error) {
        return null;
      }
    },
  });
};

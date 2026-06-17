import * as multisig from '@sqds/multisig';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Connection, PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';
import { useMultisigData } from './useMultisigData';
import { useMultisigAddress } from './useMultisigAddress';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';

export type TransactionKind = 'vault' | 'config' | 'batch' | 'unknown';

function getTransactionKind(data: Buffer): TransactionKind {
  const matches = (disc: number[]) => disc.every((b, i) => data[i] === b);
  if (matches([...multisig.accounts.vaultTransactionDiscriminator])) return 'vault';
  if (matches([...multisig.accounts.configTransactionDiscriminator])) return 'config';
  if (matches([...multisig.accounts.batchDiscriminator])) return 'batch';
  return 'unknown';
}

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
        // NOTE: must `await` here so a deserialization rejection is caught below.
        // Returning the un-awaited promise lets the rejection escape this try/catch
        // and, because this is a useSuspenseQuery, it gets thrown to the ErrorBoundary.
        return await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPubkey);
      } catch (error) {
        // Distinguish "account doesn't exist" (expected — show lookup) from
        // "account found but failed to decode" (surface a message to the user).
        const message = error instanceof Error ? error.message : String(error);
        const notFound = message.includes('Unable to find');
        if (!notFound) {
          toast.error('Failed to load multisig', {
            description: 'The multisig account could not be decoded. Verify the address and that your RPC/network are correct.',
          });
        }
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
        return await connection.getBalance(multisigVault);
      } catch (error) {
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

  const [transactionAccountInfo, proposal] = await Promise.all([
    connection.getAccountInfo(transactionPda[0]).catch(() => null),
    multisig.accounts.Proposal.fromAccountAddress(connection, proposalPda[0]).catch(() => null),
  ]);

  const transactionExists = transactionAccountInfo !== null;
  const kind: TransactionKind = transactionAccountInfo
    ? getTransactionKind(transactionAccountInfo.data)
    : 'unknown';
  const proposalStatusData = proposal?.status;
  const approvedAt =
    proposalStatusData?.__kind === 'Approved' ? Number(proposalStatusData.timestamp) : undefined;

  return { transactionPda, proposal, index, transactionExists, kind, approvedAt };
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
        const results: Awaited<ReturnType<typeof fetchTransactionData>>[] = [];

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

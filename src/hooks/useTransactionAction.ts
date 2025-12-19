import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, type TransactionInstruction } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMultisigData } from '@/hooks/useMultisigData';
import { waitForConfirmation } from '@/lib/transactionConfirmation';

export type TransactionActionParams = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
};

/**
 * Hook that provides shared transaction action logic for proposal operations.
 * Handles wallet connection, proposal creation/activation, and transaction confirmation.
 */
export function useTransactionAction() {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const { connection } = useMultisigData();
  const queryClient = useQueryClient();

  /**
   * Ensures wallet is connected, throws if not
   */
  const ensureWalletConnected = useCallback(() => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw new Error('Wallet not connected');
    }
    return wallet.publicKey;
  }, [wallet.publicKey, walletModal]);

  /**
   * Builds base transaction with proposal create/activate if needed
   */
  const buildProposalTransaction = useCallback(
    (params: TransactionActionParams): Transaction => {
      const walletPubkey = ensureWalletConnected();
      const { multisigPda, transactionIndex, proposalStatus, programId } = params;
      const bigIntTransactionIndex = BigInt(transactionIndex);
      const transaction = new Transaction();

      // Create proposal if status is None
      if (proposalStatus === 'None') {
        const createProposalInstruction = multisig.instructions.proposalCreate({
          multisigPda: new PublicKey(multisigPda),
          creator: walletPubkey,
          isDraft: false,
          transactionIndex: bigIntTransactionIndex,
          rentPayer: walletPubkey,
          programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
        });
        transaction.add(createProposalInstruction);
      }

      // Activate proposal if status is Draft
      if (proposalStatus === 'Draft') {
        const activateProposalInstruction = multisig.instructions.proposalActivate({
          multisigPda: new PublicKey(multisigPda),
          member: walletPubkey,
          transactionIndex: bigIntTransactionIndex,
          programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
        });
        transaction.add(activateProposalInstruction);
      }

      return transaction;
    },
    [ensureWalletConnected]
  );

  /**
   * Sends transaction and waits for confirmation
   */
  const sendAndConfirm = useCallback(
    async (transaction: Transaction): Promise<string> => {
      const signature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: true,
      });
      console.log('Transaction signature', signature);
      toast.loading('Confirming...', { id: 'transaction' });

      const sent = await waitForConfirmation(connection, [signature]);
      if (!sent[0]) {
        throw new Error(`Transaction failed or unable to confirm. Check ${signature}`);
      }

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      return signature;
    },
    [wallet, connection, queryClient]
  );

  /**
   * Execute a transaction action with the given instruction builder
   */
  const executeAction = useCallback(
    async (
      params: TransactionActionParams,
      buildInstruction: (
        multisigPda: PublicKey,
        member: PublicKey,
        transactionIndex: bigint,
        programId: PublicKey
      ) => TransactionInstruction
    ): Promise<string> => {
      const walletPubkey = ensureWalletConnected();
      const transaction = buildProposalTransaction(params);

      const instruction = buildInstruction(
        new PublicKey(params.multisigPda),
        walletPubkey,
        BigInt(params.transactionIndex),
        params.programId ? new PublicKey(params.programId) : multisig.PROGRAM_ID
      );
      transaction.add(instruction);

      return sendAndConfirm(transaction);
    },
    [ensureWalletConnected, buildProposalTransaction, sendAndConfirm]
  );

  return {
    wallet,
    walletModal,
    connection,
    queryClient,
    ensureWalletConnected,
    buildProposalTransaction,
    sendAndConfirm,
    executeAction,
  };
}

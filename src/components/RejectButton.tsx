'use client';
import { PublicKey, Transaction } from '@solana/web3.js';
import { Button } from './ui/button';
import * as multisig from '@sqds/multisig';
import { useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'sonner';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useQueryClient } from '@tanstack/react-query';
import { waitForConfirmation } from '../lib/transactionConfirmation';
import { useMultisig } from '@/hooks/useServices';
import { isMember, formatTransactionError } from '@/lib/utils';

type RejectButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
  isStale: boolean;
  rejectedMembers: PublicKey[];
  isAccountClosed: boolean;
};

const RejectButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
  isStale,
  rejectedMembers,
  isAccountClosed,
}: RejectButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();

  const { connection } = useMultisigData();
  const queryClient = useQueryClient();
  const { data: multisigConfig } = useMultisig();

  const rejectableStatuses = ['None', 'Active', 'Draft'];
  const hasAlreadyRejected =
    !!wallet.publicKey && rejectedMembers.some((k) => k.equals(wallet.publicKey!));
  const connectedMember = wallet.publicKey
    ? isMember(wallet.publicKey, multisigConfig?.members ?? [])
    : undefined;
  const hasVotePermission = connectedMember
    ? multisig.types.Permissions.has(connectedMember.permissions, multisig.types.Permission.Vote)
    : false;
  const isDisabled =
    !wallet.publicKey ||
    isAccountClosed ||
    isStale ||
    !rejectableStatuses.includes(proposalStatus) ||
    hasAlreadyRejected ||
    !hasVotePermission;
  const signatureRef = useRef<string>('');

  const rejectTransaction = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
    }
    let bigIntTransactionIndex = BigInt(transactionIndex);

    const transaction = new Transaction();
    if (proposalStatus === 'None') {
      const createProposalInstruction = multisig.instructions.proposalCreate({
        multisigPda: new PublicKey(multisigPda),
        creator: wallet.publicKey,
        isDraft: false,
        transactionIndex: bigIntTransactionIndex,
        rentPayer: wallet.publicKey,
        programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
      });
      transaction.add(createProposalInstruction);
    }
    if (proposalStatus == 'Draft') {
      const activateProposalInstruction = multisig.instructions.proposalActivate({
        multisigPda: new PublicKey(multisigPda),
        member: wallet.publicKey,
        transactionIndex: bigIntTransactionIndex,
        programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
      });
      transaction.add(activateProposalInstruction);
    }
    const rejectProposalInstruction = multisig.instructions.proposalReject({
      multisigPda: new PublicKey(multisigPda),
      member: wallet.publicKey,
      transactionIndex: bigIntTransactionIndex,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });

    transaction.add(rejectProposalInstruction);

    toast.loading('Waiting for wallet approval...', { id: 'transaction', duration: Infinity });

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    signatureRef.current = signature;

    const shortSig = `${signature.slice(0, 8)}...${signature.slice(-4)}`;
    toast.info(`Sent: ${signature}`, { duration: 6000 });
    toast.info(`Confirming: ${shortSig}`, { id: 'transaction', duration: Infinity });

    const [confirmed] = await waitForConfirmation(connection, [signature]);
    if (!confirmed) {
      throw `Transaction failed or timed out. Check ${signature}`;
    }
    toast.success('Transaction rejected.', { id: 'transaction' });
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };
  return (
    <Button
      disabled={isDisabled}
      onClick={async () => {
        try {
          await rejectTransaction();
        } catch (e) {
          toast.error(
            `Failed to reject: ${formatTransactionError(e)}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
            { id: 'transaction' }
          );
        }
      }}
      className="mr-2"
    >
      Reject
    </Button>
  );
};

export default RejectButton;

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

type ApproveButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
  isStale: boolean;
};

const ApproveButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
  isStale,
}: ApproveButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const terminalStatuses = ['Rejected', 'Approved', 'Executing', 'Executed', 'Cancelled'];
  const isDisabled = isStale || terminalStatuses.includes(proposalStatus || 'None');
  const { connection } = useMultisigData();
  const queryClient = useQueryClient();
  const signatureRef = useRef<string>('');

  const approveProposal = async () => {
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
    const approveProposalInstruction = multisig.instructions.proposalApprove({
      multisigPda: new PublicKey(multisigPda),
      member: wallet.publicKey,
      transactionIndex: bigIntTransactionIndex,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });
    transaction.add(approveProposalInstruction);
    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    signatureRef.current = signature;
    toast.info(`Sending ${signature}`, {
      duration: Infinity,
    });
    toast.loading('Confirming...', {
      id: 'transaction',
    });
    const sent = await waitForConfirmation(connection, [signature]);
    if (!sent[0]) {
      throw `Transaction failed or unable to confirm. Check ${signature}`;
    }
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };
  return (
    <Button
      disabled={isDisabled}
      onClick={() =>
        toast.promise(approveProposal, {
          id: 'transaction',
          loading: 'Loading...',
          success: 'Transaction approved.',
          error: (e) => `Failed to approve: ${e}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
        })
      }
      className="mr-2"
    >
      Approve
    </Button>
  );
};

export default ApproveButton;

import { PublicKey, Transaction } from '@solana/web3.js';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import * as multisig from '@sqds/multisig';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { useMultisigData } from '@/hooks/useMultisigData';
import { waitForConfirmation } from '@/lib/transactionConfirmation';

type ApproveButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
};

const ApproveButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
}: ApproveButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const validKinds = ['Rejected', 'Approved', 'Executing', 'Executed', 'Cancelled'];
  const isKindValid = validKinds.includes(proposalStatus || 'None');
  const { connection } = useMultisigData();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const approveProposal = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
    }
    setIsLoading(true);
    try {
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
      toast.loading('Confirming...', { id: 'transaction' });
      const sent = await waitForConfirmation(connection, [signature]);
      if (!sent[0]) {
        throw `Transaction failed or unable to confirm. Check ${signature}`;
      }
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isKindValid || isLoading}
            onClick={() =>
              toast.promise(approveProposal, {
                id: 'transaction',
                loading: 'Approving...',
                success: 'Transaction approved',
                error: (e) => `Failed to approve: ${e}`,
              })
            }
            className="h-8 w-8 text-green-500 hover:bg-green-500/10 hover:text-green-500"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Approve</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ApproveButton;

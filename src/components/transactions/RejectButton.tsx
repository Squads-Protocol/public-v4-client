import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMultisigData } from '@/hooks/useMultisigData';
import { waitForConfirmation } from '@/lib/transactionConfirmation';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type RejectButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
};

const RejectButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
}: RejectButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const { connection } = useMultisigData();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const validKinds = ['None', 'Active', 'Draft'];
  const isKindValid = validKinds.includes(proposalStatus);

  const rejectTransaction = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
    }
    setIsLoading(true);
    try {
      const bigIntTransactionIndex = BigInt(transactionIndex);

      if (!isKindValid) {
        toast.error("You can't reject this proposal.");
        return;
      }

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
      if (proposalStatus === 'Draft') {
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
            disabled={!isKindValid || isLoading}
            onClick={() =>
              toast.promise(rejectTransaction, {
                id: 'transaction',
                loading: 'Rejecting...',
                success: 'Transaction rejected',
                error: (e) => `Failed to reject: ${e}`,
              })
            }
            className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-500"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Reject</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default RejectButton;

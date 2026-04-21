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
import { formatTransactionError } from '@/lib/utils';
import { useCancelButtonState } from '@/hooks/useProposalActions';

type CancelButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
  isAccountClosed: boolean;
};

const CancelButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
  isAccountClosed,
}: CancelButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const { isDisabled } = useCancelButtonState({ proposalStatus, isAccountClosed });
  const { connection } = useMultisigData();
  const queryClient = useQueryClient();
  const signatureRef = useRef<string>('');

  const cancelProposal = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
    }
    const cancelIx = multisig.instructions.proposalCancelV2({
      multisigPda: new PublicKey(multisigPda),
      transactionIndex: BigInt(transactionIndex),
      member: wallet.publicKey,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });
    const transaction = new Transaction().add(cancelIx);
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
    toast.success(`Cancel submitted. (${signature})`, { id: 'transaction' });
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  return (
    <Button
      variant="destructive"
      disabled={isDisabled}
      onClick={async () => {
        try {
          await cancelProposal();
        } catch (e) {
          toast.error(
            `Failed to cancel: ${formatTransactionError(e)}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
            { id: 'transaction' }
          );
        }
      }}
      size="sm"
      className="w-full sm:w-auto"
    >
      Cancel
    </Button>
  );
};

export default CancelButton;

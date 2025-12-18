import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { Button } from '../ui/button';
import * as multisig from '@sqds/multisig';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'sonner';
import { useAccess } from '@/hooks/useAccess';
import { waitForConfirmation } from '@/lib/transactionConfirmation';
import { useQueryClient } from '@tanstack/react-query';
import { useMultisigData } from '@/hooks/useMultisigData';

type RemoveMemberButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  memberKey: string;
  programId: string;
};

const RemoveMemberButton = ({
  multisigPda,
  transactionIndex,
  memberKey,
  programId,
}: RemoveMemberButtonProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const isMember = useAccess();
  const member = new PublicKey(memberKey);
  const queryClient = useQueryClient();
  const { connection } = useMultisigData();

  const removeMember = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }
    let bigIntTransactionIndex = BigInt(transactionIndex);

    const removeMemberIx = multisig.instructions.configTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      actions: [
        {
          __kind: 'RemoveMember',
          oldMember: member,
        },
      ],
      creator: wallet.publicKey,
      transactionIndex: bigIntTransactionIndex,
      rentPayer: wallet.publicKey,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });
    const proposalIx = multisig.instructions.proposalCreate({
      multisigPda: new PublicKey(multisigPda),
      creator: wallet.publicKey,
      isDraft: false,
      transactionIndex: bigIntTransactionIndex,
      rentPayer: wallet.publicKey,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });
    const approveIx = multisig.instructions.proposalApprove({
      multisigPda: new PublicKey(multisigPda),
      member: wallet.publicKey,
      transactionIndex: bigIntTransactionIndex,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });

    const message = new TransactionMessage({
      instructions: [removeMemberIx, proposalIx, approveIx],
      payerKey: wallet.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    console.log('Transaction signature', signature);
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
      disabled={!isMember}
      onClick={() =>
        toast.promise(removeMember, {
          id: 'transaction',
          loading: 'Submitting...',
          success: 'Remove Member action proposed.',
          error: (e) => `Failed to propose: ${e}`,
        })
      }
    >
      Remove
    </Button>
  );
};

export default RemoveMemberButton;

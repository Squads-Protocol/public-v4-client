import { useRef, useState } from 'react';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { Button } from './ui/button';
import { formatTransactionError } from '@/lib/utils';
import * as multisig from '@sqds/multisig';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'sonner';
import { useAccess } from '../hooks/useAccess';
import { waitForConfirmation } from '../lib/transactionConfirmation';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMultisigData } from '../hooks/useMultisigData';
import { buildProposalIx } from '../lib/multisigUtils';

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
  const navigate = useNavigate();
  const { connection } = useMultisigData();
  const signatureRef = useRef<string>('');
  const [isPending, setIsPending] = useState(false);

  const removeMember = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
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
    const proposalIx = buildProposalIx(
      new PublicKey(multisigPda),
      wallet.publicKey,
      bigIntTransactionIndex,
      programId ? new PublicKey(programId) : multisig.PROGRAM_ID
    );

    const message = new TransactionMessage({
      instructions: [removeMemberIx, proposalIx],
      payerKey: wallet.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);

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
    toast.success(`Remove member action proposed. (${signature})`, { id: 'transaction' });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['multisig'] }),
    ]);
    navigate('/transactions');
  };
  return (
    <Button
      size="sm"
      disabled={!isMember || isPending}
      onClick={async () => {
        setIsPending(true);
        try {
          await removeMember();
        } catch (e) {
          toast.error(
            `Failed to propose: ${formatTransactionError(e)}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
            { id: 'transaction' }
          );
        } finally {
          setIsPending(false);
        }
      }}
    >
      Remove
    </Button>
  );
};

export default RemoveMemberButton;

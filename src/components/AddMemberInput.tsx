import { Button } from './ui/button';
import { formatTransactionError } from '@/lib/utils';
import { Input } from './ui/input';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useRef } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import * as multisig from '@sqds/multisig';
import { PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { isPublickey } from '@/lib/isPublickey';
import { useMultisig } from '@/hooks/useServices';
import { useAccess } from '@/hooks/useAccess';
import { useMultisigData } from '@/hooks/useMultisigData';
import { isMember } from '../lib/utils';
import invariant from 'invariant';
import { waitForConfirmation } from '../lib/transactionConfirmation';
import { useQueryClient } from '@tanstack/react-query';
import { buildProposalAndApproveIx } from '@/lib/multisigUtils';

type AddMemberInputProps = {
  multisigPda: string;
  transactionIndex: number;
  programId: string;
};

const AddMemberInput = ({ multisigPda, transactionIndex, programId }: AddMemberInputProps) => {
  const [member, setMember] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const { data: multisigConfig } = useMultisig();
  const bigIntTransactionIndex = BigInt(transactionIndex);
  const { connection } = useMultisigData();
  const queryClient = useQueryClient();
  const signatureRef = useRef<string>('');
  const hasAccess = useAccess();
  const addMember = async () => {
    invariant(multisigConfig, 'invalid multisig conf data');
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }
    const newMemberKey = new PublicKey(member);
    const memberExists = isMember(newMemberKey, multisigConfig.members);
    if (memberExists) {
      throw 'Member already exists';
    }
    const addMemberIx = multisig.instructions.configTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      actions: [
        {
          __kind: 'AddMember',
          newMember: {
            key: newMemberKey,
            permissions: {
              mask: 7,
            },
          },
        },
      ],
      creator: wallet.publicKey,
      transactionIndex: bigIntTransactionIndex,
      rentPayer: wallet.publicKey,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });
    const [proposalIx, approveIx] = buildProposalAndApproveIx(
      new PublicKey(multisigPda),
      wallet.publicKey,
      bigIntTransactionIndex,
      programId ? new PublicKey(programId) : multisig.PROGRAM_ID
    );

    const message = new TransactionMessage({
      instructions: [addMemberIx, proposalIx, approveIx],
      payerKey: wallet.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    signatureRef.current = signature;
    toast.info(`Sending ${signature}`, { duration: Infinity });
    toast.loading('Confirming...', {
      id: 'transaction',
    });
    const sent = await waitForConfirmation(connection, [signature]);
    if (!sent[0]) {
      throw `Transaction failed or unable to confirm. Check ${signature}`;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['multisig'] }),
    ]);
  };
  return (
    <div>
      <Input
        placeholder="Member Public Key"
        onChange={(e) => setMember(e.target.value.trim())}
        className="mb-3"
      />
      <Button
        onClick={() =>
          toast.promise(addMember, {
            id: 'transaction',
            loading: 'Loading...',
            success: 'Add member action proposed.',
            error: (e) => `Failed to propose: ${formatTransactionError(e)}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
          })
        }
        disabled={!isPublickey(member) || !hasAccess}
      >
        Add Member
      </Button>
    </div>
  );
};

export default AddMemberInput;

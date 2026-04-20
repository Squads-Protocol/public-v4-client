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
import { useNavigate } from 'react-router-dom';
import { buildProposalIx } from '@/lib/multisigUtils';

type AddMemberInputProps = {
  multisigPda: string;
  transactionIndex: number;
  programId: string;
};

const PERMISSIONS = [
  { label: 'Initiate', value: 1 },
  { label: 'Vote', value: 2 },
  { label: 'Execute', value: 4 },
] as const;

const AddMemberInput = ({ multisigPda, transactionIndex, programId }: AddMemberInputProps) => {
  const [member, setMember] = useState('');
  const [permMask, setPermMask] = useState(7);
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const { data: multisigConfig } = useMultisig();
  const bigIntTransactionIndex = BigInt(transactionIndex);
  const { connection } = useMultisigData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signatureRef = useRef<string>('');
  const hasAccess = useAccess();
  const addMember = async () => {
    invariant(multisigConfig, 'invalid multisig conf data');
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
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
              mask: permMask,
            },
          },
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
      instructions: [addMemberIx, proposalIx],
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
    toast.success(`Add member action proposed. (${signature})`, { id: 'transaction' });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['multisig'] }),
    ]);
    navigate('/transactions');
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <Input
        placeholder="Member Public Key"
        onChange={(e) => setMember(e.target.value.trim())}
        className="w-full sm:flex-1"
      />
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 gap-3">
          {PERMISSIONS.map(({ label, value }) => (
            <label key={label} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={(permMask & value) !== 0}
                onChange={(e) =>
                  setPermMask((prev) => (e.target.checked ? prev | value : prev & ~value))
                }
                className="h-3.5 w-3.5 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
        <Button
          size="sm"
          onClick={async () => {
            try {
              await addMember();
            } catch (e) {
              toast.error(
                `Failed to propose: ${formatTransactionError(e)}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
                { id: 'transaction' }
              );
            }
          }}
          disabled={!isPublickey(member) || !hasAccess || permMask === 0}
        >
          Add
        </Button>
      </div>
    </div>
  );
};

export default AddMemberInput;

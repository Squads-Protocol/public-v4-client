import { Button } from './ui/button';
import { formatTransactionError } from '@/lib/utils';
import { Input } from './ui/input';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useRef } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import * as multisig from '@sqds/multisig';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { useMultisig } from '../hooks/useServices';
import invariant from 'invariant';
import { types as multisigTypes } from '@sqds/multisig';
import { waitForConfirmation } from '../lib/transactionConfirmation';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMultisigData } from '../hooks/useMultisigData';
import { useAccess } from '../hooks/useAccess';
import { buildProposalIx } from '../lib/multisigUtils';

type ChangeThresholdInputProps = {
  multisigPda: string;
  transactionIndex: number;
};

const ChangeThresholdInput = ({ multisigPda, transactionIndex }: ChangeThresholdInputProps) => {
  const { data: multisigConfig } = useMultisig();
  const hasAccess = useAccess();
  const [threshold, setThreshold] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signatureRef = useRef<string>('');
  const [isPending, setIsPending] = useState(false);

  const bigIntTransactionIndex = BigInt(transactionIndex);
  const { connection, programId } = useMultisigData();

  const countVoters = (members: multisig.types.Member[]) => {
    return members.filter(
      (member) =>
        (member.permissions.mask & multisigTypes.Permission.Vote) === multisigTypes.Permission.Vote
    ).length;
  };

  const validateThreshold = () => {
    invariant(multisigConfig, 'Invalid multisig conf loaded');
    const totalVoters = countVoters(multisigConfig.members);

    if (parseInt(threshold, 10) < 1) {
      return 'Threshold must be at least 1.';
    }
    if (parseInt(threshold) > totalVoters) {
      return `Threshold cannot exceed ${totalVoters} (total voters).`;
    }
    return null; // Valid input
  };

  const changeThreshold = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
    }
    const validateError = validateThreshold();
    if (validateError) {
      throw validateError;
    }

    const changeThresholdIx = multisig.instructions.configTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      actions: [
        {
          __kind: 'ChangeThreshold',
          newThreshold: parseInt(threshold),
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
      programId
    );

    const message = new TransactionMessage({
      instructions: [changeThresholdIx, proposalIx],
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
    toast.success(`Threshold change proposed. (${signature})`, { id: 'transaction' });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['multisig'] }),
    ]);
    navigate('/transactions');
  };
  return (
    <div>
      <Input
        placeholder={multisigConfig ? multisigConfig.threshold.toString() : ''}
        type="text"
        onChange={(e) => setThreshold(e.target.value.trim())}
        className="mb-3"
      />
      <Button
        onClick={async () => {
          setIsPending(true);
          try {
            await changeThreshold();
          } catch (e) {
            toast.error(
              `Failed to propose: ${formatTransactionError(e)}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
              { id: 'transaction' }
            );
          } finally {
            setIsPending(false);
          }
        }}
        disabled={
          !hasAccess ||
          !threshold ||
          (!!multisigConfig && multisigConfig.threshold == parseInt(threshold, 10)) ||
          isPending
        }
      >
        Change Threshold
      </Button>
    </div>
  );
};

export default ChangeThresholdInput;

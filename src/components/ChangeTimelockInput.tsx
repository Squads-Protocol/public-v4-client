import { Button } from './ui/button';
import { formatTransactionError } from '@/lib/utils';
import { Input } from './ui/input';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useRef } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import * as multisig from '@sqds/multisig';
import { PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { waitForConfirmation } from '../lib/transactionConfirmation';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useMultisigData } from '../hooks/useMultisigData';
import { useAccess } from '../hooks/useAccess';
import { buildProposalIx } from '../lib/multisigUtils';

const MAX_TIME_LOCK = 3 * 30 * 24 * 60 * 60; // 7,776,000 seconds (3 months)

type ChangeTimelockInputProps = {
  multisigPda: string;
  transactionIndex: number;
  currentTimeLock: number;
};

const ChangeTimelockInput = ({
  multisigPda,
  transactionIndex,
  currentTimeLock,
}: ChangeTimelockInputProps) => {
  const [seconds, setSeconds] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const signatureRef = useRef<string>('');
  const bigIntTransactionIndex = BigInt(transactionIndex);
  const { connection, programId } = useMultisigData();
  const hasAccess = useAccess();

  const parsedSeconds = parseInt(seconds, 10);
  const isValid =
    !isNaN(parsedSeconds) && parsedSeconds >= 0 && parsedSeconds <= MAX_TIME_LOCK;

  const changeTimelock = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
    }

    const changeTimelockIx = multisig.instructions.configTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      actions: [
        {
          __kind: 'SetTimeLock',
          newTimeLock: parsedSeconds,
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
      instructions: [changeTimelockIx, proposalIx],
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
    toast.success(`Timelock change proposed. (${signature})`, { id: 'transaction' });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['multisig'] }),
    ]);
    navigate('/transactions');
  };

  return (
    <div>
      <Input
        placeholder={currentTimeLock.toString()}
        type="number"
        min={0}
        max={MAX_TIME_LOCK}
        onChange={(e) => setSeconds(e.target.value.trim())}
        className="mb-3"
      />
      <Button
        onClick={async () => {
          try {
            await changeTimelock();
          } catch (e) {
            toast.error(
              `Failed to propose: ${formatTransactionError(e)}${signatureRef.current ? ` (${signatureRef.current})` : ''}`,
              { id: 'transaction' }
            );
          }
        }}
        disabled={
          !hasAccess || !seconds || !isValid || parsedSeconds === currentTimeLock
        }
      >
        Change Timelock
      </Button>
    </div>
  );
};

export default ChangeTimelockInput;

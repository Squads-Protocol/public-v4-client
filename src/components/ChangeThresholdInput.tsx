import { Button } from './ui/button';
import { Input } from './ui/input';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import * as multisig from '@sqds/multisig';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { useMultisig } from '../hooks/useServices';
import invariant from 'invariant';
import { types as multisigTypes } from '@sqds/multisig';
import { waitForConfirmation } from '../lib/transactionConfirmation';
import { useQueryClient } from '@tanstack/react-query';
import { useMultisigData } from '../hooks/useMultisigData';
import { buildProposalAndApproveIx } from '../lib/multisigUtils';

type ChangeThresholdInputProps = {
  multisigPda: string;
  transactionIndex: number;
};

const ChangeThresholdInput = ({ multisigPda, transactionIndex }: ChangeThresholdInputProps) => {
  const { data: multisigConfig } = useMultisig();
  const [threshold, setThreshold] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const queryClient = useQueryClient();

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
      return;
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
    const [proposalIx, approveIx] = buildProposalAndApproveIx(
      new PublicKey(multisigPda),
      wallet.publicKey,
      bigIntTransactionIndex,
      programId
    );

    const message = new TransactionMessage({
      instructions: [changeThresholdIx, proposalIx, approveIx],
      payerKey: wallet.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
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
    <div>
      <Input
        placeholder={multisigConfig ? multisigConfig.threshold.toString() : ''}
        type="text"
        onChange={(e) => setThreshold(e.target.value.trim())}
        className="mb-3"
      />
      <Button
        onClick={() =>
          toast.promise(changeThreshold, {
            id: 'transaction',
            loading: 'Loading...',
            success: 'Threshold change proposed.',
            error: (e) => `Failed to propose: ${e}`,
          })
        }
        disabled={
          !threshold || (!!multisigConfig && multisigConfig.threshold == parseInt(threshold, 10))
        }
      >
        Change Threshold
      </Button>
    </div>
  );
};

export default ChangeThresholdInput;

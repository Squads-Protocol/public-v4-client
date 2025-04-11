'use client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import * as multisig from '@sqds/multisig';
import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { toast } from 'sonner';
import { isPublickey } from '@/lib/isPublickey';
import { SimplifiedProgramInfo } from '../hooks/useProgram';
import { useMultisigData } from '../hooks/useMultisigData';
import { waitForConfirmation } from '../lib/transactionConfirmation';
import { useQueryClient } from '@tanstack/react-query';

type ChangeUpgradeAuthorityInputProps = {
  programInfos: SimplifiedProgramInfo;
  transactionIndex: number;
};

const ChangeUpgradeAuthorityInput = ({
  programInfos,
  transactionIndex,
}: ChangeUpgradeAuthorityInputProps) => {
  const [newAuthority, setNewAuthority] = useState('');
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const queryClient = useQueryClient();
  const bigIntTransactionIndex = BigInt(transactionIndex);
  const { connection, multisigAddress, vaultIndex, programId, multisigVault } = useMultisigData();

  const changeUpgradeAuth = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }
    if (!multisigVault) {
      throw 'Multisig vault not found';
    }
    if (!multisigAddress) {
      throw 'Multisig not found';
    }

    const multisigPda = new PublicKey(multisigAddress);
    const vaultAddress = new PublicKey(multisigVault);

    const upgradeData = Buffer.alloc(4);
    upgradeData.writeInt32LE(4, 0);

    const keys: AccountMeta[] = [
      {
        pubkey: new PublicKey(programInfos.programDataAddress),
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: vaultAddress,
        isWritable: false,
        isSigner: true,
      },
      {
        pubkey: new PublicKey(newAuthority),
        isWritable: false,
        isSigner: false,
      },
    ];

    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    const transactionMessage = new TransactionMessage({
      instructions: [
        new TransactionInstruction({
          programId: new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'),
          data: upgradeData,
          keys,
        }),
      ],
      payerKey: new PublicKey(vaultAddress),
      recentBlockhash: blockhash,
    });

    const transactionIndexBN = BigInt(transactionIndex);

    const multisigTransactionIx = multisig.instructions.vaultTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      creator: wallet.publicKey,
      ephemeralSigners: 0,
      // @ts-ignore
      transactionMessage,
      transactionIndex: transactionIndexBN,
      addressLookupTableAccounts: [],
      rentPayer: wallet.publicKey,
      vaultIndex: vaultIndex,
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
      instructions: [multisigTransactionIx, proposalIx, approveIx],
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
    <div>
      <Input
        placeholder="New Program Authority"
        type="text"
        onChange={(e) => setNewAuthority(e.target.value)}
        className="mb-3"
      />
      <Button
        onClick={() =>
          toast.promise(changeUpgradeAuth, {
            id: 'transaction',
            loading: 'Loading...',
            success: 'Upgrade authority change proposed.',
            error: (e) => `Failed to propose: ${e}`,
          })
        }
        disabled={
          !programId ||
          !isPublickey(newAuthority) ||
          !isPublickey(programInfos.programAddress) ||
          !isPublickey(programInfos.authority) ||
          !isPublickey(programInfos.programDataAddress)
        }
      >
        Change Authority
      </Button>
    </div>
  );
};

export default ChangeUpgradeAuthorityInput;

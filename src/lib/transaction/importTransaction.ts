'use client';
import * as multisig from '@sqds/multisig';
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { decodeAndDeserialize } from './decodeAndDeserialize';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { loadLookupTables } from './getAccountsForSimulation';
import { waitForConfirmation } from '~/lib/transactionConfirmation';
import { buildProposalAndApproveIx } from '~/lib/multisigUtils';

export const importTransaction = async (
  tx: string,
  connection: Connection,
  multisigPda: string,
  programId: string,
  vaultIndex: number,
  wallet: WalletContextState
) => {
  if (!wallet.publicKey) {
    throw 'Please connect your wallet.';
  }
  try {
    const { message, version } = decodeAndDeserialize(tx);

    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      connection,
      new PublicKey(multisigPda)
    );

    const transactionMessage = new TransactionMessage(message);

    const addressLookupTableAccounts =
      version === 0
        ? await loadLookupTables(connection, transactionMessage.compileToV0Message())
        : [];

    const transactionIndex = Number(multisigInfo.transactionIndex) + 1;
    const transactionIndexBN = BigInt(transactionIndex);

    const resolvedProgramId = programId ? new PublicKey(programId) : multisig.PROGRAM_ID;
    const multisigTransactionIx = multisig.instructions.vaultTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      creator: wallet.publicKey,
      ephemeralSigners: 0,
      transactionMessage: transactionMessage,
      transactionIndex: transactionIndexBN,
      addressLookupTableAccounts,
      rentPayer: wallet.publicKey,
      vaultIndex: vaultIndex,
      programId: resolvedProgramId,
    });
    const [proposalIx, approveIx] = buildProposalAndApproveIx(
      new PublicKey(multisigPda),
      wallet.publicKey,
      transactionIndexBN,
      resolvedProgramId
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    const wrappedMessage = new TransactionMessage({
      instructions: [multisigTransactionIx, proposalIx, approveIx],
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(wrappedMessage);

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    toast.loading('Confirming...', {
      id: 'transaction',
    });

    const hasSent = await waitForConfirmation(connection, [signature]);
    if (!hasSent.every((s) => !!s)) {
      throw `Unable to confirm transaction`;
    }
  } catch (error) {
    throw error;
  }
};

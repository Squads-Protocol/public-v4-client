import * as multisig from '@sqds/multisig';
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { buildProposalIx } from '../multisigUtils';
import { waitForConfirmation } from '../transactionConfirmation';

export interface VaultProposal {
  readonly vaultIndex: number;
  readonly instructions: readonly TransactionInstruction[];
  readonly ephemeralSigners: number;
}

export interface PreparedProposal extends VaultProposal {
  readonly transactionIndex: bigint;
}

/** What a builder can know before the proposal exists. */
export interface BuildContext {
  readonly transactionIndex: bigint;
  /** The PDA that the Squads program signs for at execute, in place of a new keypair. */
  readonly ephemeralSigner: (index: number) => PublicKey;
}

export async function nextTransactionIndex(
  connection: Connection,
  multisigPda: PublicKey
): Promise<bigint> {
  const info = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
  return BigInt(info.transactionIndex.toString()) + BigInt(1);
}

export function buildContext(
  multisigPda: PublicKey,
  programId: PublicKey,
  transactionIndex: bigint
): BuildContext {
  const [transactionPda] = multisig.getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });
  return {
    transactionIndex,
    ephemeralSigner: (ephemeralSignerIndex) =>
      multisig.getEphemeralSignerPda({ transactionPda, ephemeralSignerIndex, programId })[0],
  };
}

export type SimulationResult =
  | { readonly ok: true; readonly logs: readonly string[]; readonly unitsConsumed?: number }
  | { readonly ok: false; readonly error: string; readonly logs: readonly string[] };

/**
 * Simulates the inner instructions as if the vault signs them. The member pays the fee,
 * as at execute. Signature checks are off, so the vault and ephemeral PDAs can "sign".
 */
export async function simulateAsVault(
  connection: Connection,
  payer: PublicKey,
  instructions: readonly TransactionInstruction[]
): Promise<SimulationResult> {
  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: [...instructions],
    }).compileToV0Message()
  );
  const { value } = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: 'confirmed',
  });
  const logs = value.logs ?? [];
  return value.err
    ? { ok: false, error: JSON.stringify(value.err), logs }
    : { ok: true, logs, unitsConsumed: value.unitsConsumed };
}

/** Creates the vault transaction and its proposal, and waits for confirmation. */
export async function proposeVaultTransaction(p: {
  connection: Connection;
  wallet: WalletContextState;
  multisigPda: PublicKey;
  programId: PublicKey;
  prepared: PreparedProposal;
}): Promise<string> {
  const { connection, wallet, multisigPda, programId, prepared } = p;
  const creator = wallet.publicKey;
  if (!creator) throw new Error('Wallet not connected');

  const currentIndex = await nextTransactionIndex(connection, multisigPda);
  if (currentIndex !== prepared.transactionIndex) {
    throw new Error('Another proposal was created after the preview. Preview again.');
  }

  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: prepared.vaultIndex, programId });
  const { blockhash } = await connection.getLatestBlockhash();
  const createIx = multisig.instructions.vaultTransactionCreate({
    multisigPda,
    creator,
    ephemeralSigners: prepared.ephemeralSigners,
    transactionMessage: new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: blockhash,
      instructions: [...prepared.instructions],
    }),
    transactionIndex: prepared.transactionIndex,
    addressLookupTableAccounts: [],
    rentPayer: creator,
    vaultIndex: prepared.vaultIndex,
    programId,
  });
  const proposalIx = buildProposalIx(multisigPda, creator, prepared.transactionIndex, programId);

  const message = new TransactionMessage({
    instructions: [createIx, proposalIx],
    payerKey: creator,
    recentBlockhash: blockhash,
  }).compileToV0Message();

  const signature = await wallet.sendTransaction(new VersionedTransaction(message), connection, {
    skipPreflight: true,
  });
  const [confirmed] = await waitForConfirmation(connection, [signature]);
  if (!confirmed) throw new Error(`Transaction failed or timed out. Check ${signature}`);
  return signature;
}

import {
  AddressLookupTableAccount,
  Connection,
  MessageV0,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedMessage,
} from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import bs58 from 'bs58';
import { decodeAndDeserialize } from './decodeAndDeserialize';
import { loadLookupTables } from './getAccountsForSimulation';
import type { VaultTransactionMessage } from '@sqds/multisig/lib/generated/types/VaultTransactionMessage';
import type { ConfigAction } from '@sqds/multisig/lib/generated/types/ConfigAction';

export interface DecodedInstruction {
  programId: string;
  accounts: Array<{
    address: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: Uint8Array;
}

export type DecodedTransaction =
  | { kind: 'vault'; instructions: DecodedInstruction[] }
  | { kind: 'config'; actions: ConfigAction[] }
  | { kind: 'batch'; size: number; transactions: DecodedInstruction[][] };

const DUMMY_BLOCKHASH = '9xr5R5SzUGkPMLHE45QNV456CwhWBhWSwamVvPAYv8iX';

function matchesDiscriminator(data: Buffer, disc: number[]): boolean {
  return disc.every((byte, i) => data[i] === byte);
}

function buildMessageV0(msg: VaultTransactionMessage): MessageV0 {
  return new MessageV0({
    staticAccountKeys: msg.accountKeys,
    addressTableLookups: msg.addressTableLookups.map((a) => ({
      accountKey: a.accountKey,
      writableIndexes: Array.from(a.writableIndexes),
      readonlyIndexes: Array.from(a.readonlyIndexes),
    })),
    header: {
      numRequiredSignatures: msg.numSigners,
      numReadonlySignedAccounts: msg.numSigners - msg.numWritableSigners,
      numReadonlyUnsignedAccounts:
        msg.accountKeys.length - msg.numSigners - msg.numWritableNonSigners,
    },
    compiledInstructions: msg.instructions.map((ix) => ({
      programIdIndex: ix.programIdIndex,
      accountKeyIndexes: Array.from(ix.accountIndexes),
      data: ix.data,
    })),
    recentBlockhash: DUMMY_BLOCKHASH,
  });
}

async function resolveAlts(
  connection: Connection,
  lookups: VaultTransactionMessage['addressTableLookups']
): Promise<AddressLookupTableAccount[]> {
  if (lookups.length === 0) return [];
  const results = await Promise.all(
    lookups.map((a) => connection.getAddressLookupTable(a.accountKey).then((r) => r.value))
  );
  return results.filter((item): item is AddressLookupTableAccount => item !== null);
}

export function toDecodedInstructions(
  ixs: readonly TransactionInstruction[]
): DecodedInstruction[] {
  return ixs.map((ix) => ({
    programId: ix.programId.toBase58(),
    accounts: ix.keys.map((k) => ({
      address: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: ix.data,
  }));
}

async function decodeMessage(
  connection: Connection,
  msg: VaultTransactionMessage
): Promise<DecodedInstruction[]> {
  const alts = await resolveAlts(connection, msg.addressTableLookups);
  const messageV0 = buildMessageV0(msg);
  const ixs = TransactionMessage.decompile(messageV0, {
    addressLookupTableAccounts: alts,
  }).instructions;
  return toDecodedInstructions(ixs);
}

/** Decodes a base58 transaction message (legacy or v0, lookup tables resolved) for preview. */
export async function decodeEncodedMessage(
  connection: Connection,
  tx: string
): Promise<DecodedInstruction[]> {
  const bytes = bs58.decode(tx);
  if (VersionedMessage.deserializeMessageVersion(bytes) === 'legacy') {
    return toDecodedInstructions(decodeAndDeserialize(tx).message.instructions);
  }
  const message = VersionedMessage.deserialize(bytes);
  const alts = await loadLookupTables(connection, message);
  return toDecodedInstructions(
    TransactionMessage.decompile(message, { addressLookupTableAccounts: alts }).instructions
  );
}

export async function decodeTransaction(
  connection: Connection,
  transactionPda: PublicKey,
  multisigPda: PublicKey,
  programId: PublicKey
): Promise<DecodedTransaction> {
  const accountInfo = await connection.getAccountInfo(transactionPda);
  if (!accountInfo) throw new Error('Transaction account not found');

  const { data } = accountInfo;

  if (matchesDiscriminator(data, multisig.accounts.vaultTransactionDiscriminator)) {
    const [vaultTx] = multisig.accounts.VaultTransaction.fromAccountInfo(accountInfo);
    const instructions = await decodeMessage(connection, vaultTx.message);
    return { kind: 'vault', instructions };
  }

  if (matchesDiscriminator(data, multisig.accounts.configTransactionDiscriminator)) {
    const [configTx] = multisig.accounts.ConfigTransaction.fromAccountInfo(accountInfo);
    return { kind: 'config', actions: configTx.actions };
  }

  if (matchesDiscriminator(data, multisig.accounts.batchDiscriminator)) {
    const [batch] = multisig.accounts.Batch.fromAccountInfo(accountInfo);
    const batchIndex = BigInt(batch.index.toString());

    // VaultBatchTransaction accounts are indexed 1..size (1-based)
    const batchTxPdas = Array.from({ length: batch.size }, (_, i) =>
      multisig.getBatchTransactionPda({
        multisigPda,
        batchIndex,
        transactionIndex: i + 1,
        programId,
      })[0]
    );

    const batchTxAccounts = await Promise.all(
      batchTxPdas.map((pda) => connection.getAccountInfo(pda))
    );

    const transactions = await Promise.all(
      batchTxAccounts.map(async (info) => {
        if (!info) return [];
        const [batchTx] = multisig.accounts.VaultBatchTransaction.fromAccountInfo(info);
        return decodeMessage(connection, batchTx.message);
      })
    );

    return { kind: 'batch', size: batch.size, transactions };
  }

  throw new Error('Unknown transaction account discriminator');
}

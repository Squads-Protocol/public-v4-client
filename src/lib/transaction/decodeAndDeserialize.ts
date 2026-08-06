'use client';
import * as bs58 from 'bs58';
import {
  AddressLookupTableAccount,
  Connection,
  Message,
  MessageAccountKeys,
  MessageV0,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { loadLookupTables } from './getAccountsForSimulation';

interface DeserializedTransaction {
  message: TransactionMessage;
  version: number | 'legacy';
  accountKeys: PublicKey[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
}

/**
 * Decodes a base58 encoded transaction and deserializes it into a TransactionMessage
 *
 * A v0 message may reference accounts through address lookup tables. `decompile` cannot resolve
 * those on its own: the tables have to be fetched first, or it throws.
 *
 * @param tx - Base58 encoded transaction string
 * @param connection - Used to fetch any address lookup tables a v0 message references
 * @returns Object containing the deserialized message, version, account keys and resolved tables
 * @throws Error if deserialization fails
 */
export async function decodeAndDeserialize(
  tx: string,
  connection: Connection
): Promise<DeserializedTransaction> {
  if (!tx) {
    throw new Error('Transaction string is required');
  }

  try {
    const messageBytes = bs58.default.decode(tx);
    const version = VersionedMessage.deserializeMessageVersion(messageBytes);
    let message: TransactionMessage;
    let accountKeys: PublicKey[];
    let addressLookupTableAccounts: AddressLookupTableAccount[] = [];

    if (version === 'legacy') {
      const legacyMessage = Message.from(messageBytes);
      accountKeys = legacyMessage.accountKeys;

      const intermediate = VersionedMessage.deserialize(new MessageV0(legacyMessage).serialize());
      message = TransactionMessage.decompile(intermediate, {
        addressLookupTableAccounts: [],
      });
    } else {
      const versionedMessage = VersionedMessage.deserialize(messageBytes);
      accountKeys = versionedMessage.staticAccountKeys;
      addressLookupTableAccounts = await loadLookupTables(connection, versionedMessage);

      message = TransactionMessage.decompile(versionedMessage, {
        addressLookupTableAccounts,
      });
    }

    return {
      version,
      message,
      accountKeys,
      addressLookupTableAccounts,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to decode transaction: ${error.message}`);
    }
    throw new Error('Failed to decode transaction: Unknown error');
  }
}

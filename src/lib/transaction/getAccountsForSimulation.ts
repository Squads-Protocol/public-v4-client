'use client';
import {
  AddressLookupTableAccount,
  Connection,
  SystemProgram,
  VersionedMessage,
  VersionedTransaction,
} from '@solana/web3.js';

export function getAccountsForSimulation(
  tx: VersionedTransaction,
  addressLookupTableAccounts: AddressLookupTableAccount[]
): string[] {
  const { staticAccountKeys, accountKeysFromLookups } = tx.message.getAccountKeys({
    addressLookupTableAccounts,
  });

  const staticAddresses = staticAccountKeys.reduce((acc, k) => {
    if (!k.equals(SystemProgram.programId)) {
      acc.push(k.toString());
    }
    return acc;
  }, [] as string[]);

  const addressesFromLookups = accountKeysFromLookups
    ? accountKeysFromLookups.writable.map((k) => k.toString())
    : [];

  return [...new Set([...staticAddresses, ...addressesFromLookups])];
}

export async function loadLookupTables(
  connection: Connection,
  transactionMessage: VersionedMessage
) {
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  const { addressTableLookups } = transactionMessage;
  if (addressTableLookups.length > 0) {
    for (const addressTableLookup of addressTableLookups) {
      const { value } = await connection.getAddressLookupTable(addressTableLookup.accountKey);
      if (!value) continue;

      addressLookupTableAccounts.push(value);
    }
  }
  return addressLookupTableAccounts;
}

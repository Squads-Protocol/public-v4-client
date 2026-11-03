'use client';
import { toast } from 'sonner';
import { decodeAndDeserialize } from './decodeAndDeserialize';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { getAccountsForSimulation } from './getAccountsForSimulation';

export const simulateEncodedTransaction = async (
  tx: string,
  connection: Connection,
  wallet: WalletContextState
) => {
  if (!wallet.publicKey) {
    throw 'Please connect your wallet.';
  }
  try {
    const { message, addressLookupTableAccounts } = await decodeAndDeserialize(tx, connection);

    // Recompile with the tables the message arrived with, or inlining every address can push the
    // transaction past the packet size limit.
    const transaction = new VersionedTransaction(
      message.compileToV0Message(addressLookupTableAccounts)
    );

    const keys = getAccountsForSimulation(transaction, addressLookupTableAccounts);

    toast.loading('Simulating...', {
      id: 'simulation',
    });
    const { value } = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: 'confirmed',
      accounts: {
        encoding: 'base64',
        addresses: keys,
      },
    });

    if (value.err) {
      throw 'Simulation failed';
    }
  } catch (error: unknown) {
    throw new Error(String(error));
  }
};

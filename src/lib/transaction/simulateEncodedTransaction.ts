'use client';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { type Connection, VersionedTransaction } from '@solana/web3.js';
import { toast } from 'sonner';
import { decodeAndDeserialize } from './decodeAndDeserialize';
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
    const { message, version } = decodeAndDeserialize(tx);

    const transaction = new VersionedTransaction(message.compileToV0Message());

    const keys = await getAccountsForSimulation(connection, transaction, version === 0);

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
      console.error(value.err);
      throw 'Simulation failed';
    }
  } catch (error: any) {
    console.error(error);
    throw new Error(error);
  }
};

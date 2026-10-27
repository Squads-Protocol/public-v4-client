'use client';
import React, { FC, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

import '@solana/wallet-adapter-react-ui/styles.css';

type Props = {
  children?: React.ReactNode;
};

const RPC_URL_STORAGE_KEY = 'x-rpc-url';
const RPC_URL_CHANGED_EVENT = 'x-rpc-url-changed';

/**
 * PC4-3 Fix: The wallet connection must use the same cluster as the rest of the app.
 * Hardcoding Devnet here while `useMultisigData` defaulted to mainnet caused
 * wallet-side sends and reads to hit different networks. 
 * This now dynamically fetches the endpoint based on `x-rpc-url` storage state.
 */
const getEndpoint = (): string => {
  if (typeof window === 'undefined') {
    return clusterApiUrl('mainnet-beta');
  }
  return localStorage.getItem(RPC_URL_STORAGE_KEY) || clusterApiUrl('mainnet-beta');
};

export const Wallet: FC<Props> = ({ children }) => {
  const [endpoint, setEndpoint] = useState<string>(getEndpoint);

  useEffect(() => {
    const updateEndpoint = () => setEndpoint(getEndpoint());
    
    // Listen to custom RPC configuration changes
    window.addEventListener(RPC_URL_CHANGED_EVENT, updateEndpoint);
    window.addEventListener('storage', updateEndpoint);
    
    return () => {
      window.removeEventListener(RPC_URL_CHANGED_EVENT, updateEndpoint);
      window.removeEventListener('storage', updateEndpoint);
    };
  }, []);

  const wallets = React.useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
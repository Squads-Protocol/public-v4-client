import { useWallet } from '@solana/wallet-adapter-react';
import { isMember } from '@/lib/utils';
import { useMultisig } from './useServices';

export const useAccess = () => {
  const { data: multisig } = useMultisig();
  const { publicKey } = useWallet();
  if (!multisig || !publicKey) {
    return false;
  }
  // if the pubkeyKey is in members return true
  const memberExists = isMember(publicKey, multisig.members);
  // return true if found
  return !!memberExists;
};

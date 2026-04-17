import * as multisig from '@sqds/multisig';
import { useMultisig } from './useServices';
import { useWallet } from '@solana/wallet-adapter-react';
import { isMember } from '@/lib/utils';

export const useAccess = () => {
  const { data: multisigData } = useMultisig();
  const { publicKey } = useWallet();
  if (!multisigData || !publicKey) {
    return false;
  }
  const connectedMember = isMember(publicKey, multisigData.members);
  if (!connectedMember) return false;
  return multisig.types.Permissions.has(
    connectedMember.permissions,
    multisig.types.Permission.Initiate
  );
};

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { types as multisigTypes } from '@sqds/multisig';
import { PublicKey } from '@solana/web3.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

export const renderPermissions = (permissionsMask: number) => {
  return (
    Object.entries(multisigTypes.Permission)
      .filter(([_, bit]) => (permissionsMask & bit) === bit) // Check which bits are set
      .map(([key]) => key) // Get the permission names
      .join(', ') || 'None'
  ); // Handle empty case
};

export const isMember = (publicKey: PublicKey, members: multisigTypes.Member[]) => {
  return members.find((v: multisigTypes.Member) => v.key.equals(publicKey));
};

export function formatTransactionError(e: unknown): string {
  if (e instanceof Error) {
    let msg = e.message;
    const raw = (e as any).error;
    if (raw != null) {
      try {
        msg += `: ${typeof raw === 'string' ? raw : JSON.stringify(raw)}`;
      } catch { /* ignore unserializable error details */ }
    }
    return msg;
  }
  return String(e);
}

import type { PublicKey } from '@solana/web3.js';
import { types as multisigTypes } from '@sqds/multisig';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

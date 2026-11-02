import type { PublicKey } from '@solana/web3.js';
import type { DecodedInstruction } from '../decodeTransactionMessage';
import type { AccountRole, DescribedField } from './types';

export const address = (label: string, key: PublicKey | string): DescribedField => ({
  label,
  value: { kind: 'address', value: typeof key === 'string' ? key : key.toBase58() },
});

export const lamports = (label: string, value: bigint): DescribedField => ({
  label,
  value: { kind: 'lamports', value },
});

export const text = (label: string, value: string): DescribedField => ({
  label,
  value: { kind: 'text', value },
});

/** Pairs the instruction's accounts with role names. Extra accounts get a generic name. */
export function nameAccounts(ix: DecodedInstruction, roles: readonly string[]): AccountRole[] {
  return ix.accounts.map((account, i) => ({
    role: roles[i] ?? `Extra account ${i + 1}`,
    address: account.address,
    isSigner: account.isSigner,
    isWritable: account.isWritable,
  }));
}

export const accountAt = (ix: DecodedInstruction, index: number): string | null =>
  ix.accounts[index]?.address ?? null;

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);
const ZERO = BigInt(0);

function splitSol(value: bigint) {
  const abs = value < ZERO ? -value : value;
  return {
    sign: value < ZERO ? '-' : '',
    whole: abs / LAMPORTS_PER_SOL,
    fraction: (abs % LAMPORTS_PER_SOL).toString().padStart(9, '0').replace(/0+$/, ''),
  };
}

export function formatSol(value: bigint): string {
  const { sign, whole, fraction } = splitSol(value);
  return `${sign}${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''} SOL`;
}

/** Plain decimal SOL for an input field, the inverse of `parseSol`. */
export function toSolString(value: bigint): string {
  const { sign, whole, fraction } = splitSol(value);
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

/** Parses a decimal SOL amount without floating point. Returns null for invalid input. */
export function parseSol(input: string): bigint | null {
  const match = /^(\d+)(?:\.(\d{0,9}))?$/.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ''] = match;
  return BigInt(whole) * LAMPORTS_PER_SOL + BigInt(fraction.padEnd(9, '0'));
}

export const formatBps = (bps: number): string => `${(bps / 100).toFixed(2)}% (${bps} bps)`;

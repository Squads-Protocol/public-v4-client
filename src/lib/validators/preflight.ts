import { SystemProgram, type AccountInfo } from '@solana/web3.js';
import {
  estimateStakeStatus,
  isLockupInForce,
  type StakeAccountState,
  type StakeStatus,
} from './accounts';

export type Check = { readonly ok: true } | { readonly ok: false; readonly reason: string };

const pass: Check = { ok: true };
const fail = (reason: string): Check => ({ ok: false, reason });

export const firstFailure = (...checks: readonly Check[]): Check =>
  checks.find((c) => !c.ok) ?? pass;

export function requireAuthority(role: string, actual: string, vault: string): Check {
  return actual === vault
    ? pass
    : fail(`The ${role} is ${actual}, not the selected vault (${vault}).`);
}

/** Lamports above the rent-exempt minimum. Withdrawing more closes the vote account. */
export const voteWithdrawable = (balance: bigint, rentExemptMinimum: bigint): bigint =>
  balance > rentExemptMinimum ? balance - rentExemptMinimum : BigInt(0);

/**
 * The collector must be the vote account, or a system-owned account that exists and is
 * rent-exempt. Any other collector makes the instruction fail.
 */
export function collectorCheck(
  collector: string,
  voteAccount: string,
  info: AccountInfo<Buffer> | null,
  rentExemptMinimum: number
): Check {
  if (collector === voteAccount) return pass;
  if (!info)
    return fail('The collector account does not exist. Fund it first, or use the vote account.');
  if (!info.owner.equals(SystemProgram.programId)) {
    return fail(
      'The collector must be the vote account or an account owned by the System program.'
    );
  }
  if (info.lamports < rentExemptMinimum) {
    return fail('The collector account is not rent-exempt. Add SOL to it first.');
  }
  return pass;
}

export interface StakeContext {
  readonly lamports: bigint;
  readonly state: StakeAccountState;
  readonly currentEpoch: bigint;
  readonly nowUnixSeconds: bigint;
}

/** Inactive accounts can withdraw everything. Others can withdraw only lamports above stake + reserve. */
export function stakeWithdrawable({ lamports, state, currentEpoch }: StakeContext): bigint {
  const status = estimateStakeStatus(state, currentEpoch);
  if (status === 'initialized' || status === 'inactive') return lamports;
  const locked = (state.delegation?.stake ?? BigInt(0)) + state.rentExemptReserve;
  return lamports > locked ? lamports - locked : BigInt(0);
}

export function lockupCheck(
  { state, currentEpoch, nowUnixSeconds }: StakeContext,
  vault: string
): Check {
  if (!isLockupInForce(state.lockup, currentEpoch, nowUnixSeconds)) return pass;
  if (state.lockup.custodian === vault) return pass;
  return fail(
    `The stake account is in lockup until epoch ${state.lockup.epoch} / time ${state.lockup.unixTimestamp}. Only the custodian (${state.lockup.custodian}) can sign before then.`
  );
}

type MergeKind = 'inactive' | 'activating' | 'active' | 'deactivating';

const mergeKind = (status: StakeStatus): MergeKind =>
  status === 'initialized' ? 'inactive' : status;

/** Mirrors the Stake program merge rules, from the estimated status. */
export function mergeCheck(
  destination: StakeAccountState,
  source: StakeAccountState,
  currentEpoch: bigint
): Check {
  if (destination.staker !== source.staker || destination.withdrawer !== source.withdrawer) {
    return fail('Both stake accounts must have the same staker and withdrawer.');
  }
  const sameLockup =
    destination.lockup.epoch === source.lockup.epoch &&
    destination.lockup.unixTimestamp === source.lockup.unixTimestamp &&
    destination.lockup.custodian === source.lockup.custodian;
  if (!sameLockup) return fail('Both stake accounts must have the same lockup.');

  const [d, s] = [destination, source].map((a) => mergeKind(estimateStakeStatus(a, currentEpoch)));
  const sameVote = destination.delegation?.voteAccount === source.delegation?.voteAccount;
  if (d === 'deactivating' || s === 'deactivating') {
    return fail('A deactivating stake account cannot be merged. Wait until it is inactive.');
  }
  if (d === 'inactive' && s === 'inactive') return pass;
  if ((d === 'inactive' && s === 'activating') || (d === 'activating' && s === 'inactive')) {
    return pass;
  }
  if (d === s && sameVote) return pass;
  return fail(
    'The accounts are not compatible: both must be inactive, or both delegated to the same vote account in the same state.'
  );
}

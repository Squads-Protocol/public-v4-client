import { ByteReader } from '../transaction/describe/reader';

const BLS_PUBKEY_SIZE = 48;
const LOCKOUT_SIZE = 12; // slot u64 + confirmation_count u32
const LANDED_VOTE_SIZE = 13; // latency u8 + Lockout
const U64_MAX = BigInt('18446744073709551615');

export type VoteCommission =
  | { readonly kind: 'percent'; readonly percent: number }
  | {
      readonly kind: 'bps';
      readonly inflationRewardsBps: number;
      readonly blockRevenueBps: number;
    };

export interface AuthorizedVoter {
  readonly epoch: bigint;
  readonly pubkey: string;
}

export interface VoteAccountState {
  readonly version: 'V1_14_11' | 'V3' | 'V4';
  readonly nodePubkey: string;
  readonly authorizedWithdrawer: string;
  readonly commission: VoteCommission;
  /** Only V4 accounts store collectors. Earlier versions pay to the vote account itself. */
  readonly inflationRewardsCollector: string | null;
  readonly blockRevenueCollector: string | null;
  /** With BLS key management active, a voter change on such an account needs a BLS proof. */
  readonly hasBlsPubkey: boolean;
  readonly authorizedVoters: readonly AuthorizedVoter[];
}

function skipVotesAndReadVoters(r: ByteReader, voteSize: number): AuthorizedVoter[] {
  r.bytes(Number(r.u64()) * voteSize);
  r.option(() => r.u64()); // root_slot
  const count = Number(r.u64());
  return Array.from({ length: count }, () => ({ epoch: r.u64(), pubkey: r.pubkey().toBase58() }));
}

/** Parses the header and authorized voters of a vote account. Returns null if not parseable. */
export function parseVoteAccount(data: Uint8Array): VoteAccountState | null {
  try {
    const r = new ByteReader(data);
    const tag = r.u32();
    const nodePubkey = r.pubkey().toBase58();
    const authorizedWithdrawer = r.pubkey().toBase58();

    if (tag === 1 || tag === 2) {
      const commission: VoteCommission = { kind: 'percent', percent: r.u8() };
      const voteSize = tag === 1 ? LOCKOUT_SIZE : LANDED_VOTE_SIZE;
      return {
        version: tag === 1 ? 'V1_14_11' : 'V3',
        nodePubkey,
        authorizedWithdrawer,
        commission,
        inflationRewardsCollector: null,
        blockRevenueCollector: null,
        hasBlsPubkey: false,
        authorizedVoters: skipVotesAndReadVoters(r, voteSize),
      };
    }

    if (tag === 3) {
      const inflationRewardsCollector = r.pubkey().toBase58();
      const blockRevenueCollector = r.pubkey().toBase58();
      const commission: VoteCommission = {
        kind: 'bps',
        inflationRewardsBps: r.u16(),
        blockRevenueBps: r.u16(),
      };
      r.u64(); // pending_delegator_rewards
      const hasBlsPubkey = r.option(() => r.bytes(BLS_PUBKEY_SIZE)) !== null;
      return {
        version: 'V4',
        nodePubkey,
        authorizedWithdrawer,
        commission,
        inflationRewardsCollector,
        blockRevenueCollector,
        hasBlsPubkey,
        authorizedVoters: skipVotesAndReadVoters(r, LANDED_VOTE_SIZE),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** The authorized voter for an epoch: the entry with the greatest epoch not after it. */
export function currentAuthorizedVoter(
  voters: readonly AuthorizedVoter[],
  epoch: bigint
): string | null {
  return (
    voters.reduce<AuthorizedVoter | null>(
      (best, v) => (v.epoch <= epoch && (!best || v.epoch > best.epoch) ? v : best),
      null
    )?.pubkey ?? null
  );
}

export interface StakeLockup {
  readonly unixTimestamp: bigint;
  readonly epoch: bigint;
  readonly custodian: string;
}

export interface StakeDelegation {
  readonly voteAccount: string;
  readonly stake: bigint;
  readonly activationEpoch: bigint;
  readonly deactivationEpoch: bigint;
}

export interface StakeAccountState {
  readonly rentExemptReserve: bigint;
  readonly staker: string;
  readonly withdrawer: string;
  readonly lockup: StakeLockup;
  readonly delegation: StakeDelegation | null;
}

/** Parses a StakeStateV2 account (Initialized or Stake). Returns null for other states. */
export function parseStakeAccount(data: Uint8Array): StakeAccountState | null {
  try {
    const r = new ByteReader(data);
    const tag = r.u32();
    if (tag !== 1 && tag !== 2) return null;
    const rentExemptReserve = r.u64();
    const [staker, withdrawer] = [r.pubkey().toBase58(), r.pubkey().toBase58()];
    const lockup = { unixTimestamp: r.i64(), epoch: r.u64(), custodian: r.pubkey().toBase58() };
    const delegation =
      tag === 2
        ? {
            voteAccount: r.pubkey().toBase58(),
            stake: r.u64(),
            activationEpoch: r.u64(),
            deactivationEpoch: r.u64(),
          }
        : null;
    return { rentExemptReserve, staker, withdrawer, lockup, delegation };
  } catch {
    return null;
  }
}

export type StakeStatus = 'initialized' | 'activating' | 'active' | 'deactivating' | 'inactive';

/**
 * Estimates the status from the delegation epochs. Warmup and cooldown can take more than one
 * epoch for large stakes, so "inactive" can be early. The simulation before each proposal is exact.
 */
export function estimateStakeStatus(state: StakeAccountState, currentEpoch: bigint): StakeStatus {
  const d = state.delegation;
  if (!d) return 'initialized';
  if (d.deactivationEpoch !== U64_MAX) {
    return d.deactivationEpoch < currentEpoch ? 'inactive' : 'deactivating';
  }
  return d.activationEpoch >= currentEpoch ? 'activating' : 'active';
}

export function isLockupInForce(
  lockup: StakeLockup,
  currentEpoch: bigint,
  nowUnixSeconds: bigint
): boolean {
  return lockup.epoch > currentEpoch || lockup.unixTimestamp > nowUnixSeconds;
}

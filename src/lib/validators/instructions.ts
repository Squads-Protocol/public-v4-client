import {
  Authorized,
  Lockup,
  PublicKey,
  StakeAuthorizationLayout,
  StakeProgram,
  TransactionInstruction,
  VoteAuthorizationLayout,
  VoteProgram,
} from '@solana/web3.js';

export type VoteAuthorityKind = 'voter' | 'withdrawer';
export type StakeAuthorityKind = 'staker' | 'withdrawer';
export type CommissionKind = 'inflationRewards' | 'blockRevenue';

const COMMISSION_KIND_INDEX: Record<CommissionKind, number> = {
  inflationRewards: 0,
  blockRevenue: 1,
};

const VOTE_TAG = {
  updateCommission: 5,
  updateCommissionCollector: 17,
  updateCommissionBps: 18,
} as const;

/** web3.js builders take `number` lamports. Refuse amounts it cannot represent exactly. */
export function toSafeLamports(lamports: bigint): number {
  if (lamports < BigInt(0) || lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Amount ${lamports} lamports is out of range`);
  }
  return Number(lamports);
}

const isSysvar = (key: PublicKey) => key.toBase58().startsWith('Sysvar');

/**
 * web3.js marks the Clock sysvar writable in `StakeProgram.authorize`. The runtime demotes
 * sysvars to read-only, so the vault's CPI would then ask for a privilege it does not have.
 */
const instructionsOf = (tx: { instructions: TransactionInstruction[] }) =>
  tx.instructions.map(
    (ix) =>
      new TransactionInstruction({
        programId: ix.programId,
        data: ix.data,
        keys: ix.keys.map((k) => (isSysvar(k.pubkey) ? { ...k, isWritable: false } : k)),
      })
  );

// ── Vote program (the vault is the authorized withdrawer) ─────────────────────

export const voteWithdraw = (p: {
  voteAccount: PublicKey;
  withdrawer: PublicKey;
  recipient: PublicKey;
  lamports: bigint;
}): TransactionInstruction[] =>
  instructionsOf(
    VoteProgram.withdraw({
      votePubkey: p.voteAccount,
      authorizedWithdrawerPubkey: p.withdrawer,
      toPubkey: p.recipient,
      lamports: toSafeLamports(p.lamports),
    })
  );

export const voteAuthorize = (p: {
  voteAccount: PublicKey;
  withdrawer: PublicKey;
  newAuthority: PublicKey;
  kind: VoteAuthorityKind;
}): TransactionInstruction[] =>
  instructionsOf(
    VoteProgram.authorize({
      votePubkey: p.voteAccount,
      authorizedPubkey: p.withdrawer,
      newAuthorizedPubkey: p.newAuthority,
      voteAuthorizationType:
        p.kind === 'voter' ? VoteAuthorizationLayout.Voter : VoteAuthorizationLayout.Withdrawer,
    })
  );

const withdrawerKeys = (voteAccount: PublicKey, withdrawer: PublicKey) => [
  { pubkey: voteAccount, isSigner: false, isWritable: true },
  { pubkey: withdrawer, isSigner: true, isWritable: false },
];

export function voteUpdateCommission(p: {
  voteAccount: PublicKey;
  withdrawer: PublicKey;
  commission: number;
}): TransactionInstruction[] {
  if (!Number.isInteger(p.commission) || p.commission < 0 || p.commission > 100) {
    throw new Error('Commission must be a whole number from 0 to 100');
  }
  const data = Buffer.alloc(5);
  data.writeUInt32LE(VOTE_TAG.updateCommission, 0);
  data.writeUInt8(p.commission, 4);
  return [
    new TransactionInstruction({
      programId: VoteProgram.programId,
      keys: withdrawerKeys(p.voteAccount, p.withdrawer),
      data,
    }),
  ];
}

export function voteUpdateCommissionBps(p: {
  voteAccount: PublicKey;
  withdrawer: PublicKey;
  bps: number;
  kind: CommissionKind;
}): TransactionInstruction[] {
  if (!Number.isInteger(p.bps) || p.bps < 0 || p.bps > 10_000) {
    throw new Error('Commission must be a whole number of basis points from 0 to 10000');
  }
  const data = Buffer.alloc(10);
  data.writeUInt32LE(VOTE_TAG.updateCommissionBps, 0);
  data.writeUInt16LE(p.bps, 4);
  data.writeUInt32LE(COMMISSION_KIND_INDEX[p.kind], 6);
  return [
    new TransactionInstruction({
      programId: VoteProgram.programId,
      keys: withdrawerKeys(p.voteAccount, p.withdrawer),
      data,
    }),
  ];
}

/** Data: [17,0,0,0, kind,0,0,0]. Accounts: vote (w), collector (w), withdrawer (s). */
export function voteUpdateCommissionCollector(p: {
  voteAccount: PublicKey;
  withdrawer: PublicKey;
  collector: PublicKey;
  kind: CommissionKind;
}): TransactionInstruction[] {
  const data = Buffer.alloc(8);
  data.writeUInt32LE(VOTE_TAG.updateCommissionCollector, 0);
  data.writeUInt32LE(COMMISSION_KIND_INDEX[p.kind], 4);
  return [
    new TransactionInstruction({
      programId: VoteProgram.programId,
      keys: [
        { pubkey: p.voteAccount, isSigner: false, isWritable: true },
        { pubkey: p.collector, isSigner: false, isWritable: true },
        { pubkey: p.withdrawer, isSigner: true, isWritable: false },
      ],
      data,
    }),
  ];
}

// ── Stake program (the vault is the staker and the withdrawer) ────────────────

/** CreateAccount + Initialize (+ DelegateStake). The new account is funded in one CreateAccount. */
export const stakeCreate = (p: {
  vault: PublicKey;
  stakeAccount: PublicKey;
  lamports: bigint;
  voteAccount: PublicKey | null;
}): TransactionInstruction[] => [
  ...instructionsOf(
    StakeProgram.createAccount({
      fromPubkey: p.vault,
      stakePubkey: p.stakeAccount,
      authorized: new Authorized(p.vault, p.vault),
      lockup: Lockup.default,
      lamports: toSafeLamports(p.lamports),
    })
  ),
  ...(p.voteAccount
    ? stakeDelegate({ stakeAccount: p.stakeAccount, staker: p.vault, voteAccount: p.voteAccount })
    : []),
];

export const stakeDelegate = (p: {
  stakeAccount: PublicKey;
  staker: PublicKey;
  voteAccount: PublicKey;
}): TransactionInstruction[] =>
  instructionsOf(
    StakeProgram.delegate({
      stakePubkey: p.stakeAccount,
      authorizedPubkey: p.staker,
      votePubkey: p.voteAccount,
    })
  );

export const stakeDeactivate = (p: {
  stakeAccount: PublicKey;
  staker: PublicKey;
}): TransactionInstruction[] =>
  instructionsOf(
    StakeProgram.deactivate({ stakePubkey: p.stakeAccount, authorizedPubkey: p.staker })
  );

/** Pass `custodian` only when the lockup is in force and the custodian signs. */
export const stakeWithdraw = (p: {
  stakeAccount: PublicKey;
  withdrawer: PublicKey;
  recipient: PublicKey;
  lamports: bigint;
  custodian?: PublicKey;
}): TransactionInstruction[] =>
  instructionsOf(
    StakeProgram.withdraw({
      stakePubkey: p.stakeAccount,
      authorizedPubkey: p.withdrawer,
      toPubkey: p.recipient,
      lamports: toSafeLamports(p.lamports),
      custodianPubkey: p.custodian,
    })
  );

/** CreateAccount (rent-exempt reserve, paid by the staker) + Split. */
export const stakeSplit = (p: {
  stakeAccount: PublicKey;
  staker: PublicKey;
  newStakeAccount: PublicKey;
  lamports: bigint;
  rentExemptReserve: number;
}): TransactionInstruction[] =>
  instructionsOf(
    StakeProgram.split(
      {
        stakePubkey: p.stakeAccount,
        authorizedPubkey: p.staker,
        splitStakePubkey: p.newStakeAccount,
        lamports: toSafeLamports(p.lamports),
      },
      p.rentExemptReserve
    )
  );

export const stakeMerge = (p: {
  destination: PublicKey;
  source: PublicKey;
  staker: PublicKey;
}): TransactionInstruction[] =>
  instructionsOf(
    StakeProgram.merge({
      stakePubkey: p.destination,
      sourceStakePubKey: p.source,
      authorizedPubkey: p.staker,
    })
  );

export const stakeAuthorize = (p: {
  stakeAccount: PublicKey;
  authority: PublicKey;
  newAuthority: PublicKey;
  kind: StakeAuthorityKind;
  custodian?: PublicKey;
}): TransactionInstruction[] =>
  instructionsOf(
    StakeProgram.authorize({
      stakePubkey: p.stakeAccount,
      authorizedPubkey: p.authority,
      newAuthorizedPubkey: p.newAuthority,
      stakeAuthorizationType:
        p.kind === 'staker' ? StakeAuthorizationLayout.Staker : StakeAuthorizationLayout.Withdrawer,
      custodianPubkey: p.custodian,
    })
  );

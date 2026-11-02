import { Connection, PublicKey } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import type { DecodedInstruction } from '../decodeTransactionMessage';
import { formatSol } from './fields';
import {
  BPF_UPGRADEABLE_LOADER_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  MEMO_PROGRAM_IDS,
  decodeComputeBudgetInstruction,
  decodeLoaderInstruction,
  decodeMemoInstruction,
} from './misc';
import { STAKE_PROGRAM_ID, decodeStakeInstruction } from './stake';
import { SYSTEM_PROGRAM_ID, decodeSystemInstruction } from './system';
import { VOTE_PROGRAM_ID, decodeVoteInstruction } from './vote';
import type {
  AuthorityChange,
  ControlRole,
  DecodedCall,
  DescribeContext,
  InstructionDescription,
  InstructionWarning,
  LoaderAccountKind,
  ProgramDecoder,
  WarningSeverity,
} from './types';

export type * from './types';
export { formatSol, parseSol, toSolString, formatBps } from './fields';

const DECODERS: ReadonlyMap<string, ProgramDecoder> = new Map([
  [VOTE_PROGRAM_ID, decodeVoteInstruction],
  [STAKE_PROGRAM_ID, decodeStakeInstruction],
  [SYSTEM_PROGRAM_ID, decodeSystemInstruction],
  [BPF_UPGRADEABLE_LOADER_ID, decodeLoaderInstruction],
  [COMPUTE_BUDGET_PROGRAM_ID, decodeComputeBudgetInstruction],
  ...MEMO_PROGRAM_IDS.map((id) => [id, decodeMemoInstruction] as const),
]);

export const KNOWN_ADDRESS_NAMES: ReadonlyMap<string, string> = new Map([
  [VOTE_PROGRAM_ID, 'Vote Program'],
  [STAKE_PROGRAM_ID, 'Stake Program'],
  [SYSTEM_PROGRAM_ID, 'System Program'],
  [BPF_UPGRADEABLE_LOADER_ID, 'BPF Upgradeable Loader'],
  [COMPUTE_BUDGET_PROGRAM_ID, 'Compute Budget Program'],
  ...MEMO_PROGRAM_IDS.map((id) => [id, 'Memo Program'] as const),
  ['SysvarC1ock11111111111111111111111111111111', 'Clock sysvar'],
  ['SysvarRent111111111111111111111111111111111', 'Rent sysvar'],
  ['SysvarStakeHistory1111111111111111111111111', 'Stake history sysvar'],
  ['SysvarS1otHashes111111111111111111111111111', 'Slot hashes sysvar'],
  ['SysvarRecentB1ockHashes11111111111111111111', 'Recent blockhashes sysvar'],
  ['StakeConfig11111111111111111111111111111111', 'Stake config (unused)'],
]);

const ROLE_LABELS: Record<ControlRole, string> = {
  'vote-withdrawer': 'authorized withdrawer (Vote program role)',
  'stake-staker': 'staker (Stake program role)',
  'stake-withdrawer': 'withdrawer (Stake program role)',
  'vote-commission-collector': 'commission collector (Vote program role)',
  'program-upgrade-authority': 'program upgrade authority',
};

const LOADER_LABELS: Record<LoaderAccountKind | 'unknown', string> = {
  'program-data': 'program upgrade authority',
  buffer: 'buffer authority',
  unknown: 'upgrade authority (program data) or buffer authority',
};

/** A buffer authority does not control a deployed program, so moving it is a caution only. */
function roleOf(
  change: AuthorityChange,
  ctx: DescribeContext
): { label: string; severity: WarningSeverity } {
  if (change.role !== 'program-upgrade-authority') {
    return { label: ROLE_LABELS[change.role], severity: 'danger' };
  }
  const kind = ctx.loaderAccountKinds.get(change.account) ?? 'unknown';
  return { label: LOADER_LABELS[kind], severity: kind === 'buffer' ? 'caution' : 'danger' };
}

function authorityWarnings(
  changes: readonly AuthorityChange[],
  ctx: DescribeContext
): InstructionWarning[] {
  return changes.flatMap((change): InstructionWarning[] => {
    const { label, severity } = roleOf(change, ctx);
    if (change.newAuthority === null) {
      return [
        {
          severity,
          message: `Removes the ${label} of ${change.account}. No one can change it after this.`,
        },
      ];
    }
    const vaultIndex = ctx.vaultIndexByAddress.get(change.newAuthority);
    if (vaultIndex !== undefined) return [];
    return [
      {
        severity,
        message: `Moves the ${label} of ${change.account} away from the vaults of this multisig, to ${change.newAuthority}.`,
      },
    ];
  });
}

/** Compares the sum of all withdrawals from the vote account in this proposal with its balance. */
function voteCloseWarnings(decoded: DecodedCall, ctx: DescribeContext): InstructionWarning[] {
  const withdrawal = decoded.voteWithdrawal;
  if (!withdrawal) return [];
  const balance = ctx.accountLamports.get(withdrawal.voteAccount);
  const total = ctx.voteWithdrawalTotals.get(withdrawal.voteAccount) ?? withdrawal.lamports;
  if (balance === undefined || total < balance) return [];
  return [
    {
      severity: 'danger',
      message:
        total > withdrawal.lamports
          ? `The withdrawals from this vote account in this proposal total ${formatSol(total)}, the full balance (${formatSol(balance)}). Together they close the vote account.`
          : `Withdraws the full balance (${formatSol(balance)}). This closes the vote account.`,
    },
  ];
}

function takeoverWarnings(decoded: DecodedCall, ctx: DescribeContext): InstructionWarning[] {
  const takeover = decoded.accountTakeover;
  if (!takeover) return [];
  const vaultIndex = ctx.vaultIndexByAddress.get(takeover.account);
  if (vaultIndex === undefined) return [];
  const vault = `vault ${vaultIndex} (${takeover.account})`;
  return [
    {
      severity: 'danger',
      message: takeover.newOwner
        ? `Gives ownership of ${vault} to program ${takeover.newOwner}. That program then controls the SOL of the vault, and the System program can no longer transfer it.`
        : `Puts data in ${vault}. The System program can no longer transfer the SOL of the vault.`,
    },
  ];
}

export function describeInstruction(
  ix: DecodedInstruction,
  ctx: DescribeContext
): InstructionDescription {
  const decoder = DECODERS.get(ix.programId);
  const decoded = decoder ? decoder(ix) : null;
  if (!decoded) {
    return { kind: 'unknown', program: KNOWN_ADDRESS_NAMES.get(ix.programId) ?? null };
  }
  return {
    kind: 'known',
    ...decoded,
    warnings: [
      ...authorityWarnings(decoded.authorityChanges ?? [], ctx),
      ...voteCloseWarnings(decoded, ctx),
      ...takeoverWarnings(decoded, ctx),
      ...(decoded.notes ?? []),
    ],
  };
}

export function hasDangerWarning(
  instructions: readonly DecodedInstruction[],
  ctx: DescribeContext
): boolean {
  return instructions.some((ix) => {
    const d = describeInstruction(ix, ctx);
    return d.kind === 'known' && d.warnings.some((w) => w.severity === 'danger');
  });
}

const MAX_VAULT_INDEX = 255;
const vaultMapCache = new Map<string, ReadonlyMap<string, number>>();

/** Every vault PDA (index 0-255) of a multisig. Cached: deriving 256 PDAs costs some milliseconds. */
export function getVaultIndexByAddress(
  multisigPda: PublicKey,
  programId: PublicKey
): ReadonlyMap<string, number> {
  const key = `${programId.toBase58()}:${multisigPda.toBase58()}`;
  const cached = vaultMapCache.get(key);
  if (cached) return cached;
  const map = new Map(
    Array.from({ length: MAX_VAULT_INDEX + 1 }, (_, index) => [
      multisig.getVaultPda({ multisigPda, index, programId })[0].toBase58(),
      index,
    ])
  );
  vaultMapCache.set(key, map);
  return map;
}

/** A context without RPC data, for descriptions built before any proposal exists. */
export const staticDescribeContext = (
  vaultIndexByAddress: ReadonlyMap<string, number>
): DescribeContext => ({
  vaultIndexByAddress,
  accountLamports: new Map(),
  voteWithdrawalTotals: new Map(),
  loaderAccountKinds: new Map(),
});

const LOADER_SET_AUTHORITY_TAGS: ReadonlySet<number> = new Set([4, 7]);
const LOADER_STATE_TAGS: ReadonlyMap<number, LoaderAccountKind> = new Map([
  [1, 'buffer'],
  [3, 'program-data'],
]);

const u32At = (data: Uint8Array, offset: number): number | null =>
  data.length >= offset + 4
    ? new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true)
    : null;

function sumVoteWithdrawals(instructions: readonly DecodedInstruction[]): Map<string, bigint> {
  return instructions
    .filter((ix) => ix.programId === VOTE_PROGRAM_ID)
    .map((ix) => decodeVoteInstruction(ix)?.voteWithdrawal)
    .reduce((totals, w) => {
      if (!w) return totals;
      return new Map(totals).set(
        w.voteAccount,
        (totals.get(w.voteAccount) ?? BigInt(0)) + w.lamports
      );
    }, new Map<string, bigint>());
}

const loaderSetAuthorityTargets = (instructions: readonly DecodedInstruction[]): string[] =>
  instructions
    .filter(
      (ix) =>
        ix.programId === BPF_UPGRADEABLE_LOADER_ID &&
        LOADER_SET_AUTHORITY_TAGS.has(u32At(ix.data, 0) ?? -1)
    )
    .map((ix) => ix.accounts[0]?.address)
    .filter((account): account is string => !!account);

/**
 * Builds the context: vault PDAs, the balance of each vote account that a Withdraw reads, the
 * withdrawal totals, and the kind of each loader account that a Set Authority changes.
 * An RPC failure leaves the balances and kinds unknown; the descriptions then stay conservative.
 */
export async function loadDescribeContext(
  connection: Connection,
  multisigPda: PublicKey,
  programId: PublicKey,
  instructions: readonly DecodedInstruction[]
): Promise<DescribeContext> {
  const voteWithdrawalTotals = sumVoteWithdrawals(instructions);
  const voteAccounts = [...voteWithdrawalTotals.keys()];
  const loaderAccounts = loaderSetAuthorityTargets(instructions);
  const addresses = [...new Set([...voteAccounts, ...loaderAccounts])];
  const infos =
    addresses.length > 0
      ? await connection
          .getMultipleAccountsInfo(addresses.map((a) => new PublicKey(a)))
          .catch(() => [])
      : [];
  const infoOf = new Map(addresses.map((address, i) => [address, infos[i] ?? null]));

  const accountLamports = new Map(
    voteAccounts.flatMap((account) => {
      const info = infoOf.get(account);
      return info ? [[account, BigInt(info.lamports)] as const] : [];
    })
  );
  const loaderAccountKinds = new Map(
    loaderAccounts.flatMap((account) => {
      const info = infoOf.get(account);
      if (!info || info.owner.toBase58() !== BPF_UPGRADEABLE_LOADER_ID) return [];
      const kind = LOADER_STATE_TAGS.get(u32At(info.data, 0) ?? -1);
      return kind ? [[account, kind] as const] : [];
    })
  );
  return {
    vaultIndexByAddress: getVaultIndexByAddress(multisigPda, programId),
    accountLamports,
    voteWithdrawalTotals,
    loaderAccountKinds,
  };
}

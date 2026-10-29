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
  ProgramDecoder,
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
  'program-upgrade-authority': 'program upgrade authority',
};

function authorityWarnings(
  changes: readonly AuthorityChange[],
  ctx: DescribeContext
): InstructionWarning[] {
  return changes.flatMap((change): InstructionWarning[] => {
    const label = ROLE_LABELS[change.role];
    if (change.newAuthority === null) {
      return [
        {
          severity: 'danger',
          message: `Removes the ${label} of ${change.account}. No one can change it after this.`,
        },
      ];
    }
    const vaultIndex = ctx.vaultIndexByAddress.get(change.newAuthority);
    if (vaultIndex !== undefined) return [];
    return [
      {
        severity: 'danger',
        message: `Moves the ${label} of ${change.account} away from the vaults of this multisig, to ${change.newAuthority}.`,
      },
    ];
  });
}

function voteCloseWarnings(decoded: DecodedCall, ctx: DescribeContext): InstructionWarning[] {
  const withdrawal = decoded.voteWithdrawal;
  if (!withdrawal) return [];
  const balance = ctx.accountLamports.get(withdrawal.voteAccount);
  if (balance === undefined || withdrawal.lamports < balance) return [];
  return [
    {
      severity: 'danger',
      message: `Withdraws the full balance (${formatSol(balance)}). This closes the vote account.`,
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

/** Builds the context: vault PDAs, plus the balance of each vote account that a Withdraw reads. */
export async function loadDescribeContext(
  connection: Connection,
  multisigPda: PublicKey,
  programId: PublicKey,
  instructions: readonly DecodedInstruction[]
): Promise<DescribeContext> {
  const voteAccounts = [
    ...new Set(
      instructions
        .filter((ix) => ix.programId === VOTE_PROGRAM_ID)
        .map((ix) => decodeVoteInstruction(ix)?.voteWithdrawal?.voteAccount)
        .filter((account): account is string => !!account)
    ),
  ];
  const infos =
    voteAccounts.length > 0
      ? await connection
          .getMultipleAccountsInfo(voteAccounts.map((a) => new PublicKey(a)))
          .catch(() => [])
      : [];
  const accountLamports = new Map(
    voteAccounts.flatMap((account, i) => {
      const info = infos[i];
      return info ? [[account, BigInt(info.lamports)] as const] : [];
    })
  );
  return { vaultIndexByAddress: getVaultIndexByAddress(multisigPda, programId), accountLamports };
}

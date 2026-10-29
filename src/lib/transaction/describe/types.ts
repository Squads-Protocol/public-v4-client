import type { DecodedInstruction } from '../decodeTransactionMessage';

export type FieldValue =
  | { readonly kind: 'address'; readonly value: string }
  | { readonly kind: 'lamports'; readonly value: bigint }
  | { readonly kind: 'text'; readonly value: string };

export interface DescribedField {
  readonly label: string;
  readonly value: FieldValue;
}

export interface AccountRole {
  readonly role: string;
  readonly address: string;
  readonly isSigner: boolean;
  readonly isWritable: boolean;
}

export type WarningSeverity = 'danger' | 'caution';

export interface InstructionWarning {
  readonly severity: WarningSeverity;
  readonly message: string;
}

/** An authority that controls funds or delegation. Changing it away from a vault is dangerous. */
export type ControlRole =
  | 'vote-withdrawer'
  | 'stake-staker'
  | 'stake-withdrawer'
  | 'program-upgrade-authority';

export interface AuthorityChange {
  readonly role: ControlRole;
  readonly account: string;
  /** null means the authority is removed (for example, a program becomes immutable). */
  readonly newAuthority: string | null;
}

export interface VoteWithdrawal {
  readonly voteAccount: string;
  readonly lamports: bigint;
}

/** What a program decoder knows from the instruction bytes alone. */
export interface DecodedCall {
  readonly program: string;
  readonly name: string;
  readonly fields: readonly DescribedField[];
  readonly accounts: readonly AccountRole[];
  readonly authorityChanges?: readonly AuthorityChange[];
  readonly voteWithdrawal?: VoteWithdrawal;
  readonly notes?: readonly InstructionWarning[];
}

/** Returns null when the tag is unknown or the data is malformed. */
export type ProgramDecoder = (ix: DecodedInstruction) => DecodedCall | null;

export interface DescribeContext {
  /** Vault PDA (base58) -> vault index, for every vault of the active multisig. */
  readonly vaultIndexByAddress: ReadonlyMap<string, number>;
  /** Known account balances (base58 -> lamports), used to detect a vote account close. */
  readonly accountLamports: ReadonlyMap<string, bigint>;
}

export type InstructionDescription =
  | ({ readonly kind: 'known'; readonly warnings: readonly InstructionWarning[] } & DecodedCall)
  | { readonly kind: 'unknown'; readonly program: string | null };

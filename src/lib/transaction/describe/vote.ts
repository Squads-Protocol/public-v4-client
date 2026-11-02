import type { DecodedInstruction } from '../decodeTransactionMessage';
import { ByteReader } from './reader';
import { accountAt, address, formatBps, lamports, nameAccounts, text } from './fields';
import type { AuthorityChange, DecodedCall, DescribedField, ProgramDecoder } from './types';

export const VOTE_PROGRAM_ID = 'Vote111111111111111111111111111111111111111';

const PROGRAM = 'Vote Program';
const BLS_PUBKEY_SIZE = 48;
const BLS_PROOF_OF_POSSESSION_SIZE = 96;

export const COMMISSION_KINDS = ['Inflation rewards', 'Block revenue'] as const;

type VoteAuthorize = { readonly label: string; readonly isWithdrawer: boolean };

function readVoteAuthorize(r: ByteReader): VoteAuthorize {
  const tag = r.u32();
  if (tag === 0) return { label: 'Authorized voter', isWithdrawer: false };
  if (tag === 1) return { label: 'Authorized withdrawer', isWithdrawer: true };
  if (tag === 2) {
    r.bytes(BLS_PUBKEY_SIZE + BLS_PROOF_OF_POSSESSION_SIZE);
    return { label: 'Authorized voter (with BLS key)', isWithdrawer: false };
  }
  throw new Error(`unknown VoteAuthorize ${tag}`);
}

function readCommissionKind(r: ByteReader): string {
  const kind = COMMISSION_KINDS[r.u32()];
  if (!kind) throw new Error('unknown CommissionKind');
  return kind;
}

const withdrawerChange = (
  authority: VoteAuthorize,
  voteAccount: string | null,
  newAuthority: string | null
): AuthorityChange[] =>
  authority.isWithdrawer && voteAccount && newAuthority
    ? [{ role: 'vote-withdrawer', account: voteAccount, newAuthority }]
    : [];

const call = (
  ix: DecodedInstruction,
  name: string,
  roles: readonly string[],
  fields: readonly DescribedField[] = [],
  extra: Partial<DecodedCall> = {}
): DecodedCall => ({ program: PROGRAM, name, fields, accounts: nameAccounts(ix, roles), ...extra });

const CONSENSUS_ROLES = ['Vote account', 'Vote authority'] as const;
const LEGACY_VOTE_ROLES = ['Vote account', 'Slot hashes sysvar', 'Clock sysvar', 'Vote authority'];

const decoders: Record<number, (ix: DecodedInstruction, r: ByteReader) => DecodedCall> = {
  0: (ix, r) => {
    const [node, voter, withdrawer] = [r.pubkey(), r.pubkey(), r.pubkey()];
    return call(
      ix,
      'Initialize Vote Account',
      ['Vote account', 'Rent sysvar', 'Clock sysvar', 'Validator identity'],
      [
        address('Validator identity', node),
        address('Authorized voter', voter),
        address('Authorized withdrawer', withdrawer),
        text('Commission', `${r.u8()}%`),
      ]
    );
  },
  1: (ix, r) => {
    const newAuthority = r.pubkey().toBase58();
    const authority = readVoteAuthorize(r);
    return call(
      ix,
      'Authorize',
      ['Vote account', 'Clock sysvar', 'Current authority'],
      [text('Authority type', authority.label), address('New authority', newAuthority)],
      { authorityChanges: withdrawerChange(authority, accountAt(ix, 0), newAuthority) }
    );
  },
  2: (ix) => call(ix, 'Vote', LEGACY_VOTE_ROLES),
  3: (ix, r) => {
    const amount = r.u64();
    const voteAccount = accountAt(ix, 0);
    return call(
      ix,
      'Withdraw',
      ['Vote account', 'Recipient', 'Withdraw authority'],
      [lamports('Amount', amount)],
      voteAccount ? { voteWithdrawal: { voteAccount, lamports: amount } } : {}
    );
  },
  4: (ix) => {
    const newIdentity = accountAt(ix, 1);
    return call(
      ix,
      'Update Validator Identity',
      ['Vote account', 'New validator identity', 'Withdraw authority'],
      newIdentity ? [address('New validator identity', newIdentity)] : [],
      {
        notes: [
          {
            severity: 'caution',
            message: 'The new validator identity must also sign when this proposal is executed.',
          },
        ],
      }
    );
  },
  5: (ix, r) =>
    call(
      ix,
      'Update Commission',
      ['Vote account', 'Withdraw authority'],
      [text('New commission', `${r.u8()}%`)]
    ),
  6: (ix) => call(ix, 'Vote Switch', LEGACY_VOTE_ROLES),
  7: (ix, r) => {
    const authority = readVoteAuthorize(r);
    const newAuthority = accountAt(ix, 3);
    return call(
      ix,
      'Authorize Checked',
      ['Vote account', 'Clock sysvar', 'Current authority', 'New authority'],
      [
        text('Authority type', authority.label),
        ...(newAuthority ? [address('New authority', newAuthority)] : []),
      ],
      { authorityChanges: withdrawerChange(authority, accountAt(ix, 0), newAuthority) }
    );
  },
  8: (ix) => call(ix, 'Update Vote State', CONSENSUS_ROLES),
  9: (ix) => call(ix, 'Update Vote State Switch', CONSENSUS_ROLES),
  10: (ix, r) => {
    const authority = readVoteAuthorize(r);
    const owner = r.pubkey();
    const seed = r.string();
    const newAuthority = r.pubkey().toBase58();
    return call(
      ix,
      'Authorize With Seed',
      ['Vote account', 'Clock sysvar', 'Base key of current authority'],
      [
        text('Authority type', authority.label),
        address('New authority', newAuthority),
        address('Current authority seed owner', owner),
        text('Current authority seed', seed),
      ],
      { authorityChanges: withdrawerChange(authority, accountAt(ix, 0), newAuthority) }
    );
  },
  11: (ix, r) => {
    const authority = readVoteAuthorize(r);
    const owner = r.pubkey();
    const seed = r.string();
    const newAuthority = accountAt(ix, 3);
    return call(
      ix,
      'Authorize Checked With Seed',
      ['Vote account', 'Clock sysvar', 'Base key of current authority', 'New authority'],
      [
        text('Authority type', authority.label),
        ...(newAuthority ? [address('New authority', newAuthority)] : []),
        address('Current authority seed owner', owner),
        text('Current authority seed', seed),
      ],
      { authorityChanges: withdrawerChange(authority, accountAt(ix, 0), newAuthority) }
    );
  },
  12: (ix) => call(ix, 'Compact Update Vote State', CONSENSUS_ROLES),
  13: (ix) => call(ix, 'Compact Update Vote State Switch', CONSENSUS_ROLES),
  14: (ix) => call(ix, 'Tower Sync', CONSENSUS_ROLES),
  15: (ix) => call(ix, 'Tower Sync Switch', CONSENSUS_ROLES),
  16: (ix, r) => {
    const [node, voter] = [r.pubkey(), r.pubkey()];
    r.bytes(BLS_PUBKEY_SIZE + BLS_PROOF_OF_POSSESSION_SIZE);
    const withdrawer = r.pubkey();
    const [inflationBps, blockBps] = [r.u16(), r.u16()];
    return call(
      ix,
      'Initialize Vote Account V2',
      [
        'Vote account',
        'Validator identity',
        'Inflation rewards collector',
        'Block revenue collector',
      ],
      [
        address('Validator identity', node),
        address('Authorized voter', voter),
        address('Authorized withdrawer', withdrawer),
        text('Inflation rewards commission', formatBps(inflationBps)),
        text('Block revenue commission', formatBps(blockBps)),
      ]
    );
  },
  17: (ix, r) => {
    const kind = readCommissionKind(r);
    const [voteAccount, collector] = [accountAt(ix, 0), accountAt(ix, 1)];
    // A collector that is the vote account keeps the commission under the withdrawer's control.
    const redirects = !!voteAccount && !!collector && collector !== voteAccount;
    return call(
      ix,
      `Update ${kind} Collector`,
      ['Vote account', 'New collector', 'Withdraw authority'],
      [text('Commission kind', kind), ...(collector ? [address('New collector', collector)] : [])],
      redirects
        ? {
            authorityChanges: [
              { role: 'vote-commission-collector', account: voteAccount, newAuthority: collector },
            ],
          }
        : {}
    );
  },
  18: (ix, r) => {
    const bps = r.u16();
    const kind = readCommissionKind(r);
    return call(
      ix,
      'Update Commission (bps)',
      ['Vote account', 'Withdraw authority'],
      [text('Commission kind', kind), text('New commission', formatBps(bps))]
    );
  },
  19: (ix, r) =>
    call(
      ix,
      'Deposit Delegator Rewards',
      ['Vote account', 'Source account'],
      [lamports('Deposit', r.u64())]
    ),
};

export const decodeVoteInstruction: ProgramDecoder = (ix) => {
  try {
    const r = new ByteReader(ix.data);
    const decode = decoders[r.u32()];
    return decode ? decode(ix, r) : null;
  } catch {
    return null;
  }
};

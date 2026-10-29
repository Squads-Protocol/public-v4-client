import type { DecodedInstruction } from '../decodeTransactionMessage';
import { ByteReader } from './reader';
import { accountAt, address, lamports, nameAccounts, text } from './fields';
import type { AuthorityChange, DecodedCall, DescribedField, ProgramDecoder } from './types';

export const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';

const PROGRAM = 'Stake Program';

type StakeAuthorize = { readonly label: string; readonly role: AuthorityChange['role'] };

function readStakeAuthorize(r: ByteReader): StakeAuthorize {
  const tag = r.u32();
  if (tag === 0) return { label: 'Staker', role: 'stake-staker' };
  if (tag === 1) return { label: 'Withdrawer', role: 'stake-withdrawer' };
  throw new Error(`unknown StakeAuthorize ${tag}`);
}

const authorityChange = (
  authority: StakeAuthorize,
  stakeAccount: string | null,
  newAuthority: string | null
): AuthorityChange[] =>
  stakeAccount && newAuthority
    ? [{ role: authority.role, account: stakeAccount, newAuthority }]
    : [];

function formatTimestamp(seconds: bigint): string {
  if (seconds === BigInt(0)) return 'None';
  const date = new Date(Number(seconds) * 1000);
  return Number.isNaN(date.getTime()) ? seconds.toString() : date.toISOString();
}

function lockupFields(
  unixTimestamp: bigint | null,
  epoch: bigint | null,
  custodian: string | null
): DescribedField[] {
  return [
    ...(unixTimestamp !== null
      ? [text('Lockup until (time)', formatTimestamp(unixTimestamp))]
      : []),
    ...(epoch !== null ? [text('Lockup until (epoch)', epoch.toString())] : []),
    ...(custodian !== null ? [address('Lockup custodian', custodian)] : []),
  ];
}

const LOCKUP_NOTE = {
  severity: 'caution',
  message: 'Changes the lockup. A lockup can block withdrawals until it ends.',
} as const;

const call = (
  ix: DecodedInstruction,
  name: string,
  roles: readonly string[],
  fields: readonly DescribedField[] = [],
  extra: Partial<DecodedCall> = {}
): DecodedCall => ({ program: PROGRAM, name, fields, accounts: nameAccounts(ix, roles), ...extra });

const decoders: Record<number, (ix: DecodedInstruction, r: ByteReader) => DecodedCall> = {
  0: (ix, r) => {
    const [staker, withdrawer] = [r.pubkey(), r.pubkey()];
    const [unixTimestamp, epoch, custodian] = [r.i64(), r.u64(), r.pubkey()];
    const hasLockup = unixTimestamp !== BigInt(0) || epoch !== BigInt(0);
    return call(
      ix,
      'Initialize',
      ['Stake account', 'Rent sysvar'],
      [
        address('Staker', staker),
        address('Withdrawer', withdrawer),
        ...(hasLockup ? lockupFields(unixTimestamp, epoch, custodian.toBase58()) : []),
      ]
    );
  },
  1: (ix, r) => {
    const newAuthority = r.pubkey().toBase58();
    const authority = readStakeAuthorize(r);
    return call(
      ix,
      'Authorize',
      ['Stake account', 'Clock sysvar', 'Current authority', 'Lockup custodian'],
      [text('Authority type', authority.label), address('New authority', newAuthority)],
      { authorityChanges: authorityChange(authority, accountAt(ix, 0), newAuthority) }
    );
  },
  2: (ix) => {
    const voteAccount = accountAt(ix, 1);
    return call(
      ix,
      'Delegate Stake',
      [
        'Stake account',
        'Vote account',
        'Clock sysvar',
        'Stake history sysvar',
        'Stake config (unused)',
        'Stake authority',
      ],
      voteAccount ? [address('Delegate to vote account', voteAccount)] : []
    );
  },
  3: (ix, r) =>
    call(
      ix,
      'Split',
      ['Source stake account', 'New stake account', 'Stake authority'],
      [lamports('Amount', r.u64())]
    ),
  4: (ix, r) =>
    call(
      ix,
      'Withdraw',
      [
        'Stake account',
        'Recipient',
        'Clock sysvar',
        'Stake history sysvar',
        'Withdraw authority',
        'Lockup custodian',
      ],
      [lamports('Amount', r.u64())]
    ),
  5: (ix) => call(ix, 'Deactivate', ['Stake account', 'Clock sysvar', 'Stake authority']),
  6: (ix, r) => {
    const unixTimestamp = r.option(() => r.i64());
    const epoch = r.option(() => r.u64());
    const custodian = r.option(() => r.pubkey().toBase58());
    return call(
      ix,
      'Set Lockup',
      ['Stake account', 'Lockup or withdraw authority'],
      lockupFields(unixTimestamp, epoch, custodian),
      { notes: [LOCKUP_NOTE] }
    );
  },
  7: (ix) => {
    const source = accountAt(ix, 1);
    return call(
      ix,
      'Merge',
      [
        'Destination stake account',
        'Source stake account (closed)',
        'Clock sysvar',
        'Stake history sysvar',
        'Stake authority',
      ],
      source ? [address('Merge from', source)] : []
    );
  },
  8: (ix, r) => {
    const newAuthority = r.pubkey().toBase58();
    const authority = readStakeAuthorize(r);
    const seed = r.string();
    const owner = r.pubkey();
    return call(
      ix,
      'Authorize With Seed',
      ['Stake account', 'Base key of current authority', 'Clock sysvar', 'Lockup custodian'],
      [
        text('Authority type', authority.label),
        address('New authority', newAuthority),
        address('Current authority seed owner', owner),
        text('Current authority seed', seed),
      ],
      { authorityChanges: authorityChange(authority, accountAt(ix, 0), newAuthority) }
    );
  },
  9: (ix) => {
    const [staker, withdrawer] = [accountAt(ix, 2), accountAt(ix, 3)];
    return call(
      ix,
      'Initialize Checked',
      ['Stake account', 'Rent sysvar', 'Staker', 'Withdrawer'],
      [
        ...(staker ? [address('Staker', staker)] : []),
        ...(withdrawer ? [address('Withdrawer', withdrawer)] : []),
      ]
    );
  },
  10: (ix, r) => {
    const authority = readStakeAuthorize(r);
    const newAuthority = accountAt(ix, 3);
    return call(
      ix,
      'Authorize Checked',
      ['Stake account', 'Clock sysvar', 'Current authority', 'New authority', 'Lockup custodian'],
      [
        text('Authority type', authority.label),
        ...(newAuthority ? [address('New authority', newAuthority)] : []),
      ],
      { authorityChanges: authorityChange(authority, accountAt(ix, 0), newAuthority) }
    );
  },
  11: (ix, r) => {
    const authority = readStakeAuthorize(r);
    const seed = r.string();
    const owner = r.pubkey();
    const newAuthority = accountAt(ix, 3);
    return call(
      ix,
      'Authorize Checked With Seed',
      [
        'Stake account',
        'Base key of current authority',
        'Clock sysvar',
        'New authority',
        'Lockup custodian',
      ],
      [
        text('Authority type', authority.label),
        ...(newAuthority ? [address('New authority', newAuthority)] : []),
        address('Current authority seed owner', owner),
        text('Current authority seed', seed),
      ],
      { authorityChanges: authorityChange(authority, accountAt(ix, 0), newAuthority) }
    );
  },
  12: (ix, r) => {
    const unixTimestamp = r.option(() => r.i64());
    const epoch = r.option(() => r.u64());
    return call(
      ix,
      'Set Lockup Checked',
      ['Stake account', 'Lockup or withdraw authority', 'New lockup custodian'],
      lockupFields(unixTimestamp, epoch, accountAt(ix, 2)),
      { notes: [LOCKUP_NOTE] }
    );
  },
  13: (ix) => call(ix, 'Get Minimum Delegation', []),
  14: (ix) =>
    call(ix, 'Deactivate Delinquent', [
      'Stake account',
      'Delinquent vote account',
      'Reference vote account',
    ]),
  15: (ix) =>
    call(ix, 'Redelegate (deprecated)', [
      'Stake account',
      'New stake account',
      'Vote account',
      'Stake config (unused)',
      'Stake authority',
    ]),
  16: (ix, r) =>
    call(
      ix,
      'Move Stake',
      ['Source stake account', 'Destination stake account', 'Stake authority'],
      [lamports('Amount', r.u64())]
    ),
  17: (ix, r) =>
    call(
      ix,
      'Move Lamports',
      ['Source stake account', 'Destination stake account', 'Stake authority'],
      [lamports('Amount', r.u64())]
    ),
};

export const decodeStakeInstruction: ProgramDecoder = (ix) => {
  try {
    const r = new ByteReader(ix.data);
    const decode = decoders[r.u32()];
    return decode ? decode(ix, r) : null;
  } catch {
    return null;
  }
};

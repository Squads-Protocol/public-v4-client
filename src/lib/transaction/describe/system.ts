import type { DecodedInstruction } from '../decodeTransactionMessage';
import { ByteReader } from './reader';
import { accountAt, address, lamports, nameAccounts, text } from './fields';
import type { AccountTakeover, DecodedCall, DescribedField, ProgramDecoder } from './types';

export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

const PROGRAM = 'System Program';

const call = (
  ix: DecodedInstruction,
  name: string,
  roles: readonly string[],
  fields: readonly DescribedField[] = [],
  extra: Partial<DecodedCall> = {}
): DecodedCall => ({ program: PROGRAM, name, fields, accounts: nameAccounts(ix, roles), ...extra });

/** Assign to the System program and Allocate of 0 bytes change nothing, so they are not takeovers. */
const takeover = (ix: DecodedInstruction, owner: string, space: bigint): Partial<DecodedCall> => {
  const account = accountAt(ix, 0);
  const newOwner = owner === SYSTEM_PROGRAM_ID ? null : owner;
  if (!account || (newOwner === null && space === BigInt(0))) return {};
  const accountTakeover: AccountTakeover = { account, newOwner };
  return { accountTakeover };
};

const NONCE_ROLES = ['Nonce account', 'Recent blockhashes sysvar', 'Nonce authority'];

const decoders: Record<number, (ix: DecodedInstruction, r: ByteReader) => DecodedCall> = {
  0: (ix, r) => {
    const [amount, space, owner] = [r.u64(), r.u64(), r.pubkey()];
    return call(
      ix,
      'Create Account',
      ['Funding account', 'New account'],
      [
        lamports('Amount', amount),
        text('Space', `${space} bytes`),
        address('Owner program', owner),
        ...(accountAt(ix, 1) ? [address('New account', accountAt(ix, 1)!)] : []),
      ]
    );
  },
  1: (ix, r) => {
    const owner = r.pubkey().toBase58();
    return call(
      ix,
      'Assign',
      ['Account'],
      [address('New owner program', owner)],
      takeover(ix, owner, BigInt(0))
    );
  },
  2: (ix, r) => {
    const amount = r.u64();
    const recipient = accountAt(ix, 1);
    return call(
      ix,
      'Transfer',
      ['Sender', 'Recipient'],
      [lamports('Amount', amount), ...(recipient ? [address('Recipient', recipient)] : [])]
    );
  },
  3: (ix, r) => {
    const base = r.pubkey();
    const seed = r.string();
    const [amount, space, owner] = [r.u64(), r.u64(), r.pubkey()];
    return call(
      ix,
      'Create Account With Seed',
      ['Funding account', 'New account', 'Base account'],
      [
        lamports('Amount', amount),
        text('Space', `${space} bytes`),
        address('Owner program', owner),
        address('Base', base),
        text('Seed', seed),
      ]
    );
  },
  4: (ix) => call(ix, 'Advance Nonce', NONCE_ROLES),
  5: (ix, r) =>
    call(
      ix,
      'Withdraw From Nonce',
      ['Nonce account', 'Recipient', 'Recent blockhashes sysvar', 'Rent sysvar', 'Nonce authority'],
      [lamports('Amount', r.u64())]
    ),
  6: (ix, r) =>
    call(
      ix,
      'Initialize Nonce',
      ['Nonce account', 'Recent blockhashes sysvar', 'Rent sysvar'],
      [address('Nonce authority', r.pubkey())]
    ),
  7: (ix, r) =>
    call(
      ix,
      'Authorize Nonce',
      ['Nonce account', 'Nonce authority'],
      [address('New nonce authority', r.pubkey())]
    ),
  8: (ix, r) => {
    const space = r.u64();
    return call(
      ix,
      'Allocate',
      ['Account'],
      [text('Space', `${space} bytes`)],
      takeover(ix, SYSTEM_PROGRAM_ID, space)
    );
  },
  9: (ix, r) => {
    const base = r.pubkey();
    const seed = r.string();
    const [space, owner] = [r.u64(), r.pubkey().toBase58()];
    return call(
      ix,
      'Allocate With Seed',
      ['Account', 'Base account'],
      [
        text('Space', `${space} bytes`),
        address('Owner program', owner),
        address('Base', base),
        text('Seed', seed),
      ],
      takeover(ix, owner, space)
    );
  },
  10: (ix, r) => {
    const base = r.pubkey();
    const seed = r.string();
    const owner = r.pubkey().toBase58();
    return call(
      ix,
      'Assign With Seed',
      ['Account', 'Base account'],
      [address('New owner program', owner), address('Base', base), text('Seed', seed)],
      takeover(ix, owner, BigInt(0))
    );
  },
  11: (ix, r) => {
    const amount = r.u64();
    const seed = r.string();
    return call(
      ix,
      'Transfer With Seed',
      ['Sender', 'Base account', 'Recipient'],
      [lamports('Amount', amount), address('Seed owner', r.pubkey()), text('Seed', seed)]
    );
  },
  12: (ix) => call(ix, 'Upgrade Nonce', ['Nonce account']),
};

export const decodeSystemInstruction: ProgramDecoder = (ix) => {
  try {
    const r = new ByteReader(ix.data);
    const decode = decoders[r.u32()];
    return decode ? decode(ix, r) : null;
  } catch {
    return null;
  }
};

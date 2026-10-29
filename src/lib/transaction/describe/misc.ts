import type { DecodedInstruction } from '../decodeTransactionMessage';
import { ByteReader } from './reader';
import { accountAt, address, nameAccounts, text } from './fields';
import type { DecodedCall, DescribedField, ProgramDecoder } from './types';

export const BPF_UPGRADEABLE_LOADER_ID = 'BPFLoaderUpgradeab1e11111111111111111111111';
export const COMPUTE_BUDGET_PROGRAM_ID = 'ComputeBudget111111111111111111111111111111';
export const MEMO_PROGRAM_IDS = [
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
] as const;

const callOf =
  (program: string) =>
  (
    ix: DecodedInstruction,
    name: string,
    roles: readonly string[],
    fields: readonly DescribedField[] = [],
    extra: Partial<DecodedCall> = {}
  ): DecodedCall => ({ program, name, fields, accounts: nameAccounts(ix, roles), ...extra });

const loaderCall = callOf('BPF Upgradeable Loader');

/** SetAuthority on a ProgramData account changes the upgrade authority; on a buffer it does not. */
function upgradeAuthorityChange(ix: DecodedInstruction, newAuthority: string | null) {
  const account = accountAt(ix, 0);
  return account ? [{ role: 'program-upgrade-authority' as const, account, newAuthority }] : [];
}

const loaderDecoders: Record<number, (ix: DecodedInstruction, r: ByteReader) => DecodedCall> = {
  0: (ix) => loaderCall(ix, 'Initialize Buffer', ['Buffer account', 'Buffer authority']),
  1: (ix, r) =>
    loaderCall(
      ix,
      'Write',
      ['Buffer account', 'Buffer authority'],
      [text('Offset', String(r.u32()))]
    ),
  2: (ix, r) =>
    loaderCall(
      ix,
      'Deploy With Max Data Length',
      [
        'Payer',
        'Program data account',
        'Program account',
        'Buffer account',
        'Rent sysvar',
        'Clock sysvar',
        'System program',
        'Upgrade authority',
      ],
      [text('Max data length', `${r.u64()} bytes`)]
    ),
  3: (ix) => {
    const [program, buffer] = [accountAt(ix, 1), accountAt(ix, 2)];
    return loaderCall(
      ix,
      'Upgrade',
      [
        'Program data account',
        'Program account',
        'Buffer account',
        'Spill account',
        'Rent sysvar',
        'Clock sysvar',
        'Upgrade authority',
      ],
      [
        ...(program ? [address('Program', program)] : []),
        ...(buffer ? [address('Buffer', buffer)] : []),
      ]
    );
  },
  4: (ix) => {
    const newAuthority = accountAt(ix, 2);
    return loaderCall(
      ix,
      'Set Authority',
      ['Program data or buffer account', 'Current authority', 'New authority'],
      [newAuthority ? address('New authority', newAuthority) : text('New authority', 'None')],
      { authorityChanges: upgradeAuthorityChange(ix, newAuthority) }
    );
  },
  5: (ix) =>
    loaderCall(ix, 'Close', ['Account to close', 'Recipient', 'Authority', 'Program account']),
  6: (ix, r) =>
    loaderCall(
      ix,
      'Extend Program',
      ['Program data account', 'Program account', 'System program', 'Payer'],
      [text('Additional bytes', String(r.u32()))]
    ),
  7: (ix) => {
    const newAuthority = accountAt(ix, 2);
    return loaderCall(
      ix,
      'Set Authority Checked',
      ['Program data or buffer account', 'Current authority', 'New authority'],
      newAuthority ? [address('New authority', newAuthority)] : [],
      { authorityChanges: upgradeAuthorityChange(ix, newAuthority) }
    );
  },
  8: (ix) => loaderCall(ix, 'Migrate', ['Program data account', 'Program account', 'Authority']),
  9: (ix, r) =>
    loaderCall(
      ix,
      'Extend Program Checked',
      ['Program data account', 'Program account', 'Authority', 'System program', 'Payer'],
      [text('Additional bytes', String(r.u32()))]
    ),
};

export const decodeLoaderInstruction: ProgramDecoder = (ix) => {
  try {
    const r = new ByteReader(ix.data);
    const decode = loaderDecoders[r.u32()];
    return decode ? decode(ix, r) : null;
  } catch {
    return null;
  }
};

const budgetCall = callOf('Compute Budget Program');

export const decodeComputeBudgetInstruction: ProgramDecoder = (ix) => {
  try {
    const r = new ByteReader(ix.data);
    switch (r.u8()) {
      case 1:
        return budgetCall(ix, 'Request Heap Frame', [], [text('Bytes', String(r.u32()))]);
      case 2:
        return budgetCall(ix, 'Set Compute Unit Limit', [], [text('Units', String(r.u32()))]);
      case 3:
        return budgetCall(
          ix,
          'Set Compute Unit Price',
          [],
          [text('Micro-lamports per unit', r.u64().toString())]
        );
      case 4:
        return budgetCall(
          ix,
          'Set Loaded Accounts Data Size Limit',
          [],
          [text('Bytes', String(r.u32()))]
        );
      default:
        return null;
    }
  } catch {
    return null;
  }
};

export const decodeMemoInstruction: ProgramDecoder = (ix) => {
  try {
    const memo = new TextDecoder('utf-8', { fatal: true }).decode(ix.data);
    return callOf('Memo Program')(
      ix,
      'Memo',
      ix.accounts.map(() => 'Signer'),
      [text('Memo', memo)]
    );
  } catch {
    return null;
  }
};

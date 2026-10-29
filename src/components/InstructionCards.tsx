import { useState } from 'react';
import bs58 from 'bs58';
import type { DecodedInstruction } from '@/lib/transaction/decodeTransactionMessage';
import {
  describeInstruction,
  formatSol,
  KNOWN_ADDRESS_NAMES,
  type DescribeContext,
  type FieldValue,
  type InstructionWarning,
} from '@/lib/transaction/describe';
import { cn } from '@/lib/utils';

const DATA_FORMATS = ['base64', 'base58', 'bytes'] as const;
type DataFormat = (typeof DATA_FORMATS)[number];

function DataField({ data }: { data: Uint8Array }) {
  const [format, setFormat] = useState<DataFormat>('base64');

  const encoded = (() => {
    if (data.length === 0) return '(empty)';
    if (format === 'base64') return Buffer.from(data).toString('base64');
    if (format === 'base58') return bs58.encode(data);
    return Array.from(data).join(', ');
  })();

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Data</span>
        <div className="flex overflow-hidden rounded border border-border">
          {DATA_FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                'px-2 py-0.5 text-xs transition-colors',
                format === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="break-all font-mono">{encoded}</div>
    </div>
  );
}

function Flag({ children, tone }: { children: string; tone: 'signer' | 'writable' | 'vault' }) {
  const toneClass = {
    signer: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    writable: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    vault: 'bg-green-500/20 text-green-700 dark:text-green-400',
  }[tone];
  return <span className={cn('rounded px-1', toneClass)}>{children}</span>;
}

/** An address with its known name and a badge when it is a vault of this multisig. */
export function AddressValue({ address, ctx }: { address: string; ctx?: DescribeContext }) {
  const vaultIndex = ctx?.vaultIndexByAddress.get(address);
  const name = KNOWN_ADDRESS_NAMES.get(address);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="break-all font-mono">{address}</span>
      {name && <span className="text-muted-foreground">({name})</span>}
      {vaultIndex !== undefined && <Flag tone="vault">{`vault ${vaultIndex}`}</Flag>}
    </span>
  );
}

function AccountRow({
  label,
  address,
  isSigner,
  isWritable,
  ctx,
}: {
  label?: string;
  address: string;
  isSigner: boolean;
  isWritable: boolean;
  ctx?: DescribeContext;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {label && <span className="text-muted-foreground">{label}:</span>}
      <AddressValue address={address} ctx={ctx} />
      {isSigner && <Flag tone="signer">signer</Flag>}
      {isWritable && <Flag tone="writable">writable</Flag>}
    </div>
  );
}

function RawInstructionBody({ ix, ctx }: { ix: DecodedInstruction; ctx?: DescribeContext }) {
  return (
    <>
      <div className="space-y-1">
        <span className="text-muted-foreground">Program ID</span>
        <div>
          <AddressValue address={ix.programId} ctx={ctx} />
        </div>
      </div>
      <DataField data={ix.data} />
      {ix.accounts.length > 0 && (
        <div className="space-y-1">
          <span className="text-muted-foreground">Accounts</span>
          <div className="space-y-1">
            {ix.accounts.map((acc, j) => (
              <AccountRow key={j} {...acc} ctx={ctx} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FieldRow({
  label,
  value,
  ctx,
}: {
  label: string;
  value: FieldValue;
  ctx?: DescribeContext;
}) {
  return (
    <div className="flex flex-wrap gap-x-1">
      <span className="text-muted-foreground">{label}:</span>
      {value.kind === 'address' && <AddressValue address={value.value} ctx={ctx} />}
      {value.kind === 'lamports' && (
        <span className="font-medium">
          {formatSol(value.value)}{' '}
          <span className="text-muted-foreground">({value.value.toString()} lamports)</span>
        </span>
      )}
      {value.kind === 'text' && <span className="break-all font-medium">{value.value}</span>}
    </div>
  );
}

export function WarningList({ warnings }: { warnings: readonly InstructionWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="space-y-1">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={cn(
            'rounded border px-2 py-1',
            w.severity === 'danger'
              ? 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400'
              : 'border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
          )}
        >
          {w.severity === 'danger' ? 'Warning: ' : 'Note: '}
          {w.message}
        </div>
      ))}
    </div>
  );
}

/** Decoded view of one instruction, with the raw view behind a toggle. */
export function InstructionCard({
  ix,
  label,
  ctx,
}: {
  ix: DecodedInstruction;
  label: string;
  ctx: DescribeContext;
}) {
  const description = describeInstruction(ix, ctx);
  const known = description.kind === 'known';
  const [showRaw, setShowRaw] = useState(!known);

  return (
    <div className="space-y-2 rounded border border-border bg-muted/30 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium">
          {label}
          {known ? (
            <span>
              {' '}
              · {description.program} · {description.name}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {' '}
              · {description.program ?? 'Unknown program'}
            </span>
          )}
        </div>
        {known && (
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="shrink-0 text-muted-foreground underline hover:text-foreground"
          >
            {showRaw ? 'Hide raw' : 'Show raw'}
          </button>
        )}
      </div>

      {known ? (
        <>
          <WarningList warnings={description.warnings} />
          {description.fields.length > 0 && (
            <div className="space-y-1">
              {description.fields.map((f, i) => (
                <FieldRow key={i} label={f.label} value={f.value} ctx={ctx} />
              ))}
            </div>
          )}
          {description.accounts.length > 0 && (
            <div className="space-y-1">
              <span className="text-muted-foreground">Accounts</span>
              {description.accounts.map((a, i) => (
                <AccountRow key={i} label={a.role} {...a} ctx={ctx} />
              ))}
            </div>
          )}
        </>
      ) : (
        <WarningList
          warnings={[
            {
              severity: 'caution',
              message: 'Not decoded. Verify the raw data before you approve.',
            },
          ]}
        />
      )}

      {showRaw && (
        <div className="space-y-2 border-t border-border pt-2">
          <RawInstructionBody ix={ix} ctx={ctx} />
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import bs58 from 'bs58';
import type { ConfigAction } from '@sqds/multisig/lib/generated/types/ConfigAction';
import { useMultisigData } from '@/hooks/useMultisigData';
import { decodeTransaction, DecodedInstruction } from '@/lib/transaction/decodeTransactionMessage';
import { cn, renderPermissions } from '@/lib/utils';

interface Props {
  transactionPda: string;
  proposal: multisig.generated.Proposal | null;
}

export default function TransactionInstructionDetails({ transactionPda, proposal }: Props) {
  const { connection, multisigAddress, programId } = useMultisigData();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['txDetails', transactionPda],
    queryFn: () =>
      decodeTransaction(
        connection,
        new PublicKey(transactionPda),
        new PublicKey(multisigAddress!),
        programId
      ),
    retry: false,
    enabled: !!multisigAddress,
  });

  const leftContent = (() => {
    if (isLoading) {
      return <div className="p-4 text-sm text-muted-foreground">Loading instructions...</div>;
    }
    if (isError || !data) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Unable to decode transaction instructions.
        </div>
      );
    }
    if (data.kind === 'vault') return <VaultInstructions instructions={data.instructions} />;
    if (data.kind === 'config') return <ConfigActions actions={data.actions} />;
    return <BatchInstructions size={data.size} transactions={data.transactions} />;
  })();

  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      <div className="min-w-0">{leftContent}</div>
      <div className="min-w-0">
        <ProposalPanel proposal={proposal} />
      </div>
    </div>
  );
}

// ── Proposal panel ────────────────────────────────────────────────────────────

function ProposalPanel({ proposal }: { proposal: multisig.generated.Proposal | null }) {
  if (!proposal) {
    return (
      <div className="p-4 text-sm text-muted-foreground">No proposal found.</div>
    );
  }

  const approved = proposal.approved;
  const rejected = proposal.rejected;
  const cancelled = proposal.cancelled;

  return (
    <div className="p-4 space-y-4 text-xs">
      <div className="space-y-1">
        <span className="text-muted-foreground text-sm">Proposal Status</span>
        <div className="font-medium">{proposal.status.__kind}</div>
      </div>

      <VoterList label="Approved" voters={approved} accent="green" />
      <VoterList label="Rejected" voters={rejected} accent="red" />
      {cancelled.length > 0 && (
        <VoterList label="Cancelled" voters={cancelled} accent="neutral" />
      )}
    </div>
  );
}

function VoterList({
  label,
  voters,
  accent,
}: {
  label: string;
  voters: PublicKey[];
  accent: 'green' | 'red' | 'neutral';
}) {
  const accentClass = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    neutral: 'text-muted-foreground',
  }[accent];

  return (
    <div className="space-y-1">
      <div className={cn('font-medium', accentClass)}>
        {label} ({voters.length})
      </div>
      {voters.length === 0 ? (
        <div className="text-muted-foreground">None</div>
      ) : (
        <div className="space-y-0.5">
          {voters.map((pk) => (
            <div key={pk.toBase58()} className="font-mono break-all">
              {pk.toBase58()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Instruction displays ──────────────────────────────────────────────────────

function VaultInstructions({ instructions }: { instructions: DecodedInstruction[] }) {
  if (instructions.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No instructions found.</div>;
  }
  return (
    <div className="p-4 space-y-3">
      {instructions.map((ix, i) => (
        <InstructionCard key={i} ix={ix} label={`Instruction ${i + 1}`} />
      ))}
    </div>
  );
}

function BatchInstructions({
  size,
  transactions,
}: {
  size: number;
  transactions: DecodedInstruction[][];
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="text-sm text-muted-foreground">{size} transaction(s) in batch</div>
      {transactions.map((ixs, txIndex) => (
        <div key={txIndex} className="space-y-2">
          <div className="text-sm font-medium">Transaction {txIndex + 1}</div>
          {ixs.length === 0 ? (
            <div className="text-xs text-muted-foreground">No instructions.</div>
          ) : (
            ixs.map((ix, i) => (
              <InstructionCard key={i} ix={ix} label={`Instruction ${i + 1}`} />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

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
        <div className="flex rounded border border-border overflow-hidden">
          {DATA_FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                'px-2 py-0.5 text-xs transition-colors',
                format === f
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="font-mono break-all">{encoded}</div>
    </div>
  );
}

function InstructionCard({ ix, label }: { ix: DecodedInstruction; label: string }) {
  return (
    <div className="rounded border border-border bg-muted/30 p-3 space-y-2 text-xs">
      <div className="font-medium text-sm">{label}</div>
      <div className="space-y-1">
        <span className="text-muted-foreground">Program ID</span>
        <div className="font-mono break-all">{ix.programId}</div>
      </div>
      <DataField data={ix.data} />
      {ix.accounts.length > 0 && (
        <div className="space-y-1">
          <span className="text-muted-foreground">Accounts</span>
          <div className="space-y-1">
            {ix.accounts.map((acc, j) => (
              <div key={j} className="flex items-center gap-2 font-mono">
                <span className="break-all">{acc.address}</span>
                <div className="flex gap-1 shrink-0">
                  {acc.isSigner && (
                    <span className="rounded bg-yellow-500/20 px-1 text-yellow-600 dark:text-yellow-400">
                      signer
                    </span>
                  )}
                  {acc.isWritable && (
                    <span className="rounded bg-blue-500/20 px-1 text-blue-600 dark:text-blue-400">
                      writable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigActions({ actions }: { actions: ConfigAction[] }) {
  if (actions.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No config actions found.</div>;
  }
  return (
    <div className="p-4 space-y-3">
      {actions.map((action, i) => (
        <div key={i} className="rounded border border-border bg-muted/30 p-3 space-y-2 text-xs">
          <div className="font-medium text-sm">{formatActionKind(action.__kind)}</div>
          {renderActionFields(action)}
        </div>
      ))}
    </div>
  );
}

function formatActionKind(kind: string): string {
  return kind.replace(/([A-Z])/g, ' $1').trim();
}

function renderActionFields(action: ConfigAction) {
  switch (action.__kind) {
    case 'AddMember':
      return (
        <div className="space-y-1">
          <Field label="Member" value={action.newMember.key.toBase58()} mono />
          <Field label="Permissions" value={renderPermissions(action.newMember.permissions.mask)} />
        </div>
      );
    case 'RemoveMember':
      return <Field label="Member" value={action.oldMember.toBase58()} mono />;
    case 'ChangeThreshold':
      return <Field label="New Threshold" value={String(action.newThreshold)} />;
    case 'SetTimeLock':
      return <Field label="New Time Lock" value={String(action.newTimeLock)} />;
    case 'AddSpendingLimit':
      return (
        <div className="space-y-1">
          <Field label="Create Key" value={action.createKey.toBase58()} mono />
          <Field label="Mint" value={action.mint.toBase58()} mono />
          <Field label="Amount" value={action.amount.toString()} />
          <Field label="Vault Index" value={String(action.vaultIndex)} />
          <Field
            label="Period"
            value={['OneTime', 'Day', 'Week', 'Month'][action.period] ?? String(action.period)}
          />
          <Field label="Members" value={action.members.map((m) => m.toBase58()).join(', ')} mono />
          <Field
            label="Destinations"
            value={action.destinations.map((d) => d.toBase58()).join(', ')}
            mono
          />
        </div>
      );
    case 'RemoveSpendingLimit':
      return <Field label="Spending Limit" value={action.spendingLimit.toBase58()} mono />;
    case 'SetRentCollector':
      return (
        <Field
          label="New Rent Collector"
          value={action.newRentCollector?.toBase58() ?? 'None'}
          mono={!!action.newRentCollector}
        />
      );
    default:
      return null;
  }
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={mono ? 'font-mono break-all' : ''}>{value}</span>
    </div>
  );
}

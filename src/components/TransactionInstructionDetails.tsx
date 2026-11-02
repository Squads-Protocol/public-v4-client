import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import { useMultisigData } from '@/hooks/useMultisigData';
import { decodeTransaction, DecodedInstruction } from '@/lib/transaction/decodeTransactionMessage';
import { loadDescribeContext, type DescribeContext } from '@/lib/transaction/describe';
import { InstructionCard } from '@/components/InstructionCards';
import { cn, renderPermissions } from '@/lib/utils';

type ConfigAction = multisig.generated.ConfigAction;

interface Props {
  transactionPda: string;
  proposal: multisig.generated.Proposal | null;
}

export default function TransactionInstructionDetails({ transactionPda, proposal }: Props) {
  const { connection, multisigAddress, programId } = useMultisigData();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['txDetails', transactionPda],
    queryFn: async () => {
      const multisigPda = new PublicKey(multisigAddress!);
      const decoded = await decodeTransaction(
        connection,
        new PublicKey(transactionPda),
        multisigPda,
        programId
      );
      const instructions =
        decoded.kind === 'vault'
          ? decoded.instructions
          : decoded.kind === 'batch'
            ? decoded.transactions.flat()
            : [];
      const ctx = await loadDescribeContext(connection, multisigPda, programId, instructions);
      return { decoded, ctx };
    },
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
    const { decoded, ctx } = data;
    if (decoded.kind === 'vault') {
      return <VaultInstructions instructions={decoded.instructions} ctx={ctx} />;
    }
    if (decoded.kind === 'config') return <ConfigActions actions={decoded.actions} />;
    return <BatchInstructions size={decoded.size} transactions={decoded.transactions} ctx={ctx} />;
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

function VaultInstructions({
  instructions,
  ctx,
}: {
  instructions: DecodedInstruction[];
  ctx: DescribeContext;
}) {
  if (instructions.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No instructions found.</div>;
  }
  return (
    <div className="p-4 space-y-3">
      {instructions.map((ix, i) => (
        <InstructionCard key={i} ix={ix} label={`Instruction ${i + 1}`} ctx={ctx} />
      ))}
    </div>
  );
}

function BatchInstructions({
  size,
  transactions,
  ctx,
}: {
  size: number;
  transactions: DecodedInstruction[][];
  ctx: DescribeContext;
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
              <InstructionCard key={i} ix={ix} label={`Instruction ${i + 1}`} ctx={ctx} />
            ))
          )}
        </div>
      ))}
    </div>
  );
}

// ── Config actions ────────────────────────────────────────────────────────────

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

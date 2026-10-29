import { useEffect, useState, type ReactNode } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InstructionCard } from '@/components/InstructionCards';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useAccess } from '@/hooks/useAccess';
import {
  type DecodedInstruction,
  toDecodedInstructions,
} from '@/lib/transaction/decodeTransactionMessage';
import {
  hasDangerWarning,
  loadDescribeContext,
  type DescribeContext,
} from '@/lib/transaction/describe';
import {
  buildContext,
  nextTransactionIndex,
  proposeVaultTransaction,
  simulateAsVault,
  type BuildContext,
  type PreparedProposal,
  type SimulationResult,
  type VaultProposal,
} from '@/lib/validators/propose';
import { formatTransactionError } from '@/lib/utils';

const CONFIRM_WORD = 'CONFIRM';

interface Preview {
  readonly prepared: PreparedProposal;
  readonly instructions: readonly DecodedInstruction[];
  readonly ctx: DescribeContext;
  readonly simulation: SimulationResult;
  readonly hasDanger: boolean;
}

export interface VaultActionDialogProps {
  readonly title: string;
  readonly description: string;
  readonly triggerLabel: string;
  readonly triggerVariant?: ButtonProps['variant'];
  readonly disabled?: boolean;
  /** Changes whenever a form value changes. A change clears the preview. */
  readonly formKey: string;
  /** null when the form is valid. */
  readonly formError: string | null;
  readonly build: (ctx: BuildContext) => Promise<VaultProposal>;
  readonly children?: ReactNode;
}

function SimulationBox({ simulation }: { simulation: SimulationResult }) {
  const [showLogs, setShowLogs] = useState(false);
  return (
    <div
      className={
        simulation.ok
          ? 'rounded border border-green-500/50 bg-green-500/10 p-2 text-xs text-green-700 dark:text-green-400'
          : 'rounded border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span>
          {simulation.ok
            ? `Simulation as the vault succeeded${simulation.unitsConsumed ? ` (${simulation.unitsConsumed} compute units)` : ''}.`
            : `Simulation as the vault failed: ${simulation.error}`}
        </span>
        {simulation.logs.length > 0 && (
          <button className="shrink-0 underline" onClick={() => setShowLogs((v) => !v)}>
            {showLogs ? 'Hide logs' : 'Show logs'}
          </button>
        )}
      </div>
      {showLogs && (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-muted-foreground">
          {simulation.logs.join('\n')}
        </pre>
      )}
    </div>
  );
}

export function VaultActionDialog({
  title,
  description,
  triggerLabel,
  triggerVariant = 'outline',
  disabled,
  formKey,
  formError,
  build,
  children,
}: VaultActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [acceptFailedSimulation, setAcceptFailedSimulation] = useState(false);

  const wallet = useWallet();
  const walletModal = useWalletModal();
  const hasAccess = useAccess();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { connection, multisigAddress, programId } = useMultisigData();

  useEffect(() => {
    setPreview(null);
    setPreviewError(null);
    setConfirmText('');
    setAcceptFailedSimulation(false);
  }, [formKey, open]);

  const runPreview = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      return;
    }
    if (!multisigAddress) return;
    setBusy(true);
    setPreviewError(null);
    try {
      const multisigPda = new PublicKey(multisigAddress);
      const transactionIndex = await nextTransactionIndex(connection, multisigPda);
      const proposal = await build(buildContext(multisigPda, programId, transactionIndex));
      const instructions = toDecodedInstructions(proposal.instructions);
      const [ctx, simulation] = await Promise.all([
        loadDescribeContext(connection, multisigPda, programId, instructions),
        simulateAsVault(connection, wallet.publicKey, proposal.instructions).catch(
          (e): SimulationResult => ({ ok: false, error: formatTransactionError(e), logs: [] })
        ),
      ]);
      setPreview({
        prepared: { ...proposal, transactionIndex },
        instructions,
        ctx,
        simulation,
        hasDanger: hasDangerWarning(instructions, ctx),
      });
    } catch (e) {
      setPreviewError(formatTransactionError(e));
    } finally {
      setBusy(false);
    }
  };

  const propose = async () => {
    if (!preview || !multisigAddress) return;
    setBusy(true);
    try {
      toast.loading('Waiting for wallet approval...', { id: 'transaction', duration: Infinity });
      const signature = await proposeVaultTransaction({
        connection,
        wallet,
        multisigPda: new PublicKey(multisigAddress),
        programId,
        prepared: preview.prepared,
      });
      toast.success(`${title}: proposed. (${signature})`, { id: 'transaction' });
      setOpen(false);
      await Promise.all(
        ['transactions', 'multisig', 'voteAccount', 'vaultStakeAccounts', 'balance'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] })
        )
      );
      navigate('/transactions');
    } catch (e) {
      toast.error(`Failed to propose: ${formatTransactionError(e)}`, { id: 'transaction' });
    } finally {
      setBusy(false);
    }
  };

  const confirmed =
    !!preview &&
    (preview.simulation.ok || acceptFailedSimulation) &&
    (!preview.hasDanger || confirmText === CONFIRM_WORD);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm" disabled={disabled || !hasAccess}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">{children}</div>
        {formError && <p className="text-sm text-red-500">{formError}</p>}

        <div className="flex justify-end">
          <Button onClick={runPreview} disabled={!!formError || busy} variant="secondary">
            {busy && !preview ? 'Checking...' : 'Preview'}
          </Button>
        </div>
        {previewError && (
          <p className="rounded border border-red-500/50 bg-red-500/10 p-2 text-sm text-red-600 dark:text-red-400">
            {previewError}
          </p>
        )}

        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Proposal #{preview.prepared.transactionIndex.toString()}. Vault{' '}
              {preview.prepared.vaultIndex} will sign these instructions:
            </p>
            {preview.instructions.map((ix, i) => (
              <InstructionCard key={i} ix={ix} label={`Instruction ${i + 1}`} ctx={preview.ctx} />
            ))}
            <SimulationBox simulation={preview.simulation} />

            {!preview.simulation.ok && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acceptFailedSimulation}
                  onChange={(e) => setAcceptFailedSimulation(e.target.checked)}
                />
                Propose anyway. The conditions can change before execution (for example, a
                commission increase in a later epoch).
              </label>
            )}
            {preview.hasDanger && (
              <div className="space-y-1 text-sm text-red-600 dark:text-red-400">
                <p>Read the warnings above. Type {CONFIRM_WORD} to continue.</p>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={propose} disabled={!confirmed || busy}>
                Propose
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { Button } from './ui/button';
import * as multisig from '@sqds/multisig';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'sonner';
import { Dialog, DialogDescription, DialogHeader } from './ui/dialog';
import { DialogTrigger } from './ui/dialog';
import { DialogContent, DialogTitle } from './ui/dialog';
import { useRef, useState } from 'react';
import { Input } from './ui/input';
import { Clock } from 'lucide-react';
import { range, formatTransactionError } from '@/lib/utils';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useQueryClient } from '@tanstack/react-query';
import { waitForConfirmation } from '../lib/transactionConfirmation';
import { useExecuteButtonState } from '@/hooks/useProposalActions';
import type { TransactionKind } from '@/hooks/useServices';

function formatTimeRemaining(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `${days}day${days !== 1 ? 's' : ''}`;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${hours}hr${hours !== 1 ? 's' : ''}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 1) return `${minutes}min`;
  return `${Math.floor(seconds)}sec`;
}

type WithALT = {
  instruction: TransactionInstruction;
  lookupTableAccounts: AddressLookupTableAccount[];
};

type ExecuteButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
  isStale: boolean;
  isAccountClosed: boolean;
  approvedAt: number | undefined;
  kind: TransactionKind;
};

const ExecuteButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
  isStale,
  isAccountClosed,
  approvedAt,
  kind,
}: ExecuteButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeDialog = () => setIsOpen(false);
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [priorityFeeLamports, setPriorityFeeLamports] = useState<number>(5000);
  const [computeUnitBudget, setComputeUnitBudget] = useState<number>(200_000);

  const { isDisabled, timelockSecondsRemaining } = useExecuteButtonState({ proposalStatus, isStale, isAccountClosed, approvedAt, kind });
  const timelockBlocked = timelockSecondsRemaining !== null;

  const { connection } = useMultisigData();
  const signaturesRef = useRef<string[]>([]);
  const queryClient = useQueryClient();

  const executeTransaction = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
    }
    const member = wallet.publicKey;
    if (!wallet.signAllTransactions) throw 'Connected wallet does not support signing multiple transactions';
    signaturesRef.current = [];
    let bigIntTransactionIndex = BigInt(transactionIndex);

    // Stage 1: waiting for wallet
    toast.loading('Waiting for wallet approval...', { id: 'execute', duration: Infinity });

    const resolvedProgramId = programId ? new PublicKey(programId) : multisig.PROGRAM_ID;

    const [transactionPda] = multisig.getTransactionPda({
      multisigPda: new PublicKey(multisigPda),
      index: bigIntTransactionIndex,
      programId: resolvedProgramId,
    });

    if (kind === 'unknown') {
      throw 'Cannot execute: transaction type could not be determined from account discriminator';
    }

    let transactions: VersionedTransaction[] = [];

    const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFeeLamports,
    });
    const computeUnitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnitBudget,
    });

    let blockhash = (await connection.getLatestBlockhash()).blockhash;

    if (kind === 'vault') {
      const resp = await multisig.instructions.vaultTransactionExecute({
        multisigPda: new PublicKey(multisigPda),
        connection,
        member,
        transactionIndex: bigIntTransactionIndex,
        programId: resolvedProgramId,
      });
      transactions.push(
        new VersionedTransaction(
          new TransactionMessage({
            instructions: [priorityFeeInstruction, computeUnitInstruction, resp.instruction],
            payerKey: member,
            recentBlockhash: blockhash,
          }).compileToV0Message(resp.lookupTableAccounts)
        )
      );
    } else if (kind === 'config') {
      const executeIx = multisig.instructions.configTransactionExecute({
        multisigPda: new PublicKey(multisigPda),
        member,
        rentPayer: member,
        transactionIndex: bigIntTransactionIndex,
        programId: resolvedProgramId,
      });
      transactions.push(
        new VersionedTransaction(
          new TransactionMessage({
            instructions: [priorityFeeInstruction, computeUnitInstruction, executeIx],
            payerKey: member,
            recentBlockhash: blockhash,
          }).compileToV0Message()
        )
      );
    } else if (kind === 'batch') {
      const txData = await multisig.accounts.Batch.fromAccountAddress(connection, transactionPda);
      const executedBatchIndex = txData.executedTransactionIndex;
      const batchSize = txData.size;

      if (executedBatchIndex === undefined || batchSize === undefined) {
        throw new Error("executedBatchIndex or batchSize is undefined and can't execute the transaction");
      }

      transactions.push(
        ...(await Promise.all(
          range(executedBatchIndex + 1, batchSize).map(async (batchIndex) => {
            const { instruction: transactionExecuteIx, lookupTableAccounts } =
              await multisig.instructions.batchExecuteTransaction({
                connection,
                member,
                batchIndex: bigIntTransactionIndex,
                transactionIndex: batchIndex,
                multisigPda: new PublicKey(multisigPda),
                programId: resolvedProgramId,
              });

            const message = new TransactionMessage({
              payerKey: member,
              recentBlockhash: blockhash,
              instructions: [priorityFeeInstruction, computeUnitInstruction, transactionExecuteIx],
            }).compileToV0Message(lookupTableAccounts);

            return new VersionedTransaction(message);
          })
        ))
      );
    }

    const signedTransactions = await wallet.signAllTransactions(transactions);

    for (let i = 0; i < signedTransactions.length; i++) {
      const label =
        signedTransactions.length > 1 ? ` (${i + 1}/${signedTransactions.length})` : '';

      // Stage 2: sending
      toast.loading(`Sending transaction${label}...`, { id: 'execute', duration: Infinity });

      const signature = await connection.sendRawTransaction(signedTransactions[i].serialize(), {
        skipPreflight: true,
      });
      signaturesRef.current.push(signature);

      // Stage 3: confirming — stacks a brief "Sent" announcement alongside the progress toast
      const shortSig = `${signature.slice(0, 8)}...${signature.slice(-4)}`;
      toast.info(`Sent${label}: ${signature}`, { duration: 6000 });
      toast.info(`Confirming${label}: ${shortSig}`, { id: 'execute', duration: Infinity });

      const [confirmed] = await waitForConfirmation(connection, [signature]);
      if (!confirmed) {
        throw `Transaction${label} failed or timed out. Check ${signature}`;
      }
    }

    // Stage 4: confirmed
    toast.success('Transaction executed.', { id: 'execute' });

    closeDialog();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['multisig'] }),
      queryClient.invalidateQueries({ queryKey: ['balance'] }),
      queryClient.invalidateQueries({ queryKey: ['tokenBalances'] }),
    ]);
  };
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <div className="relative group w-full sm:w-auto">
        <DialogTrigger
          disabled={isDisabled}
          className={`h-9 px-3 text-sm w-full inline-flex items-center justify-center gap-1.5 ${isDisabled ? `bg-green-600/50` : `bg-green-600 hover:bg-green-700`} rounded-md text-white`}
          onClick={() => setIsOpen(true)}
        >
          {timelockBlocked && <Clock className="h-3.5 w-3.5" />}
          Execute
        </DialogTrigger>
        {timelockBlocked && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {formatTimeRemaining(timelockSecondsRemaining!)} remaining
          </div>
        )}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Execute Transaction</DialogTitle>
          <DialogDescription>
            Select custom priority fees and compute unit limits and execute transaction.
          </DialogDescription>
        </DialogHeader>
        <h3>Priority Fee in lamports</h3>
        <Input
          placeholder="Priority Fee"
          onChange={(e) => setPriorityFeeLamports(Number(e.target.value))}
          value={priorityFeeLamports}
        />

        <h3>Compute Unit Budget</h3>
        <Input
          placeholder="Priority Fee"
          onChange={(e) => setComputeUnitBudget(Number(e.target.value))}
          value={computeUnitBudget}
        />
        <Button
          disabled={isDisabled}
          onClick={async () => {
            try {
              await executeTransaction();
            } catch (e) {
              toast.error(
                `Failed to execute: ${formatTransactionError(e)}${signaturesRef.current.length ? ` (${signaturesRef.current.join(', ')})` : ''}`,
                { id: 'execute' }
              );
            }
          }}
          className="mr-2 bg-green-600 hover:bg-green-700 text-white"
        >
          Execute
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ExecuteButton;

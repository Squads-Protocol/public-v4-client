import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, Settings2, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMultisigData } from '@/hooks/useMultisigData';
import { waitForConfirmation } from '@/lib/transactionConfirmation';
import { range } from '@/lib/utils';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type WithALT = {
  instruction: TransactionInstruction;
  lookupTableAccounts: AddressLookupTableAccount[];
};

type ExecuteButtonProps = {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
};

const ExecuteButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
}: ExecuteButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeDialog = () => setIsOpen(false);
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [priorityFeeLamports, setPriorityFeeLamports] = useState<number>(5000);
  const [computeUnitBudget, setComputeUnitBudget] = useState<number>(200_000);
  const [isLoading, setIsLoading] = useState(false);

  const isTransactionReady = proposalStatus === 'Approved';

  const { connection } = useMultisigData();
  const queryClient = useQueryClient();

  const executeTransaction = async () => {
    if (!wallet.publicKey) {
      walletModal.setVisible(true);
      throw 'Wallet not connected';
    }
    setIsLoading(true);
    try {
      const member = wallet.publicKey;
      if (!wallet.signAllTransactions) return;
      const bigIntTransactionIndex = BigInt(transactionIndex);

      if (!isTransactionReady) {
        toast.error('Proposal has not reached threshold.');
        return;
      }

      const [transactionPda] = multisig.getTransactionPda({
        multisigPda: new PublicKey(multisigPda),
        index: bigIntTransactionIndex,
        programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
      });

      let txData;
      let txType;
      try {
        await multisig.accounts.VaultTransaction.fromAccountAddress(
          // @ts-expect-error
          connection,
          transactionPda
        );
        txType = 'vault';
      } catch (_error) {
        try {
          await multisig.accounts.ConfigTransaction.fromAccountAddress(
            // @ts-expect-error
            connection,
            transactionPda
          );
          txType = 'config';
        } catch (_e) {
          txData = await multisig.accounts.Batch.fromAccountAddress(
            // @ts-expect-error
            connection,
            transactionPda
          );
          txType = 'batch';
        }
      }

      const transactions: VersionedTransaction[] = [];

      const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFeeLamports,
      });
      const computeUnitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnitBudget,
      });

      const blockhash = (await connection.getLatestBlockhash()).blockhash;

      if (txType === 'vault') {
        const resp = await multisig.instructions.vaultTransactionExecute({
          multisigPda: new PublicKey(multisigPda),
          // @ts-expect-error
          connection,
          member,
          transactionIndex: bigIntTransactionIndex,
          programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
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
      } else if (txType === 'config') {
        const executeIx = multisig.instructions.configTransactionExecute({
          multisigPda: new PublicKey(multisigPda),
          member,
          rentPayer: member,
          transactionIndex: bigIntTransactionIndex,
          programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
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
      } else if (txType === 'batch' && txData) {
        const executedBatchIndex = txData.executedTransactionIndex;
        const batchSize = txData.size;

        if (executedBatchIndex === undefined || batchSize === undefined) {
          throw new Error(
            "executedBatchIndex or batchSize is undefined and can't execute the transaction"
          );
        }

        transactions.push(
          ...(await Promise.all(
            range(executedBatchIndex + 1, batchSize).map(async (batchIndex) => {
              const { instruction: transactionExecuteIx, lookupTableAccounts } =
                await multisig.instructions.batchExecuteTransaction({
                  // @ts-expect-error
                  connection,
                  member,
                  batchIndex: bigIntTransactionIndex,
                  transactionIndex: batchIndex,
                  multisigPda: new PublicKey(multisigPda),
                  programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
                });

              const message = new TransactionMessage({
                payerKey: member,
                recentBlockhash: blockhash,
                instructions: [
                  priorityFeeInstruction,
                  computeUnitInstruction,
                  transactionExecuteIx,
                ],
              }).compileToV0Message(lookupTableAccounts);

              return new VersionedTransaction(message);
            })
          ))
        );
      }

      const signedTransactions = await wallet.signAllTransactions(transactions);

      const signatures = [];
      for (const signedTx of signedTransactions) {
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: true,
        });
        signatures.push(signature);
        toast.loading('Confirming...', { id: 'transaction' });
      }
      const sent = await waitForConfirmation(connection, signatures);
      if (!sent.every((sent) => !!sent)) {
        throw `Unable to confirm`;
      }
      closeDialog();
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!isTransactionReady}
                className="h-8 w-8 text-blue-500 hover:bg-blue-500/10 hover:text-blue-500"
              >
                <Play className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Execute</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Execute Transaction
          </DialogTitle>
          <DialogDescription>
            Configure priority fees and compute limits for execution.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              Priority Fee (lamports)
            </Label>
            <Input
              type="number"
              placeholder="5000"
              onChange={(e) => setPriorityFeeLamports(Number(e.target.value))}
              value={priorityFeeLamports}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              Compute Unit Budget
            </Label>
            <Input
              type="number"
              placeholder="200000"
              onChange={(e) => setComputeUnitBudget(Number(e.target.value))}
              value={computeUnitBudget}
            />
          </div>

          <Button
            onClick={() =>
              toast.promise(executeTransaction, {
                id: 'transaction',
                loading: 'Executing...',
                success: 'Transaction executed successfully',
                error: 'Failed to execute. Check console for details.',
              })
            }
            disabled={!isTransactionReady || isLoading}
            className="w-full gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Execute Transaction
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExecuteButton;

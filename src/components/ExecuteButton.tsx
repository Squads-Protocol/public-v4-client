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
import { range, formatTransactionError, isMember } from '@/lib/utils';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisig } from '@/hooks/useServices';
import { useQueryClient } from '@tanstack/react-query';
import { waitForConfirmation } from '../lib/transactionConfirmation';

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
};

const ExecuteButton = ({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
  isStale,
  isAccountClosed,
}: ExecuteButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeDialog = () => setIsOpen(false);
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [priorityFeeLamports, setPriorityFeeLamports] = useState<number>(5000);
  const [computeUnitBudget, setComputeUnitBudget] = useState<number>(200_000);

  const { data: multisigConfig } = useMultisig();
  const connectedMember = wallet.publicKey
    ? isMember(wallet.publicKey, multisigConfig?.members ?? [])
    : undefined;
  const hasExecutePermission = connectedMember
    ? multisig.types.Permissions.has(connectedMember.permissions, multisig.types.Permission.Execute)
    : true; // no wallet connected — allow click so handler can open wallet modal

  const isTransactionReady = !isAccountClosed && proposalStatus === 'Approved' && !isStale;
  const isDisabled = !isTransactionReady || (!!wallet.publicKey && !hasExecutePermission);

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

    if (!isTransactionReady) {
      throw 'Proposal has not reached threshold';
    }

    const [transactionPda] = multisig.getTransactionPda({
      multisigPda: new PublicKey(multisigPda),
      index: bigIntTransactionIndex,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });

    let txData;
    let txType;
    try {
      await multisig.accounts.VaultTransaction.fromAccountAddress(connection, transactionPda);
      txType = 'vault';
    } catch (error) {
      try {
        await multisig.accounts.ConfigTransaction.fromAccountAddress(connection, transactionPda);
        txType = 'config';
      } catch (e) {
        txData = await multisig.accounts.Batch.fromAccountAddress(connection, transactionPda);
        txType = 'batch';
      }
    }

    let transactions: VersionedTransaction[] = [];

    const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFeeLamports,
    });
    const computeUnitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnitBudget,
    });

    let blockhash = (await connection.getLatestBlockhash()).blockhash;

    if (txType == 'vault') {
      const resp = await multisig.instructions.vaultTransactionExecute({
        multisigPda: new PublicKey(multisigPda),
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
    } else if (txType == 'config') {
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
    } else if (txType == 'batch' && txData) {
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
              instructions: [priorityFeeInstruction, computeUnitInstruction, transactionExecuteIx],
            }).compileToV0Message(lookupTableAccounts);

            return new VersionedTransaction(message);
          })
        ))
      );
    }

    const signedTransactions = await wallet.signAllTransactions(transactions);

    const signatures: string[] = [];
    for (let i = 0; i < signedTransactions.length; i++) {
      const label =
        signedTransactions.length > 1 ? ` (${i + 1}/${signedTransactions.length})` : '';

      const signature = await connection.sendRawTransaction(signedTransactions[i].serialize(), {
        skipPreflight: true,
      });
      signatures.push(signature);
      signaturesRef.current.push(signature);

      toast.info(`Sending${label} ${signature}`, { duration: Infinity });
      toast.loading(`Confirming${label} ${signature}...`, { duration: Infinity });

      const [confirmed] = await waitForConfirmation(connection, [signature]);
      if (!confirmed) {
        throw `Transaction${label} failed or timed out. Check ${signature}`;
      }
    }
    closeDialog();
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        disabled={isDisabled}
        className={`mr-2 h-10 px-4 py-2 ${isDisabled ? `bg-primary/50` : `bg-primary hover:bg-primary/90`} rounded-md text-primary-foreground`}
        onClick={() => setIsOpen(true)}
      >
        Execute
      </DialogTrigger>
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
          onClick={() =>
            toast.promise(executeTransaction, {
              id: 'transaction',
              loading: 'Loading...',
              success: 'Transaction executed.',
              error: (e) => `Failed to execute: ${formatTransactionError(e)}${signaturesRef.current.length ? ` (${signaturesRef.current.join(', ')})` : ''}`,
            })
          }
          className="mr-2"
        >
          Execute
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ExecuteButton;

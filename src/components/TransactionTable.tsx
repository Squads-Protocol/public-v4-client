import * as multisig from '@sqds/multisig';
import { PublicKey } from '@solana/web3.js';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import ApproveButton from './ApproveButton';
import ExecuteButton from './ExecuteButton';
import RejectButton from './RejectButton';
import { TableBody, TableCell, TableRow } from './ui/table';
import { useExplorerUrl, useRpcUrl } from '@/hooks/useSettings';
import { Link } from 'react-router-dom';
import { useMultisig } from '@/hooks/useServices';
import { cn } from '@/lib/utils';
import TransactionInstructionDetails from './TransactionInstructionDetails';

interface ActionButtonsProps {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
  isStale: boolean;
  approvedMembers: PublicKey[];
  rejectedMembers: PublicKey[];
  isAccountClosed: boolean;
}

type TransactionRow = {
  transactionPda: string;
  proposal: multisig.generated.Proposal | null;
  index: bigint;
  transactionExists: boolean;
};

const EOL_STATUSES = new Set(['Executed', 'Cancelled', 'Rejected']);

export default function TransactionTable({
  multisigPda,
  transactions,
  programId,
}: {
  multisigPda: string;
  transactions: TransactionRow[];
  programId?: string;
}) {
  const { data: multisigConfig } = useMultisig();
  if (transactions.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={5}>No transactions found.</TableCell>
        </TableRow>
      </TableBody>
    );
  }
  return (
    <TableBody>
      {transactions.map((transaction, index) => {
        const stale =
          (multisigConfig &&
            Number(multisigConfig.staleTransactionIndex) > Number(transaction.index)) ||
          false;
        return (
          <TransactionRowItem
            key={transaction.transactionPda}
            transaction={transaction}
            multisigPda={multisigPda}
            programId={programId}
            stale={stale}
          />
        );
      })}
    </TableBody>
  );
}

function TransactionRowItem({
  transaction,
  multisigPda,
  programId,
  stale,
}: {
  transaction: TransactionRow;
  multisigPda: string;
  programId?: string;
  stale: boolean;
}) {
  const { rpcUrl } = useRpcUrl();
  const [isExpanded, setIsExpanded] = useState(false);

  const statusKind = transaction.proposal?.status.__kind;
  const isExpandable = transaction.transactionExists;

  const status = !transaction.transactionExists
    ? 'Closed'
    : stale
      ? '(stale)'
      : statusKind || 'None';

  return (
    <>
      <TableRow>
        <TableCell className="w-8 pr-0">
          {isExpandable && (
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="flex items-center justify-center rounded p-1 hover:bg-muted transition-colors"
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              <ChevronDown
                className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', {
                  'rotate-180': isExpanded,
                })}
              />
            </button>
          )}
        </TableCell>
        <TableCell>{Number(transaction.index)}</TableCell>
        <TableCell className="text-blue-500">
          <Link
            target="_blank"
            to={createSolanaExplorerUrl(transaction.transactionPda, rpcUrl!)}
          >
            {transaction.transactionPda}
          </Link>
        </TableCell>
        <TableCell>{status}</TableCell>
        <TableCell>
          <ActionButtons
            multisigPda={multisigPda}
            transactionIndex={Number(transaction.index)}
            proposalStatus={statusKind || 'None'}
            programId={programId ? programId : multisig.PROGRAM_ID.toBase58()}
            isStale={stale}
            approvedMembers={transaction.proposal?.approved ?? []}
            rejectedMembers={transaction.proposal?.rejected ?? []}
            isAccountClosed={!transaction.transactionExists}
          />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={5} className="p-0">
            <TransactionInstructionDetails
            transactionPda={transaction.transactionPda}
            proposal={transaction.proposal}
          />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ActionButtons({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
  isStale,
  approvedMembers,
  rejectedMembers,
  isAccountClosed,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <ApproveButton
        multisigPda={multisigPda}
        transactionIndex={transactionIndex}
        proposalStatus={proposalStatus}
        programId={programId}
        isStale={isStale}
        approvedMembers={approvedMembers}
        isAccountClosed={isAccountClosed}
      />
      <RejectButton
        multisigPda={multisigPda}
        transactionIndex={transactionIndex}
        proposalStatus={proposalStatus}
        programId={programId}
        isStale={isStale}
        rejectedMembers={rejectedMembers}
        isAccountClosed={isAccountClosed}
      />
      <ExecuteButton
        multisigPda={multisigPda}
        transactionIndex={transactionIndex}
        proposalStatus={proposalStatus}
        programId={programId}
        isStale={isStale}
        isAccountClosed={isAccountClosed}
      />
    </div>
  );
}

function createSolanaExplorerUrl(publicKey: string, rpcUrl: string): string {
  const { explorerUrl } = useExplorerUrl();
  const baseUrl = `${explorerUrl}/address/`;
  const clusterQuery = '?cluster=custom&customUrl=';
  const encodedRpcUrl = encodeURIComponent(rpcUrl);

  return `${baseUrl}${publicKey}${clusterQuery}${encodedRpcUrl}`;
}

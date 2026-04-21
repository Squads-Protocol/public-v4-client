import * as multisig from '@sqds/multisig';
import { PublicKey } from '@solana/web3.js';
import { useState } from 'react';
import { Eye } from 'lucide-react';
import ApproveButton from './ApproveButton';
import CancelButton from './CancelButton';
import ExecuteButton from './ExecuteButton';
import RejectButton from './RejectButton';
import { TableBody, TableCell, TableRow } from './ui/table';
import { useExplorerUrl, useRpcUrl } from '@/hooks/useSettings';
import { Link } from 'react-router-dom';
import { useMultisig } from '@/hooks/useServices';
import type { TransactionKind } from '@/hooks/useServices';
import { isProposalEOL } from '@/hooks/useProposalActions';
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
  approvedAt: number | undefined;
  kind: TransactionKind;
}

type TransactionRow = {
  transactionPda: string;
  proposal: multisig.generated.Proposal | null;
  index: bigint;
  transactionExists: boolean;
  kind: TransactionKind;
  approvedAt: number | undefined;
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
      <TableRow className="block border-b md:table-row">
        <TableCell className="hidden md:table-cell w-8 pr-0">
          {isExpandable && (
            <div className="relative group w-fit">
              <button
                onClick={() => setIsExpanded((v) => !v)}
                className="flex items-center justify-center rounded p-1 hover:bg-muted transition-colors"
                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
              >
                <Eye className={cn('h-4 w-4 transition-colors', isExpanded ? 'text-foreground' : 'text-muted-foreground')} />
              </button>
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                View details
              </div>
            </div>
          )}
        </TableCell>
        <TableCell className="block md:table-cell">
          <div className="flex items-center gap-2">
            {isExpandable && (
              <button
                onClick={() => setIsExpanded((v) => !v)}
                className="flex items-center justify-center rounded p-1 hover:bg-muted transition-colors md:hidden"
                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
              >
                <Eye className={cn('h-4 w-4 transition-colors', isExpanded ? 'text-foreground' : 'text-muted-foreground')} />
              </button>
            )}
            <span>{Number(transaction.index)}</span>
          </div>
        </TableCell>
        <TableCell className="block md:table-cell truncate text-blue-500">
          <Link
            target="_blank"
            to={createSolanaExplorerUrl(transaction.transactionPda, rpcUrl!)}
            className="truncate"
          >
            {transaction.transactionPda}
          </Link>
        </TableCell>
        <TableCell className="block md:table-cell">{status}</TableCell>
        <TableCell className="block md:table-cell">
          <ActionButtons
            multisigPda={multisigPda}
            transactionIndex={Number(transaction.index)}
            proposalStatus={statusKind || 'None'}
            programId={programId ? programId : multisig.PROGRAM_ID.toBase58()}
            isStale={stale}
            approvedMembers={transaction.proposal?.approved ?? []}
            rejectedMembers={transaction.proposal?.rejected ?? []}
            isAccountClosed={!transaction.transactionExists}
            approvedAt={transaction.approvedAt}
            kind={transaction.kind}
          />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="block md:table-row">
          <TableCell colSpan={5} className="block md:table-cell p-0">
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
  approvedAt,
  kind,
}: ActionButtonsProps) {
  if (isProposalEOL(proposalStatus, isStale, isAccountClosed)) return null;
  const isApproved = proposalStatus === 'Approved';
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {!isApproved && (
        <>
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
        </>
      )}
      <ExecuteButton
        multisigPda={multisigPda}
        transactionIndex={transactionIndex}
        proposalStatus={proposalStatus}
        programId={programId}
        isStale={isStale}
        isAccountClosed={isAccountClosed}
        approvedAt={approvedAt}
        kind={kind}
      />
      {isApproved && (
        <CancelButton
          multisigPda={multisigPda}
          transactionIndex={transactionIndex}
          proposalStatus={proposalStatus}
          programId={programId}
          isAccountClosed={isAccountClosed}
        />
      )}
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

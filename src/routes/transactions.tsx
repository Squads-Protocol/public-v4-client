import { Suspense } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeftRight, 
  Plus, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CreateTransaction from '@/components/transactions/CreateTransactionButton';
import ApproveButton from '@/components/transactions/ApproveButton';
import ExecuteButton from '@/components/transactions/ExecuteButton';
import RejectButton from '@/components/transactions/RejectButton';
import { useMultisig, useTransactions } from '@/hooks/useServices';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useExplorerUrl, useRpcUrl } from '@/hooks/useSettings';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import * as multisig from '@sqds/multisig';
import { cn } from '~/lib/utils';

const TRANSACTIONS_PER_PAGE = 10;

function getStatusConfig(status: string, stale: boolean) {
  if (stale) {
    return {
      label: 'Stale',
      variant: 'outline' as const,
      icon: AlertCircle,
      className: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
      animated: false
    };
  }

  switch (status) {
    case 'Approved':
      return {
        label: 'Approved',
        variant: 'outline' as const,
        icon: CheckCircle2,
        className: 'border-green-500/30 text-green-500 bg-green-500/10',
        animated: false
      };
    case 'Rejected':
      return {
        label: 'Rejected',
        variant: 'outline' as const,
        icon: XCircle,
        className: 'border-red-500/30 text-red-500 bg-red-500/10',
        animated: false
      };
    case 'Executed':
      return {
        label: 'Executed',
        variant: 'outline' as const,
        icon: CheckCircle2,
        className: 'border-blue-500/30 text-blue-500 bg-blue-500/10',
        animated: false
      };
    case 'Cancelled':
      return {
        label: 'Cancelled',
        variant: 'outline' as const,
        icon: XCircle,
        className: 'border-muted-foreground/30 text-muted-foreground bg-muted/50',
        animated: false
      };
    case 'Active':
      return {
        label: 'Active',
        variant: 'outline' as const,
        icon: Clock,
        className: 'border-primary/30 text-primary bg-primary/10',
        animated: true
      };
    case 'None':
    default:
      return {
        label: 'Pending',
        variant: 'outline' as const,
        icon: Clock,
        className: 'border-muted-foreground/30 text-muted-foreground bg-muted/30',
        animated: true
      };
  }
}

function StatusBadge({ status, stale }: { status: string; stale: boolean }) {
  const config = getStatusConfig(status, stale);
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={cn(
        "gap-1.5 transition-all duration-300", 
        config.className,
        config.animated && "pulse-subtle"
      )}
    >
      <Icon className={cn("h-3 w-3", config.animated && "animate-pulse")} />
      {config.label}
    </Badge>
  );
}

function TransactionRow({
  index,
  transactionPda,
  status,
  stale,
  multisigPda,
  programId,
}: {
  index: number;
  transactionPda: string;
  status: string;
  stale: boolean;
  multisigPda: string;
  programId: string;
}) {
  const { rpcUrl } = useRpcUrl();
  const { explorerUrl } = useExplorerUrl();
  
  const explorerLink = `${explorerUrl}/address/${transactionPda}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl || '')}`;

  return (
    <TableRow className="group">
      <TableCell>
        <span className="font-mono font-medium">#{index}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
            {transactionPda.slice(0, 8)}...{transactionPda.slice(-8)}
          </code>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100" asChild>
            <a href={explorerLink} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={status} stale={stale} />
      </TableCell>
      <TableCell>
        {!stale ? (
          <div className="flex items-center gap-1">
            <ApproveButton
              multisigPda={multisigPda}
              transactionIndex={index}
              proposalStatus={status}
              programId={programId}
            />
            <RejectButton
              multisigPda={multisigPda}
              transactionIndex={index}
              proposalStatus={status}
              programId={programId}
            />
            <ExecuteButton
              multisigPda={multisigPda}
              transactionIndex={index}
              proposalStatus={status}
              programId={programId}
            />
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No actions available</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function TransactionsTableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border/50 p-4">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-24" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTransactions() {
  return (
    <Empty className="min-h-[400px] border-dashed">
      <EmptyMedia variant="icon">
        <ArrowLeftRight className="h-6 w-6" />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>No transactions yet</EmptyTitle>
        <EmptyDescription>
          Create your first transaction to get started with your multisig operations.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateTransaction />
      </EmptyContent>
    </Empty>
  );
}

export default function TransactionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageParam = new URLSearchParams(location.search).get('page');
  let page = pageParam ? parseInt(pageParam, 10) : 1;
  if (page < 1) page = 1;

  const { multisigAddress, programId } = useMultisigData();
  const { data: multisigConfig, isLoading: configLoading } = useMultisig();

  const totalTransactions = Number(multisigConfig?.transactionIndex || 0);
  const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);

  const startIndex = totalTransactions - (page - 1) * TRANSACTIONS_PER_PAGE;
  const endIndex = Math.max(startIndex - TRANSACTIONS_PER_PAGE + 1, 1);

  const { data: latestTransactions, isLoading: txLoading } = useTransactions(startIndex, endIndex);

  const transactions = (latestTransactions || []).map((transaction) => ({
    ...transaction,
    transactionPda: transaction.transactionPda[0].toBase58(),
  }));

  const isLoading = configLoading || txLoading;
  const staleIndex = multisigConfig ? Number(multisigConfig.staleTransactionIndex) : 0;

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="mt-1 text-muted-foreground">
              Manage and execute multisig proposals
            </p>
          </div>
          <CreateTransaction />
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="card-hover animate-in" style={{ animationDelay: '0s', opacity: 0 }}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-numbers">{totalTransactions}</p>
                <p className="text-xs text-muted-foreground">Total Transactions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover animate-in" style={{ animationDelay: '0.05s', opacity: 0 }}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-numbers">{staleIndex}</p>
                <p className="text-xs text-muted-foreground">Stale Index</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover animate-in" style={{ animationDelay: '0.1s', opacity: 0 }}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-numbers">{page}/{totalPages || 1}</p>
                <p className="text-xs text-muted-foreground">Current Page</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card className="animate-in" style={{ animationDelay: '0.15s', opacity: 0 }}>
          <CardHeader className="border-b border-border/50">
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              View and manage all multisig transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <TransactionsTableSkeleton />
              </div>
            ) : transactions.length === 0 ? (
              <EmptyTransactions />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[80px]">Index</TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const isStale = staleIndex > Number(tx.index);
                      return (
                        <TransactionRow
                          key={tx.transactionPda}
                          index={Number(tx.index)}
                          transactionPda={tx.transactionPda}
                          status={tx.proposal?.status.__kind || 'None'}
                          stale={isStale}
                          multisigPda={multisigAddress!}
                          programId={programId?.toBase58() || multisig.PROGRAM_ID.toBase58()}
                        />
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
                    <p className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => navigate(`/transactions?page=${page - 1}`)}
                          >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Previous
                          </Button>
                        </PaginationItem>
                        <PaginationItem>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => navigate(`/transactions?page=${page + 1}`)}
                          >
                            Next
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

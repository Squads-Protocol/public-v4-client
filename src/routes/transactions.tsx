import * as multisig from '@sqds/multisig';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import ApproveButton from '@/components/transactions/ApproveButton';
import CreateTransaction from '@/components/transactions/CreateTransactionButton';
import ExecuteButton from '@/components/transactions/ExecuteButton';
import RejectButton from '@/components/transactions/RejectButton';
import { TransactionDetailDrawer } from '@/components/transactions/TransactionDetailDrawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisig, useTransactions } from '@/hooks/useServices';
import { useExplorerUrl, useRpcUrl } from '@/hooks/useSettings';
import { cn } from '~/lib/utils';

const TRANSACTIONS_PER_PAGE = 10;

type StatusFilter = 'all' | 'pending' | 'approved' | 'executed' | 'rejected' | 'stale';

const filterOptions: { value: StatusFilter; label: string; icon: typeof Clock }[] = [
  { value: 'all', label: 'All', icon: Filter },
  { value: 'pending', label: 'Pending', icon: Clock },
  { value: 'approved', label: 'Approved', icon: CheckCircle2 },
  { value: 'executed', label: 'Executed', icon: CheckCircle2 },
  { value: 'rejected', label: 'Rejected', icon: XCircle },
  { value: 'stale', label: 'Stale', icon: AlertCircle },
];

function FilterBar({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filterOptions.map((option) => {
        const Icon = option.icon;
        const isActive = activeFilter === option.value;
        return (
          <Button
            key={option.value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'gap-1.5 transition-all',
              isActive && 'shadow-md',
              !isActive && 'hover:bg-muted'
            )}
            onClick={() => onFilterChange(option.value)}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </Button>
        );
      })}
      {activeFilter !== 'all' && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => onFilterChange('all')}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

function getStatusConfig(status: string, stale: boolean) {
  if (stale) {
    return {
      label: 'Stale',
      variant: 'outline' as const,
      icon: AlertCircle,
      className: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
      animated: false,
    };
  }

  switch (status) {
    case 'Approved':
      return {
        label: 'Approved',
        variant: 'outline' as const,
        icon: CheckCircle2,
        className: 'border-green-500/30 text-green-500 bg-green-500/10',
        animated: false,
      };
    case 'Rejected':
      return {
        label: 'Rejected',
        variant: 'outline' as const,
        icon: XCircle,
        className: 'border-red-500/30 text-red-500 bg-red-500/10',
        animated: false,
      };
    case 'Executed':
      return {
        label: 'Executed',
        variant: 'outline' as const,
        icon: CheckCircle2,
        className: 'border-blue-500/30 text-blue-500 bg-blue-500/10',
        animated: false,
      };
    case 'Cancelled':
      return {
        label: 'Cancelled',
        variant: 'outline' as const,
        icon: XCircle,
        className: 'border-muted-foreground/30 text-muted-foreground bg-muted/50',
        animated: false,
      };
    case 'Active':
      return {
        label: 'Active',
        variant: 'outline' as const,
        icon: Clock,
        className: 'border-primary/30 text-primary bg-primary/10',
        animated: true,
      };
    default:
      return {
        label: 'Pending',
        variant: 'outline' as const,
        icon: Clock,
        className: 'border-muted-foreground/30 text-muted-foreground bg-muted/30',
        animated: true,
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
        'gap-1.5 transition-all duration-300',
        config.className,
        config.animated && 'pulse-subtle'
      )}
    >
      <Icon className={cn('h-3 w-3', config.animated && 'animate-pulse')} />
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
  onClick,
}: {
  index: number;
  transactionPda: string;
  status: string;
  stale: boolean;
  multisigPda: string;
  programId: string;
  onClick?: () => void;
}) {
  const { rpcUrl } = useRpcUrl();
  const { explorerUrl } = useExplorerUrl();

  const explorerLink = `${explorerUrl}/address/${transactionPda}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl || '')}`;

  return (
    <TableRow className="group cursor-pointer hover:bg-muted/50" onClick={onClick}>
      <TableCell>
        <span className="font-mono font-medium">#{index}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
            {transactionPda.slice(0, 8)}...{transactionPda.slice(-8)}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
            asChild
          >
            <a href={explorerLink} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={status} stale={stale} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
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

type TransactionData = {
  index: number;
  transactionPda: string;
  status: string;
  isStale: boolean;
  proposal?: any;
};

export default function TransactionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageParam = new URLSearchParams(location.search).get('page');
  const filterParam = new URLSearchParams(location.search).get('filter') as StatusFilter | null;
  let page = pageParam ? parseInt(pageParam, 10) : 1;
  if (page < 1) page = 1;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(filterParam || 'all');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { multisigAddress, programId } = useMultisigData();
  const { rpcUrl } = useRpcUrl();
  const { explorerUrl } = useExplorerUrl();
  const { data: multisigConfig, isLoading: configLoading } = useMultisig();

  const totalTransactions = Number(multisigConfig?.transactionIndex || 0);
  const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);

  const startIndex = totalTransactions - (page - 1) * TRANSACTIONS_PER_PAGE;
  const endIndex = Math.max(startIndex - TRANSACTIONS_PER_PAGE + 1, 1);

  const { data: latestTransactions, isLoading: txLoading } = useTransactions(startIndex, endIndex);
  const staleIndex = multisigConfig ? Number(multisigConfig.staleTransactionIndex) : 0;

  const transactions = useMemo(() => {
    const mapped = (latestTransactions || []).map((transaction) => ({
      ...transaction,
      transactionPda: transaction.transactionPda[0].toBase58(),
      isStale: staleIndex > Number(transaction.index),
    }));

    if (statusFilter === 'all') return mapped;

    return mapped.filter((tx) => {
      const status = tx.proposal?.status.__kind || 'None';
      switch (statusFilter) {
        case 'pending':
          return !tx.isStale && (status === 'None' || status === 'Active');
        case 'approved':
          return status === 'Approved';
        case 'executed':
          return status === 'Executed';
        case 'rejected':
          return status === 'Rejected' || status === 'Cancelled';
        case 'stale':
          return tx.isStale;
        default:
          return true;
      }
    });
  }, [latestTransactions, statusFilter, staleIndex]);

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    const params = new URLSearchParams(location.search);
    if (filter === 'all') {
      params.delete('filter');
    } else {
      params.set('filter', filter);
    }
    params.set('page', '1');
    navigate(`/transactions?${params.toString()}`);
  };

  const isLoading = configLoading || txLoading;

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="mt-1 text-muted-foreground">Manage and execute multisig proposals</p>
          </div>
          <CreateTransaction />
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="card-hover animate-in stagger-1">
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
          <Card className="card-hover animate-in stagger-2">
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
          <Card className="card-hover animate-in stagger-3">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono-numbers">
                  {page}/{totalPages || 1}
                </p>
                <p className="text-xs text-muted-foreground">Current Page</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="animate-in stagger-4">
          <FilterBar activeFilter={statusFilter} onFilterChange={handleFilterChange} />
        </div>

        {/* Transactions Table */}
        <Card className="animate-in stagger-5">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  {statusFilter === 'all'
                    ? 'View and manage all multisig transactions'
                    : `Showing ${statusFilter} transactions`}
                </CardDescription>
              </div>
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="ml-2">
                  {transactions.length} result{transactions.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <TransactionsTableSkeleton />
              </div>
            ) : transactions.length === 0 ? (
              statusFilter === 'all' ? (
                <EmptyTransactions />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Filter className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-4 text-sm font-medium">No {statusFilter} transactions</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try changing your filter or check back later
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => handleFilterChange('all')}
                  >
                    Clear filter
                  </Button>
                </div>
              )
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
                    {transactions.map((tx) => (
                      <TransactionRow
                        key={tx.transactionPda}
                        index={Number(tx.index)}
                        transactionPda={tx.transactionPda}
                        status={tx.proposal?.status.__kind || 'None'}
                        stale={tx.isStale}
                        multisigPda={multisigAddress!}
                        programId={programId?.toBase58() || multisig.PROGRAM_ID.toBase58()}
                        onClick={() => {
                          setSelectedTransaction({
                            index: Number(tx.index),
                            transactionPda: tx.transactionPda,
                            status: tx.proposal?.status.__kind || 'None',
                            isStale: tx.isStale,
                            proposal: tx.proposal,
                          });
                          setDrawerOpen(true);
                        }}
                      />
                    ))}
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
                            onClick={() => {
                              const params = new URLSearchParams(location.search);
                              params.set('page', String(page - 1));
                              navigate(`/transactions?${params.toString()}`);
                            }}
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
                            onClick={() => {
                              const params = new URLSearchParams(location.search);
                              params.set('page', String(page + 1));
                              navigate(`/transactions?${params.toString()}`);
                            }}
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

        {/* Transaction Detail Drawer */}
        <TransactionDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          transaction={selectedTransaction}
          multisigPda={multisigAddress || ''}
          programId={programId?.toBase58() || multisig.PROGRAM_ID.toBase58()}
          explorerUrl={explorerUrl}
          rpcUrl={rpcUrl || ''}
        />
      </div>
    </ErrorBoundary>
  );
}

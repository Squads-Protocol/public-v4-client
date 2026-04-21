import { Loader2 } from 'lucide-react';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Suspense } from 'react';
import CreateTransaction from '@/components/CreateTransactionButton';
import TransactionTable from '@/components/TransactionTable';
import { useMultisig, useTransactions } from '@/hooks/useServices';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const TRANSACTIONS_PER_PAGE = 10;

export default function TransactionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageParam = new URLSearchParams(location.search).get('page');
  let page = pageParam ? parseInt(pageParam, 10) : 1;
  if (page < 1) {
    page = 1;
  }
  const { multisigAddress, programId } = useMultisigData();

  const { data } = useMultisig();

  const totalTransactions = Number(data ? data.transactionIndex : 0);
  const totalPages = Math.ceil(totalTransactions / TRANSACTIONS_PER_PAGE);

  const startIndex = totalTransactions - (page - 1) * TRANSACTIONS_PER_PAGE;
  const endIndex = Math.max(startIndex - TRANSACTIONS_PER_PAGE + 1, 1);

  const { data: latestTransactions, isFetching } = useTransactions(startIndex, endIndex);

  const transactions = (latestTransactions || []).map((transaction) => {
    return {
      ...transaction,
      transactionPda: transaction.transactionPda[0].toBase58(),
    };
  });

  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading ...</div>}>
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              Transactions
              {isFetching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </h1>
            <CreateTransaction />
          </div>

          <Suspense>
            <Table>
              <TableHeader className="hidden md:table-header-group">
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Index</TableHead>
                  <TableHead>Transaction Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <Suspense>
                <TransactionTable
                  multisigPda={multisigAddress!}
                  transactions={transactions}
                  programId={programId!.toBase58()}
                />
              </Suspense>
            </Table>
          </Suspense>

          {totalPages > 0 && (
            <Pagination className="mt-4">
              <PaginationContent>
                {page > 1 && (
                  <PaginationPrevious
                    onClick={() => navigate(`/transactions?page=${page - 1}`)}
                    to={`/transactions?page=${page - 1}`}
                  />
                )}
                <PaginationItem>
                  <span className="px-3 text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                </PaginationItem>
                {page < totalPages && (
                  <PaginationNext
                    to={`/transactions?page=${page + 1}`}
                    onClick={() => navigate(`/transactions?page=${page + 1}`)}
                  />
                )}
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

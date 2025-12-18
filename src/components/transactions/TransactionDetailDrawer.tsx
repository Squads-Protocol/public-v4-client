import {
  ExternalLink,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Hash,
  Calendar,
} from 'lucide-react';
import { useState } from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import ApproveButton from './ApproveButton';
import ExecuteButton from './ExecuteButton';
import RejectButton from './RejectButton';
import { cn } from '~/lib/utils';

type TransactionDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    index: number;
    transactionPda: string;
    status: string;
    isStale: boolean;
    proposal?: {
      approved?: string[];
      rejected?: string[];
      cancelled?: string[];
    } | null;
  } | null;
  multisigPda: string;
  programId: string;
  explorerUrl: string;
  rpcUrl: string;
};

function getStatusConfig(status: string, stale: boolean) {
  if (stale) {
    return {
      label: 'Stale',
      icon: AlertCircle,
      className: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
    };
  }

  switch (status) {
    case 'Approved':
      return {
        label: 'Approved',
        icon: CheckCircle2,
        className: 'border-green-500/30 text-green-500 bg-green-500/10',
      };
    case 'Rejected':
      return {
        label: 'Rejected',
        icon: XCircle,
        className: 'border-red-500/30 text-red-500 bg-red-500/10',
      };
    case 'Executed':
      return {
        label: 'Executed',
        icon: CheckCircle2,
        className: 'border-blue-500/30 text-blue-500 bg-blue-500/10',
      };
    case 'Cancelled':
      return {
        label: 'Cancelled',
        icon: XCircle,
        className: 'border-muted-foreground/30 text-muted-foreground bg-muted/50',
      };
    case 'Active':
      return {
        label: 'Active',
        icon: Clock,
        className: 'border-primary/30 text-primary bg-primary/10',
      };
    case 'None':
    default:
      return {
        label: 'Pending',
        icon: Clock,
        className: 'border-muted-foreground/30 text-muted-foreground bg-muted/30',
      };
  }
}

function truncateAddress(address: string, chars = 8): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function TransactionDetailDrawer({
  open,
  onOpenChange,
  transaction,
  multisigPda,
  programId,
  explorerUrl,
  rpcUrl,
}: TransactionDetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const statusConfig = getStatusConfig(transaction.status, transaction.isStale);
  const StatusIcon = statusConfig.icon;

  const explorerLink = `${explorerUrl}/address/${transaction.transactionPda}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl || '')}`;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(transaction.transactionPda);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Hash className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle>Transaction #{transaction.index}</SheetTitle>
              <SheetDescription>Transaction details and actions</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="mt-6 h-[calc(100vh-200px)]">
          <div className="space-y-6 pr-4">
            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('gap-1.5', statusConfig.className)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusConfig.label}
                </Badge>
                {transaction.isStale && (
                  <span className="text-xs text-muted-foreground">
                    This transaction is stale and cannot be executed
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Transaction Address */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Transaction Address
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                <code className="flex-1 break-all font-mono text-xs">
                  {transaction.transactionPda}
                </code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyAddress}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                  <a href={explorerLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Votes Summary */}
            {transaction.proposal && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground">Votes</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Approved</span>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-green-500">
                        {transaction.proposal.approved?.length || 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">Rejected</span>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-red-500">
                        {transaction.proposal.rejected?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Voters List */}
            {transaction.proposal?.approved && transaction.proposal.approved.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Approved By ({transaction.proposal.approved.length})
                  </label>
                  <div className="space-y-2">
                    {transaction.proposal.approved.map((voter: string, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 p-2"
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <code className="font-mono text-xs">{truncateAddress(voter)}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {transaction.proposal?.rejected && transaction.proposal.rejected.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Rejected By ({transaction.proposal.rejected.length})
                  </label>
                  <div className="space-y-2">
                    {transaction.proposal.rejected.map((voter: string, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 p-2"
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <code className="font-mono text-xs">{truncateAddress(voter)}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            {!transaction.isStale && (
              <>
                <Separator />
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground">Actions</label>
                  <div className="flex flex-wrap gap-2">
                    <ApproveButton
                      multisigPda={multisigPda}
                      transactionIndex={transaction.index}
                      proposalStatus={transaction.status}
                      programId={programId}
                    />
                    <RejectButton
                      multisigPda={multisigPda}
                      transactionIndex={transaction.index}
                      proposalStatus={transaction.status}
                      programId={programId}
                    />
                    <ExecuteButton
                      multisigPda={multisigPda}
                      transactionIndex={transaction.index}
                      proposalStatus={transaction.status}
                      programId={programId}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

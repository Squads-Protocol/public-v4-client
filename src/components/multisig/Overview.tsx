import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  Wallet, 
  Users, 
  ArrowLeftRight, 
  Shield, 
  Copy, 
  Check,
  ExternalLink,
  TrendingUp,
  Coins
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisig, useBalance, useGetTokens } from '@/hooks/useServices';
import { useExplorerUrl } from '@/hooks/useSettings';
import { TokenList } from '@/components/vault/TokenList';
import { VaultSelector } from '@/components/vault/VaultSelector';
import { cn } from '~/lib/utils';

function truncateAddress(address: string, chars = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  className,
  index = 0
}: { 
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  index?: number;
}) {
  return (
    <Card 
      className={cn("stat-card card-hover animate-in", className)}
      style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight font-mono-numbers">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
            trend === 'up' && "bg-green-500/10 text-green-500",
            trend === 'down' && "bg-red-500/10 text-red-500",
            (!trend || trend === 'neutral') && "bg-primary/10 text-primary"
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VaultCard() {
  const { multisigVault: vaultAddress, rpcUrl } = useMultisigData();
  const { explorerUrl } = useExplorerUrl();
  const { data: solBalance = 0, isLoading } = useBalance();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (vaultAddress) {
      await navigator.clipboard.writeText(vaultAddress.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const explorerLink = vaultAddress 
    ? `${explorerUrl}/address/${vaultAddress.toBase58()}?cluster=custom&customUrl=${encodeURIComponent(rpcUrl || '')}`
    : '';

  return (
    <Card className="card-hover relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Squad Vault</CardTitle>
              <CardDescription>Primary treasury</CardDescription>
            </div>
          </div>
          <VaultSelector />
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        {vaultAddress && (
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 p-3">
            <code className="flex-1 truncate font-mono text-sm">
              {truncateAddress(vaultAddress.toBase58(), 12)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={copyAddress}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              asChild
            >
              <a href={explorerLink} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
        
        <div className="flex items-baseline justify-between rounded-lg bg-gradient-to-r from-primary/10 to-transparent p-4">
          <div>
            <p className="text-sm text-muted-foreground">SOL Balance</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-8 w-32" />
            ) : (
              <p className="text-3xl font-bold font-mono-numbers">
                {(solBalance / LAMPORTS_PER_SOL).toLocaleString(undefined, { 
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4 
                })}
                <span className="ml-2 text-lg font-normal text-muted-foreground">SOL</span>
              </p>
            )}
          </div>
          <TrendingUp className="h-8 w-8 text-primary/30" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
        <CardDescription>Common operations</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link to="/transactions">
            <ArrowLeftRight className="h-4 w-4" />
            View Transactions
          </Link>
        </Button>
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link to="/config">
            <Users className="h-4 w-4" />
            Manage Members
          </Link>
        </Button>
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link to="/programs">
            <Shield className="h-4 w-4" />
            Program Manager
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ThresholdCard() {
  const { data: multisigConfig, isLoading } = useMultisig();
  
  if (isLoading) {
    return (
      <Card className="card-hover">
        <CardContent className="p-6">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!multisigConfig) return null;

  const threshold = multisigConfig.threshold;
  const memberCount = multisigConfig.members.length;
  const percentage = (threshold / memberCount) * 100;

  return (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Approval Threshold</p>
            <p className="text-2xl font-bold">
              {threshold} <span className="text-lg text-muted-foreground">of {memberCount}</span>
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary">
            {percentage.toFixed(0)}% required
          </Badge>
        </div>
        <Progress value={percentage} className="mt-4 h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {threshold} signature{threshold !== 1 ? 's' : ''} needed to execute transactions
        </p>
      </CardContent>
    </Card>
  );
}

export default function Overview() {
  const { multisigAddress } = useMultisigData();
  const { data: multisigConfig, isLoading: configLoading } = useMultisig();
  const { data: solBalance = 0, isLoading: balanceLoading } = useBalance();
  const { data: tokens = [] } = useGetTokens();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of your Squad multisig wallet
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={balanceLoading ? '...' : `${(solBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`}
          description="Native SOL balance"
          icon={Wallet}
          index={0}
        />
        <StatCard
          title="Members"
          value={configLoading ? '...' : multisigConfig?.members.length || 0}
          description="Active signers"
          icon={Users}
          index={1}
        />
        <StatCard
          title="Transactions"
          value={configLoading ? '...' : Number(multisigConfig?.transactionIndex || 0)}
          description="Total created"
          icon={ArrowLeftRight}
          index={2}
        />
        <StatCard
          title="Token Types"
          value={tokens?.length || 0}
          description="SPL tokens held"
          icon={Coins}
          index={3}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="animate-in" style={{ animationDelay: '0.2s', opacity: 0 }}>
            <VaultCard />
          </div>
          <div className="animate-in" style={{ animationDelay: '0.25s', opacity: 0 }}>
            <ThresholdCard />
          </div>
        </div>
        <div className="animate-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
          <QuickActions />
        </div>
      </div>

      {/* Token List */}
      {multisigAddress && (
        <TokenList multisigPda={multisigAddress} />
      )}
    </div>
  );
}

import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Coins, Send, Wallet, Plus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '../ui/empty';
import SendTokens from './SendTokensButton';
import SendSol from './SendSolButton';
import { useMultisigData } from '~/hooks/useMultisigData';
import { useBalance, useGetTokens } from '~/hooks/useServices';
import { cn } from '~/lib/utils';

type TokenListProps = {
  multisigPda: string;
};

function TokenCard({ 
  symbol, 
  name, 
  amount, 
  decimals,
  mint,
  action 
}: { 
  symbol: string;
  name?: string;
  amount: number | string;
  decimals?: number;
  mint?: string;
  action: React.ReactNode;
}) {
  // Generate a color based on the symbol/mint for variety
  const getTokenColor = (id: string) => {
    const colors = [
      'from-violet-500/20 to-violet-500/5',
      'from-blue-500/20 to-blue-500/5',
      'from-cyan-500/20 to-cyan-500/5',
      'from-emerald-500/20 to-emerald-500/5',
      'from-amber-500/20 to-amber-500/5',
      'from-rose-500/20 to-rose-500/5',
      'from-pink-500/20 to-pink-500/5',
    ];
    const hash = id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const gradientClass = getTokenColor(mint || symbol);

  return (
    <Card className="card-interactive relative group overflow-hidden">
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100", gradientClass)} />
      <CardContent className="relative p-4">
        <div className="flex items-center gap-4">
          {/* Token Icon */}
          <div className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
            symbol === 'SOL' ? 'from-purple-500/20 to-purple-500/5' : gradientClass
          )}>
            {symbol === 'SOL' ? (
              <Wallet className="h-6 w-6 text-purple-400" />
            ) : (
              <Coins className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Token Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{symbol}</h3>
              {symbol === 'SOL' && (
                <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-[10px]">
                  Native
                </Badge>
              )}
            </div>
            {name && (
              <p className="truncate text-xs text-muted-foreground">{name}</p>
            )}
            {mint && mint !== 'SOL' && (
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {mint.slice(0, 8)}...{mint.slice(-8)}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="text-right">
            <p className="font-mono text-lg font-semibold font-mono-numbers">
              {typeof amount === 'number' 
                ? amount.toLocaleString(undefined, { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: decimals || 4 
                  })
                : amount
              }
            </p>
            <p className="text-xs text-muted-foreground">{symbol}</p>
          </div>

          {/* Action */}
          <div className="shrink-0">
            {action}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TokenListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="text-right space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-9 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TokenList({ multisigPda }: TokenListProps) {
  const { vaultIndex, programId } = useMultisigData();
  const { data: solBalance = 0, isLoading: solLoading } = useBalance();
  const { data: tokens = null, isLoading: tokensLoading } = useGetTokens();

  const isLoading = solLoading || tokensLoading;
  const hasTokens = tokens && tokens.length > 0;
  const totalAssets = 1 + (tokens?.length || 0); // SOL + SPL tokens

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Assets
            </CardTitle>
            <CardDescription>
              {isLoading ? 'Loading...' : `${totalAssets} asset${totalAssets !== 1 ? 's' : ''} in vault`}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-mono">
            Vault #{vaultIndex}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <TokenListSkeleton />
        ) : (
          <div className="space-y-3">
            {/* SOL Token */}
            <TokenCard
              symbol="SOL"
              name="Solana"
              amount={solBalance / LAMPORTS_PER_SOL}
              decimals={9}
              action={
                <SendSol multisigPda={multisigPda} vaultIndex={vaultIndex} />
              }
            />

            {/* SPL Tokens */}
            {hasTokens && tokens.map((token) => (
              <TokenCard
                key={token.account.data.parsed.info.mint}
                symbol={token.account.data.parsed.info.mint.slice(0, 4).toUpperCase()}
                name={`SPL Token`}
                mint={token.account.data.parsed.info.mint}
                amount={token.account.data.parsed.info.tokenAmount.uiAmount}
                decimals={token.account.data.parsed.info.tokenAmount.decimals}
                action={
                  <SendTokens
                    mint={token.account.data.parsed.info.mint}
                    tokenAccount={token.pubkey.toBase58()}
                    decimals={token.account.data.parsed.info.tokenAmount.decimals}
                    multisigPda={multisigPda}
                    vaultIndex={vaultIndex}
                    programId={programId.toBase58()}
                  />
                }
              />
            ))}

            {/* Empty state for when there are no SPL tokens */}
            {!hasTokens && (
              <Empty className="mt-6 border-dashed">
                <EmptyMedia variant="icon">
                  <Plus className="h-5 w-5" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No SPL Tokens</EmptyTitle>
                  <EmptyDescription>
                    This vault only contains SOL. Send SPL tokens to your vault address to see them here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

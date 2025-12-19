import { Code, ExternalLink, Globe, Info, Server } from 'lucide-react';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import SetExplorerInput from '@/components/settings/SetExplorerInput';
import SetProgramIdInput from '@/components/settings/SetProgramIdInput';
import SetRpcUrlInput from '@/components/settings/SetRpcUrlInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useExplorerUrl, useProgramId, useRpcUrl } from '@/hooks/useSettings';

function SettingCard({
  icon: Icon,
  title,
  description,
  children,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          {badge && (
            <Badge variant="outline" className="shrink-0">
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CurrentSettings() {
  const { rpcUrl } = useRpcUrl();
  const { explorerUrl } = useExplorerUrl();
  const { programId } = useProgramId();

  return (
    <Card className="card-hover overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
            <Info className="h-3.5 w-3.5 text-foreground" />
          </div>
          Current Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">RPC Endpoint</p>
          <code className="mt-1 block truncate text-xs">{rpcUrl || 'Default (Mainnet)'}</code>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Explorer</p>
          <code className="mt-1 block truncate text-xs">{explorerUrl || 'Solana Explorer'}</code>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">Program ID</p>
          <code className="mt-1 block truncate text-xs">{programId || 'Default Squads v4'}</code>
        </div>
      </CardContent>
    </Card>
  );
}

const SettingsPage = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <div className="space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="mt-1 text-muted-foreground">
              Configure app preferences and connection settings
            </p>
          </div>

          {/* Info Alert */}
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>Settings are stored locally</AlertTitle>
            <AlertDescription>
              All settings are saved in your browser's local storage and will persist across
              sessions.
            </AlertDescription>
          </Alert>

          {/* Settings Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <SettingCard
                icon={Server}
                title="RPC Endpoint"
                description="Configure the Solana RPC URL for blockchain interactions"
                badge="Network"
              >
                <div className="space-y-4">
                  <SetRpcUrlInput />
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>Use a custom RPC for better performance or specific network access</span>
                  </div>
                </div>
              </SettingCard>

              <SettingCard
                icon={ExternalLink}
                title="Block Explorer"
                description="Choose which explorer to use for viewing transactions and accounts"
                badge="Display"
              >
                <div className="space-y-4">
                  <SetExplorerInput />
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>Explorer URLs are used for viewing transaction and account details</span>
                  </div>
                </div>
              </SettingCard>

              <SettingCard
                icon={Code}
                title="Program ID"
                description="Set a custom Squads multisig program ID"
                badge="Advanced"
              >
                <div className="space-y-4">
                  <SetProgramIdInput />
                  <Separator />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    <span>Only change this if you're using a forked or custom Squads program</span>
                  </div>
                </div>
              </SettingCard>
            </div>

            <div>
              <CurrentSettings />
            </div>
          </div>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

export default SettingsPage;

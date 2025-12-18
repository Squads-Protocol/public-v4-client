import { Suspense, useState } from 'react';
import { 
  Box, 
  Shield, 
  Upload, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Info,
  Code,
  RefreshCw
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import ChangeUpgradeAuthorityInput from '@/components/programs/ChangeUpgradeAuthorityInput';
import CreateProgramUpgradeInput from '@/components/programs/CreateProgramUpgradeInput';
import { useMultisig } from '@/hooks/useServices';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { useProgram } from '@/hooks/useProgram';
import { cn } from '~/lib/utils';

function ProgramInfoCard({ programInfos, validatedProgramId }: { 
  programInfos: { programDataAddress: string; authority: string | null } | null;
  validatedProgramId: string;
}) {
  if (!programInfos) {
    return (
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <AlertTitle>Program Not Found</AlertTitle>
        <AlertDescription>
          No program found with this ID or unable to fetch program data.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="card-hover overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-transparent" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-base">Program Validated</CardTitle>
              <CardDescription className="font-mono text-xs">
                {validatedProgramId.slice(0, 16)}...
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-green-500/30 text-green-500 bg-green-500/10">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Program Data Address</p>
            <code className="mt-1 block truncate text-xs font-mono">
              {programInfos.programDataAddress}
            </code>
          </div>
          <Separator />
          <div>
            <p className="text-xs text-muted-foreground">Upgrade Authority</p>
            <code className="mt-1 block truncate text-xs font-mono">
              {programInfos.authority || 'Immutable (No Authority)'}
            </code>
          </div>
        </div>
        
        {!programInfos.authority && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-sm">Immutable Program</AlertTitle>
            <AlertDescription className="text-xs">
              This program has no upgrade authority and cannot be modified.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ProgramActionCard({ 
  icon: Icon, 
  title, 
  description, 
  iconColor,
  children 
}: { 
  icon: React.ElementType;
  title: string;
  description: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="card-hover h-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconColor)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

const ProgramsPage = () => {
  const { data: multisigConfig, isLoading: configLoading } = useMultisig();

  // State for program ID input and validation
  const [programIdInput, setProgramIdInput] = useState('');
  const [programIdError, setProgramIdError] = useState('');
  const [validatedProgramId, setValidatedProgramId] = useState<string | null>(null);

  // Only use the hook when we have a validated program ID
  const { data: programInfos, isLoading: programLoading } = useProgram(validatedProgramId);

  // Validate the program ID
  const validateProgramId = () => {
    setProgramIdError('');

    if (!programIdInput.trim()) {
      setProgramIdError('Program ID is required');
      return;
    }

    try {
      new PublicKey(programIdInput);
      setValidatedProgramId(programIdInput);
    } catch (error) {
      setProgramIdError('Invalid Program ID format');
    }
  };

  // Clear program ID and related data
  const clearProgramId = () => {
    setProgramIdInput('');
    setValidatedProgramId(null);
    setProgramIdError('');
  };

  const transactionIndex = Number(multisigConfig?.transactionIndex || 0) + 1;

  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
            <p className="mt-1 text-muted-foreground">
              Manage program upgrades and authority settings
            </p>
          </div>

          {/* Info Alert */}
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>Program Manager</AlertTitle>
            <AlertDescription>
              Enter a program ID to view its details and manage upgrades. Only programs with your Squad as the upgrade authority can be modified.
            </AlertDescription>
          </Alert>

          {/* Program Lookup */}
          <Card className="card-hover">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Lookup Program</CardTitle>
                  <CardDescription>
                    Enter a program ID to view its upgrade authority and manage settings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative flex-1">
                  <Code className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Enter Program ID (e.g., SQDS4ep65T...)"
                    value={programIdInput}
                    onChange={(e) => setProgramIdInput(e.target.value)}
                    className={cn(
                      "pl-10 font-mono text-sm",
                      programIdError && 'border-red-500 focus-visible:ring-red-500'
                    )}
                    onKeyDown={(e) => e.key === 'Enter' && validateProgramId()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={validateProgramId} className="gap-2">
                    <Search className="h-4 w-4" />
                    Validate
                  </Button>
                  {validatedProgramId && (
                    <Button variant="outline" onClick={clearProgramId} className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              {programIdError && (
                <p className="mt-2 text-sm text-red-500">{programIdError}</p>
              )}
            </CardContent>
          </Card>

          {/* Program Info & Actions */}
          {validatedProgramId && (
            <>
              {programLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-64" />
                      </div>
                    </div>
                    <div className="mt-6 space-y-3">
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <ProgramInfoCard 
                  programInfos={programInfos || null} 
                  validatedProgramId={validatedProgramId} 
                />
              )}

              {/* Action Cards */}
              {multisigConfig && programInfos && programInfos.authority && (
                <div className="grid gap-4 md:grid-cols-2">
                  <ProgramActionCard
                    icon={Shield}
                    title="Change Upgrade Authority"
                    description="Transfer program control to a new authority"
                    iconColor="bg-amber-500"
                  >
                    <ChangeUpgradeAuthorityInput
                      programInfos={programInfos}
                      transactionIndex={transactionIndex}
                    />
                  </ProgramActionCard>

                  <ProgramActionCard
                    icon={Upload}
                    title="Upgrade Program"
                    description="Deploy a new version of the program"
                    iconColor="bg-green-500"
                  >
                    <CreateProgramUpgradeInput
                      programInfos={programInfos}
                      transactionIndex={transactionIndex}
                    />
                  </ProgramActionCard>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!validatedProgramId && (
            <Empty className="min-h-[300px] border-dashed">
              <EmptyMedia variant="icon">
                <Box className="h-6 w-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No program selected</EmptyTitle>
                <EmptyDescription>
                  Enter a program ID above to view its details and manage upgrades.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

export default ProgramsPage;

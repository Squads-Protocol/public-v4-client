import { Suspense } from 'react';
import { 
  Users, 
  Shield, 
  UserPlus, 
  Settings2, 
  Copy, 
  Check,
  Trash2,
  Vote,
  Pen,
  Play
} from 'lucide-react';
import { useState } from 'react';
import * as multisig from '@sqds/multisig';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import AddMemberInput from '@/components/members/AddMemberInput';
import ChangeThresholdInput from '@/components/members/ChangeThresholdInput';
import RemoveMemberButton from '@/components/members/RemoveMemberButton';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisig } from '@/hooks/useServices';
import { renderPermissions } from '@/lib/utils';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { cn } from '~/lib/utils';

function truncateAddress(address: string, chars = 6): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function getPermissionBadges(mask: number) {
  const permissions = [];
  
  // Check each permission bit
  if (mask & 1) permissions.push({ label: 'Initiate', icon: Pen, color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' });
  if (mask & 2) permissions.push({ label: 'Vote', icon: Vote, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' });
  if (mask & 4) permissions.push({ label: 'Execute', icon: Play, color: 'text-green-500 bg-green-500/10 border-green-500/30' });
  
  if (permissions.length === 0) {
    permissions.push({ label: 'None', icon: Shield, color: 'text-muted-foreground bg-muted/50 border-muted' });
  }
  
  return permissions;
}

function MemberCard({ 
  publicKey, 
  permissionMask,
  multisigPda,
  transactionIndex,
  programId,
  isCurrentUser = false
}: { 
  publicKey: string;
  permissionMask: number;
  multisigPda: string;
  transactionIndex: number;
  programId: string;
  isCurrentUser?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const permissions = getPermissionBadges(permissionMask);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="card-hover group overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-sm font-semibold">
              {publicKey.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Member Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="truncate font-mono text-sm font-medium">
                {truncateAddress(publicKey)}
              </code>
              {isCurrentUser && (
                <Badge variant="secondary" className="text-[10px]">You</Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={copyAddress}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            
            {/* Permissions */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <TooltipProvider>
                {permissions.map((perm) => {
                  const Icon = perm.icon;
                  return (
                    <Tooltip key={perm.label}>
                      <TooltipTrigger asChild>
                        <Badge 
                          variant="outline" 
                          className={cn("gap-1 text-[10px]", perm.color)}
                        >
                          <Icon className="h-3 w-3" />
                          {perm.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {perm.label} permission
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>

          {/* Actions */}
          <div className="shrink-0">
            <RemoveMemberButton
              memberKey={publicKey}
              multisigPda={multisigPda}
              transactionIndex={transactionIndex}
              programId={programId}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MembersSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
              <Skeleton className="h-9 w-9" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ThresholdVisualizer({ threshold, memberCount }: { threshold: number; memberCount: number }) {
  const percentage = (threshold / memberCount) * 100;
  
  return (
    <Card className="card-hover overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Approval Threshold</p>
            <p className="mt-1 text-3xl font-bold">
              {threshold}
              <span className="text-lg text-muted-foreground"> / {memberCount}</span>
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/20">
            <span className="text-xl font-bold text-primary">{percentage.toFixed(0)}%</span>
          </div>
        </div>
        <Progress value={percentage} className="mt-4 h-2" />
        <p className="mt-3 text-xs text-muted-foreground">
          {threshold} of {memberCount} signatures required to approve transactions
        </p>
      </CardContent>
    </Card>
  );
}

const ConfigurationPage = () => {
  const { multisigAddress, programId } = useMultisigData();
  const { data: multisigConfig, isLoading } = useMultisig();

  const transactionIndex = Number(multisigConfig?.transactionIndex || 0) + 1;
  const resolvedProgramId = programId?.toBase58() || multisig.PROGRAM_ID.toBase58();

  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Members</h1>
            <p className="mt-1 text-muted-foreground">
              Manage Squad members and approval settings
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : multisigConfig?.members.length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Members</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <Shield className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading ? '...' : multisigConfig?.threshold || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Threshold</p>
                </div>
              </CardContent>
            </Card>
            <Card className="card-hover">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Vote className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {isLoading || !multisigConfig 
                      ? '...' 
                      : `${((multisigConfig.threshold / multisigConfig.members.length) * 100).toFixed(0)}%`
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">Required %</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Members List */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Squad Members</CardTitle>
                      <CardDescription>
                        Members with signing authority
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {isLoading ? (
                    <MembersSkeleton />
                  ) : (
                    <div className="space-y-3">
                      {multisigConfig?.members.map((member) => (
                        <MemberCard
                          key={member.key.toBase58()}
                          publicKey={member.key.toBase58()}
                          permissionMask={member.permissions.mask}
                          multisigPda={multisigAddress!}
                          transactionIndex={transactionIndex}
                          programId={resolvedProgramId}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Actions */}
            <div className="space-y-4">
              {/* Threshold Visualizer */}
              {multisigConfig && (
                <ThresholdVisualizer 
                  threshold={multisigConfig.threshold} 
                  memberCount={multisigConfig.members.length} 
                />
              )}

              {/* Add Member */}
              <Card className="card-hover">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                      <UserPlus className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Add Member</CardTitle>
                      <CardDescription className="text-xs">
                        Invite a new signer
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <AddMemberInput
                    multisigPda={multisigAddress!}
                    transactionIndex={transactionIndex}
                    programId={resolvedProgramId}
                  />
                </CardContent>
              </Card>

              {/* Change Threshold */}
              <Card className="card-hover">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                      <Settings2 className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Change Threshold</CardTitle>
                      <CardDescription className="text-xs">
                        {multisigConfig && `Currently: ${multisigConfig.threshold} signatures`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChangeThresholdInput
                    multisigPda={multisigAddress!}
                    transactionIndex={transactionIndex}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

export default ConfigurationPage;

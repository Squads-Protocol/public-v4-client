import AddMemberInput from '@/components/AddMemberInput';
import ChangeThresholdInput from '@/components/ChangeThresholdInput';
import ChangeTimelockInput from '@/components/ChangeTimelockInput';
import RemoveMemberButton from '@/components/RemoveMemberButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { clusterApiUrl } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisig } from '@/hooks/useServices';
import { renderPermissions } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Suspense } from 'react';

const ConfigurationPage = () => {
  const { rpcUrl, multisigAddress, programId } = useMultisigData();
  const { data: multisigConfig } = useMultisig();
  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="">
          <h1 className="mb-4 text-3xl font-bold">Multisig Configuration</h1>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>
                  List of members in the multisig as well as their permissions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AddMemberInput
                  multisigPda={multisigAddress!}
                  transactionIndex={
                    Number(multisigConfig ? multisigConfig.transactionIndex : 0) + 1
                  }
                  programId={programId ? programId.toBase58() : multisig.PROGRAM_ID.toBase58()}
                />
                <hr />
                <div className="max-h-[calc(5*5rem)] overflow-y-auto pr-1">
                  <div className="space-y-8">
                    {multisigConfig &&
                      multisigConfig.members.map((member) => (
                        <div key={member.key.toBase58()}>
                          <div className="flex items-center">
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-medium leading-none">
                                Public Key: {member.key.toBase58()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Permissions: {renderPermissions(member.permissions.mask)}
                              </p>
                            </div>
                            <div className="ml-auto pl-4">
                              <RemoveMemberButton
                                memberKey={member.key.toBase58()}
                                multisigPda={multisigAddress!}
                                transactionIndex={
                                  Number(multisigConfig ? multisigConfig.transactionIndex : 0) + 1
                                }
                                programId={
                                  programId ? programId.toBase58() : multisig.PROGRAM_ID.toBase58()
                                }
                              />
                            </div>
                          </div>
                          <hr className="mt-2" />
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Change Threshold</CardTitle>
                  <CardDescription>
                    Change the threshold required to execute a Multisig transaction.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {multisigConfig ? (
                    <span>Current Threshold: {multisigConfig.threshold} </span>
                  ) : null}
                  <ChangeThresholdInput
                    multisigPda={multisigAddress!}
                    transactionIndex={
                      Number(multisigConfig ? multisigConfig.transactionIndex : 0) + 1
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Timelock</CardTitle>
                  <CardDescription>
                    Seconds that must pass between transaction approval and execution.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {multisigConfig != null ? (
                    <span>Current Timelock: {multisigConfig.timeLock}s </span>
                  ) : null}
                  <ChangeTimelockInput
                    multisigPda={multisigAddress!}
                    transactionIndex={
                      Number(multisigConfig ? multisigConfig.transactionIndex : 0) + 1
                    }
                    currentTimeLock={multisigConfig?.timeLock ?? 0}
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

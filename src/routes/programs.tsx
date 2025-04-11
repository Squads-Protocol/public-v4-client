import ChangeUpgradeAuthorityInput from '@/components/ChangeUpgradeAuthorityInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PublicKey } from '@solana/web3.js';
import { useMultisig } from '@/hooks/useServices';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Suspense, useState } from 'react';
import { useProgram } from '../hooks/useProgram';
import CreateProgramUpgradeInput from '../components/CreateProgramUpgradeInput';

const ProgramsPage = () => {
  const { data: multisigConfig } = useMultisig();

  // State for program ID input and validation
  const [programIdInput, setProgramIdInput] = useState('');
  const [programIdError, setProgramIdError] = useState('');
  const [validatedProgramId, setValidatedProgramId] = useState<string | null>(null);

  // Only use the hook when we have a validated program ID
  const { data: programInfos } = useProgram(validatedProgramId);

  // Validate the program ID
  const validateProgramId = () => {
    // Reset error state
    setProgramIdError('');

    // Empty check
    if (!programIdInput.trim()) {
      setProgramIdError('Program ID is required');
      return;
    }

    // Try to validate as PublicKey
    try {
      new PublicKey(programIdInput);
      // If we get here, it's a valid PublicKey format
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

  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <div className="">
          <h1 className="mb-4 text-3xl font-bold">Program Manager</h1>
          <Card>
            <CardHeader>
              <CardTitle>Program</CardTitle>
              <CardDescription>
                Enter the Program ID for a program under Squad authority. Upon validation, you will
                have the ability to upgrade and modify its authority settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter Program ID"
                      value={programIdInput}
                      onChange={(e) => setProgramIdInput(e.target.value)}
                      className={programIdError ? 'border-red-500' : ''}
                    />
                    {programIdError && (
                      <p className="mt-1 text-sm text-red-500">{programIdError}</p>
                    )}
                  </div>
                  <Button onClick={validateProgramId}>Validate</Button>
                  {validatedProgramId && (
                    <Button variant="outline" onClick={clearProgramId}>
                      Clear
                    </Button>
                  )}
                </div>

                {validatedProgramId && programInfos && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium">Program Information</h3>
                    <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4">
                      <div>Program Data Address: {programInfos.programDataAddress}</div>
                      <div>Program Authority: {programInfos.authority || 'Immutable'}</div>
                    </pre>
                  </div>
                )}

                {validatedProgramId && !programInfos && (
                  <div className="mt-4 rounded bg-yellow-50 p-4 text-yellow-800">
                    No program found with this ID or unable to fetch program data.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {multisigConfig && programInfos && (
            <div className="mt-4 flex flex-col gap-4 pb-4 md:flex-row">
              <div className="flex-1">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Change program Upgrade authority</CardTitle>
                    <CardDescription>
                      Change the upgrade authority of one of your programs.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChangeUpgradeAuthorityInput
                      programInfos={programInfos}
                      transactionIndex={
                        Number(multisigConfig ? multisigConfig.transactionIndex : 0) + 1
                      }
                    />
                  </CardContent>
                </Card>
              </div>
              <div className="flex-1">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Upgrade program</CardTitle>
                    <CardDescription>Apply an upgrade to the program.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CreateProgramUpgradeInput
                      programInfos={programInfos}
                      transactionIndex={
                        Number(multisigConfig ? multisigConfig.transactionIndex : 0) + 1
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

export default ProgramsPage;

import { Suspense, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { VaultSelector } from '@/components/VaultSelector';
import { VoteAccountPanel } from '@/components/validators/VoteAccountPanel';
import { StakeAccountsPanel } from '@/components/validators/StakeAccountsPanel';
import { useMultisigData } from '@/hooks/useMultisigData';
import {
  fetchVoteAccount,
  findVoteAccountsByWithdrawer,
  useTrackedVoteAccounts,
} from '@/hooks/useValidators';
import { getVaultIndexByAddress, type DescribeContext } from '@/lib/transaction/describe';
import { isPublickey } from '@/lib/isPublickey';
import { formatTransactionError } from '@/lib/utils';

const ValidatorsContent = ({ multisigAddress }: { multisigAddress: string }) => {
  const { connection, rpcUrl, programId, vaultIndex, multisigVault } = useMultisigData();
  const { voteAccounts, add, remove } = useTrackedVoteAccounts();
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const dctx: DescribeContext = {
    vaultIndexByAddress: getVaultIndexByAddress(new PublicKey(multisigAddress), programId),
    accountLamports: new Map(),
  };

  const addVoteAccount = async () => {
    setInputError(null);
    const address = input.trim();
    if (!isPublickey(address)) {
      setInputError('Enter a valid vote account address.');
      return;
    }
    const data = await fetchVoteAccount(connection, address).catch(
      (e) => ({ kind: 'error', message: formatTransactionError(e) }) as const
    );
    if (data.kind === 'error') {
      setInputError(data.message);
      return;
    }
    await add([address]);
    setInput('');
  };

  const findVoteAccounts = async () => {
    if (!multisigVault) return;
    setSearching(true);
    try {
      const found = await findVoteAccountsByWithdrawer(connection, multisigVault);
      await add(found);
      toast.success(
        found.length === 0
          ? `No vote account has vault ${vaultIndex} as authorized withdrawer.`
          : `Found ${found.length} vote account(s) for vault ${vaultIndex}.`
      );
    } catch (e) {
      toast.error(
        `Search failed. Your RPC may not allow getProgramAccounts on the Vote program. Add the vote account by address. (${formatTransactionError(e)})`
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-2 text-3xl font-bold">Validators</h1>
        <p className="text-sm text-muted-foreground">
          Manage the vote accounts and the stake accounts that a vault of this multisig controls.
          This page reads only from your RPC ({rpcUrl}). Each action creates a proposal that the
          members approve and execute on the Transactions page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vote accounts</CardTitle>
          <CardDescription>
            A vault must be the authorized withdrawer (Vote program role). The list is stored in
            this browser only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Vote account address"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={inputError ? 'border-red-500' : ''}
            />
            <Button onClick={addVoteAccount}>Add</Button>
            <Button variant="outline" onClick={findVoteAccounts} disabled={searching}>
              {searching ? 'Searching...' : `Find for vault ${vaultIndex}`}
            </Button>
          </div>
          {inputError && <p className="text-sm text-red-500">{inputError}</p>}
          {voteAccounts.length === 0 && (
            <p className="text-sm text-muted-foreground">No vote accounts in the list.</p>
          )}
          {voteAccounts.map((address) => (
            <VoteAccountPanel key={address} address={address} onRemove={() => remove(address)} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stake accounts</CardTitle>
          <CardDescription>
            Stake accounts where the selected vault is the staker or the withdrawer (Stake program
            roles).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span>Vault:</span>
            <VaultSelector />
          </div>
          <StakeAccountsPanel dctx={dctx} voteSuggestions={voteAccounts} />
        </CardContent>
      </Card>
    </div>
  );
};

const ValidatorsPage = () => {
  const { multisigAddress } = useMultisigData();
  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        {multisigAddress ? (
          <ValidatorsContent multisigAddress={multisigAddress} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a multisig on the Home page first.</p>
        )}
      </Suspense>
    </ErrorBoundary>
  );
};

export default ValidatorsPage;

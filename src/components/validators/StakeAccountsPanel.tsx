import { useState } from 'react';
import { Connection, PublicKey, VoteProgram } from '@solana/web3.js';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressValue } from '@/components/InstructionCards';
import { useMultisigData } from '@/hooks/useMultisigData';
import {
  fetchStakeAccount,
  useEpoch,
  useStakeParameters,
  useVaultStakeAccounts,
  type VaultStakeAccount,
} from '@/hooks/useValidators';
import { formatSol, parseSol, toSolString, type DescribeContext } from '@/lib/transaction/describe';
import { estimateStakeStatus, isLockupInForce, type StakeStatus } from '@/lib/validators/accounts';
import {
  stakeAuthorize,
  stakeCreate,
  stakeDeactivate,
  stakeDelegate,
  stakeMerge,
  stakeSplit,
  stakeWithdraw,
  type StakeAuthorityKind,
} from '@/lib/validators/instructions';
import {
  firstFailure,
  lockupCheck,
  mergeCheck,
  requireAuthority,
  stakeWithdrawAmountCheck,
  stakeWithdrawable,
  type Check,
  type StakeContext,
} from '@/lib/validators/preflight';
import { isPublickey } from '@/lib/isPublickey';
import { VaultActionDialog } from './VaultActionDialog';
import { Labeled, NativeSelect, solHint, toPublicKey } from './forms';

const STATUS_LABELS: Record<StakeStatus, string> = {
  initialized: 'Initialized (not delegated)',
  activating: 'Activating',
  active: 'Active',
  deactivating: 'Deactivating',
  inactive: 'Inactive',
};

const STAKER_ROLE = 'staker (Stake program role)';
const WITHDRAWER_ROLE = 'withdrawer (Stake program role)';

interface Env {
  readonly connection: Connection;
  readonly vaultIndex: number;
  readonly vault: PublicKey;
}

const assertCheck = (check: Check) => {
  if (!check.ok) throw new Error(check.reason);
};

/** Reads the stake account again, with the epoch and time for the lockup checks. */
async function freshStake(env: Env, address: string): Promise<StakeContext> {
  const [account, epochInfo] = await Promise.all([
    fetchStakeAccount(env.connection, address),
    env.connection.getEpochInfo(),
  ]);
  if (!account) throw new Error('The stake account was not found or cannot be read.');
  return {
    lamports: account.lamports,
    state: account.state,
    currentEpoch: BigInt(epochInfo.epoch),
    nowUnixSeconds: BigInt(Math.floor(Date.now() / 1000)),
  };
}

async function assertVoteAccount(connection: Connection, address: string) {
  const info = await connection.getAccountInfo(toPublicKey(address, 'vote account'));
  if (!info || !info.owner.equals(VoteProgram.programId)) {
    throw new Error('The vote account was not found, or it is not owned by the Vote program.');
  }
}

async function assertVaultBalance(env: Env, lamports: bigint, purpose: string) {
  const balance = BigInt(await env.connection.getBalance(env.vault));
  if (balance < lamports) {
    throw new Error(
      `Vault ${env.vaultIndex} has ${formatSol(balance)}. It needs ${formatSol(lamports)} ${purpose}.`
    );
  }
}

function VoteAccountInput({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: readonly string[];
}) {
  return (
    <>
      <Input
        list="tracked-vote-accounts"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        placeholder="Vote account address"
      />
      <datalist id="tracked-vote-accounts">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

function CreateStakeAction({
  env,
  voteSuggestions,
}: {
  env: Env;
  voteSuggestions: readonly string[];
}) {
  const { data: params } = useStakeParameters();
  const [amount, setAmount] = useState('');
  const [voteAccount, setVoteAccount] = useState('');
  const stake = parseSol(amount);
  const reserve = BigInt(params?.rentExemptReserve ?? 0);

  const formError = !params
    ? 'Loading stake parameters...'
    : !stake || stake <= BigInt(0)
      ? 'Enter the amount to stake, in SOL.'
      : voteAccount && !isPublickey(voteAccount)
        ? 'Enter a valid vote account address, or leave it empty.'
        : voteAccount && stake < params.minimumDelegation
          ? `The minimum delegation is ${formatSol(params.minimumDelegation)}.`
          : null;

  return (
    <VaultActionDialog
      title="Create stake account"
      description="Create a stake account owned by this vault (staker and withdrawer), funded from the vault. The new account address comes from the proposal, so no extra keypair is necessary."
      triggerLabel="Create stake account"
      triggerVariant="default"
      formKey={`${amount}|${voteAccount}`}
      formError={formError}
      build={async (ctx) => {
        const lamports = stake! + reserve;
        await assertVaultBalance(env, lamports, 'to fund the stake account');
        if (voteAccount) await assertVoteAccount(env.connection, voteAccount);
        return {
          vaultIndex: env.vaultIndex,
          ephemeralSigners: 1,
          instructions: stakeCreate({
            vault: env.vault,
            stakeAccount: ctx.ephemeralSigner(0),
            lamports,
            voteAccount: voteAccount ? new PublicKey(voteAccount) : null,
          }),
        };
      }}
    >
      <Labeled
        label="Amount to stake (SOL)"
        hint={`The vault also pays the rent-exempt reserve (${formatSol(reserve)}).`}
      >
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" />
      </Labeled>
      <Labeled label="Delegate to vote account (optional)" hint="Leave empty to only create it.">
        <VoteAccountInput
          value={voteAccount}
          onChange={setVoteAccount}
          suggestions={voteSuggestions}
        />
      </Labeled>
    </VaultActionDialog>
  );
}

interface RowActionProps {
  readonly env: Env;
  readonly account: VaultStakeAccount;
}

function DelegateAction({
  env,
  account,
  voteSuggestions,
}: RowActionProps & { voteSuggestions: readonly string[] }) {
  const [voteAccount, setVoteAccount] = useState(account.state.delegation?.voteAccount ?? '');
  return (
    <VaultActionDialog
      title="Delegate stake"
      description="Delegate the stake account to a vote account. To move active stake to a new validator, deactivate it first."
      triggerLabel="Delegate"
      formKey={voteAccount}
      formError={isPublickey(voteAccount) ? null : 'Enter a valid vote account address.'}
      build={async () => {
        const fresh = await freshStake(env, account.address);
        assertCheck(requireAuthority(STAKER_ROLE, fresh.state.staker, env.vault.toBase58()));
        await assertVoteAccount(env.connection, voteAccount);
        return {
          vaultIndex: env.vaultIndex,
          ephemeralSigners: 0,
          instructions: stakeDelegate({
            stakeAccount: new PublicKey(account.address),
            staker: env.vault,
            voteAccount: new PublicKey(voteAccount),
          }),
        };
      }}
    >
      <Labeled label="Vote account">
        <VoteAccountInput
          value={voteAccount}
          onChange={setVoteAccount}
          suggestions={voteSuggestions}
        />
      </Labeled>
    </VaultActionDialog>
  );
}

function DeactivateAction({ env, account }: RowActionProps) {
  return (
    <VaultActionDialog
      title="Deactivate stake"
      description="Deactivate the stake. It stops earning rewards and becomes withdrawable after the cooldown."
      triggerLabel="Deactivate"
      formKey=""
      formError={null}
      build={async () => {
        const fresh = await freshStake(env, account.address);
        assertCheck(requireAuthority(STAKER_ROLE, fresh.state.staker, env.vault.toBase58()));
        return {
          vaultIndex: env.vaultIndex,
          ephemeralSigners: 0,
          instructions: stakeDeactivate({
            stakeAccount: new PublicKey(account.address),
            staker: env.vault,
          }),
        };
      }}
    />
  );
}

function WithdrawStakeAction({ env, account, ctx }: RowActionProps & { ctx: StakeContext }) {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState(env.vault.toBase58());
  const withdrawable = stakeWithdrawable(ctx);
  const lamports = parseSol(amount);

  const amountCheck = lamports ? stakeWithdrawAmountCheck(ctx, lamports) : null;

  const formError = !isPublickey(recipient)
    ? 'Enter a valid recipient address.'
    : !lamports || lamports <= BigInt(0)
      ? 'Enter an amount in SOL.'
      : amountCheck && !amountCheck.ok
        ? amountCheck.reason
        : null;

  return (
    <VaultActionDialog
      title="Withdraw from stake account"
      description="Withdraw SOL. An inactive account can withdraw everything, which closes it, or an amount that leaves the rent-exempt reserve. An active account can withdraw only the SOL above its stake and reserve."
      triggerLabel="Withdraw"
      formKey={`${amount}|${recipient}`}
      formError={formError}
      build={async () => {
        const fresh = await freshStake(env, account.address);
        const vault = env.vault.toBase58();
        assertCheck(
          firstFailure(
            requireAuthority(WITHDRAWER_ROLE, fresh.state.withdrawer, vault),
            lockupCheck(fresh, vault)
          )
        );
        const freshAmountCheck = stakeWithdrawAmountCheck(fresh, lamports!);
        if (!freshAmountCheck.ok) {
          throw new Error(`The stake account changed. ${freshAmountCheck.reason}`);
        }
        const lockupActive = isLockupInForce(
          fresh.state.lockup,
          fresh.currentEpoch,
          fresh.nowUnixSeconds
        );
        return {
          vaultIndex: env.vaultIndex,
          ephemeralSigners: 0,
          instructions: stakeWithdraw({
            stakeAccount: new PublicKey(account.address),
            withdrawer: env.vault,
            recipient: toPublicKey(recipient, 'recipient'),
            lamports: lamports!,
            custodian: lockupActive ? env.vault : undefined,
          }),
        };
      }}
    >
      <Labeled label="Amount (SOL)" hint={solHint('Withdrawable', withdrawable)}>
        <div className="flex gap-2">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" />
          <Button
            variant="outline"
            type="button"
            onClick={() => setAmount(toSolString(withdrawable))}
          >
            Max
          </Button>
        </div>
      </Labeled>
      <Labeled label="Recipient" hint="Default: this vault.">
        <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      </Labeled>
    </VaultActionDialog>
  );
}

function SplitAction({ env, account }: RowActionProps) {
  const { data: params } = useStakeParameters();
  const [amount, setAmount] = useState('');
  const lamports = parseSol(amount);

  const formError = !params
    ? 'Loading stake parameters...'
    : !lamports || lamports <= BigInt(0)
      ? 'Enter the amount to split, in SOL.'
      : lamports >= account.lamports
        ? 'The amount must be less than the account balance.'
        : null;

  return (
    <VaultActionDialog
      title="Split stake"
      description="Move part of this stake account into a new stake account with the same authorities and delegation. The vault pays the rent-exempt reserve of the new account."
      triggerLabel="Split"
      formKey={amount}
      formError={formError}
      build={async (ctx) => {
        const fresh = await freshStake(env, account.address);
        assertCheck(requireAuthority(STAKER_ROLE, fresh.state.staker, env.vault.toBase58()));
        await assertVaultBalance(
          env,
          BigInt(params!.rentExemptReserve),
          'for the rent-exempt reserve of the new account'
        );
        return {
          vaultIndex: env.vaultIndex,
          ephemeralSigners: 1,
          instructions: stakeSplit({
            stakeAccount: new PublicKey(account.address),
            staker: env.vault,
            newStakeAccount: ctx.ephemeralSigner(0),
            lamports: lamports!,
            rentExemptReserve: params!.rentExemptReserve,
          }),
        };
      }}
    >
      <Labeled label="Amount to split (SOL)" hint={solHint('Account balance', account.lamports)}>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" />
      </Labeled>
    </VaultActionDialog>
  );
}

function MergeAction({
  env,
  account,
  others,
}: RowActionProps & { others: readonly VaultStakeAccount[] }) {
  const [source, setSource] = useState(others[0]?.address ?? '');
  return (
    <VaultActionDialog
      title="Merge stake accounts"
      description="Merge another stake account into this one. The source account is closed and its SOL moves here."
      triggerLabel="Merge"
      disabled={others.length === 0}
      formKey={source}
      formError={source ? null : 'Select a source stake account.'}
      build={async () => {
        const [destination, src] = await Promise.all([
          freshStake(env, account.address),
          freshStake(env, source),
        ]);
        assertCheck(
          firstFailure(
            requireAuthority(STAKER_ROLE, destination.state.staker, env.vault.toBase58()),
            mergeCheck(destination.state, src.state, destination)
          )
        );
        return {
          vaultIndex: env.vaultIndex,
          ephemeralSigners: 0,
          instructions: stakeMerge({
            destination: new PublicKey(account.address),
            source: new PublicKey(source),
            staker: env.vault,
          }),
        };
      }}
    >
      <Labeled label="Source stake account (closed by the merge)">
        <NativeSelect
          value={source}
          options={others.map((o) => ({
            value: o.address,
            label: `${o.address} (${formatSol(o.lamports)})`,
          }))}
          onChange={setSource}
        />
      </Labeled>
    </VaultActionDialog>
  );
}

function AuthorizeStakeAction({
  env,
  account,
  kind,
}: RowActionProps & { kind: StakeAuthorityKind }) {
  const [newAuthority, setNewAuthority] = useState('');
  const current = kind === 'staker' ? account.state.staker : account.state.withdrawer;
  const roleName = kind === 'staker' ? STAKER_ROLE : WITHDRAWER_ROLE;

  const formError = !isPublickey(newAuthority)
    ? 'Enter a valid address for the new authority.'
    : newAuthority === current
      ? `This address is already the ${roleName}.`
      : null;

  return (
    <VaultActionDialog
      title={`Change ${kind}`}
      description={
        kind === 'staker'
          ? 'Set a new staker. The staker can delegate, deactivate, split and merge.'
          : 'Set a new withdrawer. The withdrawer controls the funds. If it is not a vault of this multisig, this multisig loses control of the stake account.'
      }
      triggerLabel={`Change ${kind}`}
      triggerVariant={kind === 'withdrawer' ? 'destructive' : 'outline'}
      formKey={newAuthority}
      formError={formError}
      build={async () => {
        const fresh = await freshStake(env, account.address);
        const vault = env.vault.toBase58();
        const lockupActive = isLockupInForce(
          fresh.state.lockup,
          fresh.currentEpoch,
          fresh.nowUnixSeconds
        );
        if (kind === 'withdrawer') {
          assertCheck(
            firstFailure(
              requireAuthority(WITHDRAWER_ROLE, fresh.state.withdrawer, vault),
              lockupCheck(fresh, vault)
            )
          );
        } else if (fresh.state.staker !== vault && fresh.state.withdrawer !== vault) {
          throw new Error('The vault is not the staker or the withdrawer of this stake account.');
        }
        return {
          vaultIndex: env.vaultIndex,
          ephemeralSigners: 0,
          instructions: stakeAuthorize({
            stakeAccount: new PublicKey(account.address),
            authority: env.vault,
            newAuthority: toPublicKey(newAuthority, 'new authority'),
            kind,
            custodian: kind === 'withdrawer' && lockupActive ? env.vault : undefined,
          }),
        };
      }}
    >
      <Labeled label={`New ${roleName}`} hint={`Current: ${current}`}>
        <Input value={newAuthority} onChange={(e) => setNewAuthority(e.target.value)} />
      </Labeled>
    </VaultActionDialog>
  );
}

function StakeRow({
  env,
  account,
  epoch,
  all,
  dctx,
  voteSuggestions,
}: RowActionProps & {
  epoch: bigint;
  all: readonly VaultStakeAccount[];
  dctx: DescribeContext;
  voteSuggestions: readonly string[];
}) {
  const vault = env.vault.toBase58();
  const { state } = account;
  const status = estimateStakeStatus(state, epoch);
  const isStaker = state.staker === vault;
  const isWithdrawer = state.withdrawer === vault;
  const nowUnixSeconds = BigInt(Math.floor(Date.now() / 1000));
  const ctx: StakeContext = {
    lamports: account.lamports,
    state,
    currentEpoch: epoch,
    nowUnixSeconds,
  };
  const others = all.filter((o) => o.address !== account.address && o.state.staker === vault);

  return (
    <div className="space-y-2 rounded border p-3 text-xs">
      <div className="text-sm font-medium">
        <AddressValue address={account.address} ctx={dctx} />
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <span>
          <span className="text-muted-foreground">Status (estimate): </span>
          {STATUS_LABELS[status]}
        </span>
        <span>
          <span className="text-muted-foreground">Balance: </span>
          {formatSol(account.lamports)}
        </span>
        {state.delegation && (
          <>
            <span>
              <span className="text-muted-foreground">Delegated stake: </span>
              {formatSol(state.delegation.stake)}
            </span>
            <span className="min-w-0">
              <span className="text-muted-foreground">Vote account: </span>
              <AddressValue address={state.delegation.voteAccount} ctx={dctx} />
            </span>
          </>
        )}
        <span className="min-w-0">
          <span className="text-muted-foreground">Staker: </span>
          <AddressValue address={state.staker} ctx={dctx} />
        </span>
        <span className="min-w-0">
          <span className="text-muted-foreground">Withdrawer: </span>
          <AddressValue address={state.withdrawer} ctx={dctx} />
        </span>
        {isLockupInForce(state.lockup, epoch, nowUnixSeconds) && (
          <span className="text-yellow-700 dark:text-yellow-400">
            In lockup until epoch {state.lockup.epoch.toString()} (custodian{' '}
            {state.lockup.custodian})
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {isStaker &&
          (status === 'initialized' || status === 'inactive' || status === 'deactivating') && (
            <DelegateAction env={env} account={account} voteSuggestions={voteSuggestions} />
          )}
        {isStaker && (status === 'active' || status === 'activating') && (
          <DeactivateAction env={env} account={account} />
        )}
        {isWithdrawer && <WithdrawStakeAction env={env} account={account} ctx={ctx} />}
        {isStaker && <SplitAction env={env} account={account} />}
        {isStaker && <MergeAction env={env} account={account} others={others} />}
        {(isStaker || isWithdrawer) && (
          <AuthorizeStakeAction env={env} account={account} kind="staker" />
        )}
        {isWithdrawer && <AuthorizeStakeAction env={env} account={account} kind="withdrawer" />}
      </div>
    </div>
  );
}

export function StakeAccountsPanel({
  dctx,
  voteSuggestions,
}: {
  dctx: DescribeContext;
  voteSuggestions: readonly string[];
}) {
  const { connection, vaultIndex, multisigVault } = useMultisigData();
  const queryClient = useQueryClient();
  const { data: accounts, isLoading, error } = useVaultStakeAccounts(multisigVault);
  const { data: epoch, isLoading: epochLoading, error: epochError } = useEpoch();

  if (!multisigVault) return null;
  const env: Env = { connection, vaultIndex, vault: multisigVault };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CreateStakeAction env={env} voteSuggestions={voteSuggestions} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            Promise.all(
              ['vaultStakeAccounts', 'epochInfo'].map((key) =>
                queryClient.invalidateQueries({ queryKey: [key] })
              )
            )
          }
        >
          Refresh
        </Button>
      </div>
      {(isLoading || (accounts && epochLoading)) && (
        <p className="text-sm text-muted-foreground">Loading stake accounts...</p>
      )}
      {accounts && accounts.length > 0 && epochError && (
        <p className="text-sm text-red-500">
          Unable to load the current epoch from your RPC. The stake accounts cannot be shown without
          it.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-500">
          Unable to load stake accounts. Your RPC must allow getProgramAccounts on the Stake
          program.
        </p>
      )}
      {accounts && accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No stake account has vault {vaultIndex} as staker or withdrawer.
        </p>
      )}
      {accounts &&
        epoch !== undefined &&
        accounts.map((account) => (
          <StakeRow
            key={account.address}
            env={env}
            account={account}
            epoch={epoch}
            all={accounts}
            dctx={dctx}
            voteSuggestions={voteSuggestions}
          />
        ))}
    </div>
  );
}

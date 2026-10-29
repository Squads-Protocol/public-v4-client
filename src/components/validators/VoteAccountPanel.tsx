import { useState, type ReactNode } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddressValue } from '@/components/InstructionCards';
import { useMultisigData } from '@/hooks/useMultisigData';
import {
  FEATURES,
  fetchVoteAccount,
  useEpoch,
  useFeatureActive,
  useVoteAccount,
  type VoteAccountData,
} from '@/hooks/useValidators';
import {
  formatBps,
  formatSol,
  getVaultIndexByAddress,
  parseSol,
  toSolString,
  type DescribeContext,
} from '@/lib/transaction/describe';
import { currentAuthorizedVoter, type VoteAccountState } from '@/lib/validators/accounts';
import {
  voteAuthorize,
  voteUpdateCommission,
  voteUpdateCommissionBps,
  voteUpdateCommissionCollector,
  voteWithdraw,
  type CommissionKind,
  type VoteAuthorityKind,
} from '@/lib/validators/instructions';
import { collectorCheck, requireAuthority, voteWithdrawable } from '@/lib/validators/preflight';
import { isPublickey } from '@/lib/isPublickey';
import { VaultActionDialog } from './VaultActionDialog';
import { Checkbox, Labeled, NativeSelect, parseWholeNumber, solHint, toPublicKey } from './forms';

type OkVoteAccount = Extract<VoteAccountData, { kind: 'ok' }>;

interface ActionProps {
  readonly address: string;
  readonly data: OkVoteAccount;
  readonly vaultIndex: number;
  readonly vaultPda: PublicKey;
}

const COMMISSION_KIND_OPTIONS = [
  { value: 'inflationRewards', label: 'Inflation rewards' },
  { value: 'blockRevenue', label: 'Block revenue' },
] as const satisfies readonly { value: CommissionKind; label: string }[];

/** Reads the account again and checks that the vault is still the authorized withdrawer. */
async function freshVoteAccount(
  connection: Connection,
  address: string,
  vaultPda: PublicKey
): Promise<OkVoteAccount> {
  const data = await fetchVoteAccount(connection, address);
  if (data.kind === 'error') throw new Error(data.message);
  const check = requireAuthority(
    'authorized withdrawer (Vote program role)',
    data.state.authorizedWithdrawer,
    vaultPda.toBase58()
  );
  if (!check.ok) throw new Error(check.reason);
  return data;
}

function WithdrawAction({ address, data, vaultIndex, vaultPda }: ActionProps) {
  const { connection } = useMultisigData();
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState(vaultPda.toBase58());
  const [closeAccount, setCloseAccount] = useState(false);
  const withdrawable = voteWithdrawable(data.lamports, data.rentExemptMinimum);
  const lamports = closeAccount ? data.lamports : parseSol(amount);

  const formError = !isPublickey(recipient)
    ? 'Enter a valid recipient address.'
    : !lamports || lamports <= BigInt(0)
      ? 'Enter an amount in SOL.'
      : !closeAccount && lamports > withdrawable
        ? `The amount is more than the withdrawable balance (${formatSol(withdrawable)}).`
        : null;

  return (
    <VaultActionDialog
      title="Withdraw from vote account"
      description="Withdraw rewards from the vote account. The rent-exempt minimum stays in the account."
      triggerLabel="Withdraw"
      formKey={`${amount}|${recipient}|${closeAccount}`}
      formError={formError}
      build={async () => {
        const fresh = await freshVoteAccount(connection, address, vaultPda);
        const value = closeAccount ? fresh.lamports : lamports!;
        if (!closeAccount && value > voteWithdrawable(fresh.lamports, fresh.rentExemptMinimum)) {
          throw new Error('The vote account balance changed. The amount is now too high.');
        }
        return {
          vaultIndex,
          ephemeralSigners: 0,
          instructions: voteWithdraw({
            voteAccount: new PublicKey(address),
            withdrawer: vaultPda,
            recipient: toPublicKey(recipient, 'recipient'),
            lamports: value,
          }),
        };
      }}
    >
      {!closeAccount && (
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
      )}
      <Labeled label="Recipient" hint="Default: the vault that is the authorized withdrawer.">
        <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      </Labeled>
      <Checkbox checked={closeAccount} onChange={setCloseAccount}>
        Withdraw the full balance ({formatSol(data.lamports)}) and close the vote account. Do this
        only for a vote account that no longer votes.
      </Checkbox>
    </VaultActionDialog>
  );
}

function CommissionAction({ address, data, vaultIndex, vaultPda }: ActionProps) {
  const { connection } = useMultisigData();
  const [value, setValue] = useState('');
  const commission = parseWholeNumber(value, 0, 100);

  return (
    <VaultActionDialog
      title="Change commission"
      description="Set the commission in whole percent (UpdateCommission). An increase is only allowed in the first half of an epoch."
      triggerLabel="Change commission"
      formKey={value}
      formError={commission === null ? 'Enter a whole number from 0 to 100.' : null}
      build={async () => {
        await freshVoteAccount(connection, address, vaultPda);
        return {
          vaultIndex,
          ephemeralSigners: 0,
          instructions: voteUpdateCommission({
            voteAccount: new PublicKey(address),
            withdrawer: vaultPda,
            commission: commission!,
          }),
        };
      }}
    >
      <Labeled label="New commission (%)" hint={`Current: ${describeCommission(data.state)}`}>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="0-100" />
      </Labeled>
    </VaultActionDialog>
  );
}

function CommissionBpsAction({ address, data, vaultIndex, vaultPda }: ActionProps) {
  const { connection } = useMultisigData();
  const [kind, setKind] = useState<CommissionKind>('inflationRewards');
  const [value, setValue] = useState('');
  const bps = parseWholeNumber(value, 0, 10_000);

  return (
    <VaultActionDialog
      title="Change commission (basis points)"
      description="Set the inflation rewards or the block revenue commission in basis points (UpdateCommissionBps)."
      triggerLabel="Change commission (bps)"
      formKey={`${kind}|${value}`}
      formError={bps === null ? 'Enter a whole number of basis points from 0 to 10000.' : null}
      build={async () => {
        await freshVoteAccount(connection, address, vaultPda);
        return {
          vaultIndex,
          ephemeralSigners: 0,
          instructions: voteUpdateCommissionBps({
            voteAccount: new PublicKey(address),
            withdrawer: vaultPda,
            bps: bps!,
            kind,
          }),
        };
      }}
    >
      <Labeled label="Commission kind">
        <NativeSelect value={kind} options={COMMISSION_KIND_OPTIONS} onChange={setKind} />
      </Labeled>
      <Labeled label="New commission (bps)" hint={`Current: ${describeCommission(data.state)}`}>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="0-10000" />
      </Labeled>
    </VaultActionDialog>
  );
}

function AuthorizeAction({
  address,
  data,
  vaultIndex,
  vaultPda,
  kind,
  currentVoter,
}: ActionProps & { readonly kind: VoteAuthorityKind; readonly currentVoter: string | null }) {
  const { connection } = useMultisigData();
  const [newAuthority, setNewAuthority] = useState('');
  const current = kind === 'voter' ? currentVoter : data.state.authorizedWithdrawer;
  const roleName =
    kind === 'voter'
      ? 'authorized voter (Vote program role)'
      : 'authorized withdrawer (Vote program role)';

  const formError = !isPublickey(newAuthority)
    ? 'Enter a valid address for the new authority.'
    : newAuthority === current
      ? `This address is already the ${roleName}.`
      : null;

  return (
    <VaultActionDialog
      title={kind === 'voter' ? 'Change authorized voter' : 'Change authorized withdrawer'}
      description={
        kind === 'voter'
          ? 'Set a new authorized voter. The change takes effect in the next epoch. The voter key signs votes, so it stays on the validator.'
          : 'Set a new authorized withdrawer. The withdrawer controls the funds and the settings of the vote account. If it is not a vault of this multisig, this multisig loses control.'
      }
      triggerLabel={kind === 'voter' ? 'Change voter' : 'Change withdrawer'}
      triggerVariant={kind === 'withdrawer' ? 'destructive' : 'outline'}
      formKey={newAuthority}
      formError={formError}
      build={async () => {
        await freshVoteAccount(connection, address, vaultPda);
        return {
          vaultIndex,
          ephemeralSigners: 0,
          instructions: voteAuthorize({
            voteAccount: new PublicKey(address),
            withdrawer: vaultPda,
            newAuthority: toPublicKey(newAuthority, 'new authority'),
            kind,
          }),
        };
      }}
    >
      <Labeled label={`New ${roleName}`} hint={current ? `Current: ${current}` : undefined}>
        <Input value={newAuthority} onChange={(e) => setNewAuthority(e.target.value)} />
      </Labeled>
    </VaultActionDialog>
  );
}

function CollectorAction({
  address,
  data,
  vaultIndex,
  vaultPda,
  kind,
}: ActionProps & { readonly kind: CommissionKind }) {
  const { connection } = useMultisigData();
  const [collector, setCollector] = useState(address);
  const label = kind === 'blockRevenue' ? 'block revenue' : 'inflation rewards';
  const current =
    kind === 'blockRevenue'
      ? data.state.blockRevenueCollector
      : data.state.inflationRewardsCollector;

  return (
    <VaultActionDialog
      title={`Change ${label} collector`}
      description={`Set the account that receives the ${label} commission. It must be the vote account, or an existing rent-exempt account owned by the System program.`}
      triggerLabel={`Change ${label} collector`}
      formKey={collector}
      formError={!isPublickey(collector) ? 'Enter a valid collector address.' : null}
      build={async () => {
        await freshVoteAccount(connection, address, vaultPda);
        const collectorKey = toPublicKey(collector, 'collector');
        const info = await connection.getAccountInfo(collectorKey);
        const rent = await connection.getMinimumBalanceForRentExemption(info?.data.length ?? 0);
        const check = collectorCheck(collector, address, info, rent);
        if (!check.ok) throw new Error(check.reason);
        return {
          vaultIndex,
          ephemeralSigners: 0,
          instructions: voteUpdateCommissionCollector({
            voteAccount: new PublicKey(address),
            withdrawer: vaultPda,
            collector: collectorKey,
            kind,
          }),
        };
      }}
    >
      <Labeled
        label="New collector"
        hint={`Default: the vote account itself.${current ? ` Current: ${current}` : ''}`}
      >
        <Input value={collector} onChange={(e) => setCollector(e.target.value)} />
      </Labeled>
    </VaultActionDialog>
  );
}

function describeCommission(state: VoteAccountState): string {
  return state.commission.kind === 'percent'
    ? `${state.commission.percent}%`
    : `inflation rewards ${formatBps(state.commission.inflationRewardsBps)}, block revenue ${formatBps(state.commission.blockRevenueBps)}`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-[12rem_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function VoteAccountPanel({
  address,
  onRemove,
}: {
  readonly address: string;
  readonly onRemove: () => void;
}) {
  const { multisigAddress, programId } = useMultisigData();
  const { data, isLoading, error } = useVoteAccount(address);
  const { data: epoch } = useEpoch();
  const collectorsActive = useFeatureActive(FEATURES.customCommissionCollector).data ?? false;
  const bpsActive = useFeatureActive(FEATURES.commissionRateInBasisPoints).data ?? false;
  const blsActive = useFeatureActive(FEATURES.blsPubkeyManagementInVoteAccount).data ?? false;

  const vaultIndexByAddress = multisigAddress
    ? getVaultIndexByAddress(new PublicKey(multisigAddress), programId)
    : new Map<string, number>();
  const ctx: DescribeContext = { vaultIndexByAddress, accountLamports: new Map() };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm font-medium">
        Vote account <AddressValue address={address} ctx={ctx} />
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        Remove from list
      </Button>
    </div>
  );

  if (isLoading) return <div className="rounded border p-4 text-sm">{header}Loading...</div>;
  if (error || !data || data.kind === 'error') {
    return (
      <div className="space-y-2 rounded border p-4 text-sm">
        {header}
        <p className="text-red-500">
          {data?.kind === 'error' ? data.message : 'Unable to load the vote account.'}
        </p>
      </div>
    );
  }

  const { state } = data;
  const vaultIndex = vaultIndexByAddress.get(state.authorizedWithdrawer);
  const voter = epoch !== undefined ? currentAuthorizedVoter(state.authorizedVoters, epoch) : null;
  const withdrawable = voteWithdrawable(data.lamports, data.rentExemptMinimum);

  return (
    <div className="space-y-3 rounded border p-4 text-sm">
      {header}
      <div className="space-y-1 text-xs">
        <Row label="Validator identity">
          <AddressValue address={state.nodePubkey} ctx={ctx} />
        </Row>
        <Row label="Authorized voter">
          {voter ? <AddressValue address={voter} ctx={ctx} /> : 'Unknown'}
        </Row>
        <Row label="Authorized withdrawer">
          <AddressValue address={state.authorizedWithdrawer} ctx={ctx} />
        </Row>
        <Row label="Commission">{describeCommission(state)}</Row>
        {state.inflationRewardsCollector && (
          <Row label="Inflation rewards collector">
            <AddressValue address={state.inflationRewardsCollector} ctx={ctx} />
          </Row>
        )}
        {state.blockRevenueCollector && (
          <Row label="Block revenue collector">
            <AddressValue address={state.blockRevenueCollector} ctx={ctx} />
          </Row>
        )}
        <Row label="Balance">{formatSol(data.lamports)}</Row>
        <Row label="Rent-exempt minimum">{formatSol(data.rentExemptMinimum)}</Row>
        <Row label="Withdrawable">{formatSol(withdrawable)}</Row>
        <Row label="State version">{state.version}</Row>
      </div>

      {vaultIndex === undefined ? (
        <p className="rounded border border-yellow-500/50 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
          The authorized withdrawer is not a vault of this multisig. This multisig cannot manage
          this vote account. To give control to vault 0, run{' '}
          <code className="font-mono">
            solana vote-authorize-withdrawer {address} &lt;CURRENT_WITHDRAWER_KEYPAIR&gt;{' '}
            {[...vaultIndexByAddress.entries()].find(([, i]) => i === 0)?.[0]}
          </code>
        </p>
      ) : (
        <VoteActions
          address={address}
          data={data}
          vaultIndex={vaultIndex}
          vaultPda={new PublicKey(state.authorizedWithdrawer)}
          voter={voter}
          collectorsActive={collectorsActive}
          bpsActive={bpsActive}
          voterChangeNeedsBls={blsActive && state.hasBlsPubkey}
        />
      )}
    </div>
  );
}

function VoteActions({
  voter,
  collectorsActive,
  bpsActive,
  voterChangeNeedsBls,
  ...props
}: ActionProps & {
  readonly voter: string | null;
  readonly collectorsActive: boolean;
  readonly bpsActive: boolean;
  readonly voterChangeNeedsBls: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Vault {props.vaultIndex} is the authorized withdrawer. Each action creates one proposal.
      </p>
      <div className="flex flex-wrap gap-2">
        <WithdrawAction {...props} />
        <CommissionAction {...props} />
        {bpsActive && <CommissionBpsAction {...props} />}
        {collectorsActive && <CollectorAction {...props} kind="inflationRewards" />}
        {collectorsActive && <CollectorAction {...props} kind="blockRevenue" />}
        {!voterChangeNeedsBls && <AuthorizeAction {...props} kind="voter" currentVoter={voter} />}
        <AuthorizeAction {...props} kind="withdrawer" currentVoter={voter} />
      </div>
      <p className="text-xs text-muted-foreground">
        To change the validator identity, the new identity key must also sign at execution. A
        browser wallet cannot do this. Use the Solana CLI or the Squads CLI for that operation.
      </p>
      {voterChangeNeedsBls && (
        <p className="text-xs text-muted-foreground">
          This vote account has a BLS key. A change of the authorized voter must include the BLS
          public key and the proof of possession of the new voter. Only the new voter key can make
          that proof, so use the Solana CLI for that operation.
        </p>
      )}
    </div>
  );
}

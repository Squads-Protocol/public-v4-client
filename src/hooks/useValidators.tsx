import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Connection, PublicKey, StakeProgram, VoteProgram } from '@solana/web3.js';
import { useMultisigData } from './useMultisigData';
import { isPublickey } from '@/lib/isPublickey';
import {
  parseStakeAccount,
  parseVoteAccount,
  type StakeAccountState,
  type VoteAccountState,
} from '@/lib/validators/accounts';

const STAKE_ACCOUNT_SIZE = 200;
const STAKER_OFFSET = 12;
const STAKE_WITHDRAWER_OFFSET = 44;
const VOTE_WITHDRAWER_OFFSET = 36;
const FEATURE_PROGRAM_ID = 'Feature111111111111111111111111111111111111';

export const FEATURES = {
  customCommissionCollector: '3HcSrCTGXTUnrTueHi4DAwNuMxZSsm5xui2Ax3mgxHqf',
  commissionRateInBasisPoints: 'Eg7tXEwMZzS98xaZ1YHUbdRHsaYZiCsSaR6sKgxreoaj',
  blsPubkeyManagementInVoteAccount: 'AnAP9zPV4KL7czAPQbFhpDKV2tx7g4UGNbK9wvXwjaRo',
} as const;

const storageKey = (multisig: string) => `x-validators-${multisig}`;

function readTracked(multisig: string | null): string[] {
  if (!multisig || typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(multisig)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => isPublickey(String(v))) : [];
  } catch {
    return [];
  }
}

/** Vote accounts the user follows for the active multisig, stored in localStorage. */
export const useTrackedVoteAccounts = () => {
  const { multisigAddress } = useMultisigData();
  const queryClient = useQueryClient();
  const queryKey = ['trackedVoteAccounts', multisigAddress];

  const { data: voteAccounts } = useSuspenseQuery({
    queryKey,
    queryFn: () => Promise.resolve(readTracked(multisigAddress)),
  });

  /**
   * Takes an updater, not a list: a slow action (for example a getProgramAccounts search) must
   * apply its change to the list as stored now, not to the list of the render where it started.
   */
  const setTracked = useMutation({
    mutationFn: (update: (current: readonly string[]) => string[]) => {
      if (!multisigAddress) throw new Error('No multisig selected');
      const next = update(readTracked(multisigAddress));
      localStorage.setItem(storageKey(multisigAddress), JSON.stringify(next));
      return Promise.resolve(next);
    },
    onSuccess: (next) => queryClient.setQueryData(queryKey, next),
  });

  return {
    voteAccounts,
    add: (addresses: readonly string[]) =>
      setTracked.mutateAsync((current) => [...new Set([...current, ...addresses])]),
    remove: (address: string) =>
      setTracked.mutateAsync((current) => current.filter((a) => a !== address)),
  };
};

export const useEpoch = () => {
  const { connection, rpcUrl } = useMultisigData();
  return useQuery({
    queryKey: ['epochInfo', rpcUrl],
    queryFn: async () => BigInt((await connection.getEpochInfo()).epoch),
  });
};

export type VoteAccountData =
  | {
      readonly kind: 'ok';
      readonly lamports: bigint;
      readonly rentExemptMinimum: bigint;
      readonly state: VoteAccountState;
    }
  | { readonly kind: 'error'; readonly message: string };

export async function fetchVoteAccount(
  connection: Connection,
  address: string
): Promise<VoteAccountData> {
  const info = await connection.getAccountInfo(new PublicKey(address));
  if (!info) return { kind: 'error', message: 'Account not found on this cluster.' };
  if (!info.owner.equals(VoteProgram.programId)) {
    return { kind: 'error', message: 'This account is not owned by the Vote program.' };
  }
  const state = parseVoteAccount(info.data);
  if (!state) return { kind: 'error', message: 'Unable to read the vote account state.' };
  const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(info.data.length);
  return {
    kind: 'ok',
    lamports: BigInt(info.lamports),
    rentExemptMinimum: BigInt(rentExemptMinimum),
    state,
  };
}

export const useVoteAccount = (address: string) => {
  const { connection, rpcUrl } = useMultisigData();
  return useQuery({
    queryKey: ['voteAccount', rpcUrl, address],
    queryFn: () => fetchVoteAccount(connection, address),
  });
};

/** Finds vote accounts whose authorized withdrawer is the vault. Many public RPCs refuse this. */
export async function findVoteAccountsByWithdrawer(
  connection: Connection,
  vault: PublicKey
): Promise<string[]> {
  const accounts = await connection.getProgramAccounts(VoteProgram.programId, {
    dataSlice: { offset: 0, length: 0 },
    filters: [{ memcmp: { offset: VOTE_WITHDRAWER_OFFSET, bytes: vault.toBase58() } }],
  });
  return accounts.map((a) => a.pubkey.toBase58());
}

export interface VaultStakeAccount {
  readonly address: string;
  readonly lamports: bigint;
  readonly state: StakeAccountState;
}

export async function fetchStakeAccount(
  connection: Connection,
  address: string
): Promise<VaultStakeAccount | null> {
  const info = await connection.getAccountInfo(new PublicKey(address));
  const state = info && info.owner.equals(StakeProgram.programId) && parseStakeAccount(info.data);
  return info && state ? { address, lamports: BigInt(info.lamports), state } : null;
}

/** Stake accounts where the vault is the staker or the withdrawer. */
export const useVaultStakeAccounts = (vault: PublicKey | null) => {
  const { connection, rpcUrl } = useMultisigData();
  return useQuery({
    queryKey: ['vaultStakeAccounts', rpcUrl, vault?.toBase58()],
    enabled: !!vault,
    queryFn: async (): Promise<VaultStakeAccount[]> => {
      const byOffset = (offset: number) =>
        connection.getProgramAccounts(StakeProgram.programId, {
          filters: [
            { dataSize: STAKE_ACCOUNT_SIZE },
            { memcmp: { offset, bytes: vault!.toBase58() } },
          ],
        });
      const results = await Promise.all([
        byOffset(STAKER_OFFSET),
        byOffset(STAKE_WITHDRAWER_OFFSET),
      ]);
      const unique = new Map(results.flat().map((a) => [a.pubkey.toBase58(), a.account]));
      return [...unique.entries()]
        .flatMap(([address, account]) => {
          const state = parseStakeAccount(account.data);
          return state ? [{ address, lamports: BigInt(account.lamports), state }] : [];
        })
        .sort((a, b) => (b.lamports > a.lamports ? 1 : b.lamports < a.lamports ? -1 : 0));
    },
  });
};

export const useFeatureActive = (featureId: string) => {
  const { connection, rpcUrl } = useMultisigData();
  return useQuery({
    queryKey: ['feature', rpcUrl, featureId],
    queryFn: async () => {
      const info = await connection.getAccountInfo(new PublicKey(featureId));
      return !!info && info.owner.toBase58() === FEATURE_PROGRAM_ID && info.data[0] === 1;
    },
    staleTime: Infinity,
  });
};

export const useStakeParameters = () => {
  const { connection, rpcUrl } = useMultisigData();
  return useQuery({
    queryKey: ['stakeParameters', rpcUrl],
    queryFn: async () => {
      const [rentExemptReserve, minimumDelegation] = await Promise.all([
        connection.getMinimumBalanceForRentExemption(STAKE_ACCOUNT_SIZE),
        connection.getStakeMinimumDelegation().then((r) => r.value),
      ]);
      return { rentExemptReserve, minimumDelegation: BigInt(minimumDelegation) };
    },
    staleTime: Infinity,
  });
};

import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import * as multisig from '@sqds/multisig';
import { useMultisig } from './useServices';
import type { TransactionKind } from './useServices';
import { isMember } from '@/lib/utils';

const TERMINAL_STATUSES = new Set(['Rejected', 'Approved', 'Executing', 'Executed', 'Cancelled']);
const VOTEABLE_STATUSES = new Set(['None', 'Active', 'Draft']);
const EOL_STATUSES = new Set(['Rejected', 'Executed', 'Cancelled']);

// Returns true when no action is possible and buttons should be hidden entirely.
// Stale + Approved is NOT EOL — vault/batch execute and cancel are still available.
export function isProposalEOL(proposalStatus: string, isStale: boolean, isAccountClosed: boolean): boolean {
  return isAccountClosed || EOL_STATUSES.has(proposalStatus) || (isStale && proposalStatus !== 'Approved');
}

export function useApproveButtonState({
  proposalStatus,
  isStale,
  isAccountClosed,
  approvedMembers,
}: {
  proposalStatus: string;
  isStale: boolean;
  isAccountClosed: boolean;
  approvedMembers: PublicKey[];
}) {
  const { publicKey } = useWallet();
  const { data: multisigConfig } = useMultisig();
  const connectedMember = publicKey ? isMember(publicKey, multisigConfig?.members ?? []) : undefined;
  const hasVotePermission = connectedMember
    ? multisig.types.Permissions.has(connectedMember.permissions, multisig.types.Permission.Vote)
    : false;
  const hasAlreadyApproved = !!publicKey && approvedMembers.some((k) => k.equals(publicKey));

  return {
    isDisabled:
      !publicKey ||
      isAccountClosed ||
      isStale ||
      TERMINAL_STATUSES.has(proposalStatus) ||
      hasAlreadyApproved ||
      !hasVotePermission,
  };
}

export function useRejectButtonState({
  proposalStatus,
  isStale,
  isAccountClosed,
  rejectedMembers,
}: {
  proposalStatus: string;
  isStale: boolean;
  isAccountClosed: boolean;
  rejectedMembers: PublicKey[];
}) {
  const { publicKey } = useWallet();
  const { data: multisigConfig } = useMultisig();
  const connectedMember = publicKey ? isMember(publicKey, multisigConfig?.members ?? []) : undefined;
  const hasVotePermission = connectedMember
    ? multisig.types.Permissions.has(connectedMember.permissions, multisig.types.Permission.Vote)
    : false;
  const hasAlreadyRejected = !!publicKey && rejectedMembers.some((k) => k.equals(publicKey));

  return {
    isDisabled:
      !publicKey ||
      isAccountClosed ||
      isStale ||
      !VOTEABLE_STATUSES.has(proposalStatus) ||
      hasAlreadyRejected ||
      !hasVotePermission,
  };
}

export function useExecuteButtonState({
  proposalStatus,
  isStale,
  isAccountClosed,
  approvedAt,
  kind,
}: {
  proposalStatus: string;
  isStale: boolean;
  isAccountClosed: boolean;
  approvedAt: number | undefined;
  kind: TransactionKind;
}) {
  const { publicKey } = useWallet();
  const { data: multisigConfig } = useMultisig();
  const connectedMember = publicKey ? isMember(publicKey, multisigConfig?.members ?? []) : undefined;
  const hasExecutePermission = connectedMember
    ? multisig.types.Permissions.has(connectedMember.permissions, multisig.types.Permission.Execute)
    : false;

  const timeLock = multisigConfig?.timeLock ?? 0;
  const timelockElapsed =
    timeLock === 0 ||
    (approvedAt !== undefined && Math.floor(Date.now() / 1000) >= approvedAt + timeLock);

  // Config transactions cannot execute when stale; vault and batch can
  const staleBlocked = isStale && kind === 'config';

  return {
    isDisabled:
      !publicKey ||
      isAccountClosed ||
      staleBlocked ||
      proposalStatus !== 'Approved' ||
      !timelockElapsed ||
      !hasExecutePermission,
  };
}

export function useCancelButtonState({
  proposalStatus,
  isAccountClosed,
}: {
  proposalStatus: string;
  isAccountClosed: boolean;
}) {
  const { publicKey } = useWallet();
  const { data: multisigConfig } = useMultisig();
  const connectedMember = publicKey ? isMember(publicKey, multisigConfig?.members ?? []) : undefined;
  const hasVotePermission = connectedMember
    ? multisig.types.Permissions.has(connectedMember.permissions, multisig.types.Permission.Vote)
    : false;

  return {
    isDisabled: !publicKey || isAccountClosed || proposalStatus !== 'Approved' || !hasVotePermission,
  };
}

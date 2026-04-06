import * as multisig from '@sqds/multisig';
// top level
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com'; // Default fallback

const getRpcUrl = () => {
  if (typeof document !== 'undefined') {
    return localStorage.getItem('x-rpc-url') || DEFAULT_RPC_URL;
  }
  return DEFAULT_RPC_URL;
};

export const useRpcUrl = () => {
  const queryClient = useQueryClient();

  const { data: rpcUrl } = useSuspenseQuery({
    queryKey: ['rpcUrl'],
    queryFn: () => Promise.resolve(getRpcUrl()),
  });

  const setRpcUrl = useMutation({
    mutationFn: (newRpcUrl: string) => {
      localStorage.setItem(`x-rpc-url`, newRpcUrl);
      return Promise.resolve(newRpcUrl);
    },
    onSuccess: (newRpcUrl) => {
      queryClient.setQueryData(['rpcUrl'], newRpcUrl);
    },
  });

  return { rpcUrl, setRpcUrl };
};

const DEFAULT_PROGRAM_ID = multisig.PROGRAM_ID.toBase58();

const getProgramId = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('x-program-id-v4') || DEFAULT_PROGRAM_ID;
  }
  return DEFAULT_PROGRAM_ID;
};

export const useProgramId = () => {
  const queryClient = useQueryClient();

  const { data: programId } = useSuspenseQuery({
    queryKey: ['programId'],
    queryFn: () => Promise.resolve(getProgramId()),
  });

  const setProgramId = useMutation({
    mutationFn: (newProgramId: string) => {
      localStorage.setItem('x-program-id-v4', newProgramId);
      return Promise.resolve(newProgramId);
    },
    onSuccess: (newProgramId) => {
      queryClient.setQueryData(['programId'], newProgramId);
    },
  });
  return { programId, setProgramId };
};

// explorer url
const DEFAULT_EXPLORER_URL = 'https://explorer.solana.com';
const getExplorerUrl = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('x-explorer-url') || DEFAULT_EXPLORER_URL;
  }
  return DEFAULT_EXPLORER_URL;
};

export const useExplorerUrl = () => {
  const queryClient = useQueryClient();

  const { data: explorerUrl } = useSuspenseQuery({
    queryKey: ['explorerUrl'],
    queryFn: () => Promise.resolve(getExplorerUrl()),
  });

  const setExplorerUrl = useMutation({
    mutationFn: (newExplorerUrl: string) => {
      localStorage.setItem('x-explorer-url', newExplorerUrl);
      return Promise.resolve(newExplorerUrl);
    },
    onSuccess: (newExplorerUrl) => {
      queryClient.setQueryData(['explorerUrl'], newExplorerUrl);
    },
  });
  return { explorerUrl, setExplorerUrl };
};

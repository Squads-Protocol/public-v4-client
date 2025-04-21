import * as multisig from '@sqds/multisig';
import ApproveButton from './ApproveButton';
import ExecuteButton from './ExecuteButton';
import RejectButton from './RejectButton';
import { TableBody, TableCell, TableRow } from './ui/table';
import { useExplorerUrl, useRpcUrl } from '@/hooks/useSettings';
import { Link } from 'react-router-dom';
import { useMultisig } from '@/hooks/useServices';

interface ActionButtonsProps {
  multisigPda: string;
  transactionIndex: number;
  proposalStatus: string;
  programId: string;
}

export default function TransactionTable({
  multisigPda,
  transactions,
  programId,
}: {
  multisigPda: string;
  transactions: {
    transactionPda: string;
    proposal: multisig.generated.Proposal | null;
    index: bigint;
  }[];
  programId?: string;
}) {
  const { rpcUrl } = useRpcUrl();
  const { data: multisigConfig } = useMultisig();
  if (transactions.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={5}>No transactions found.</TableCell>
        </TableRow>
      </TableBody>
    );
  }
  return (
    <TableBody>
      {transactions.map((transaction, index) => {
        const stale =
          (multisigConfig &&
            Number(multisigConfig.staleTransactionIndex) >= Number(transaction.index)) ||
          false;
        return (
          <TableRow key={index}>
            <TableCell>{Number(transaction.index)}</TableCell>
            <TableCell className="text-blue-500">
              <Link
                target={`_blank`}
                to={createSolanaExplorerUrl(transaction.transactionPda, rpcUrl!)}
              >
                {transaction.transactionPda}
              </Link>
            </TableCell>
            <TableCell>
              {stale ? '(stale)' : transaction.proposal?.status.__kind || 'None'}
            </TableCell>
            <TableCell>
              {!stale ? (
                <ActionButtons
                  multisigPda={multisigPda!}
                  transactionIndex={Number(transaction.index)}
                  proposalStatus={transaction.proposal?.status.__kind || 'None'}
                  programId={programId ? programId : multisig.PROGRAM_ID.toBase58()}
                />
              ) : (
                <span>Stale</span>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  );
}

function ActionButtons({
  multisigPda,
  transactionIndex,
  proposalStatus,
  programId,
}: ActionButtonsProps) {
  return (
    <>
      <ApproveButton
        multisigPda={multisigPda}
        transactionIndex={transactionIndex}
        proposalStatus={proposalStatus}
        programId={programId}
      />
      <RejectButton
        multisigPda={multisigPda}
        transactionIndex={transactionIndex}
        proposalStatus={proposalStatus}
        programId={programId}
      />
      <ExecuteButton
        multisigPda={multisigPda}
        transactionIndex={transactionIndex}
        proposalStatus={proposalStatus}
        programId={programId}
      />
    </>
  );
}

function createSolanaExplorerUrl(publicKey: string, rpcUrl: string): string {
  const { explorerUrl } = useExplorerUrl();
  const baseUrl = `${explorerUrl}/address/`;
  const clusterQuery = '?cluster=custom&customUrl=';
  const encodedRpcUrl = encodeURIComponent(rpcUrl);

  return `${baseUrl}${publicKey}${clusterQuery}${encodedRpcUrl}`;
}

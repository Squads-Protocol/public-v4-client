import * as multisig from '@sqds/multisig';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export function buildProposalAndApproveIx(
  multisigPda: PublicKey,
  member: PublicKey,
  transactionIndex: bigint,
  programId: PublicKey
): [TransactionInstruction, TransactionInstruction] {
  const proposalIx = multisig.instructions.proposalCreate({
    multisigPda,
    creator: member,
    isDraft: false,
    transactionIndex,
    rentPayer: member,
    programId,
  });
  const approveIx = multisig.instructions.proposalApprove({
    multisigPda,
    member,
    transactionIndex,
    programId,
  });
  return [proposalIx, approveIx];
}

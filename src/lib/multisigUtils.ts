import * as multisig from '@sqds/multisig';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';

export function buildProposalIx(
  multisigPda: PublicKey,
  member: PublicKey,
  transactionIndex: bigint,
  programId: PublicKey
): TransactionInstruction {
  return multisig.instructions.proposalCreate({
    multisigPda,
    creator: member,
    isDraft: false,
    transactionIndex,
    rentPayer: member,
    programId,
  });
}

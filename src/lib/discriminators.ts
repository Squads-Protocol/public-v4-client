// to assist in the search based off of vault including relevant discriminators
// ie, we can find the multisig config address by identifying where its positioned if given a vault address
import type { PublicKey, TransactionInstruction } from '@solana/web3.js';

const batchExecuteTransactionInstructionDiscriminator = [172, 44, 179, 152, 21, 127, 234, 180];
const spendingLimitUseInstructionDiscriminator = [16, 57, 130, 127, 193, 20, 155, 134];
const vaultTransactionExecuteInstructionDiscriminator = [194, 8, 161, 87, 153, 164, 25, 171];

export interface DiscriminatorMultisigPosition {
  discriminator: number[];
  multisigAccountIndex: number;
  label: string;
}
export const MULTISIG_ACCOUNT_POSITIONS: DiscriminatorMultisigPosition[] = [
  {
    discriminator: batchExecuteTransactionInstructionDiscriminator,
    multisigAccountIndex: 0,
    label: 'batchExecuteTransactionInstruction',
  },
  {
    discriminator: spendingLimitUseInstructionDiscriminator,
    multisigAccountIndex: 0,
    label: 'spendingLimitUseInstruction',
  },
  {
    discriminator: vaultTransactionExecuteInstructionDiscriminator,
    multisigAccountIndex: 0,
    label: 'vaultTransactionExecuteInstruction',
  },
];

export const identifyInstructionByDiscriminator = (
  instruction: TransactionInstruction,
  programId: PublicKey
) => {
  if (!programId.equals(instruction.programId)) {
    return null;
  }
  const discrim = Array.from(instruction.data.slice(0, 8));
  const matches = MULTISIG_ACCOUNT_POSITIONS.find((msp) => {
    return arraysEqual(msp.discriminator, discrim);
  });
  return matches || null;
};

const arraysEqual = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((val, index) => val === b[index]);

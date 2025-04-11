import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Button } from './ui/button';
import { useState } from 'react';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as multisig from '@sqds/multisig';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { isPublickey } from '~/lib/isPublickey';
import { useMultisigData } from '~/hooks/useMultisigData';
import { useQueryClient } from '@tanstack/react-query';
import { useAccess } from '../hooks/useAccess';
import { waitForConfirmation } from '../lib/transactionConfirmation';

type SendTokensProps = {
  tokenAccount: string;
  mint: string;
  decimals: number;
  multisigPda: string;
  vaultIndex: number;
  programId?: string;
};

const SendTokens = ({
  tokenAccount,
  mint,
  decimals,
  multisigPda,
  vaultIndex,
  programId,
}: SendTokensProps) => {
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState('');

  const { connection } = useMultisigData();

  const queryClient = useQueryClient();
  const parsedAmount = parseFloat(amount);
  const isAmountValid = !isNaN(parsedAmount) && parsedAmount > 0;
  const isMember = useAccess();

  const [isOpen, setIsOpen] = useState(false);
  const closeDialog = () => setIsOpen(false);

  const transfer = async () => {
    if (!wallet.publicKey) {
      throw 'Wallet not connected';
    }

    const mintAccountInfo = await connection.getAccountInfo(new PublicKey(mint));
    const TOKEN_PROGRAM = mintAccountInfo?.owner || TOKEN_PROGRAM_ID;

    const recipientATA = getAssociatedTokenAddressSync(
      new PublicKey(mint),
      new PublicKey(recipient),
      true,
      TOKEN_PROGRAM
    );

    const vaultAddress = multisig
      .getVaultPda({
        index: vaultIndex,
        multisigPda: new PublicKey(multisigPda),
        programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
      })[0]
      .toBase58();

    const createRecipientATAInstruction = createAssociatedTokenAccountIdempotentInstruction(
      new PublicKey(vaultAddress),
      recipientATA,
      new PublicKey(recipient),
      new PublicKey(mint),
      TOKEN_PROGRAM
    );

    const transferInstruction = createTransferCheckedInstruction(
      new PublicKey(tokenAccount),
      new PublicKey(mint),
      recipientATA,
      new PublicKey(vaultAddress),
      parsedAmount * 10 ** decimals,
      decimals,
      [],
      TOKEN_PROGRAM
    );

    const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
      // @ts-ignore
      connection,
      new PublicKey(multisigPda)
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    const transferMessage = new TransactionMessage({
      instructions: [createRecipientATAInstruction, transferInstruction],
      payerKey: new PublicKey(vaultAddress),
      recentBlockhash: blockhash,
    });

    const transactionIndex = Number(multisigInfo.transactionIndex) + 1;
    const transactionIndexBN = BigInt(transactionIndex);

    const multisigTransactionIx = multisig.instructions.vaultTransactionCreate({
      multisigPda: new PublicKey(multisigPda),
      creator: wallet.publicKey,
      ephemeralSigners: 0,
      // @ts-ignore
      transactionMessage: transferMessage,
      transactionIndex: transactionIndexBN,
      addressLookupTableAccounts: [],
      rentPayer: wallet.publicKey,
      vaultIndex: vaultIndex,
    });
    const proposalIx = multisig.instructions.proposalCreate({
      multisigPda: new PublicKey(multisigPda),
      creator: wallet.publicKey,
      isDraft: false,
      transactionIndex: transactionIndexBN,
      rentPayer: wallet.publicKey,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });
    const approveIx = multisig.instructions.proposalApprove({
      multisigPda: new PublicKey(multisigPda),
      member: wallet.publicKey,
      transactionIndex: transactionIndexBN,
      programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
    });

    const message = new TransactionMessage({
      instructions: [multisigTransactionIx, proposalIx, approveIx],
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(message);

    const signature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
    });
    console.log('Transaction signature', signature);
    toast.loading('Confirming...', {
      id: 'transaction',
    });
    const sent = await waitForConfirmation(connection, [signature]);
    if (!sent[0]) {
      throw `Transaction failed or unable to confirm. Check ${signature}`;
    }
    setAmount('');
    setRecipient('');
    await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    closeDialog();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={!isMember}
          onClick={(e) => {
            if (!wallet.publicKey) {
              e.preventDefault();
              walletModal.setVisible(true);
              return;
            }
          }}
        >
          Send Tokens
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer tokens</DialogTitle>
          <DialogDescription>
            Create a proposal to transfer tokens to another address.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Recipient"
          type="text"
          onChange={(e) => setRecipient(e.target.value.trim())}
        />
        {isPublickey(recipient) ? null : <p className="text-xs">Invalid recipient address</p>}
        <Input
          placeholder="Amount"
          type="number"
          onChange={(e) => setAmount(e.target.value.trim())}
        />
        {!isAmountValid && amount.length > 0 && (
          <p className="text-xs text-red-500">Invalid amount</p>
        )}
        <Button
          onClick={() =>
            toast.promise(transfer, {
              id: 'transaction',
              loading: 'Loading...',
              success: 'Transfer proposed.',
              error: (e) => `Failed to propose: ${e}`,
            })
          }
          disabled={!isPublickey(recipient) || amount.length < 1 || !isAmountValid}
        >
          Transfer
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default SendTokens;

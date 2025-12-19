import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import * as multisig from '@sqds/multisig';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, Send, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAccess } from '@/hooks/useAccess';
import { waitForConfirmation } from '@/lib/transactionConfirmation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { useMultisigData } from '~/hooks/useMultisigData';
import { isPublickey } from '~/lib/isPublickey';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

type SendSolProps = {
  multisigPda: string;
  vaultIndex: number;
};

const SendSol = ({ multisigPda, vaultIndex }: SendSolProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeDialog = () => setIsOpen(false);
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { connection, programId } = useMultisigData();
  const queryClient = useQueryClient();
  const parsedAmount = parseFloat(amount);
  const isAmountValid = !Number.isNaN(parsedAmount) && parsedAmount > 0;
  const isMember = useAccess();

  const transfer = async () => {
    if (!wallet.publicKey) {
      throw 'Wallet not connected';
    }
    setIsLoading(true);
    try {
      const vaultAddress = multisig.getVaultPda({
        index: vaultIndex,
        multisigPda: new PublicKey(multisigPda),
        programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
      })[0];

      const transferInstruction = SystemProgram.transfer({
        fromPubkey: vaultAddress,
        toPubkey: new PublicKey(recipient),
        lamports: parsedAmount * LAMPORTS_PER_SOL,
      });

      const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
        // @ts-expect-error
        connection,
        new PublicKey(multisigPda)
      );

      const blockhash = (await connection.getLatestBlockhash()).blockhash;

      const transferMessage = new TransactionMessage({
        instructions: [transferInstruction],
        payerKey: new PublicKey(vaultAddress),
        recentBlockhash: blockhash,
      });

      const transactionIndex = Number(multisigInfo.transactionIndex) + 1;
      const transactionIndexBN = BigInt(transactionIndex);

      const multisigTransactionIx = multisig.instructions.vaultTransactionCreate({
        multisigPda: new PublicKey(multisigPda),
        creator: wallet.publicKey,
        ephemeralSigners: 0,
        // @ts-expect-error
        transactionMessage: transferMessage,
        transactionIndex: transactionIndexBN,
        addressLookupTableAccounts: [],
        rentPayer: wallet.publicKey,
        vaultIndex: vaultIndex,
        programId: programId ? new PublicKey(programId) : multisig.PROGRAM_ID,
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
      toast.loading('Confirming...', { id: 'transaction' });
      const sent = await waitForConfirmation(connection, [signature]);
      if (!sent[0]) {
        throw `Transaction failed or unable to confirm. Check ${signature}`;
      }
      setAmount('');
      setRecipient('');
      closeDialog();
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!isMember}
          className="gap-2"
          onClick={(e) => {
            if (!wallet.publicKey) {
              e.preventDefault();
              walletModal.setVisible(true);
              return;
            } else {
              setIsOpen(true);
            }
          }}
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Transfer SOL
          </DialogTitle>
          <DialogDescription>Create a proposal to send SOL from the vault.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Recipient Address</Label>
            <Input
              placeholder="Enter Solana address..."
              type="text"
              onChange={(e) => setRecipient(e.target.value)}
              className="font-mono text-sm"
            />
            {recipient && !isPublickey(recipient) && (
              <p className="text-xs text-destructive">Invalid recipient address</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Amount (SOL)</Label>
            <Input
              placeholder="0.00"
              type="number"
              step="0.01"
              onChange={(e) => setAmount(e.target.value)}
            />
            {amount && !isAmountValid && <p className="text-xs text-destructive">Invalid amount</p>}
          </div>

          <Button
            onClick={() =>
              toast.promise(transfer, {
                id: 'transaction',
                loading: 'Creating proposal...',
                success: 'Transfer proposed',
                error: (e) => `Failed to propose: ${e}`,
              })
            }
            disabled={!isPublickey(recipient) || !isAmountValid || isLoading}
            className="w-full gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Create Proposal
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendSol;

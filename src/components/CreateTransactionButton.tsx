import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as bs58 from 'bs58';
import { Button } from './ui/button';
import { formatTransactionError } from '@/lib/utils';
import { useState } from 'react';
import * as multisig from '@sqds/multisig';
import { useWallet } from '@solana/wallet-adapter-react';
import { Message, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { simulateEncodedTransaction } from '@/lib/transaction/simulateEncodedTransaction';
import { importTransaction } from '@/lib/transaction/importTransaction';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useAccess } from '@/hooks/useAccess';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import invariant from 'invariant';
import { VaultSelector } from './VaultSelector';

const CreateTransaction = () => {
  const wallet = useWallet();
  const hasAccess = useAccess();

  const [tx, setTx] = useState('');
  const [open, setOpen] = useState(false);

  const { connection, multisigAddress, vaultIndex, programId } = useMultisigData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const getSampleMessage = async () => {
    invariant(programId, 'Program ID not found');
    invariant(multisigAddress, 'Multisig address not found. Please create a multisig first.');
    invariant(wallet.publicKey, 'Wallet ID not found');
    let memo = 'Hello from Solana land!';
    const vaultAddress = multisig.getVaultPda({
      index: vaultIndex,
      multisigPda: new PublicKey(multisigAddress),
      programId: programId,
    })[0];

    const dummyMessage = Message.compile({
      instructions: [
        new TransactionInstruction({
          keys: [
            {
              pubkey: wallet.publicKey,
              isSigner: true,
              isWritable: true,
            },
          ],
          data: Buffer.from(memo, 'utf-8'),
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        }),
      ],
      payerKey: vaultAddress,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    });

    const encoded = bs58.default.encode(dummyMessage.serialize());

    setTx(encoded);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <DialogTrigger
        className={`h-10 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground ${!hasAccess ? `bg-primary/50 hover:bg-primary/50` : `hover:bg-primary/90`}`}
        disabled={!hasAccess}
      >
        Import Transaction
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Transaction</DialogTitle>
          <DialogDescription>
            Propose a transaction from a base58 encoded transaction message (not a transaction).
          </DialogDescription>
        </DialogHeader>
        <div className={`flex items-center justify-between gap-2`}>
          <p>Using Vault Index:</p>
          <VaultSelector />
        </div>
        <Input
          placeholder="Paste base58 encoded transaction..."
          type="text"
          defaultValue={tx}
          onChange={(e) => setTx(e.target.value.trim())}
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => {
              toast('Note: Simulations may fail on alt-SVM', {
                description: 'Please verify via an explorer before submitting.',
              });
              toast.promise(simulateEncodedTransaction(tx, connection, wallet), {
                id: 'simulation',
                loading: 'Building simulation...',
                success: 'Simulation successful.',
                error: (e) => formatTransactionError(e),
              });
            }}
          >
            Simulate
          </Button>
          {multisigAddress && (
            <Button
              onClick={async () => {
                try {
                  const signature = await importTransaction(
                    tx,
                    connection,
                    multisigAddress,
                    programId.toBase58(),
                    vaultIndex,
                    wallet
                  );
                  setOpen(false);
                  toast.success(`Transaction proposed. (${signature})`, { id: 'transaction' });
                  await queryClient.invalidateQueries({ queryKey: ['transactions'] });
                  navigate('/transactions');
                } catch (e) {
                  toast.error(`Failed to propose: ${formatTransactionError(e)}`, { id: 'transaction' });
                }
              }}
            >
              Import
            </Button>
          )}
        </div>
        <button
          onClick={() => getSampleMessage()}
          disabled={!wallet || !wallet.publicKey}
          className="flex cursor-pointer justify-end text-xs text-stone-400 underline hover:text-stone-200"
        >
          Click to use a sample memo for testing
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTransaction;

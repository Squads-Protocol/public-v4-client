import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import * as bs58 from 'bs58';
import { Button } from '../ui/button';
import { useState } from 'react';
import * as multisig from '@sqds/multisig';
import { useWallet } from '@solana/wallet-adapter-react';
import { Message, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { Plus, FileCode, Play, FlaskConical, Sparkles } from 'lucide-react';
import { simulateEncodedTransaction } from '@/lib/transaction/simulateEncodedTransaction';
import { importTransaction } from '@/lib/transaction/importTransaction';
import { useMultisigData } from '@/hooks/useMultisigData';
import invariant from 'invariant';
import { VaultSelector } from '@/components/vault/VaultSelector';

const CreateTransaction = () => {
  const wallet = useWallet();

  const [tx, setTx] = useState('');
  const [open, setOpen] = useState(false);

  const { connection, multisigAddress, vaultIndex, programId } = useMultisigData();

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
      <DialogTrigger asChild>
        <Button
          disabled={!wallet || !wallet.publicKey}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Import Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" />
            Import Transaction
          </DialogTitle>
          <DialogDescription>
            Propose a transaction from a base58 encoded transaction message.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
            <div>
              <Label className="text-xs text-muted-foreground">Target Vault</Label>
              <p className="font-mono text-sm">Vault #{vaultIndex}</p>
            </div>
            <VaultSelector />
          </div>

          <div className="space-y-2">
            <Label>Transaction Message (base58)</Label>
            <Input
              placeholder="Paste base58 encoded transaction..."
              type="text"
              defaultValue={tx}
              onChange={(e) => setTx(e.target.value.trim())}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => {
                toast('Note: Simulations may fail on alt-SVM', {
                  description: 'Please verify via an explorer before submitting.',
                });
                toast.promise(simulateEncodedTransaction(tx, connection, wallet), {
                  id: 'simulation',
                  loading: 'Simulating...',
                  success: 'Simulation successful',
                  error: (e) => `${e}`,
                });
              }}
            >
              <FlaskConical className="h-4 w-4" />
              Simulate
            </Button>
            {multisigAddress && (
              <Button
                className="flex-1 gap-2"
                onClick={() =>
                  toast.promise(
                    importTransaction(
                      tx,
                      connection,
                      multisigAddress,
                      programId.toBase58(),
                      vaultIndex,
                      wallet
                    ),
                    {
                      id: 'transaction',
                      loading: 'Importing...',
                      success: () => {
                        setOpen(false);
                        return 'Transaction proposed';
                      },
                      error: (e) => `Failed to propose: ${e}`,
                    }
                  )
                }
              >
                <Play className="h-4 w-4" />
                Import
              </Button>
            )}
          </div>

          <button
            onClick={() => getSampleMessage()}
            disabled={!wallet || !wallet.publicKey}
            className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <Sparkles className="h-3 w-3" />
            Use sample memo for testing
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTransaction;

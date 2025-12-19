import {
  AddressLookupTableAccount,
  type AddressLookupTableAccountArgs,
  type ConfirmedSignatureInfo,
  type Connection,
  type DecompileArgs,
  PublicKey,
  TransactionMessage,
  type VersionedTransactionResponse,
} from '@solana/web3.js';
import { Check, Loader2, Search, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMultisigAddress } from '@/hooks/useMultisigAddress';
import { useMultisigData } from '@/hooks/useMultisigData';
import { identifyInstructionByDiscriminator } from '@/lib/discriminators';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';

interface MultisigLookupProps {
  onUpdate: () => void;
}

const MultisigLookup: React.FC<MultisigLookupProps> = ({ onUpdate }) => {
  const { connection, programId } = useMultisigData();
  const { setMultisigAddress } = useMultisigAddress();

  const [open, setOpen] = useState(false);
  const [vaultAddress, setVaultAddress] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [foundMultisigs, setFoundMultisigs] = useState<Set<string>>(new Set());
  const [forceCancel, setForceCancel] = useState<boolean>(false);

  const search = async (): Promise<void> => {
    if (!vaultAddress) return;
    setSearching(true);
    setForceCancel(false);
    setProgress(0);
    setFoundMultisigs(new Set());

    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      setStatusMessage('Fetching signatures...');

      const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
        vaultPubkey,
        { limit: 300 }
      );

      if (signatures.length === 0) {
        setStatusMessage('No signatures found for this address');
        setSearching(false);
        return;
      }

      setStatusMessage(`Found ${signatures.length} signatures to scan`);

      for (let i = 0; i < signatures.length; i++) {
        if (forceCancel) {
          setSearching(false);
          break;
        }

        const signature = signatures[i];
        setProgress(((i + 1) / signatures.length) * 100);
        setStatusMessage(`Scanning ${i + 1}/${signatures.length}...`);

        const tx: VersionedTransactionResponse | null = await connection.getTransaction(
          signature.signature,
          {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          }
        );

        if (tx) {
          const result = await processTransaction(tx, connection, programId);
          if (result?.decompiled) {
            for (let j = 0; j < result.decompiled.instructions.length; j++) {
              const identified = identifyInstructionByDiscriminator(
                result.decompiled.instructions[j],
                programId
              );
              if (identified) {
                const msKey =
                  result.decompiled.instructions[j].keys[
                    identified.multisigAccountIndex
                  ].pubkey.toBase58();
                setFoundMultisigs((prevState) => new Set(prevState).add(msKey));
              }
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setStatusMessage('Search complete');
      setSearching(false);
    } catch (e) {
      console.error(e);
      setStatusMessage('Search failed');
      setSearching(false);
      throw e;
    }
  };

  const handleSelect = async (msKey: string) => {
    setForceCancel(true);
    await setMultisigAddress.mutateAsync(msKey);
    setOpen(false);
    onUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Search className="h-4 w-4" />
          Lookup by Vault
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Find Multisig Address
          </DialogTitle>
          <DialogDescription>
            Enter your vault address to search for the associated multisig config.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter vault address..."
              className="font-mono text-sm"
              value={vaultAddress}
              onChange={(e) => setVaultAddress(e.target.value.trim())}
              disabled={searching}
            />
            <Button
              onClick={() =>
                toast.promise(search, {
                  loading: 'Searching...',
                  success: 'Search complete',
                  error: (e) => `Search failed: ${e}`,
                })
              }
              disabled={searching || !vaultAddress}
              className="shrink-0"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {searching && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{statusMessage}</p>
            </div>
          )}

          {foundMultisigs.size > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">
                  Found {foundMultisigs.size} multisig{foundMultisigs.size > 1 ? 's' : ''}
                </span>
              </div>
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {[...foundMultisigs].map((msKey, index) => (
                    <Button
                      key={`ms-${index}`}
                      variant="outline"
                      className="w-full justify-start gap-2 font-mono text-xs"
                      onClick={() => handleSelect(msKey)}
                    >
                      <Wallet className="h-4 w-4 shrink-0" />
                      <span className="truncate">{msKey}</span>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {!searching && foundMultisigs.size === 0 && statusMessage && (
            <p className="text-center text-sm text-muted-foreground">{statusMessage}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const processTransaction = async (
  tx: VersionedTransactionResponse,
  connection: Connection,
  programId: PublicKey
) => {
  const includesSquadsProgram = tx.transaction.message.staticAccountKeys.find((val) =>
    val.equals(programId)
  );
  if (includesSquadsProgram) {
    const { addressTableLookups } = tx.transaction.message;
    const altAddresses = addressTableLookups.map((addressTableLookup) =>
      addressTableLookup.accountKey.toBase58()
    );
    const altArgsArray: AddressLookupTableAccountArgs[] = [];

    for (let i = 0; i < altAddresses.length; i++) {
      const altPubkey = new PublicKey(altAddresses[i]);
      await new Promise((resolve) => setTimeout(resolve, 500));
      const alreadyCheckedState = altArgsArray.find((preAltArg) => preAltArg.key.equals(altPubkey));
      if (!alreadyCheckedState) {
        const altState = await connection.getAddressLookupTable(altPubkey);
        if (altState.value) {
          altArgsArray.push({
            key: altPubkey,
            state: altState.value.state,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const decompileArgs: DecompileArgs = {
      addressLookupTableAccounts: altArgsArray.map(
        (altArgs) => new AddressLookupTableAccount(altArgs)
      ),
    };
    const decompileTx = TransactionMessage.decompile(tx.transaction.message, decompileArgs);
    return { tx, decompiled: decompileTx };
  }
};

export default MultisigLookup;

import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { formatTransactionError } from '@/lib/utils';
import { useMultisigData } from '../hooks/useMultisigData';
import {
  AddressLookupTableAccount,
  AddressLookupTableAccountArgs,
  ConfirmedSignatureInfo,
  Connection,
  DecompileArgs,
  PublicKey,
  TransactionMessage,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { identifyInstructionByDiscriminator } from '../lib/discriminators';
import { useMultisigAddress } from '../hooks/useMultisigAddress';
import { toast } from 'sonner';

const MAX_CONSECUTIVE_SCAN_FAILURES = 5;

interface MultisigLookupProps {
  onUpdate: () => void;
}

const MultisigLookup: React.FC<MultisigLookupProps> = ({ onUpdate }) => {
  const { connection, programId } = useMultisigData();
  const { setMultisigAddress } = useMultisigAddress();

  const [vaultAddress, setVaultAddress] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [foundMultisigs, setFoundMultisigs] = useState<Set<string>>(new Set());
  const [forceCancel, setForceCancel] = useState<boolean>(false);

  const search = async (): Promise<void> => {
    if (!vaultAddress) return;
    setSearching(true);
    setForceCancel(false);
    setStatusMessages([]);
    try {
      const vaultPubkey = new PublicKey(vaultAddress);

      const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
        vaultPubkey,
        { limit: 300 }
      );
      if (signatures.length > 0) {
        setStatusMessages([`Found ${signatures.length} signatures`]);
      } else {
        setStatusMessages([`There was an issue retrieving the signatures, search again`]);
      }

      let scannedCount = 0;
      let consecutiveFailures = 0;
      let lastFailure = '';
      for (const signature of signatures) {
        if (forceCancel) {
          setSearching(false);
          break;
        }
        setStatusMessages((prev) => [
          ...prev,
          `Scanning signature ${signature.signature} - in progress`,
        ]);

        let scanResult = 'done';
        try {
          const tx: VersionedTransactionResponse | null = await connection.getTransaction(
            signature.signature,
            {
              commitment: 'confirmed',
              maxSupportedTransactionVersion: 1,
            }
          );

          if (tx) {
            const result = await processTransaction(tx, connection, programId);
            if (result) {
              if (result.decompiled) {
                for (let i = 0; i < result.decompiled.instructions.length; i++) {
                  let identified = identifyInstructionByDiscriminator(
                    result.decompiled.instructions[i],
                    programId
                  );
                  if (identified) {
                    let msKey =
                      result.decompiled.instructions[i].keys[
                        identified.multisigAccountIndex
                      ].pubkey.toBase58();
                    setFoundMultisigs((prevState) => {
                      return prevState.add(msKey);
                    });
                  }
                }
              }
            }
            scannedCount++;
          } else {
            scanResult = 'skipped, transaction not found';
          }
          consecutiveFailures = 0;
        } catch (e) {
          console.error(`Failed to scan signature ${signature.signature}`, e);
          consecutiveFailures++;
          lastFailure = e instanceof Error ? e.message : String(e);
          scanResult = `skipped, ${lastFailure}`;
        }

        setStatusMessages((prev) =>
          prev.map((msg) =>
            msg.includes(signature.signature)
              ? `Scanning signature ${signature.signature} - ${scanResult}`
              : msg
          )
        );
        if (consecutiveFailures >= MAX_CONSECUTIVE_SCAN_FAILURES) {
          throw new Error(
            `stopped after ${consecutiveFailures} signatures in a row failed to load (${lastFailure})`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (signatures.length > 0 && scannedCount === 0) {
        throw new Error(
          lastFailure
            ? `none of the signatures could be scanned (${lastFailure})`
            : 'none of the signatures could be scanned'
        );
      }

      setSearching(false);
    } catch (e) {
      setSearching(false);
      throw e;
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <h1>Search for Multisig Config Address</h1>
      <p className="text-sm text-gray-500">
        If you can't access your settings in main Squads app UI to find the multisig config address,
        enter your vault address below to do a search via onchain call.
      </p>
      <Input
        type="text"
        placeholder="Vault Address"
        className="mt-2 w-full rounded-md border border-gray-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-sm"
        value={vaultAddress}
        onChange={(e) => setVaultAddress(e.target.value.trim())}
      />
      <Button
        onClick={() =>
          toast.promise(search, {
            id: 'mksKeySearch',
            loading: 'Loading...',
            success: 'Search finished.',
            error: (e) => `Search failed: ${formatTransactionError(e)}`,
          })
        }
        className="mt-4"
        disabled={searching}
      >
        {searching ? 'Searching...' : 'Search'}
      </Button>

      {statusMessages.length > 0 && (
        <ul className="mt-4 h-[100px] overflow-y-auto rounded border border-gray-300 p-2 text-sm text-gray-600">
          {statusMessages.map((msg, index) => (
            <li key={index}>
              <pre className="text-xs">{msg}</pre>
            </li>
          ))}
        </ul>
      )}

      {foundMultisigs.size > 0 && (
        <>
          Found Multisig Config Address!
          <ul className="mt-4">
            {[...foundMultisigs].map((msKey, index) => {
              return (
                <li key={`ms-${index}`}>
                  <Button
                    onClick={async () => {
                      setForceCancel(true);
                      await setMultisigAddress.mutateAsync(msKey); // Save using React Query
                    }}
                  >
                    Use {msKey}
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
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
      let altPubkey = new PublicKey(altAddresses[i]);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // check previous state first to see if we already have it
      const alreadyCheckedState = altArgsArray.find((preAltArg) => preAltArg.key.equals(altPubkey));
      if (!alreadyCheckedState) {
        const altState = await connection.getAddressLookupTable(altPubkey);
        if (altState.value) {
          altArgsArray.push({
            key: altPubkey,
            state: altState.value.state,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
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

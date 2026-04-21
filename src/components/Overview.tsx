import { TokenList } from '@/components/TokenList';
import { VaultDisplayer } from '@/components/VaultDisplayer';
import { useMultisigData } from '@/hooks/useMultisigData';
import { ChangeMultisig } from '@/components/ChangeMultisig';

export default function Overview() {
  const { multisigAddress } = useMultisigData();

  return (
    <main>
      <div>
        <h1 className="text-3xl font-bold mb-4">Overview</h1>
        {multisigAddress && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1"><VaultDisplayer /></div>
              <div className="flex-1"><ChangeMultisig /></div>
            </div>
            <TokenList multisigPda={multisigAddress} />
          </div>
        )}
      </div>
    </main>
  );
}

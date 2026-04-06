import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useMultisigAddress } from '@/hooks/useMultisigAddress';

const MultisigInput = ({ onUpdate }: { onUpdate: () => void }) => {
  const { multisigAddress, setMultisigAddress } = useMultisigAddress();
  const [multisig, setMultisig] = useState(multisigAddress || '');

  const onSubmit = async () => {
    if (multisig.trim().length > 0) {
      await setMultisigAddress.mutateAsync(multisig); // Save using React Query
      onUpdate(); // Trigger any additional UI updates
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6 md:py-10 lg:px-8">
      <h1>Enter Multisig Config Address</h1>
      <p className="text-sm text-gray-500">
        There is no multisig set in Local Storage. Set it by entering its Public Key below.
      </p>
      <Input
        type="text"
        placeholder="Multisig Address"
        className="mt-2 w-full rounded-md border border-gray-300 px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 sm:text-sm"
        value={multisig}
        onChange={(e) => setMultisig(e.target.value.trim())}
      />
      <Button onClick={onSubmit} className="mt-4">
        Set Multisig
      </Button>
    </div>
  );
};

export default MultisigInput;

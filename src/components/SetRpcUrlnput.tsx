'use client';

import { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { useRpcUrl } from '~/hooks/useSettings'; // Now using React Query!

const SetRpcUrlInput = ({ onUpdate }: { onUpdate?: () => void }) => {
  const { rpcUrl: storedRpcUrl, setRpcUrl } = useRpcUrl(); // Use React Query
  const [rpcUrl, setRpcUrlState] = useState(storedRpcUrl || '');

  const isValidUrl = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      // Connection requires a lowercase http: or https: scheme.
      // Fetch requests cannot use URLs with embedded credentials.
      return /^https?:/.test(url) && !parsedUrl.username && !parsedUrl.password;
    } catch {
      return false;
    }
  };

  const onSubmit = async () => {
    if (isValidUrl(rpcUrl)) {
      await setRpcUrl.mutateAsync(rpcUrl); // Use React Query mutation
      setRpcUrlState(''); // Clear input field after submission
      if (onUpdate) onUpdate();
    } else {
      throw 'Please enter a valid URL.';
    }
  };

  return (
    <div>
      <Input
        onChange={(e) => setRpcUrlState(e.target.value.trim())}
        placeholder={storedRpcUrl || 'https://api.mainnet-beta.solana.com'}
        value={rpcUrl} // Sync input state with stored value
        className=""
      />
      {!isValidUrl(rpcUrl) && rpcUrl.length > 0 && (
        <p className="mt-2 text-xs">Please enter a valid URL.</p>
      )}
      <Button
        onClick={() =>
          toast.promise(onSubmit(), {
            loading: 'Updating RPC URL...',
            success: 'RPC URL set successfully.',
            error: (err) => `${err}`,
          })
        }
        disabled={!isValidUrl(rpcUrl) && rpcUrl.length > 0}
        className="mt-2"
      >
        Set RPC Url
      </Button>
    </div>
  );
};

export default SetRpcUrlInput;

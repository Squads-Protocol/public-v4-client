import { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useExplorerUrl } from '~/hooks/useSettings';

const DEBOUNCE_DELAY = 500; // 500ms debounce

const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const SetExplorerInput = () => {
  const { explorerUrl: storedExplorerUrl, setExplorerUrl } = useExplorerUrl();
  const [explorerUrl, setExplorerUrlState] = useState(storedExplorerUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (explorerUrl && !isValidUrl(explorerUrl)) {
        setError('Invalid URL. Please enter a valid URL.');
      } else {
        setError(null);
      }
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(handler);
  }, [explorerUrl]);

  const onSubmit = async () => {
    if (!explorerUrl || error) return;
    if (explorerUrl === storedExplorerUrl) return;

    await setExplorerUrl.mutateAsync(explorerUrl);
    setExplorerUrlState(''); // Clear input field after submission
  };

  return (
    <div>
      <Input
        onChange={(e) => setExplorerUrlState(e.target.value.trim())}
        placeholder={storedExplorerUrl || 'Enter explorer URL'}
        value={explorerUrl}
        className=""
      />
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <Button
        onClick={() =>
          toast.promise(onSubmit(), {
            loading: 'Updating Explorer...',
            success: 'Explorer set successfully.',
            error: (err) => `${err}`,
          })
        }
        disabled={!explorerUrl || !!error}
        className="mt-2"
      >
        Set Explorer URL
      </Button>
    </div>
  );
};

export default SetExplorerInput;

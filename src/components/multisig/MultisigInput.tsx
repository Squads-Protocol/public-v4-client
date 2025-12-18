import { useState } from 'react';
import { Users, ArrowRight, Sparkles } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useMultisigAddress } from '@/hooks/useMultisigAddress';

const MultisigInput = ({ onUpdate }: { onUpdate: () => void }) => {
  const { multisigAddress, setMultisigAddress } = useMultisigAddress();
  const [multisig, setMultisig] = useState(multisigAddress || '');
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async () => {
    if (multisig.trim().length > 0) {
      setIsLoading(true);
      try {
        await setMultisigAddress.mutateAsync(multisig);
        onUpdate();
      } catch (error) {
        console.error('Failed to set multisig address:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Card className="card-hover relative mx-auto max-w-xl overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/5" />
      <CardHeader className="relative text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Connect Your Squad</CardTitle>
        <CardDescription className="text-base">
          Enter your multisig address to get started
        </CardDescription>
      </CardHeader>
      <CardContent className="relative space-y-6">
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Enter multisig address (e.g., SQDS...)"
            className="h-12 font-mono text-sm"
            value={multisig}
            onChange={(e) => setMultisig(e.target.value.trim())}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          />
          <p className="text-xs text-muted-foreground">
            Paste the public key of your Squads multisig configuration account
          </p>
        </div>

        <Button 
          onClick={onSubmit} 
          className="w-full h-12 gap-2 text-base"
          disabled={isLoading || !multisig.trim()}
        >
          {isLoading ? (
            <>Loading...</>
          ) : (
            <>
              Connect to Squad
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          <span>Your address is stored locally in your browser</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default MultisigInput;

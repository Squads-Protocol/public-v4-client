import { Card, CardContent } from '../ui/card';
import { Button } from '~/components/ui/button';
import { useMultisigAddress } from '~/hooks/useMultisigAddress';

export function ChangeMultisig() {
  const { setMultisigAddress } = useMultisigAddress(); // Use React Query hook

  const handleChangeMultisig = () => {
    setMultisigAddress.mutate(null); // Wipes out the stored multisig address
  };

  return (
    <Card className="my-3 w-fit pt-5">
      <CardContent>
        <div>Switch to a different Squad</div>
        <Button onClick={handleChangeMultisig}>Change</Button>
      </CardContent>
    </Card>
  );
}

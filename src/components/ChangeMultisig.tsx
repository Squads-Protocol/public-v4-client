import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from '~/components/ui/button';
import { useMultisigAddress } from '~/hooks/useMultisigAddress';

export function ChangeMultisig() {
  const { setMultisigAddress } = useMultisigAddress();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Change Multisig</CardTitle>
        <CardDescription>Use a different Squad Multisig</CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" onClick={() => setMultisigAddress.mutate(null)}>
          Change
        </Button>
      </CardContent>
    </Card>
  );
}

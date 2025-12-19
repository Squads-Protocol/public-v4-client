import { useNavigate } from 'react-router-dom';
import { useMultisigAddress } from '@/hooks/useMultisigAddress';
import { Button } from '../ui/button';

export const ChangeMultisigFromNav = () => {
  const { setMultisigAddress } = useMultisigAddress(); // Use React Query hook
  const navigate = useNavigate();
  const handleChangeMultisig = () => {
    setMultisigAddress.mutate(null); // Wipes out the stored multisig address
    // navigate to home
    navigate('/');
  };

  return (
    <Button className={`mb-2 w-full bg-gray-500`} onClick={handleChangeMultisig}>
      Switch Squad
    </Button>
  );
};

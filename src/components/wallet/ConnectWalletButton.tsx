import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Button } from '../ui/button';
import '@solana/wallet-adapter-react-ui/styles.css';

const ConnectWallet = () => {
  const modal = useWalletModal();
  const { publicKey, disconnect } = useWallet();
  return (
    <div>
      {!publicKey ? (
        <Button
          onClick={() => {
            modal.setVisible(true);
          }}
          className="h-12 w-full"
        >
          Connect Wallet
        </Button>
      ) : (
        <Button onClick={disconnect} className="h-12 w-full">
          Disconnect Wallet
        </Button>
      )}
    </div>
  );
};

export default ConnectWallet;

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  ArrowLeftRight,
  Box,
  ExternalLink,
  Home,
  Moon,
  Plus,
  Settings,
  Sun,
  Users,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useTheme } from '@/hooks/useTheme';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { publicKey, disconnect } = useWallet();
  const modal = useWalletModal();
  useMultisigData(); // Ensure hook is called for consistency
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Command/Ctrl + K to open command palette
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }

      // Quick navigation with G + key (go to)
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !open) {
        const handleSecondKey = (e2: KeyboardEvent) => {
          switch (e2.key) {
            case 'h': // Go home
              navigate('/');
              break;
            case 't': // Go to transactions
              navigate('/transactions');
              break;
            case 'm': // Go to members
              navigate('/config');
              break;
            case 'p': // Go to programs
              navigate('/programs');
              break;
            case 's': // Go to settings
              navigate('/settings');
              break;
          }
          document.removeEventListener('keydown', handleSecondKey);
        };
        document.addEventListener('keydown', handleSecondKey, { once: true });
        setTimeout(() => document.removeEventListener('keydown', handleSecondKey), 500);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, navigate]);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate('/'))}>
            <Home className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>G H</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/transactions'))}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            <span>Transactions</span>
            <CommandShortcut>G T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/config'))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Members</span>
            <CommandShortcut>G M</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/programs'))}>
            <Box className="mr-2 h-4 w-4" />
            <span>Programs</span>
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => runCommand(() => navigate('/create'))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Create New Squad</span>
          </CommandItem>
          {!publicKey ? (
            <CommandItem onSelect={() => runCommand(() => modal.setVisible(true))}>
              <Wallet className="mr-2 h-4 w-4" />
              <span>Connect Wallet</span>
            </CommandItem>
          ) : (
            <CommandItem onSelect={() => runCommand(() => disconnect())}>
              <Wallet className="mr-2 h-4 w-4" />
              <span>Disconnect Wallet</span>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
            <Sun className="mr-2 h-4 w-4" />
            <span>Light Mode</span>
            {theme === 'light' && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
            <Moon className="mr-2 h-4 w-4" />
            <span>Dark Mode</span>
            {theme === 'dark' && <CommandShortcut>Active</CommandShortcut>}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Links">
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                window.open('https://github.com/Squads-Protocol/public-v4-client', '_blank')
              )
            }
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            <span>GitHub Repository</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => window.open('https://docs.squads.so', '_blank'))}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            <span>Documentation</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

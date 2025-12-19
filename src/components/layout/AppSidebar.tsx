import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import {
  ArrowLeftRight,
  Box,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Github,
  Home,
  LogOut,
  Moon,
  Settings,
  Shuffle,
  Sun,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMultisigAddress } from '@/hooks/useMultisigAddress';
import { useMultisigData } from '@/hooks/useMultisigData';
import { useMultisig } from '@/hooks/useServices';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '~/lib/utils';

const navItems = [
  {
    name: 'Dashboard',
    icon: Home,
    route: '/',
  },
  {
    name: 'Transactions',
    icon: ArrowLeftRight,
    route: '/transactions/',
  },
  {
    name: 'Members',
    icon: Users,
    route: '/config/',
  },
  {
    name: 'Programs',
    icon: Box,
    route: '/programs/',
  },
  {
    name: 'Settings',
    icon: Settings,
    route: '/settings/',
  },
];

function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

function WalletSection() {
  const { publicKey, disconnect } = useWallet();
  const modal = useWalletModal();
  const [copied, setCopied] = useState(false);
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const copyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!publicKey) {
    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => modal.setVisible(true)}
              size="icon"
              className="h-8 w-8 bg-primary hover:bg-primary/90"
            >
              <Wallet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Connect Wallet</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Button
        onClick={() => modal.setVisible(true)}
        className="w-full gap-2 bg-primary hover:bg-primary/90"
      >
        <Wallet className="h-4 w-4" />
        <span>Connect Wallet</span>
      </Button>
    );
  }

  if (isCollapsed) {
    return (
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-primary/20 text-[10px] text-primary">
                    {publicKey.toBase58().slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Wallet</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-xs text-muted-foreground">Connected wallet</p>
              <p className="truncate font-mono text-xs">{publicKey.toBase58()}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyAddress}>
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-green-500" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy address'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => modal.setVisible(true)}>
            <Wallet className="mr-2 h-4 w-4" />
            Change wallet
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={disconnect}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-border/50 bg-sidebar-accent/50 hover:bg-sidebar-accent"
        >
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="bg-primary/20 text-xs text-primary">
              {publicKey.toBase58().slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-left font-mono text-xs">
            {truncateAddress(publicKey.toBase58())}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-xs text-muted-foreground">Connected wallet</p>
            <p className="truncate font-mono text-xs">{publicKey.toBase58()}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress}>
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? 'Copied!' : 'Copy address'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => modal.setVisible(true)}>
          <Wallet className="mr-2 h-4 w-4" />
          Change wallet
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnect} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={toggleTheme}>
      {theme === 'dark' ? (
        <>
          <Sun className="h-4 w-4" />
          <span>Light mode</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4" />
          <span>Dark mode</span>
        </>
      )}
    </Button>
  );
}

function SquadSelector() {
  const { multisigAddress } = useMultisigData();
  const { setMultisigAddress } = useMultisigAddress();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  if (!multisigAddress) return null;

  const handleSwitch = () => {
    setMultisigAddress.mutate(null);
    navigate('/');
  };

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleSwitch}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-muted transition-colors hover:bg-accent"
          >
            <Users className="h-4 w-4 text-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-mono text-xs">{truncateAddress(multisigAddress, 4)}</p>
          <p className="text-[10px] text-muted-foreground">Click to switch</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-sidebar-accent/50 p-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Users className="h-4 w-4 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">Active Squad</p>
        <p className="truncate font-mono text-xs">{truncateAddress(multisigAddress, 6)}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleSwitch}>
        <Shuffle className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function usePendingCount() {
  const { data: multisigConfig } = useMultisig();
  if (!multisigConfig) return 0;
  try {
    const totalTx = Number(multisigConfig.transactionIndex);
    const staleTx = Number(multisigConfig.staleTransactionIndex);
    // Pending = transactions that are not stale yet
    return Math.max(0, totalTx - staleTx);
  } catch {
    return 0;
  }
}

export function AppSidebar() {
  const location = useLocation();
  const path = location.pathname;
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const pendingCount = usePendingCount();

  const isActive = (route: string) => {
    if (route === '/') return path === '/';
    return path.startsWith(route);
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Squads">
              <Link to="/">
                <div
                  className={cn(
                    'flex items-center justify-center overflow-hidden transition-all duration-200',
                    isCollapsed ? 'size-8' : 'h-8 w-auto px-2 rounded-lg bg-foreground'
                  )}
                >
                  {/* Collapsed: Logomark icons (square) for proper alignment */}
                  {isCollapsed ? (
                    <>
                      {/* Light mode: black logomark visible on light bg */}
                      <img
                        src="/logomark-black.png"
                        className="size-8 object-contain dark:hidden"
                        alt="Squads"
                      />
                      {/* Dark mode: white logomark visible on dark bg */}
                      <img
                        src="/logomark-white.png"
                        className="size-8 object-contain hidden dark:block"
                        alt="Squads"
                      />
                    </>
                  ) : (
                    <>
                      {/* Expanded: Full wordmark logos */}
                      <img
                        src="/logo-white.png"
                        className="h-5 w-auto object-contain dark:hidden"
                        alt="Squads"
                      />
                      <img
                        src="/logo-black.png"
                        className="h-5 w-auto object-contain hidden dark:block"
                        alt="Squads"
                      />
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 leading-none group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold">Squads</span>
                  <span className="text-[10px] text-muted-foreground">Multisig v4</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Squad Selector */}
        <SidebarGroup className={cn(isCollapsed && 'flex items-center justify-center')}>
          <SquadSelector />
        </SidebarGroup>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.route);
                const showBadge = item.route === '/transactions/' && pendingCount > 0;
                return (
                  <SidebarMenuItem key={item.route}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={showBadge ? `${item.name} (${pendingCount} pending)` : item.name}
                      className="nav-active-indicator"
                      data-active={active}
                    >
                      <Link to={item.route} className="relative">
                        <Icon className="shrink-0" />
                        <span>{item.name}</span>
                        {showBadge && !isCollapsed && (
                          <Badge
                            variant="default"
                            className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px] font-medium"
                          >
                            {pendingCount > 99 ? '99+' : pendingCount}
                          </Badge>
                        )}
                        {showBadge && isCollapsed && (
                          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
                            {pendingCount > 9 ? '9+' : pendingCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Resources */}
        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="GitHub">
                  <a
                    href="https://github.com/Squads-Protocol/public-v4-client"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github className="shrink-0" />
                    <span>GitHub</span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-50" />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Theme Toggle and Wallet */}
      <SidebarFooter
        className={cn(
          'border-t border-sidebar-border space-y-2',
          isCollapsed && 'flex flex-col items-center justify-center'
        )}
      >
        <ThemeToggle />
        <WalletSection />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

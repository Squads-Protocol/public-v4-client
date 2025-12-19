import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMultisigData } from '@/hooks/useMultisigData';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import MultisigInput from './MultisigInput';
import MultisigLookup from './MultisigLookup';
import Overview from './Overview';

function AnimatedOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Subtle gradient - top */}
      <div
        className="absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, hsl(0 0% 50% / 0.3) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Secondary gradient - right */}
      <div
        className="absolute -right-24 top-0 h-72 w-72 rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, hsl(0 0% 60% / 0.3) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
}

export default function RenderMultisigRoute() {
  const { multisigAddress: multisig } = useMultisigData();

  if (multisig) {
    return <Overview />;
  }

  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center space-y-8 py-12">
      {/* Animated background orbs */}
      <AnimatedOrbs />

      {/* Hero Section */}
      <div className="relative text-center animate-in">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Welcome to <span className="text-foreground">Squads</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
          The most secure multisig solution on Solana. Manage your team's treasury with confidence.
        </p>
      </div>

      {/* Connect Card */}
      <div className="relative animate-in-delayed w-full max-w-xl">
        <MultisigInput onUpdate={() => null} />
      </div>

      {/* Divider */}
      <div
        className="relative flex w-full max-w-xl items-center gap-4 animate-in"
        style={{ animationDelay: '0.2s', opacity: 0 }}
      >
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Create New / Lookup */}
      <div
        className="relative flex flex-col items-center gap-4 sm:flex-row animate-in"
        style={{ animationDelay: '0.3s', opacity: 0 }}
      >
        <Button asChild variant="outline" className="gap-2">
          <Link to="/create">
            <Plus className="h-4 w-4" />
            Create New Squad
          </Link>
        </Button>
        <MultisigLookup onUpdate={() => null} />
      </div>
    </div>
  );
}

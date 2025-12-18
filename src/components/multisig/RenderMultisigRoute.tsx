import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';

import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import MultisigInput from './MultisigInput';
import MultisigLookup from './MultisigLookup';
import { useMultisigData } from '@/hooks/useMultisigData';
import Overview from './Overview';

function AnimatedOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Primary orb - top left */}
      <div 
        className="animate-float absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, hsl(263 70% 50% / 0.4) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      {/* Secondary orb - top right */}
      <div 
        className="animate-float-delayed absolute -right-24 top-0 h-72 w-72 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, hsl(280 65% 60% / 0.5) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      {/* Accent orb - bottom */}
      <div 
        className="animate-float-slow absolute -bottom-20 left-1/3 h-80 w-80 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, hsl(142 71% 45% / 0.3) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Small floating particles */}
      <div className="animate-float absolute left-1/4 top-1/4 h-2 w-2 rounded-full bg-primary/30" style={{ animationDelay: '-1s' }} />
      <div className="animate-float-delayed absolute right-1/3 top-1/3 h-1.5 w-1.5 rounded-full bg-purple-400/40" style={{ animationDelay: '-3s' }} />
      <div className="animate-float-slow absolute bottom-1/3 left-1/2 h-1 w-1 rounded-full bg-green-400/30" style={{ animationDelay: '-2s' }} />
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
          Welcome to <span className="gradient-text-animated">Squads</span>
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
      <div className="relative flex w-full max-w-xl items-center gap-4 animate-in" style={{ animationDelay: '0.2s', opacity: 0 }}>
        <Separator className="flex-1" />
        <span className="text-sm text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      {/* Create New / Lookup */}
      <div className="relative flex flex-col items-center gap-4 sm:flex-row animate-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
        <Button asChild variant="outline" className="gap-2 gradient-border">
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

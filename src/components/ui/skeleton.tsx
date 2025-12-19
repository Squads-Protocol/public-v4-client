import { cn } from '~/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'shimmer';
}

function Skeleton({ className, variant = 'shimmer', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted',
        variant === 'shimmer' ? 'shimmer-loading' : 'animate-pulse',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };

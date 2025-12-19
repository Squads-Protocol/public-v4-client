import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PageSkeleton } from '@/components/layout/PageSkeleton';
import RenderMultisigRoute from '@/components/multisig/RenderMultisigRoute';

const Index = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <RenderMultisigRoute />
      </Suspense>
    </ErrorBoundary>
  );
};

export default Index;

import RenderMultisigRoute from '@/components/multisig/RenderMultisigRoute';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Suspense } from 'react';

const Index = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <RenderMultisigRoute />
      </Suspense>
    </ErrorBoundary>
  );
};

export default Index;

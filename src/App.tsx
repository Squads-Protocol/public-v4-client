import React, { Suspense } from 'react';
import { Wallet } from './components/wallet/Wallet';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { Toaster } from './components/ui/sonner';
import { Spinner } from './components/ui/spinner';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './components/ui/sidebar';
import { AppSidebar } from './components/layout/AppSidebar';

import HomePage from './routes/_index';
import ConfigPage from './routes/config';
import CreatePage from './routes/create';
import SettingsPage from './routes/settings';
import TransactionsPage from './routes/transactions';
import ProgramsPage from './routes/programs';
import { Routes, Route, HashRouter } from 'react-router-dom';

import './styles/global.css';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Separator } from './components/ui/separator';

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="flex h-full min-h-[400px] items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <Spinner className="h-8 w-8 text-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const PageHeader = ({ children }: { children?: React.ReactNode }) => (
  <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
    <SidebarTrigger className="-ml-1" />
    <Separator orientation="vertical" className="mr-2 h-4" />
    {children}
  </header>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Wallet>
        <HashRouter>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="gradient-mesh">
              <PageHeader />
              <main className="flex-1 overflow-auto">
                <div className="mx-auto max-w-6xl space-y-6 p-6">
                  <ErrorBoundary>
                    <Suspense fallback={<LoadingFallback />}>
                      <Routes>
                        <Route index path="/" element={<HomePage />} />
                        <Route path="/config" element={<ConfigPage />} />
                        <Route path="/create" element={<CreatePage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/transactions" element={<TransactionsPage />} />
                        <Route path="/programs" element={<ProgramsPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </main>
            </SidebarInset>
          </SidebarProvider>

          <Toaster
            position="bottom-right"
            expand
            richColors
            closeButton
            visibleToasts={4}
            toastOptions={{
              classNames: {
                toast: 'bg-card border-border',
                title: 'text-foreground',
                description: 'text-muted-foreground',
              },
            }}
          />
        </HashRouter>
      </Wallet>
    </QueryClientProvider>
  );
};

const NotFound = () => (
  <div className="flex flex-col items-center justify-center py-20">
    <div className="rounded-full bg-muted p-6">
      <span className="text-4xl">🔍</span>
    </div>
    <h1 className="mt-6 text-4xl font-bold">404</h1>
    <p className="mt-2 text-muted-foreground">Page not found</p>
  </div>
);

export default App;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type React from 'react';
import { Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppBreadcrumb } from './components/layout/AppBreadcrumb';
import { AppSidebar } from './components/layout/AppSidebar';
import { CommandPalette } from './components/layout/CommandPalette';
import { PageSkeleton } from './components/layout/PageSkeleton';
import { PageTransition } from './components/layout/PageTransition';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar';
import { Toaster } from './components/ui/sonner';
import { Wallet } from './components/wallet/Wallet';
import { ThemeProvider } from './hooks/useTheme';
import HomePage from './routes/_index';
import ConfigPage from './routes/config';
import CreatePage from './routes/create';
import ProgramsPage from './routes/programs';
import SettingsPage from './routes/settings';
import TransactionsPage from './routes/transactions';

import './styles/global.css';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Separator } from './components/ui/separator';

const queryClient = new QueryClient();

const LoadingFallback = () => <PageSkeleton />;

const PageHeader = ({ children }: { children?: React.ReactNode }) => (
  <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 px-4 backdrop-blur-lg backdrop-saturate-150 supports-[backdrop-filter]:bg-background/60">
    <SidebarTrigger className="-ml-1" />
    <Separator orientation="vertical" className="mr-2 h-4" />
    <AppBreadcrumb />
    {children}
    <div className="ml-auto flex items-center gap-2">
      <kbd className="pointer-events-none hidden h-6 select-none items-center gap-1 rounded border border-border/50 bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </div>
  </header>
);

const App = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="squads-ui-theme">
      <QueryClientProvider client={queryClient}>
        <Wallet>
          <HashRouter>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <PageHeader />
                <main className="flex-1 overflow-auto">
                  <div className="mx-auto max-w-6xl space-y-6 p-6">
                    <ErrorBoundary>
                      <Suspense fallback={<LoadingFallback />}>
                        <PageTransition>
                          <Routes>
                            <Route index path="/" element={<HomePage />} />
                            <Route path="/config" element={<ConfigPage />} />
                            <Route path="/create" element={<CreatePage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/transactions" element={<TransactionsPage />} />
                            <Route path="/programs" element={<ProgramsPage />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </PageTransition>
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                </main>
              </SidebarInset>
            </SidebarProvider>

            <CommandPalette />

            <Toaster position="bottom-right" expand richColors closeButton visibleToasts={4} />
          </HashRouter>
        </Wallet>
      </QueryClientProvider>
    </ThemeProvider>
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

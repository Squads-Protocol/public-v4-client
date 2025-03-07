import React, { Suspense } from 'react';
import { Wallet } from './components/Wallet';
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckSquare } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import TabNav from './components/TabNav';

import HomePage from './routes/_index';
import ConfigPage from './routes/config';
import CreatePage from './routes/create';
import SettingsPage from './routes/settings';
import TransactionsPage from './routes/transactions';
import ProgramPage from "./routes/program";
import { Routes, Route, HashRouter } from 'react-router-dom';

import './styles/global.css'; // ✅ Load Tailwind styles
import { ErrorBoundary } from './components/ErrorBoundary';

const App = () => {
  const queryClient = new QueryClient();

  // @ts-ignore
  return (
    <QueryClientProvider client={queryClient}>
      <Wallet>
        <HashRouter>
          <div className="flex h-screen min-w-full flex-col bg-white md:flex-row">
            <TabNav />

            <div className="mt-1 space-y-2 p-3 pb-24 pt-4 md:ml-auto md:w-9/12 md:space-y-4 md:p-8 md:pt-6">
              <ErrorBoundary>
                <Suspense fallback={<p>Loading...</p>}>
                  <Routes>
                    <Route index path="/" element={<HomePage />} />
                    <Route path="/config" element={<ConfigPage />} />
                    <Route path="/create" element={<CreatePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/program" element={<ProgramPage />} />
                    <Route path="*" element={<p>404 - Not Found</p>} /> {/* Catch-all route */}
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>

          <Toaster
            expand
            visibleToasts={3}
            icons={{
              error: <AlertTriangle className="h-4 w-4 text-red-600" />,
              success: <CheckSquare className="h-4 w-4 text-green-600" />,
            }}
          />
        </HashRouter>
      </Wallet>
    </QueryClientProvider>
  );
};

export default App;

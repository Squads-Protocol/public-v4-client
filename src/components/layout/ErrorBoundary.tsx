import { Component, ReactNode } from 'react';
import { Button } from '../ui/button';
import SetRpcUrlInput from '@/components/settings/SetRpcUrlInput';
import { Card, CardContent, CardTitle } from '../ui/card';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode; // Optional custom fallback UI
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  rpcUpdated: boolean; // Track whether onUpdate was triggered
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: undefined, rpcUpdated: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, rpcUpdated: false };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('🛑 React Error Boundary caught an error:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleRpcUpdate = () => {
    this.setState({ rpcUpdated: true }); // Mark that the RPC was updated
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback
      ) : (
        <div className="error-boundary p-2">
          <div className={`max-w-fit`}>
            <h3>Something went wrong.</h3>
            <pre className={`max-w-fit whitespace-pre-wrap break-words text-xs`}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </pre>
          </div>
          {this.state.error?.message.includes('jsonrpc') ? (
            <div className={'mt-4'}>
              <Card className={`w-full md:w-1/2`}>
                <CardContent>
                  <h3>Try a different RPC</h3>
                  <div className="mt-4 justify-between">
                    <div className={`w-full`}>
                      <SetRpcUrlInput onUpdate={this.handleRpcUpdate} />
                    </div>
                    {this.state.rpcUpdated && (
                      <div className="mt-4 w-full">
                        <Button onClick={() => window.location.reload()}>Refresh Page</Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={() => window.location.reload()}>Refresh Page</Button>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

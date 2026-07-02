"use client";
import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              An unexpected error occurred in this section. The rest of the app is still
              running normally.
            </p>
            {this.state.error?.message && (
              <p className="mt-2 rounded bg-secondary px-3 py-1.5 font-mono text-xs text-muted-foreground">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

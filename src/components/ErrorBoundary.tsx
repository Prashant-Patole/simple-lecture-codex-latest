import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  retries: number;
  showBanner: boolean;
}

const MAX_SILENT_RETRIES = 3;
const RETRY_WINDOW_MS = 10000;
const RETRY_DELAY_MS = 150;

export class ErrorBoundary extends Component<Props, State> {
  private retryTimes: number[] = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retries: 0, showBanner: false };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);

    const now = Date.now();
    this.retryTimes = this.retryTimes.filter(t => now - t < RETRY_WINDOW_MS);
    this.retryTimes.push(now);

    if (this.retryTimes.length > MAX_SILENT_RETRIES) {
      // Too many errors in a short window — show a minimal banner instead of looping.
      this.setState({ showBanner: true });
      return;
    }

    // Silent auto-recovery: attempt to re-render after a brief delay.
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.setState(s => ({ hasError: false, retries: s.retries + 1 }));
    }, RETRY_DELAY_MS);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.showBanner) {
      // Non-blocking, dismissible notice. The app tree below is hidden but the page is not a takeover screen.
      return (
        <div className="fixed bottom-4 right-4 z-[9999] max-w-sm bg-card border border-border shadow-lg rounded-lg p-4 text-sm">
          <p className="text-foreground font-medium mb-2">Some content failed to load.</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
            >
              Refresh
            </button>
            <button
              onClick={() => {
                this.retryTimes = [];
                this.setState({ hasError: false, showBanner: false });
              }}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      // Silent fallback while we auto-recover — render nothing visible.
      return null;
    }

    return this.props.children;
  }
}

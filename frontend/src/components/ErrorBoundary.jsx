import React from "react";

/**
 * App-wide runtime error boundary.
 * Use for unexpected render/runtime errors outside of route loader/actions.
 *
 * Example:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error ?? new Error("Unknown error") };
  }

  componentDidCatch(error, errorInfo) {
    // Hook up your logging/telemetry here (Sentry, PostHog, etc.)
    // console.error("ErrorBoundary caught:", error, errorInfo);
    if (typeof this.props.onError === "function") {
      try {
        this.props.onError(error, errorInfo);
      } catch {}
    }
  }

  handleReset = () => {
    // Simple reset: clear error state so children re-render
    this.setState({ hasError: false, error: null });
    if (typeof this.props.onReset === "function") {
      try {
        this.props.onReset();
      } catch {}
    }
  };

  render() {
    if (this.state.hasError) {
      const message =
        this.state.error?.message || "An unexpected error occurred.";

      return (
        <div className="min-h-[60vh] grid place-items-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-800/40 bg-neutral-900/40 p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-white">
              Something broke.
            </h2>
            <p className="mt-2 text-neutral-200">{message}</p>

            {import.meta.env.DEV && (
              <pre className="mt-4 max-h-64 overflow-auto rounded bg-black/60 p-3 text-xs text-neutral-300">
                {this.state.error?.stack || String(this.state.error)}
              </pre>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={this.handleReset}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
              >
                Try again
              </button>
              {this.props.fallbackAction}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// frontend/src/components/ErrorBoundary.jsx
import React from "react";

const API_BASE = import.meta.env.VITE_API_BASE || ""; // Vercel/Local env drives this
const REPORT_URL = `${API_BASE}/api/report-issue`.replace(/([^:]\/)\/+/g, "$1");

function makeReportPayload(error, errorInfo) {
  return {
    path:
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "",
    status: 500,
    message: error?.message || "Runtime error",
    note: (errorInfo?.componentStack || "").slice(0, 1500),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
    env: import.meta.env.MODE, // 'development' | 'production'
  };
}

// very light duplicate suppression (per page + message)
function shouldSkipDuplicate(message) {
  try {
    const k = "eb-last-report";
    const now = Date.now();
    const key = `${
      typeof window !== "undefined" ? window.location.pathname : ""
    }|${message || ""}`;
    const raw = sessionStorage.getItem(k);
    const last = raw ? JSON.parse(raw) : null;
    if (last && last.key === key && now - last.ts < 30_000) return true; // 30s window
    sessionStorage.setItem(k, JSON.stringify({ key, ts: now }));
    return false;
  } catch {
    return false;
  }
}

async function sendReport(payload) {
  const res = await fetch(REPORT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({}));
}

/**
 * App-wide runtime error boundary.
 * Wrap your <App /> with this to catch render/runtime errors.
 *
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      reported: false,
      reporting: false,
      reportFailed: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error: error ?? new Error("Unknown error") };
  }

  componentDidCatch(error, errorInfo) {
    // Give callers a hook first (e.g., Sentry)
    if (typeof this.props.onError === "function") {
      try {
        this.props.onError(error, errorInfo);
      } catch {}
    }

    // Auto-report unless explicitly disabled
    if (this.props.autoReport === false) return;

    // Skip noisy repeats
    if (shouldSkipDuplicate(error?.message)) return;

    const payload = makeReportPayload(error, errorInfo);

    this.setState({ reporting: true, reportFailed: false }, () => {
      sendReport(payload)
        .then(() => this.setState({ reported: true, reporting: false }))
        .catch(() => this.setState({ reportFailed: true, reporting: false }));
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      reported: false,
      reportFailed: false,
    });
    if (typeof this.props.onReset === "function") {
      try {
        this.props.onReset();
      } catch {}
    }
  };

  handleManualReport = async () => {
    const { error } = this.state;
    this.setState({ reporting: true, reportFailed: false });
    try {
      await sendReport(
        makeReportPayload(error, { componentStack: error?.stack || "" })
      );
      this.setState({ reported: true, reporting: false });
    } catch {
      this.setState({ reportFailed: true, reporting: false });
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || "An unexpected error occurred.";
    const { reporting, reported, reportFailed } = this.state;

    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="w-full max-w-xl rounded-2xl border border-neutral-800/40 bg-neutral-900/40 p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-white">Something broke.</h2>
          <p className="mt-2 text-neutral-200">{message}</p>

          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-64 overflow-auto rounded bg-black/60 p-3 text-xs text-neutral-300">
              {this.state.error?.stack || String(this.state.error)}
            </pre>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={this.handleReset}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
            >
              Try again
            </button>

            <button
              onClick={this.handleManualReport}
              disabled={reporting}
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
              title={reported ? "Reported" : "Report to Slack"}
            >
              {reporting ? "Reporting…" : reported ? "Reported ✓" : "Report issue"}
            </button>

            {this.props.fallbackAction}
          </div>

          {reportFailed && (
            <p className="mt-3 text-sm text-red-400">
              Couldn’t send the report. Check your network and try again.
            </p>
          )}
        </div>
      </div>
    );
  }
}

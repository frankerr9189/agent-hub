// frontend/src/components/ErrorBoundary.jsx
import React from "react";

const API_BASE = import.meta.env.VITE_API_BASE || ""; // Vercel/Local env drives this
const REPORT_URL = `${API_BASE}/api/report-issue`.replace(/([^:]\/)\/+/g, "$1");

function makeReportPayload(error, errorInfo) {
  return {
    path: window.location.pathname + window.location.search,
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
    const key = `${window.location.pathname}|${message || ""}`;
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

    this.setState({ reporting: true, reportFailed: false }, async () => {
      try {
        await sendReport(payload);
        this.setState({ reported: true, reporting: false });
      } catch {
        this.setState({ reportFailed: true, reporting: false });
      }
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, reported: false, reportFailed: false });
    if (typeof this.props.onReset === "function") {
      try {
        this.props.onReset();
      } catch {}
    }
  };

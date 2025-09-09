// frontend/src/pages/ErrorPage.jsx
import React, { useMemo, useState } from "react";
import {
  useRouteError,
  isRouteErrorResponse,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { apiUrl } from "../lib/api"; // ✅ env-driven base

export default function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState("");

  const { title, message, status } = useMemo(() => {
    let t = "Page not found";
    let m = "We can’t find the page you’re looking for.";
    let s = 404;

    if (isRouteErrorResponse(error)) {
      s = error.status;
      t = s === 404 ? "Page not found" : `Error ${s}`;
      m = error.data?.message || error.statusText || m;
    } else if (error instanceof Error) {
      t = "Something went wrong";
      s = 500;
      m = error.message || m;
    }

    return { title: t, message: m, status: s };
  }, [error]);

  const goHome = () => navigate("/", { replace: true });

  const submitReport = async () => {
    try {
      const res = await fetch(apiUrl("/api/report-issue"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: location.pathname + location.search,
          status,
          message,
          note: reportMsg,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "N/A",
          env: import.meta.env.MODE,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReportOpen(false);
      setReportMsg("");
      alert("Thanks! Your report was sent.");
    } catch (e) {
      console.error("[Report Issue] Failed:", e);
      alert("Could not send report. Please try again later.");
    }
  };

  return (
    <main className="min-h-[80vh] bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl px-4 pt-14">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-neutral-300">
          <span className="inline-flex items-center gap-2">
            <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-xs text-neutral-200">
              {status}
            </span>
            <span className="text-neutral-500">•</span>
            <span className="break-all">{location.pathname}</span>
          </span>
        </p>

        <p className="mt-4 text-neutral-200">{message}</p>

        {import.meta.env.DEV && error && (
          <details className="mt-4 rounded-lg bg-neutral-900 p-4 text-sm text-neutral-300 open:text-neutral-200">
            <summary className="cursor-pointer select-none font-medium">
              Technical details
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-black/50 p-3 text-xs">
              {(() => {
                try {
                  return JSON.stringify(
                    isRouteErrorResponse(error)
                      ? { status: error.status, data: error.data }
                      : error,
                    Object.getOwnPropertyNames(error),
                    2
                  );
                } catch {
                  return String(error);
                }
              })()}
            </pre>
          </details>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={goHome}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
          >
            Go to Home
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            Report issue
          </button>
        </div>
      </div>

      {/* Lightweight modal */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Report an issue</h2>
            <p className="mt-1 text-sm text-neutral-300">
              We’ll send this to our Slack. Current path:{" "}
              <code className="rounded bg-neutral-800 px-1 py-0.5">
                {location.pathname}
              </code>
            </p>
            <textarea
              className="mt-3 w-full rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-100 outline-none focus:border-neutral-500"
              rows={5}
              placeholder="What were you trying to do? Any details help."
              value={reportMsg}
              onChange={(e) => setReportMsg(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setReportOpen(false)}
                className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
              >
                Send to Slack
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

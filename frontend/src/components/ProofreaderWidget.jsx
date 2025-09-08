// frontend/src/components/ProofreaderWidget.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../lib/api"; // env-driven base

export default function ProofreaderWidget() {
  const [file, setFile] = useState(null);
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);

  const [uploadPct, setUploadPct] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | upload | processing | downloading

  const [dragActive, setDragActive] = useState(false);
  const [query, setQuery] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);

  const hiddenInputRef = useRef(null);
  const visibleInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  // ---------- Drag & drop ----------
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) onPickFileDirect(f);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onPickFileDirect(f);
  };

  function onPickFileDirect(f) {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) {
      setError("Please choose a .pdf file");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("PDF is larger than 50 MB limit");
      return;
    }
    setFile(f);
    setIssues(null);
    setError("");
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  }

  // ---------- XHR with upload progress ----------
  function xhrUpload({ url, file, responseType }) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.responseType = responseType; // 'json' for dryrun, 'blob' for annotate
      xhr.timeout = 600000; // 10 min safety for big PDFs

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploadPct(pct);
        }
      };
      xhr.onloadstart = () => {
        setPhase("upload");
        setUploadPct(0);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr);
        } else {
          let msg = `Request failed (${xhr.status})`;
          try {
            const data = JSON.parse(xhr.responseText || "{}");
            msg = data.detail || data.error || msg;
          } catch {}
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.ontimeout = () => reject(new Error("Request timed out"));

      // switch to processing state right after upload finishes
      xhr.upload.onloadend = () => setPhase("processing");

      xhr.send(fd);
    });
  }

  async function doDryRun() {
    if (!file) return;
    setLoading(true);
    setError("");
    setIssues(null);
    try {
      const xhr = await xhrUpload({
        url: apiUrl("/proofread-dryrun"),
        file,
        responseType: "json",
      });
      const data = xhr.response || JSON.parse(xhr.responseText || "{}");
      setIssues(Array.isArray(data?.issues) ? data.issues : []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
      setPhase("idle");
      setUploadPct(0);
    }
  }

  async function doAnnotate() {
    if (!file) return;
    setDownloading(true);
    setError("");
    try {
      const xhr = await xhrUpload({
        url: apiUrl("/proofread"),
        file,
        responseType: "blob",
      });
      const blob = xhr.response instanceof Blob ? xhr.response : new Blob([xhr.response]);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      const cd = xhr.getResponseHeader("Content-Disposition") || "";
      const m = cd.match(/filename="?([^";]+)"?/i);
      const rawName = m?.[1] || `annotated_${file.name}`;
      const sanitize = (s) => s.replace(/[\r\n]/g, "").replace(/[\\/:*?"<>|]/g, "_");
      const name = sanitize(rawName);

      // auto-download
      setPhase("downloading");
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setDownloading(false);
      setPhase("idle");
      setUploadPct(0);
    }
  }

  const filtered = useMemo(() => {
    if (!issues) return [];
    const q = query.trim().toLowerCase();
    if (!q) return issues;
    return issues.filter((it) =>
      [it.page, it.type, it.sentence_or_excerpt, it.problem, it.suggestion]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [issues, query]);

  const countsByType = useMemo(() => {
    if (!issues) return {};
    return issues.reduce((acc, it) => {
      const k = String(it.type || "other");
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  }, [issues]);

  return (
    <div style={styles.wrap}>
      <style>{css}</style>

      {/* Drag & drop zone (also clickable) */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={"dropzone" + (dragActive ? " active" : "")}
        onClick={() => hiddenInputRef.current?.click()}
        title="Click to choose a PDF or drag & drop"
      >
        <input
          ref={hiddenInputRef}
          type="file"
          accept="application/pdf"
          onChange={onPickFile}
          style={{ display: "none" }}
        />
        <div>
          <div style={{ fontSize: 16, marginBottom: 6, color: "#0f172a" }}>
            {file ? <strong>{file.name}</strong> : "Drop PDF here or click to browse"}
          </div>
          <div style={{ color: "#334155", fontSize: 13 }}>Max 50 MB</div>
        </div>
      </div>

      {/* Visible file input option */}
      <div style={styles.pickRow}>
        <button style={styles.btn} onClick={() => visibleInputRef.current?.click()}>
          Browse PDF
        </button>
        <span style={styles.or}>or</span>
        <label style={styles.fileLabel}>
          <input
            ref={visibleInputRef}
            type="file"
            accept="application/pdf"
            onChange={onPickFile}
            style={{ display: "none" }}
          />
          <span>Choose file…</span>
        </label>
        {file && <span style={styles.fileName}>{file.name}</span>}
      </div>

      {(phase === "upload" || phase === "processing") && (
        <div style={{ marginTop: 12 }}>
          <div style={styles.progressOuter}>
            <div
              style={{
                ...styles.progressInner,
                width: `${phase === "upload" ? uploadPct : 100}%`,
              }}
            />
          </div>
          <div style={styles.progressLabels}>
            <span>{phase === "upload" ? `Uploading ${uploadPct}%` : "Processing…"}</span>
          </div>
          {phase === "processing" && <div className="bar-animated" />}
        </div>
      )}

      <div style={styles.actions}>
        <button onClick={doDryRun} disabled={!file || loading || downloading} style={styles.btnSecondary}>
          {loading ? "Analyzing…" : "Preview Issues"}
        </button>
        <button onClick={doAnnotate} disabled={!file || loading || downloading} style={styles.btnPrimary}>
          {downloading ? "Generating PDF…" : "Download Annotated PDF"}
        </button>
      </div>

      {error && <div style={styles.error}>⚠︎ {error}</div>}

      {issues && (
        <>
          <div style={styles.toolbar}>
            <div style={styles.badges}>
              <span style={styles.badge}>Total: {issues.length}</span>
              {Object.entries(countsByType).map(([k, v]) => (
                <span key={k} style={styles.badgeMuted}>
                  {k}: {v}
                </span>
              ))}
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter issues…"
              style={styles.search}
            />
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Pg</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Excerpt</th>
                  <th style={styles.th}>Problem</th>
                  <th style={styles.th}>Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, i) => (
                  <tr key={i} style={i % 2 ? styles.trOdd : undefined}>
                    <td style={styles.td}>{it.page}</td>
                    <td style={styles.td}>{it.type}</td>
                    <td style={{ ...styles.td, maxWidth: 320 }}>
                      {(it.sentence_or_excerpt || "").slice(0, 200)}
                      {(it.sentence_or_excerpt || "").length > 200 ? "…" : ""}
                    </td>
                    <td style={{ ...styles.td, maxWidth: 280 }}>{it.problem}</td>
                    <td style={{ ...styles.td, maxWidth: 280 }}>{it.suggestion}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ ...styles.td, textAlign: "center", padding: 24 }}>
                      No issues match your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {downloadUrl && (
            <p style={{ marginTop: 12, color: "#0f172a" }}>
              If your browser blocked the download,{" "}
              <a href={downloadUrl} download={`annotated_${file?.name}`}>
                click here to save it
              </a>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    marginTop: 8,
    color: "#0f172a",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  pickRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },
  or: { color: "#334155" },
  fileLabel: {
    border: "1px solid #94a3b8",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    background: "#f8fafc",
    color: "#0f172a",
  },
  fileName: { color: "#0f172a", fontSize: 14 },
  actions: { display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" },
  btn: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #94a3b8",
    background: "#e2e8f0",
    color: "#0f172a",
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #94a3b8",
    background: "#f1f5f9",
    color: "#0f172a",
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #1d4ed8",
    background: "#1d4ed8",
    color: "#ffffff",
    cursor: "pointer",
  },
  error: {
    marginTop: 12,
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    padding: 10,
    borderRadius: 8,
  },
  toolbar: {
    marginTop: 16,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  badges: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: {
    background: "#e0e7ff",
    color: "#1e3a8a",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
  },
  badgeMuted: {
    background: "#e5e7eb",
    color: "#111827",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
  },
  search: {
    border: "1px solid #94a3b8",
    borderRadius: 8,
    padding: "6px 10px",
    minWidth: 220,
    color: "#0f172a",
  },
  tableWrap: {
    marginTop: 12,
    maxHeight: 360,
    overflow: "auto",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
    color: "#0f172a",
  },
  th: {
    textAlign: "left",
    position: "sticky",
    top: 0,
    background: "#e5e7eb",
    color: "#0f172a",
    borderBottom: "1px solid #cbd5e1",
    padding: "8px 10px",
  },
  td: {
    verticalAlign: "top",
    borderTop: "1px solid #e5e7eb",
    padding: "8px 10px",
    lineHeight: 1.35,
  },
  trOdd: { background: "#f8fafc" },
  progressOuter: {
    height: 8,
    background: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressInner: {
    height: "100%",
    background: "#1d4ed8",
    transition: "width 180ms ease",
  },
  progressLabels: { marginTop: 6, fontSize: 12, color: "#334155" },
};

const css = `
.dropzone {
  border: 2px dashed #94a3b8;
  border-radius: 12px;
  padding: 24px;
  background: #f1f5f9;
  text-align: center;
  cursor: pointer;
  transition: all .15s ease;
  color: #0f172a;
}
.dropzone.active {
  background: #e0e7ff;
  border-color: #4f46e5;
}
.bar-animated {
  position: relative;
  height: 4px;
  overflow: hidden;
  background: #cbd5e1;
  border-radius: 999px;
  margin-top: 8px;
}
.bar-animated::before {
  content: "";
  position: absolute;
  left: -40%;
  top: 0;
  height: 100%;
  width: 40%;
  background: #60a5fa;
  animation: slide 1.1s infinite;
}
@keyframes slide {
  0% { left: -40%; }
  50% { left: 60%; }
  100% { left: 110%; }
}
`;

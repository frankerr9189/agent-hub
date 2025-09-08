// frontend/src/components/ProofreaderWidget.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../lib/api"; // ✅ use env-driven base

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
  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };

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

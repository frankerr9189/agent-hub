import { useEffect, useMemo, useState } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [issues, setIssues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [query, setQuery] = useState("");
  const API = import.meta.env.VITE_API_BASE || "http://localhost:5050";

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const onPickFile = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setIssues(null);
    setError("");
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }
  };

  const doDryRun = async () => {
    if (!file) return;
    setLoading(true);
    setIssues(null);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/proofread-dryrun`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Dryrun failed");
      setIssues(Array.isArray(data?.issues) ? data.issues : []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const doAnnotate = async () => {
    if (!file) return;
    setDownloading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/proofread`, { method: "POST", body: fd });
      if (!res.ok) {
        const maybeJson = await res.json().catch(() => null);
        throw new Error(maybeJson?.detail || maybeJson?.error || "Annotation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      // Try to honor filename from headers
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/i);
      const name = m?.[1] || `annotated_${file.name}`;

      // Auto-download
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
    }
  };

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
      <h1 style={styles.title}>PDF Proofreader</h1>
      <p style={styles.subtitle}>Upload a PDF, preview issues, then download the annotated file.</p>

      <div style={styles.card}>
        <input type="file" accept="application/pdf" onChange={onPickFile} />
        {file && <p style={styles.meta}>Selected: {file.name}</p>}

        <div style={styles.actions}>
          <button onClick={doDryRun} disabled={!file || loading || downloading} style={styles.btn}>
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
                  <span key={k} style={styles.badgeMuted}>{k}: {v}</span>
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
                      <td style={{ ...styles.td, maxWidth: 280 }}>
                        {(it.sentence_or_excerpt || "").slice(0, 200)}
                        {(it.sentence_or_excerpt || "").length > 200 ? "…" : ""}
                      </td>
                      <td style={{ ...styles.td, maxWidth: 260 }}>{it.problem}</td>
                      <td style={{ ...styles.td, maxWidth: 260 }}>{it.suggestion}</td>
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
              <p style={{ marginTop: 12 }}>
                If your browser blocked the download,{" "}
                <a href={downloadUrl} download={`annotated_${file?.name}`}>click here to save it</a>.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 980, margin: "40px auto", padding: "0 20px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" },
  title: { margin: "0 0 8px", fontSize: 28 },
  subtitle: { marginTop: 0, color: "#555" },
  card: { background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  meta: { color: "#666", fontSize: 14, margin: "8px 0 0" },
  actions: { display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" },
  btn: { padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#f6f6f6", cursor: "pointer" },
  btnPrimary: { padding: "8px 12px", borderRadius: 8, border: "1px solid #2563eb", background: "#2563eb", color: "white", cursor: "pointer" },
  error: { marginTop: 12, color: "#b91c1c", background: "#fee2e2", border: "1px solid #fecaca", padding: 10, borderRadius: 8 },
  toolbar: { marginTop: 16, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" },
  badges: { display: "flex", gap: 8, flexWrap: "wrap" },
  badge: { background: "#eef2ff", color: "#3730a3", padding: "4px 8px", borderRadius: 999, fontSize: 12 },
  badgeMuted: { background: "#f3f4f6", color: "#111827", padding: "4px 8px", borderRadius: 999, fontSize: 12 },
  search: { border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", minWidth: 220 },
  tableWrap: { marginTop: 12, maxHeight: 360, overflow: "auto", border: "1px solid #eee", borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", position: "sticky", top: 0, background: "#fafafa", borderBottom: "1px solid #eee", padding: "8px 10px" },
  td: { verticalAlign: "top", borderTop: "1px solid #f1f1f1", padding: "8px 10px", lineHeight: 1.35 },
  trOdd: { background: "#fcfcfc" },
};

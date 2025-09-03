// frontend/src/pages/AgentProofreader.jsx
import ProofreaderWidget from "../components/ProofreaderWidget.jsx";

export default function AgentProofreader() {
  return (
    <section>
      <h1 style={{ fontSize: 24, margin: "0 0 6px", color: "#0f172a" }}>PDF Proofreader</h1>
      <p style={{ marginTop: 0, color: "#334155" }}>
        Upload a PDF, preview detected issues, then download an annotated PDF with highlights and a one-page summary.
      </p>
      <ProofreaderWidget />
    </section>
  );
}

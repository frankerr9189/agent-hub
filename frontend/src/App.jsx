// frontend/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import SiteHeader from "./components/SiteHeader.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import Home from "./pages/Home.jsx";
import Agents from "./pages/Agents.jsx";
import AgentProofreader from "./pages/AgentProofreader.jsx";

export default function App() {
  return (
    <div>
      <SiteHeader />
      <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/agents/proofreader" element={<AgentProofreader />} />

          {/* Simple placeholders so header links don't 404 yet */}
          <Route path="/agents" element={<Agents />} />
          <Route path="/pricing" element={<Placeholder title="Pricing" />} />
          <Route path="/faq" element={<Placeholder title="FAQ" />} />
          <Route path="/contact" element={<Placeholder title="Contact" />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <section style={{ textAlign: "center" }}>
      <h1 style={{ margin: "0 0 8px" }}>{title}</h1>
      <p style={{ color: "#9aa3b2", marginTop: 0 }}>
        This page is coming soon. In the meantime, try the PDF Proofreader.
      </p>
    </section>
  );
}

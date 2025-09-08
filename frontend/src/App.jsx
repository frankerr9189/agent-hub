// frontend/src/App.jsx
import { Routes, Route } from "react-router-dom";
import SiteHeader from "./components/SiteHeader.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import Home from "./pages/Home.jsx";
import Agents from "./pages/Agents.jsx";
import AgentProofreader from "./pages/AgentProofreader.jsx";

// NEW: error handling
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ErrorPage from "./pages/ErrorPage.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <div>
        <SiteHeader />
        <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/proofreader" element={<AgentProofreader />} />

            {/* Simple placeholders so header links don't 404 yet */}
            <Route path="/pricing" element={<Placeholder title="Pricing" />} />
            <Route path="/faq" element={<Placeholder title="FAQ" />} />
            <Route path="/contact" element={<Placeholder title="Contact" />} />

            {/* 404 fallback */}
            <Route path="*" element={<ErrorPage />} />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </ErrorBoundary>
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

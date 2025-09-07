// frontend/src/pages/Agents.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AgentCard from "../components/AgentCard.jsx";
import LeadCapture from "../components/LeadCapture.jsx";
import LeadCaptureModal from "../components/LeadCaptureModal.jsx";

export default function Agents() {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAgent, setPendingAgent] = useState(null);
  const navigate = useNavigate();

  const openGate = (agent) => {
    setPendingAgent(agent);
    setModalOpen(true);
  };

  const handleLeadSuccess = () => {
    setModalOpen(false);
    if (pendingAgent?.to) navigate(pendingAgent.to);
  };

  return (
    <section style={{ paddingTop: 8 }}>
      <h1 style={{ fontSize: 24, margin: "0 0 6px", color: "#fff" }}>AI Agents</h1>
      <p style={{ marginTop: 0, color: "var(--muted)" }}>
        Click an agent to try — we’ll ask for your info first, then unlock it instantly.
      </p>

      <div className="grid" style={{ marginTop: 12 }}>
        <AgentCard
          title="PDF Proofreader"
          copy="Upload a PDF and get an annotated version plus a one-page summary."
          onTry={() =>
            openGate({
              slug: "proofreader",
              title: "PDF Proofreader",
              to: "/agents/proofreader",
            })
          }
        />
        {/* Add more AgentCards here */}
      </div>

      <LeadCaptureModal open={modalOpen} onClose={() => setModalOpen(false)}>
        <LeadCapture
          interest={pendingAgent?.title || "General"}
          onSuccess={handleLeadSuccess}
        />
      </LeadCaptureModal>
    </section>
  );
}

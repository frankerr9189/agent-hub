// frontend/src/components/AgentCard.jsx
import logo from "../assets/AvaLogo.png"; // make sure this exists in src/assets

export default function AgentCard({ title, copy, onTry }) {
  return (
    <div className="card">
      <div style={{ marginBottom: 8 }}>
        <img
          src={logo}
          alt="Agent Logo"
          style={{ width: 40, height: 40, objectFit: "contain" }}
        />
      </div>
      <h3 style={{ margin: "0 0 6px", color: "#fff" }}>{title}</h3>
      <p style={{ margin: "0 0 12px", color: "var(--muted)" }}>{copy}</p>
      <button className="btn btn-ghost" onClick={onTry}>
        Try it →
      </button>
    </div>
  );
}

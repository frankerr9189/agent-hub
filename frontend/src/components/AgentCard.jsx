import { Link } from "react-router-dom";
import logo from "../assets/AvaLogo.png"; // put logo.png in src/assets

export default function AgentCard({ title, copy, to }) {
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
      <Link className="btn btn-ghost" to={to}>
        Try it →
      </Link>
    </div>
  );
}


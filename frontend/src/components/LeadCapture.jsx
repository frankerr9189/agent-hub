// frontend/src/components/LeadCapture.jsx
import { useState, useEffect } from "react";

export default function LeadCapture({ interest = "General", onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", interest });
  const [status, setStatus] = useState({ loading: false, msg: "", ok: null });

  // keep interest in sync if parent changes it
  useEffect(() => {
    setForm((f) => ({ ...f, interest }));
  }, [interest]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, msg: "", ok: null });
    try {
      const res = await fetch(import.meta.env.VITE_API_BASE + "/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus({ loading: false, msg: "Thanks! You now have access.", ok: true });
      onSuccess && onSuccess();
    } catch (err) {
      setStatus({ loading: false, msg: "Something went wrong.", ok: false });
    }
  };

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12, minWidth: 320 }}>
      <h3 style={{ margin: 0, color: "#fff" }}>Get access to {interest}</h3>

      <input className="input" name="name" placeholder="Name" value={form.name} onChange={onChange} required />
      <input className="input" name="email" placeholder="Email" value={form.email} onChange={onChange} required />
      <input className="input" name="phone" placeholder="Phone (optional)" value={form.phone} onChange={onChange} />

      {/* Show interest as read-only text, still posted with the form */}
      <input className="input" value={interest} readOnly />

      <button className="btn btn-ghost" disabled={status.loading}>
        {status.loading ? "Submitting…" : "Request Access"}
      </button>

      {status.msg && (
        <div style={{ color: status.ok ? "#8de99b" : "#ff8e8e" }}>{status.msg}</div>
      )}
    </form>
  );
}

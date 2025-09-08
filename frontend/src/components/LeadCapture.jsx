// frontend/src/components/LeadCapture.jsx
import { useState, useEffect } from "react";
import { postJSON } from "../lib/api";

export default function LeadCapture({ interest = "General", onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", interest });
  const [status, setStatus] = useState({ loading: false, msg: "", ok: null });

  // keep interest in sync if parent changes it
  useEffect(() => {
    setForm((f) => ({ ...f, interest }));
  }, [interest]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status.loading) return;

    setStatus({ loading: true, msg: "", ok: null });

    // quick front-end guard
    if (!form.name.trim() || !form.email.trim()) {
      setStatus({ loading: false, msg: "Name and email are required.", ok: false });
      return;
    }

    try {
      // postJSON builds the URL using VITE_API_BASE under the hood
      await postJSON("/lead", form);
      setStatus({ loading: false, msg: "Thanks! You now have access.", ok: true });
      onSuccess?.();
    } catch (err) {
      console.error(err);
      const msg = (err && err.message) ? err.message : "Something went wrong.";
      setStatus({ loading: false, msg, ok: false });
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="card"
      style={{ display: "grid", gap: 12, minWidth: 320 }}
      noValidate
    >
      <h3 style={{ margin: 0, color: "#fff" }}>Get access to {interest}</h3>

      <input
        className="input"
        name="name"
        placeholder="Name"
        value={form.name}
        onChange={onChange}
        required
        autoComplete="name"
      />

      <input
        className="input"
        name="email"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={onChange}
        required
        autoComplete="email"
      />

      <input
        className="input"
        name="phone"
        placeholder="Phone (optional)"
        value={form.phone}
        onChange={onChange}
        autoComplete="tel"
      />

      {/* Show interest as read-only (still posted via state) */}
      <input
        className="input"
        value={form.interest}
        readOnly
        aria-label="Interest"
      />

      <button className="btn btn-ghost" disabled={status.loading}>
        {status.loading ? "Submitting…" : "Request Access"}
      </button>

      {status.msg && (
        <div
          role="status"
          aria-live="polite"
          style={{
            color: status.ok ? "#8de99b" : "#ff8e8e",
            fontSize: 14,
          }}
        >
          {status.msg}
        </div>
      )}
    </form>
  );
}

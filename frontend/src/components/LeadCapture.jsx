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

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
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
      setStatus({ loading: false, msg: "Something went wrong.", ok: false });
    }
  };

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12, minWidth: 320 }}>
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

      {/* Show interest as read-only (still included in JSON via state) */}
      <input className="input" value={interest} readOnly />

      <button className="btn btn-ghost" disabled={status.loading}>
        {status.loading ? "Submitting…" : "Request Access"}
      </button>

      {status.msg && (

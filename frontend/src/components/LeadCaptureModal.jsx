// frontend/src/components/LeadCaptureModal.jsx
export default function LeadCaptureModal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ position: "relative", padding: 20, maxWidth: 480, width: "100%" }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="btn btn-ghost"
          style={{ position: "absolute", right: 12, top: 12 }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

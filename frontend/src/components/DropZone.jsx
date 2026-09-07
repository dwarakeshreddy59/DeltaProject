import React, { useRef } from "react";

const SLOT_CONFIG = {
  invoice:    { icon: "bi-receipt",    color: "#A855F7", bg: "linear-gradient(135deg, #7C3AED, #A855F7)" },
  po:         { icon: "bi-file-text",  color: "#C084FC", bg: "linear-gradient(135deg, #9333EA, #C084FC)" },
  remittance: { icon: "bi-cash-stack", color: "#22C55E", bg: "linear-gradient(135deg, #16A34A, #22C55E)" },
};

export default function DropZone({ slot, label, hint, file, onFile, hasError }) {
  const inputRef = useRef(null);
  const cfg = SLOT_CONFIG[slot] || SLOT_CONFIG.invoice;

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") onFile(f);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleClear = (e) => {
    e.stopPropagation();
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={`drop-zone dz-${slot}${file ? " has-file" : ""}${hasError ? " dz-error" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => !file && inputRef.current?.click()}
      style={{ cursor: file ? "default" : "pointer" }}
    >
      {/* Hidden real file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={handleChange}
      />

      {/* Icon */}
      <div className="drop-icon-wrap" style={{ background: cfg.bg }}>
        {file
          ? <i className="bi bi-check-circle-fill" style={{ color: "#fff", fontSize: "1.3rem" }} />
          : <i className={`bi ${cfg.icon}`} style={{ color: "#fff" }} />
        }
      </div>

      {/* Label */}
      <div className="drop-label" style={{ color: file ? "#22C55E" : undefined }}>
        {file ? `${label} ✓` : label}
      </div>

      {file ? (
        /* File info + change/clear buttons */
        <>
          <div className="drop-filename">{file.name}</div>
          <div className="drop-filesize">{(file.size / 1024).toFixed(1)} KB</div>
          <div style={{ display: "flex", gap: ".45rem", marginTop: ".65rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              style={{
                background: "linear-gradient(135deg, #7C3AED, #9333EA)", border: "1.5px solid #C084FC", color: "#ffffff",
                borderRadius: 8, padding: ".3rem .75rem", fontSize: ".73rem",
                fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: ".3rem",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.3)"
              }}
            >
              <i className="bi bi-arrow-repeat" /> Change
            </button>
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: "rgba(239, 68, 68, 0.15)", border: "1.5px solid rgba(239, 68, 68, 0.4)", color: "var(--danger-red)",
                borderRadius: 8, padding: ".3rem .75rem", fontSize: ".73rem",
                fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: ".3rem"
              }}
            >
              <i className="bi bi-x" /> Remove
            </button>
          </div>
        </>
      ) : (
        /* Empty state + browse button */
        <>
          <div className="drop-hint" style={{ marginBottom: ".75rem" }}>
            {hint}<br />
            <span style={{ opacity: .65 }}>Drag & drop or click below</span>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            style={{
              background: cfg.bg, color: "#fff", border: "none",
              borderRadius: 9, padding: ".45rem 1.1rem", fontSize: ".8rem",
              fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: ".4rem",
              boxShadow: "0 4px 14px rgba(0,0,0,.2)", position: "relative", zIndex: 1
            }}
          >
            <i className="bi bi-folder2-open" />Browse File
          </button>
          {hasError && (
            <div style={{ color: "#ef4444", fontSize: ".73rem", fontWeight: 600, marginTop: ".4rem" }}>
              <i className="bi bi-exclamation-circle me-1" />Required
            </div>
          )}
        </>
      )}
    </div>
  );
}

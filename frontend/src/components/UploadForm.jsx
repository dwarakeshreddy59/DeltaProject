import React, { useState } from "react";
import DropZone from "./DropZone";

const SLOTS = [
  {
    key: "invoice",
    label: "Invoice PDF",
    hint: "Document No. & Invoice Date",
    icon: "bi-receipt",
    color: "#A855F7",
    bg: "linear-gradient(135deg, #7C3AED, #A855F7)",
  },
  {
    key: "po",
    label: "Purchase Order PDF",
    hint: "PO No. & Delivery Date",
    icon: "bi-file-text",
    color: "#C084FC",
    bg: "linear-gradient(135deg, #9333EA, #C084FC)",
  },
  {
    key: "remittance",
    label: "Remittance PDF",
    hint: "Payment Ref. & Gross Amount",
    icon: "bi-cash-stack",
    color: "#22C55E",
    bg: "linear-gradient(135deg, #16A34A, #22C55E)",
  },
];

export default function UploadForm({ onSubmit, loading }) {
  const [files, setFiles] = useState({ invoice: null, po: null, remittance: null });
  const [errors, setErrors] = useState({});

  const setFile = (key) => (f) => {
    setFiles((prev) => ({ ...prev, [key]: f }));
    setErrors((prev) => ({ ...prev, [key]: false }));
  };

  const allSelected = files.invoice && files.po && files.remittance;
  const anySelected = files.invoice || files.po || files.remittance;

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!files.invoice)    errs.invoice    = true;
    if (!files.po)         errs.po         = true;
    if (!files.remittance) errs.remittance = true;
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const fd = new FormData();
    fd.append("invoice_pdf",    files.invoice);
    fd.append("po_pdf",         files.po);
    fd.append("remittance_pdf", files.remittance);
    fd.append("tds_rate",       2.0); // default 2%
    onSubmit(fd);
  };

  const handleReset = () => {
    setFiles({ invoice: null, po: null, remittance: null });
    setErrors({});
  };

  // Count how many slots are filled
  const filled = Object.values(files).filter(Boolean).length;

  return (
    <div className="upload-wrapper animate-fadein">
      <div className="upload-header">
        <i className="bi bi-cloud-arrow-up-fill" />
        Upload &amp; Extract Documents
        <span style={{ marginLeft: "auto", fontSize: ".78rem", opacity: 0.8, fontWeight: 600 }}>
          {filled}/3 PDFs Ready
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "rgba(168, 85, 247, 0.15)" }}>
        <div
          style={{
            height: "100%",
            width: `${(filled / 3) * 100}%`,
            background: filled === 3 ? "linear-gradient(90deg, #7C3AED, #22C55E)" : "linear-gradient(90deg, #7C3AED, #A855F7)",
            boxShadow: "0 0 12px rgba(168, 85, 247, 0.6)",
            transition: "width .4s cubic-bezier(.34,1.56,.64,1)",
          }}
        />
      </div>

      <div className="upload-body">
        <form onSubmit={handleSubmit}>
          {/* Drop zones for all 3 PDFs */}
          <div className="row g-3" style={{ marginBottom: "1.25rem" }}>
            {SLOTS.map(({ key, label, hint }) => (
              <div key={key} className="col-md-4">
                {errors[key] && (
                  <p style={{ color: "#ef4444", fontSize: ".75rem", marginBottom: ".35rem", fontWeight: 600 }}>
                    <i className="bi bi-exclamation-circle me-1" />{label} is required
                  </p>
                )}
                <DropZone
                  slot={key}
                  label={label}
                  hint={hint}
                  file={files[key]}
                  onFile={setFile(key)}
                  hasError={errors[key]}
                />
              </div>
            ))}
          </div>

          {/* Action Row - Dedicated Upload & Extract button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              paddingTop: "1rem",
              borderTop: "1px solid rgba(168, 85, 247, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: ".6rem", color: "#A1A1AA", fontSize: ".82rem" }}>
              <i className="bi bi-shield-check" style={{ color: "#A855F7", fontSize: "1.1rem" }} />
              <span>PDFs will be parsed &amp; auto-saved to PostgreSQL</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
              {anySelected && (
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    background: "rgba(168, 85, 247, 0.12)",
                    border: "1.5px solid rgba(168, 85, 247, 0.3)",
                    borderRadius: 10,
                    padding: ".55rem 1rem",
                    color: "#C084FC",
                    cursor: "pointer",
                    fontSize: ".83rem",
                    fontWeight: 600,
                    transition: "all .2s",
                  }}
                >
                  <i className="bi bi-arrow-counterclockwise me-1" />Reset
                </button>
              )}

              <button
                type="submit"
                className={`btn-extract animate-popin ${allSelected ? "btn-shine animate-neonpulse" : ""}`}
                disabled={loading || !allSelected}
                style={{
                  background: allSelected
                    ? "linear-gradient(135deg, #7C3AED, #A855F7)"
                    : "rgba(255, 255, 255, 0.08)",
                  color: allSelected ? "#ffffff" : "#71717A",
                  border: allSelected ? "1.5px solid #C084FC" : "1px solid rgba(255, 255, 255, 0.1)",
                  boxShadow: allSelected ? "0 0 25px rgba(168, 85, 247, 0.5), 0 6px 20px rgba(0,0,0,0.4)" : "none",
                  cursor: allSelected ? "pointer" : "not-allowed",
                  borderRadius: 10,
                  padding: ".6rem 1.6rem",
                  fontSize: ".88rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  transition: "all .2s",
                }}
              >
                {loading ? (
                  <>
                    <span className="spinner-ring" style={{ width: 18, height: 18, borderWidth: 2.5 }} />
                    Extracting &amp; Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up-fill" />
                    {allSelected ? "Upload & Extract Documents" : `Select All 3 PDFs (${filled}/3)`}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

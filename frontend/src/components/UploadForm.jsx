import React, { useState } from "react";
import DropZone from "./DropZone";

const SLOTS = [
  {
    key: "invoice",
    label: "Invoice PDF",
    hint: "Document No. & Invoice Date",
    icon: "bi-receipt",
    color: "#1565c0",
    bg: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
  },
  {
    key: "po",
    label: "Purchase Order PDF",
    hint: "PO No. & Delivery Date",
    icon: "bi-file-text",
    color: "#b45309",
    bg: "linear-gradient(135deg,#f59e0b,#d97706)",
  },
  {
    key: "remittance",
    label: "Remittance PDF",
    hint: "Payment Ref. & Gross Amount",
    icon: "bi-cash-stack",
    color: "#065f46",
    bg: "linear-gradient(135deg,#10b981,#059669)",
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
      <div style={{ height: 4, background: "#e2e8f0" }}>
        <div
          style={{
            height: "100%",
            width: `${(filled / 3) * 100}%`,
            background: filled === 3 ? "linear-gradient(90deg,#10b981,#3b82f6)" : "linear-gradient(90deg,#3b82f6,#8b5cf6)",
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
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: ".6rem", color: "#64748b", fontSize: ".82rem" }}>
              <i className="bi bi-shield-check" style={{ color: "#10b981", fontSize: "1.1rem" }} />
              <span>PDFs will be parsed &amp; auto-saved to PostgreSQL</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
              {anySelected && (
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    background: "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 10,
                    padding: ".55rem 1rem",
                    color: "#64748b",
                    cursor: "pointer",
                    fontSize: ".83rem",
                    fontWeight: 600,
                  }}
                >
                  <i className="bi bi-arrow-counterclockwise me-1" />Reset
                </button>
              )}

              <button
                type="submit"
                className="btn-extract animate-popin"
                disabled={loading || !allSelected}
                style={{
                  background: allSelected
                    ? "linear-gradient(135deg,#2563eb,#1d4ed8)"
                    : "#cbd5e1",
                  color: "#ffffff",
                  boxShadow: allSelected ? "0 6px 20px rgba(37,99,235,.35)" : "none",
                  cursor: allSelected ? "pointer" : "not-allowed",
                  borderRadius: 10,
                  padding: ".6rem 1.6rem",
                  fontSize: ".88rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: ".5rem",
                  border: "none",
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

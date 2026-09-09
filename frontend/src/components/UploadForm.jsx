import React, { useState } from "react";
import DropZone from "./DropZone";
import WrongFileModal from "./WrongFileModal";
import { useOrganization } from "../context/OrganizationContext";

export default function UploadForm({ onSubmit, loading, mismatchError, onClearMismatch }) {
  const { activeClient, nomenclature, openRegisterModal } = useOrganization();
  const [files, setFiles] = useState({ invoice: null, po: null, remittance: null });
  const [errors, setErrors] = useState({});

  const slots = [
    {
      key: "invoice",
      label: `${nomenclature.invoice_doc_label} PDF`,
      hint: `${nomenclature.invoice_num_label} & Tax Details`,
      icon: "bi-receipt",
      color: "#A855F7",
      bg: "linear-gradient(135deg, #7C3AED, #A855F7)",
    },
    {
      key: "po",
      label: `${nomenclature.po_doc_label} PDF`,
      hint: `${nomenclature.po_num_label} & Delivery Date`,
      icon: "bi-file-text",
      color: "#C084FC",
      bg: "linear-gradient(135deg, #9333EA, #C084FC)",
    },
    {
      key: "remittance",
      label: `${nomenclature.remittance_doc_label} PDF`,
      hint: `${nomenclature.remittance_num_label} & Cleared Items`,
      icon: "bi-cash-stack",
      color: "#22C55E",
      bg: "linear-gradient(135deg, #16A34A, #22C55E)",
    },
  ];

  const setFile = (key) => (f) => {
    setFiles((prev) => ({ ...prev, [key]: f }));
    setErrors((prev) => ({ ...prev, [key]: false }));
    if (onClearMismatch) onClearMismatch();
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
    if (activeClient?.id) {
      fd.append("client_id", activeClient.id);
    }
    onSubmit(fd);
  };

  const handleReset = () => {
    setFiles({ invoice: null, po: null, remittance: null });
    setErrors({});
    if (onClearMismatch) onClearMismatch();
  };

  const handleAutoFix = (mapping) => {
    // mapping is { invoice: sourceSlot, po: sourceSlot, remittance: sourceSlot }
    const fixedFiles = {
      invoice: mapping.invoice ? files[mapping.invoice] : files.invoice,
      po: mapping.po ? files[mapping.po] : files.po,
      remittance: mapping.remittance ? files[mapping.remittance] : files.remittance,
    };
    setFiles(fixedFiles);
    if (onClearMismatch) onClearMismatch();

    // Auto resubmit correctly ordered files immediately
    if (fixedFiles.invoice && fixedFiles.po && fixedFiles.remittance) {
      const fd = new FormData();
      fd.append("invoice_pdf", fixedFiles.invoice);
      fd.append("po_pdf", fixedFiles.po);
      fd.append("remittance_pdf", fixedFiles.remittance);
      fd.append("tds_rate", 2.0);
      if (activeClient?.id) {
        fd.append("client_id", activeClient.id);
      }
      onSubmit(fd);
    }
  };

  // Count how many slots are filled
  const filled = Object.values(files).filter(Boolean).length;
  const mismatches = mismatchError?.mismatches || [];

  return (
    <div className="upload-wrapper animate-fadein">
      {/* Centered High-Visibility Error Modal */}
      <WrongFileModal
        errorData={mismatchError}
        onClose={onClearMismatch}
        onAutoFix={handleAutoFix}
      />

      {/* Upload Header with Active Client Indicator */}
      <div className="upload-header">
        <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
          <span className="header-icon-glow">
            <i className="bi bi-cloud-arrow-up-fill" />
          </span>
          <div>
            <span style={{ fontWeight: 800, letterSpacing: "-0.01em", fontSize: "1.02rem" }}>
              Upload &amp; Extract Documents
            </span>
            {activeClient && (
              <div style={{ fontSize: ".76rem", color: "var(--purple-neon)", fontWeight: 600 }}>
                <i className="bi bi-building me-1" />
                Target Organization: <strong>{activeClient.organization_name}</strong>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: ".6rem" }}>
          <span className="upload-counter-pill">
            <i className="bi bi-layers-fill me-1" />
            {filled}/3 PDFs Loaded
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "rgba(168, 85, 247, 0.15)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${(filled / 3) * 100}%`,
            background: filled === 3 ? "linear-gradient(90deg, #7C3AED, #22C55E)" : "linear-gradient(90deg, #7C3AED, #A855F7)",
            boxShadow: "0 0 14px rgba(168, 85, 247, 0.7)",
            transition: "width .4s cubic-bezier(.34,1.56,.64,1)",
          }}
        />
      </div>

      <div className="upload-body">
        {/* Dynamic Nomenclature Notice */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-card-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 10,
            padding: ".55rem .9rem",
            marginBottom: "1.2rem",
            fontSize: ".78rem",
            flexWrap: "wrap",
            gap: ".5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem", color: "var(--text-muted)" }}>
            <i className="bi bi-info-circle-fill" style={{ color: "var(--purple-neon)" }} />
            <span>
              Configured document labels for <strong>{activeClient?.organization_name}</strong>:{" "}
              <span style={{ color: "#A855F7", fontWeight: 700 }}>{nomenclature.invoice_doc_label}</span>,{" "}
              <span style={{ color: "#C084FC", fontWeight: 700 }}>{nomenclature.po_doc_label}</span>,{" "}
              <span style={{ color: "#22C55E", fontWeight: 700 }}>{nomenclature.remittance_doc_label}</span>.
            </span>
          </div>

          <button
            type="button"
            onClick={openRegisterModal}
            style={{
              background: "none",
              border: "none",
              color: "var(--purple-violet)",
              fontWeight: 700,
              fontSize: ".76rem",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            + Register Another Company
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Drop zones for all 3 PDFs */}
          <div className="row g-3" style={{ marginBottom: "1.25rem" }}>
            {slots.map(({ key, label, hint }) => {
              const slotMismatch = mismatches.find((m) => m.slot === key);
              return (
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
                    mismatch={slotMismatch}
                  />
                </div>
              );
            })}
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
            <div style={{ display: "flex", alignItems: "center", gap: ".6rem", color: "var(--text-muted)", fontSize: ".82rem" }}>
              <i className="bi bi-shield-check" style={{ color: "var(--purple-neon)", fontSize: "1.1rem" }} />
              <span>Parsed &amp; saved to PostgreSQL under <strong>{activeClient?.organization_name}</strong></span>
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
                    color: "var(--purple-violet)",
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

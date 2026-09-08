import React from "react";

/**
 * WrongFileModal – Prominent centered dialog shown when mismatched or
 * invalid PDFs are uploaded. Blocks corrupted database saving and provides
 * clear diagnosis plus an instant one-click auto-swap action.
 */
export default function WrongFileModal({ errorData, onClose, onAutoFix }) {
  if (!errorData) return null;

  const { title, message, mismatches = [], can_auto_fix, auto_fix_mapping, can_auto_swap, swap_pair } = errorData;
  const showAutoFix = can_auto_fix && auto_fix_mapping;

  return (
    <div className="modal-backdrop-overlay animate-fadein" onClick={onClose}>
      <div
        className="wrong-file-modal animate-popin"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Glowing Alert Beacon */}
        <div className="modal-beacon-wrap">
          <div className="beacon-ring beacon-ring-1" />
          <div className="beacon-ring beacon-ring-2" />
          <div className="beacon-center">
            <i className="bi bi-exclamation-triangle-fill" />
          </div>
        </div>

        {/* Header */}
        <div className="modal-header-block">
          <div className="modal-chip-warning">
            <i className="bi bi-shield-slash-fill me-1" />
            UPLOAD MISMATCH DETECTED
          </div>
          <h2 className="modal-title">{title || "Wrong PDF Document Detected"}</h2>
          <p className="modal-subtitle">
            {message ||
              "One or more documents were placed in the wrong upload slot. Extraction and database saving have been blocked to protect your records from corrupted data."}
          </p>
        </div>

        {/* Diagnosis Cards */}
        <div className="mismatch-cards-grid">
          {mismatches.map((m, idx) => (
            <div key={idx} className="mismatch-card">
              <div className="mismatch-card-header">
                <span className="mismatch-slot-badge">
                  <i className="bi bi-file-earmark-pdf me-1" />
                  {m.slot_label || m.slot?.toUpperCase()}
                </span>
                <span className="mismatch-status-pill">
                  <i className="bi bi-x-circle-fill me-1" />
                  Wrong Document
                </span>
              </div>

              <div className="mismatch-filename-row" title={m.filename}>
                <i className="bi bi-paperclip text-muted me-1" />
                <span className="mismatch-filename">{m.filename}</span>
              </div>

              <div className="mismatch-compare-row">
                <div className="compare-item detected">
                  <span className="compare-label">Detected Type</span>
                  <span className="compare-val val-detected">
                    <i className="bi bi-arrow-right-circle me-1" />
                    {m.detected_label}
                  </span>
                </div>
                <div className="compare-arrow">➔</div>
                <div className="compare-item expected">
                  <span className="compare-label">Expected Type</span>
                  <span className="compare-val val-expected">
                    <i className="bi bi-check-circle me-1" />
                    {m.expected_label}
                  </span>
                </div>
              </div>

              <div className="mismatch-note">
                <i className="bi bi-info-circle me-1" />
                {m.message}
              </div>
            </div>
          ))}
        </div>

        {/* Integrity Guard Banner */}
        <div className="integrity-guard-banner">
          <i className="bi bi-shield-check text-success fs-5 me-2" />
          <div>
            <strong>Database Integrity Protected:</strong> No corrupted or empty ₹0.00 records were written to PostgreSQL.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions-row">
          {showAutoFix ? (
            <button
              type="button"
              className="btn-action-swap btn-shine animate-neonpulse"
              onClick={() => onAutoFix(auto_fix_mapping)}
            >
              <i className="bi bi-magic me-2" />
              Fix Automatically
            </button>
          ) : can_auto_swap && swap_pair ? (
            <button
              type="button"
              className="btn-action-swap btn-shine animate-neonpulse"
              onClick={() => onAutoFix({ [swap_pair[0]]: swap_pair[1], [swap_pair[1]]: swap_pair[0] })}
            >
              <i className="bi bi-magic me-2" />
              Fix Automatically
            </button>
          ) : null}

          <button type="button" className="btn-action-dismiss" onClick={onClose}>
            <i className="bi bi-pencil-square me-2" />
            Fix Manually
          </button>
        </div>
      </div>
    </div>
  );
}

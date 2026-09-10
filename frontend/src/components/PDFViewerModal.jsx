import React, { useEffect, useState, useMemo } from "react";
import { inr } from "../utils/format";
import { useOrganization } from "../context/OrganizationContext";

/**
 * PDFViewerModal provides an interactive split-view modal:
 * - Left Pane: Extracted fields belonging to this specific PDF with a verified source badge.
 * - Right Pane: Embedded PDF viewer iframe with download and new-tab actions.
 */
export default function PDFViewerModal({
  isOpen,
  onClose,
  docType = "invoice", // "invoice" | "po" | "remittance"
  docData = {},
  pdfUrl: propPdfUrl = null,
  pdfFile = null,
  title: customTitle = null,
}) {
  const { nomenclature } = useOrganization();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);

  // Generate blob URL if local File object is passed
  useEffect(() => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setBlobUrl(null);
    }
  }, [pdfFile]);

  // Determine effective PDF URL
  const effectivePdfUrl = useMemo(() => {
    if (blobUrl) return blobUrl;
    if (propPdfUrl) return propPdfUrl;

    // Check docData fields
    if (docData?.pdf_url) return docData.pdf_url;
    if (docData?.pdf_filename) return `/api/documents/${docData.pdf_filename}`;

    // Check type-specific fields in combined rows
    if (docType === "invoice" || docType === "tax_invoice") {
      if (docData?.invoice_pdf) return `/api/documents/${docData.invoice_pdf}`;
    } else if (docType === "po" || docType === "purchase_order") {
      if (docData?.po_pdf) return `/api/documents/${docData.po_pdf}`;
    } else if (docType === "remittance" || docType === "remittance_advice") {
      if (docData?.remittance_pdf) return `/api/documents/${docData.remittance_pdf}`;
    }
    return null;
  }, [blobUrl, propPdfUrl, docData, docType]);

  // Determine display filename
  const effectiveFileName = useMemo(() => {
    if (pdfFile?.name) return pdfFile.name;
    if (docData?.pdf_original_name) return docData.pdf_original_name;
    if (docType === "invoice" && docData?.invoice_pdf_name) return docData.invoice_pdf_name;
    if (docType === "po" && docData?.po_pdf_name) return docData.po_pdf_name;
    if (docType === "remittance" && docData?.remittance_pdf_name) return docData.remittance_pdf_name;
    if (docData?.pdf_filename) return docData.pdf_filename;
    return "document.pdf";
  }, [pdfFile, docData, docType]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Normalized docType
  const normalizedType = (docType || "").toLowerCase().includes("po")
    ? "po"
    : (docType || "").toLowerCase().includes("remit")
    ? "remittance"
    : "invoice";

  const typeConfig = {
    invoice: {
      label: nomenclature.invoice_doc_label || "Tax Invoice",
      numLabel: nomenclature.invoice_num_label || "Invoice Number",
      icon: "bi-receipt",
      color: "#A855F7",
      bgGradient: "linear-gradient(135deg, #7C3AED, #A855F7)",
      docNumber: docData?.invoice_number || docData?.invoice_num || "—",
      docDate: docData?.invoice_date || "—",
    },
    po: {
      label: nomenclature.po_doc_label || "Purchase Order",
      numLabel: nomenclature.po_num_label || "PO Number",
      icon: "bi-file-text",
      color: "#C084FC",
      bgGradient: "linear-gradient(135deg, #9333EA, #C084FC)",
      docNumber: docData?.po_number || "—",
      docDate: docData?.po_date || "—",
    },
    remittance: {
      label: nomenclature.remittance_doc_label || "Remittance Advice",
      numLabel: nomenclature.remittance_num_label || "Remittance Number",
      icon: "bi-cash-stack",
      color: "#22C55E",
      bgGradient: "linear-gradient(135deg, #16A34A, #22C55E)",
      docNumber: docData?.remittance_number || "—",
      docDate: docData?.remittance_date || "—",
    },
  }[normalizedType];

  return (
    <div className="pdf-modal-backdrop animate-fadein" onClick={onClose}>
      <div
        className={`pdf-modal-container animate-popin ${isFullscreen ? "fullscreen" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="pdf-modal-header" style={{ background: "var(--bg-card-subtle)" }}>
          <div className="pdf-modal-header-left">
            <div
              className="pdf-type-icon-badge"
              style={{ background: typeConfig.bgGradient }}
            >
              <i className={`bi ${typeConfig.icon}`} />
            </div>
            <div>
              <div className="pdf-modal-title">
                {customTitle || `${typeConfig.label} Document View`}
                <span className="pdf-doc-badge ms-2">
                  {typeConfig.docNumber}
                </span>
              </div>
              <div className="pdf-modal-filename text-truncate" title={effectiveFileName}>
                <i className="bi bi-file-earmark-pdf text-danger me-1" />
                <span>{effectiveFileName}</span>
              </div>
            </div>
          </div>

          <div className="pdf-modal-actions">
            {effectivePdfUrl && (
              <>
                <a
                  href={effectivePdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pdf-btn-action"
                  title="Open PDF in new browser tab"
                >
                  <i className="bi bi-box-arrow-up-right me-1" />
                  <span>Open Tab</span>
                </a>
                <a
                  href={`${effectivePdfUrl}${effectivePdfUrl.includes("?") ? "&" : "?"}download=true`}
                  download={effectiveFileName}
                  className="pdf-btn-action"
                  title="Download PDF to computer"
                >
                  <i className="bi bi-download me-1" />
                  <span>Download</span>
                </a>
              </>
            )}
            <button
              type="button"
              className="pdf-btn-action"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <i className={`bi ${isFullscreen ? "bi-fullscreen-exit" : "bi-arrows-fullscreen"}`} />
            </button>
            <button
              type="button"
              className="pdf-btn-close"
              onClick={onClose}
              title="Close viewer (Esc)"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        {/* Verification Link Banner */}
        <div className="pdf-verify-banner">
          <div className="pdf-verify-pill">
            <i className="bi bi-shield-check" />
            <span>Verified 1-to-1 Extraction Link</span>
          </div>
          <div className="pdf-verify-text">
            This extracted financial information belongs directly to this specific source PDF document.
          </div>
        </div>

        {/* Split Modal Body */}
        <div className="pdf-modal-body">
          {/* Left Pane: Extracted Information */}
          <div className="pdf-info-sidebar">
            <div className="pdf-sidebar-header">
              <i className="bi bi-layout-text-sidebar-reverse me-2" style={{ color: typeConfig.color }} />
              Extracted Information
            </div>

            <div className="pdf-sidebar-content">
              {/* Document Identity Card */}
              <div className="pdf-info-group">
                <div className="pdf-info-group-title">Document Reference</div>
                <div className="pdf-info-field">
                  <span className="pdf-field-name">{typeConfig.numLabel}</span>
                  <span className="pdf-field-val badge-val font-monospace">{typeConfig.docNumber}</span>
                </div>
                <div className="pdf-info-field">
                  <span className="pdf-field-name">Document Date</span>
                  <span className="pdf-field-val fw-bold">{typeConfig.docDate}</span>
                </div>
              </div>

              {/* Invoice-Specific Fields */}
              {normalizedType === "invoice" && (
                <>
                  <div className="pdf-info-group">
                    <div className="pdf-info-group-title">Cross-Reference & Description</div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">{nomenclature.po_num_label || "PO Number"} (Ref)</span>
                      <span className="pdf-field-val badge-val badge-po">{docData?.po_number || "—"}</span>
                    </div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">Description</span>
                      <span className="pdf-field-val text-wrap text-break" style={{ maxWidth: 210 }}>
                        {docData?.description || docData?.inv_description || "—"}
                      </span>
                    </div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">Billing Period</span>
                      <span className="pdf-field-val">{docData?.invoice_period || "—"}</span>
                    </div>
                  </div>

                  <div className="pdf-info-group">
                    <div className="pdf-info-group-title">Financials &amp; Tax</div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">Assessable Value</span>
                      <span className="pdf-field-val val-money">{inr(docData?.assessable_value)}</span>
                    </div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">Total Tax</span>
                      <span className="pdf-field-val val-money">{inr(docData?.total_tax)}</span>
                    </div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">Total Invoice Value</span>
                      <span className="pdf-field-val val-money fw-bold">{inr(docData?.total_invoice_value)}</span>
                    </div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">GST (18%)</span>
                      <span className="pdf-field-val val-money">{inr(docData?.gst_amount)}</span>
                    </div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">TDS Rate</span>
                      <span className="pdf-field-val fw-bold text-danger">{docData?.tds_rate ?? 2}%</span>
                    </div>
                    <div className="pdf-info-field">
                      <span className="pdf-field-name">TDS Deduction</span>
                      <span className="pdf-field-val val-money text-danger">− {inr(docData?.tds_amount)}</span>
                    </div>
                    <div className="pdf-info-field highlight-field">
                      <span className="pdf-field-name">Net Receivable</span>
                      <span className="pdf-field-val val-money text-success fw-bolder" style={{ fontSize: "1.05rem" }}>
                        {inr(docData?.receivable)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Purchase Order Specific Fields */}
              {normalizedType === "po" && (
                <div className="pdf-info-group">
                  <div className="pdf-info-group-title">Purchase Order Details</div>
                  <div className="pdf-info-field">
                    <span className="pdf-field-name">Original Description</span>
                    <span className="pdf-field-val text-wrap text-break" style={{ maxWidth: 210 }}>
                      {docData?.description || docData?.po_description || "—"}
                    </span>
                  </div>
                  <div className="pdf-info-field">
                    <span className="pdf-field-name">PO Validity / Delivery</span>
                    <span className="pdf-field-val">{docData?.delivery_date || "—"}</span>
                  </div>
                  <div className="pdf-info-field highlight-field">
                    <span className="pdf-field-name">Total PO Amount</span>
                    <span className="pdf-field-val val-money fw-bolder" style={{ fontSize: "1.05rem" }}>
                      {inr(docData?.total_amount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Remittance Specific Fields */}
              {normalizedType === "remittance" && (
                <div className="pdf-info-group">
                  <div className="pdf-info-group-title">Remittance Details</div>
                  <div className="pdf-info-field">
                    <span className="pdf-field-name">Linked {nomenclature.invoice_num_label || "Invoice"}</span>
                    <span className="pdf-field-val badge-val">{docData?.invoice_number || "—"}</span>
                  </div>
                  <div className="pdf-info-field">
                    <span className="pdf-field-name">Description / Notes</span>
                    <span className="pdf-field-val text-wrap text-break" style={{ maxWidth: 210 }}>
                      {docData?.description || docData?.rem_description || "—"}
                    </span>
                  </div>
                  <div className="pdf-info-field">
                    <span className="pdf-field-name">Gross Amount</span>
                    <span className="pdf-field-val val-money">{inr(docData?.gross_amount)}</span>
                  </div>
                  <div className="pdf-info-field highlight-field">
                    <span className="pdf-field-name">Total Gross Cleared</span>
                    <span className="pdf-field-val val-money fw-bolder" style={{ fontSize: "1.05rem" }}>
                      {inr(docData?.total_gross_amount)}
                    </span>
                  </div>
                </div>
              )}

              {/* Document File Metadata Box */}
              <div className="pdf-file-meta-box">
                <div className="meta-box-title">
                  <i className="bi bi-file-earmark-check-fill me-1 text-primary" />
                  Archived Document File
                </div>
                <div className="meta-box-item">
                  <span className="meta-label">Original:</span>
                  <span className="meta-val text-truncate" title={effectiveFileName}>{effectiveFileName}</span>
                </div>
                {docData?.pdf_filename && (
                  <div className="meta-box-item">
                    <span className="meta-label">Storage ID:</span>
                    <span className="meta-val font-monospace text-truncate" title={docData.pdf_filename}>
                      {docData.pdf_filename}
                    </span>
                  </div>
                )}
                {docData?.created_at && (
                  <div className="meta-box-item">
                    <span className="meta-label">Saved:</span>
                    <span className="meta-val">
                      {new Date(docData.created_at).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Pane: Embedded PDF Preview */}
          <div className="pdf-preview-pane">
            {effectivePdfUrl ? (
              <iframe
                src={effectivePdfUrl}
                title={`Source PDF - ${effectiveFileName}`}
                className="pdf-iframe"
              />
            ) : (
              <div className="pdf-unavailable-box animate-fadein">
                <div className="pdf-unavailable-icon">
                  <i className="bi bi-file-earmark-x" />
                </div>
                <div className="pdf-unavailable-title">Source PDF Not Archived</div>
                <div className="pdf-unavailable-text">
                  This record was created before automatic PDF document archiving was activated.
                  Any new documents you upload will automatically retain their original source PDFs for live viewing here.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pdf-modal-footer">
          <div className="pdf-footer-note">
            <i className="bi bi-eye-fill me-1 text-primary" />
            Active Source Document Review
          </div>
          <button type="button" className="btn-modal-done" onClick={onClose}>
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}

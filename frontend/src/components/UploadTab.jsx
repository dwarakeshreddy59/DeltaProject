import React, { useState } from "react";
import UploadForm from "./UploadForm";
import WrongFileAlert from "./WrongFileAlert";
import CrossLinkBadge from "./CrossLinkBadge";
import POCard from "./POCard";
import InvoiceCard from "./InvoiceCard";
import RemittanceCard from "./RemittanceCard";
import ExtractedTableView from "./ExtractedTableView";
import CalculationPanel from "./CalculationPanel";
import PDFViewerModal from "./PDFViewerModal";

export default function UploadTab({
  loading,
  results,
  calcData,
  mismatchError,
  onExtract,
  onRecalc,
  onViewRecords,
  onClearMismatch,
  onReset,
}) {
  const [viewMode, setViewMode] = useState("cards");
  const [resetTrigger, setResetTrigger] = useState(0);
  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    docType: "invoice",
    docData: null,
    pdfUrl: null,
    pdfFile: null,
    title: null,
  });

  const handleOk = () => {
    if (onReset) onReset();
    setResetTrigger((n) => n + 1);
  };

  const handlePreviewFile = (slot, file) => {
    setPdfModal({
      isOpen: true,
      docType: slot,
      docData: results ? results[slot] : null,
      pdfFile: file,
      pdfUrl: null,
      title: `Source PDF Preview: ${file.name}`,
    });
  };

  const handleViewPdf = ({ type, data }) => {
    const docData = data || (results ? results[type] : {});
    const url = docData?.pdf_url || results?.documents?.[type]?.url || null;
    setPdfModal({
      isOpen: true,
      docType: type,
      docData,
      pdfUrl: url,
      pdfFile: null,
      title: null,
    });
  };

  return (
    <>
      {/* Upload Form with Centered Error Modal & Auto-Swap */}
      <UploadForm
        onSubmit={onExtract}
        loading={loading}
        mismatchError={mismatchError}
        onClearMismatch={onClearMismatch}
        resetTrigger={resetTrigger}
        onPreviewFile={handlePreviewFile}
      />

      {/* Results */}
      {results && (
        <div className="animate-slideup">
          <WrongFileAlert warnings={results.errors} />

          <CrossLinkBadge po={results.po} invoice={results.invoice} remittance={results.remittance} />

          {/* View Toggle Bar with OK Button */}
          <div className="view-toggle-bar">
            <span className="view-toggle-label">
              <i className="bi bi-layout-text-window" />Extracted Data
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" }}>
              <div className="toggle-group">
                <button className={`toggle-btn ${viewMode === "cards" ? "active" : ""}`} onClick={() => setViewMode("cards")}>
                  <i className="bi bi-card-heading" />Cards
                </button>
                <button className={`toggle-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}>
                  <i className="bi bi-table" />Table
                </button>
                <button className={`toggle-btn ${viewMode === "both" ? "active" : ""}`} onClick={() => setViewMode("both")}>
                  <i className="bi bi-view-stacked" />Both
                </button>
              </div>
              <button className="btn-nav btn-green" style={{ fontFamily: "inherit", fontSize: ".8rem" }} onClick={onViewRecords}>
                <i className="bi bi-database-fill" />View All Records in DB
              </button>
              <button
                type="button"
                className="btn-ok-refresh"
                onClick={handleOk}
                title="Finish review & refresh for next upload"
              >
                <i className="bi bi-check-circle-fill" />
                <span>OK</span>
              </button>
            </div>
          </div>

          {/* Cards */}
          {(viewMode === "cards" || viewMode === "both") && (
            <div className="row g-4 mb-4">
              <div className="col-lg-4">
                <POCard po={results.po} onViewPdf={handleViewPdf} />
              </div>
              <div className="col-lg-4">
                <InvoiceCard invoice={results.invoice} onViewPdf={handleViewPdf} />
              </div>
              <div className="col-lg-4">
                <RemittanceCard remittance={results.remittance} onViewPdf={handleViewPdf} />
              </div>
            </div>
          )}

          {/* Table */}
          {(viewMode === "table" || viewMode === "both") && (
            <ExtractedTableView
              po={results.po}
              invoice={results.invoice}
              remittance={results.remittance}
              calcData={calcData}
              onTdsChange={onRecalc}
              onViewPdf={handleViewPdf}
            />
          )}

          {/* Calculations */}
          <CalculationPanel calcData={calcData} onTdsChange={onRecalc} />

          {/* Bottom OK Completion Banner */}
          <div className="extraction-done-footer animate-fadein">
            <div className="done-footer-info">
              <div className="done-footer-icon">
                <i className="bi bi-check2-all" />
              </div>
              <div>
                <div className="done-footer-title">Extraction &amp; Reconciliation Complete</div>
                <div className="done-footer-subtitle">
                  Information successfully captured and saved to records. Click OK to refresh view for next upload.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-ok-done"
              onClick={handleOk}
              title="Refresh view for next upload"
            >
              <i className="bi bi-check-circle-fill me-2" />
              OK
            </button>
          </div>
        </div>
      )}

      {/* Interactive Source PDF Viewer Modal */}
      <PDFViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        docType={pdfModal.docType}
        docData={pdfModal.docType === "invoice" ? { ...pdfModal.docData, ...calcData } : pdfModal.docData}
        pdfUrl={pdfModal.pdfUrl}
        pdfFile={pdfModal.pdfFile}
        title={pdfModal.title}
        onUpdateTds={pdfModal.docType === "invoice" ? onRecalc : null}
      />

      {!results && !loading && (
        <div className="animate-fadein" style={{ textAlign: "center", padding: "3rem 1rem", color: "#A1A1AA" }}>
          <i className="bi bi-arrow-up-circle empty-icon" style={{ fontSize: "3rem", display: "block", marginBottom: "1rem" }} />
          <p style={{ fontSize: ".95rem", fontWeight: 600 }}>Upload your 3 PDFs above to get started</p>
          <p style={{ fontSize: ".82rem", marginTop: ".4rem" }}>Invoice · Purchase Order · Remittance</p>
        </div>
      )}
    </>
  );
}

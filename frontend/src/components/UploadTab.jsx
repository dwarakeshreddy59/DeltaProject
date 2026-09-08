import React, { useState } from "react";
import UploadForm from "./UploadForm";
import WrongFileAlert from "./WrongFileAlert";
import CrossLinkBadge from "./CrossLinkBadge";
import POCard from "./POCard";
import InvoiceCard from "./InvoiceCard";
import RemittanceCard from "./RemittanceCard";
import ExtractedTableView from "./ExtractedTableView";
import CalculationPanel from "./CalculationPanel";

export default function UploadTab({
  loading,
  results,
  calcData,
  mismatchError,
  onExtract,
  onRecalc,
  onViewRecords,
  onClearMismatch,
}) {
  const [viewMode, setViewMode] = useState("cards");

  return (
    <>
      {/* Upload Form with Centered Error Modal & Auto-Swap */}
      <UploadForm
        onSubmit={onExtract}
        loading={loading}
        mismatchError={mismatchError}
        onClearMismatch={onClearMismatch}
      />

      {/* Results */}
      {results && (
        <div className="animate-slideup">
          <WrongFileAlert warnings={results.errors} />

          <CrossLinkBadge po={results.po} invoice={results.invoice} remittance={results.remittance} />

          {/* View Toggle */}
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
            </div>
          </div>

          {/* Cards */}
          {(viewMode === "cards" || viewMode === "both") && (
            <div className="row g-4 mb-4">
              <div className="col-lg-4"><POCard po={results.po} /></div>
              <div className="col-lg-4"><InvoiceCard invoice={results.invoice} /></div>
              <div className="col-lg-4"><RemittanceCard remittance={results.remittance} /></div>
            </div>
          )}

          {/* Table */}
          {(viewMode === "table" || viewMode === "both") && (
            <ExtractedTableView po={results.po} invoice={results.invoice}
              remittance={results.remittance} calcData={calcData} />
          )}

          {/* Calculations */}
          <CalculationPanel calcData={calcData} onTdsChange={onRecalc} />
        </div>
      )}

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

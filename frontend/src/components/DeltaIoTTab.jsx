import React, { useState, useEffect, useMemo } from "react";
import { fetchHistory } from "../services/api";
import { useOrganization } from "../context/OrganizationContext";
import { fmt } from "../utils/format";
import toast from "react-hot-toast";

// Standard Master Vendor Identity
const DELTA_IOT_DETAILS = {
  name: "Delta IoT Solutions",
  legal_name: "Delta IoT Solutions Private Limited",
  tagline: "Master Invoicing & Projection Origin",
  address: "Flat No 203, 2nd Floor, Lumbni Rockdale Compound, Somajiguda, Hyderabad - 500082",
  gstin: "27AAHCD2212P1ZJ",
  pan: "AAHCD2212P",
  contact: "billing@delta-iot.com",
};

// Known buyer / recipient names in PDF corresponding to client organizations
const DEFAULT_PDF_ENTITY_NAMES = {
  1: "Agco Business communications Clearing (w/c)",
  4: "J.P. Morgan Chase & Co. Global Payments Division",
  5: "BlackRock Institutional Services & Assets Management",
};

export default function DeltaIoTTab({ refreshTrigger = 0 }) {
  const { clients, activeCompany } = useOrganization();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("cards"); // 'cards' or 'table'
  
  // Customizable PDF entity names per client id
  const [pdfNames, setPdfNames] = useState(() => {
    try {
      const saved = localStorage.getItem("delta_pdf_names");
      return saved ? JSON.parse(saved) : DEFAULT_PDF_ENTITY_NAMES;
    } catch {
      return DEFAULT_PDF_ENTITY_NAMES;
    }
  });

  const [editingClientId, setEditingClientId] = useState(null);
  const [customPdfNameInput, setCustomPdfNameInput] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchHistory(null);
      if (res.data?.success) {
        setRecords(res.data?.combined || res.data?.records || []);
      }
    } catch (err) {
      console.error("Failed to load records for Delta IoT projections:", err);
      toast.error("Failed to load projections: " + (err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleSavePdfName = (clientId) => {
    if (!customPdfNameInput.trim()) return;
    const updated = { ...pdfNames, [clientId]: customPdfNameInput.trim() };
    setPdfNames(updated);
    localStorage.setItem("delta_pdf_names", JSON.stringify(updated));
    setEditingClientId(null);
    setCustomPdfNameInput("");
    toast.success("Updated PDF entity name mapping!");
  };

  // Filtered projections
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (selectedCompanyFilter && String(rec.client_id) !== String(selectedCompanyFilter)) {
        return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const clientName = rec.organization_name || "";
      const pdfName = pdfNames[rec.client_id] || "";
      const invNum = rec.invoice_number || "";
      const poNum = rec.po_number || "";
      const remNum = rec.remittance_number || "";
      return (
        invNum.toLowerCase().includes(q) ||
        clientName.toLowerCase().includes(q) ||
        pdfName.toLowerCase().includes(q) ||
        poNum.toLowerCase().includes(q) ||
        remNum.toLowerCase().includes(q)
      );
    });
  }, [records, selectedCompanyFilter, searchQuery, pdfNames]);

  const totalAssessable = filteredRecords.reduce((acc, r) => acc + Number(r.assessable_value || 0), 0);
  const totalReceivable = filteredRecords.reduce((acc, r) => acc + Number(r.receivable || 0), 0);
  const totalTax = filteredRecords.reduce((acc, r) => acc + Number(r.total_tax || 0), 0);
  const uniqueInvoices = new Set(filteredRecords.map((r) => r.invoice_number).filter(Boolean)).size;

  return (
    <div className="delta-tab-wrap animate-fadein">
      {/* Delta IoT Hero Header */}
      <div className="delta-hero">
        <div className="delta-hero-content">
          <div className="delta-hero-brand">
            <div className="delta-brand-avatar">
              <i className="bi bi-diagram-3-fill" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
                <h2 className="delta-hero-title">{DELTA_IOT_DETAILS.name}</h2>
                <span className="delta-origin-badge">
                  <i className="bi bi-shield-check" /> Central Invoicing Entity
                </span>
              </div>
              <p className="delta-hero-subtitle">
                Master Invoicing &amp; Projection Origin · Same Invoice Standardized Across Multi-Company Receivables
              </p>
              <div className="delta-credentials-row">
                <span className="delta-cred-pill">
                  GSTIN: <strong>{DELTA_IOT_DETAILS.gstin}</strong>
                </span>
                <span className="delta-cred-pill">
                  PAN: <strong>{DELTA_IOT_DETAILS.pan}</strong>
                </span>
                <span className="delta-cred-pill">
                  <i className="bi bi-geo-alt-fill me-1" />
                  Somajiguda, Hyderabad
                </span>
              </div>
            </div>
          </div>

          <div className="delta-hero-note">
            <i className="bi bi-info-circle-fill me-2" style={{ color: "var(--purple-neon)" }} />
            <span>
              <strong>Centralized Projection Model:</strong> Every invoice is issued by{" "}
              <strong>Delta IoT Solutions</strong> under standardized invoice numbering (e.g. <code>DT-...</code>). 
              On the right, view how each invoice projects to different target companies with their respective{" "}
              <strong>Company Name</strong> and <strong>Name in PDF</strong>.
            </span>
          </div>
        </div>

        {/* Top Aggregate KPI Strip */}
        <div className="delta-kpi-row">
          <div className="delta-kpi-card">
            <div className="delta-kpi-icon" style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}>
              <i className="bi bi-receipt" />
            </div>
            <div className="delta-kpi-info">
              <span className="delta-kpi-label">Projected Invoices</span>
              <span className="delta-kpi-val">{uniqueInvoices} Active</span>
              <span className="delta-kpi-sub">Issued by Delta IoT</span>
            </div>
          </div>

          <div className="delta-kpi-card">
            <div className="delta-kpi-icon" style={{ background: "linear-gradient(135deg, #22C55E, #15803D)" }}>
              <i className="bi bi-currency-rupee" />
            </div>
            <div className="delta-kpi-info">
              <span className="delta-kpi-label">Net Receivable</span>
              <span className="delta-kpi-val" style={{ color: "#22c55e" }}>{fmt(totalReceivable)}</span>
              <span className="delta-kpi-sub">Cumulative across companies</span>
            </div>
          </div>

          <div className="delta-kpi-card">
            <div className="delta-kpi-icon" style={{ background: "linear-gradient(135deg, #A855F7, #7C3AED)" }}>
              <i className="bi bi-calculator" />
            </div>
            <div className="delta-kpi-info">
              <span className="delta-kpi-label">Total Taxable Value</span>
              <span className="delta-kpi-val">{fmt(totalAssessable)}</span>
              <span className="delta-kpi-sub">Tax: {fmt(totalTax)} (18% GST)</span>
            </div>
          </div>

          <div className="delta-kpi-card">
            <div className="delta-kpi-icon" style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}>
              <i className="bi bi-buildings" />
            </div>
            <div className="delta-kpi-info">
              <span className="delta-kpi-label">Connected Companies</span>
              <span className="delta-kpi-val">{clients.length} Registered</span>
              <span className="delta-kpi-sub">Distinct buyer mappings</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & View Modes */}
      <div className="delta-controls-bar">
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" }}>
          <span className="delta-filter-label">
            <i className="bi bi-funnel-fill me-1" />Filter Target Company:
          </span>
          <button
            type="button"
            className={`delta-chip-btn ${selectedCompanyFilter === "" ? "active" : ""}`}
            onClick={() => setSelectedCompanyFilter("")}
          >
            🌐 All Companies ({records.length})
          </button>
          {clients.map((c) => {
            const count = records.filter((r) => String(r.client_id) === String(c.id)).length;
            const isSel = selectedCompanyFilter === String(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`delta-chip-btn ${isSel ? "active" : ""}`}
                onClick={() => setSelectedCompanyFilter(isSel ? "" : String(c.id))}
              >
                🏢 {c.organization_name} ({count})
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginLeft: "auto", flexWrap: "wrap" }}>
          <div className="delta-search-box">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Search Invoice #, Company, or PDF Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="delta-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            )}
          </div>

          <div className="delta-view-toggle">
            <button
              type="button"
              className={`toggle-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Side-by-Side Split Cards View"
            >
              <i className="bi bi-columns-gap" /> Split Cards
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Dense Comparison Matrix Table"
            >
              <i className="bi bi-table" /> Matrix Table
            </button>
          </div>

          <button
            type="button"
            className="btn-refresh"
            onClick={loadData}
            title="Refresh Projections"
            style={{ padding: ".4rem .8rem" }}
          >
            <i className="bi bi-arrow-clockwise" /> Refresh
          </button>
        </div>
      </div>

      {/* Main Projections Display */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)" }}>
          <div className="spinner-border text-primary mb-3" role="status" />
          <div>Loading Delta IoT Projections...</div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="delta-empty-state">
          <i className="bi bi-file-earmark-x" />
          <h4>No Invoice Projections Found</h4>
          <p>No invoices match the selected filter. Upload invoices in the Upload tab to populate projections.</p>
        </div>
      ) : viewMode === "cards" ? (
        /* VIEW 1: SIDE-BY-SIDE SPLIT PROJECTION CARDS */
        <div className="delta-cards-list">
          {filteredRecords.map((item, idx) => {
            const targetClient = clients.find((c) => String(c.id) === String(item.client_id)) || {
              organization_name: item.organization_name || "Assigned Company",
              invoice_doc_label: "Tax Invoice",
              po_doc_label: "Purchase Order",
              remittance_doc_label: "Remittance Advice",
            };

            const pdfEntityName =
              pdfNames[item.client_id] ||
              DEFAULT_PDF_ENTITY_NAMES[item.client_id] ||
              `${targetClient.organization_name} Corporate Clearing & Procurement`;

            const isEditingPdf = editingClientId === item.client_id;

            return (
              <div key={item.invoice_number || idx} className="delta-split-card animate-slideup">
                <div className="delta-card-header">
                  <div className="delta-card-seq">
                    <span className="delta-seq-badge">Projection #{idx + 1}</span>
                    <span className="delta-inv-anchor">
                      Standard Master Invoice: <strong>{item.invoice_number}</strong>
                    </span>
                  </div>

                  <div className="delta-card-reconciled">
                    {item.remittance_number ? (
                      <span className="badge-reconciled-full">
                        <i className="bi bi-check-all" /> 100% Reconciled
                      </span>
                    ) : item.po_number ? (
                      <span className="badge-reconciled-partial">
                        <i className="bi bi-link-45deg" /> PO Linked
                      </span>
                    ) : (
                      <span className="badge-reconciled-pending">
                        <i className="bi bi-hourglass-split" /> Invoice Projected
                      </span>
                    )}
                  </div>
                </div>

                <div className="delta-split-grid">
                  {/* LEFT SIDE: DELTA IOT (ISSUER & FINANCIALS) */}
                  <div className="delta-side-col delta-issuer-col">
                    <div className="side-col-header">
                      <div className="side-col-badge delta-badge">
                        <i className="bi bi-building-fill-check" /> INVOICE ISSUER
                      </div>
                      <div className="side-col-entity-title">{DELTA_IOT_DETAILS.name}</div>
                    </div>

                    <div className="delta-box-financials">
                      <div className="delta-spec-item highlight-inv">
                        <span className="spec-lbl">Projected Invoice Number:</span>
                        <span className="spec-val-inv">
                          <code>{item.invoice_number}</code>
                        </span>
                      </div>

                      <div className="delta-specs-grid">
                        <div className="delta-spec-item">
                          <span className="spec-lbl">Invoice Date:</span>
                          <span className="spec-val">{item.invoice_date || "—"}</span>
                        </div>
                        <div className="delta-spec-item">
                          <span className="spec-lbl">Billing Period:</span>
                          <span className="spec-val">{item.invoice_period || "—"}</span>
                        </div>
                        <div className="delta-spec-item">
                          <span className="spec-lbl">Assessable Value:</span>
                          <span className="spec-val">{fmt(item.assessable_value)}</span>
                        </div>
                        <div className="delta-spec-item">
                          <span className="spec-lbl">18% GST Amount:</span>
                          <span className="spec-val">{fmt(item.gst_amount || item.total_tax)}</span>
                        </div>
                        <div className="delta-spec-item">
                          <span className="spec-lbl">2% TDS Deducted:</span>
                          <span className="spec-val" style={{ color: "#ef4444" }}>
                            -{fmt(item.tds_amount)}
                          </span>
                        </div>
                        <div className="delta-spec-item highlight-receivable">
                          <span className="spec-lbl">Net Receivable:</span>
                          <span className="spec-val-rec">{fmt(item.receivable)}</span>
                        </div>
                      </div>

                      {item.inv_description && (
                        <div className="delta-desc-box">
                          <span className="spec-lbl">Invoice Description:</span>
                          <span className="spec-val-desc">{item.inv_description}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ARROW CONNECTOR */}
                  <div className="delta-connector">
                    <div className="connector-circle" title="Same Invoice Projected to Company">
                      <i className="bi bi-arrow-right" />
                    </div>
                    <span className="connector-text">Projected To</span>
                  </div>

                  {/* RIGHT SIDE: TARGET COMPANY & PDF ENTITY NAME */}
                  <div className="delta-side-col delta-target-col">
                    <div className="side-col-header">
                      <div className="side-col-badge client-badge">
                        <i className="bi bi-building me-1" /> TARGET CLIENT COMPANY
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: ".65rem", flexWrap: "wrap" }}>
                        <div className="target-company-logo">
                          {targetClient.logo_url ? (
                            <img
                              src={targetClient.logo_url}
                              alt={targetClient.organization_name}
                              onError={(e) => {
                                e.target.style.display = "none";
                                if (e.target.nextSibling) e.target.nextSibling.style.display = "inline";
                              }}
                            />
                          ) : null}
                          <span style={{ display: targetClient.logo_url ? "none" : "inline" }}>
                            {targetClient.organization_name?.slice(0, 2).toUpperCase() || "CO"}
                          </span>
                        </div>
                        <div className="side-col-entity-title">{targetClient.organization_name}</div>
                      </div>
                    </div>

                    <div className="delta-target-content">
                      {/* Name in PDF */}
                      <div className="pdf-name-highlight-card">
                        <div className="pdf-name-label">
                          <i className="bi bi-file-earmark-pdf-fill" /> Exact Name in PDF Document:
                        </div>
                        {isEditingPdf ? (
                          <div style={{ display: "flex", gap: ".4rem", marginTop: ".3rem" }}>
                            <input
                              type="text"
                              value={customPdfNameInput}
                              onChange={(e) => setCustomPdfNameInput(e.target.value)}
                              placeholder="e.g. Agco Business communications Clearing (w/c)"
                              className="edit-pdf-input"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePdfName(item.client_id)}
                              className="btn-save-pdf"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClientId(null)}
                              className="btn-cancel-pdf"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="pdf-name-value-row">
                            <span className="pdf-name-value">{pdfEntityName}</span>
                            <button
                              type="button"
                              className="btn-edit-pdf-name"
                              title="Edit mapped PDF company name"
                              onClick={() => {
                                setEditingClientId(item.client_id);
                                setCustomPdfNameInput(pdfEntityName);
                              }}
                            >
                              <i className="bi bi-pencil-fill" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Associated Company Documents */}
                      <div className="target-docs-grid">
                        <div className="doc-box po-box">
                          <div className="doc-box-title">
                            <i className="bi bi-file-earmark-text-fill me-1" />
                            {targetClient.po_doc_label || "Purchase Order"}
                          </div>
                          {item.po_number ? (
                            <div className="doc-box-info">
                              <span className="doc-num">#{item.po_number}</span>
                              <span className="doc-sub">Delivery: {item.delivery_date || "—"}</span>
                              <span className="doc-sub">Amount: {fmt(item.total_amount)}</span>
                            </div>
                          ) : (
                            <span className="doc-empty">No PO linked</span>
                          )}
                        </div>

                        <div className="doc-box remit-box">
                          <div className="doc-box-title">
                            <i className="bi bi-cash-stack me-1" />
                            {targetClient.remittance_doc_label || "Remittance Advice"}
                          </div>
                          {item.remittance_number ? (
                            <div className="doc-box-info">
                              <span className="doc-num">#{item.remittance_number}</span>
                              <span className="doc-sub">Remittance Date: {item.remittance_date || "—"}</span>
                              <span className="doc-sub" style={{ color: "#22c55e", fontWeight: 700 }}>
                                Gross: {fmt(item.gross_amount)}
                              </span>
                            </div>
                          ) : (
                            <span className="doc-empty">No Remittance linked</span>
                          )}
                        </div>
                      </div>

                      {/* Dynamic Nomenclature Profile */}
                      <div className="client-nomen-preview">
                        <span className="nomen-tag">
                          Invoice: <strong>{targetClient.invoice_doc_label || "Tax Invoice"}</strong>
                        </span>
                        <span className="nomen-tag">
                          PO: <strong>{targetClient.po_doc_label || "Purchase Order"}</strong>
                        </span>
                        <span className="nomen-tag">
                          Remittance: <strong>{targetClient.remittance_doc_label || "Remittance Advice"}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW 2: DENSE PROJECTION MATRIX TABLE */
        <div className="delta-table-container">
          <table className="delta-matrix-table">
            <thead>
              <tr>
                <th>Issuer</th>
                <th>Delta IoT Invoice #</th>
                <th>Invoice Date</th>
                <th>Assessable Value</th>
                <th>Net Receivable</th>
                <th>Target Company</th>
                <th>Exact Name in PDF</th>
                <th>Linked PO #</th>
                <th>Linked Remittance #</th>
                <th>Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((item, idx) => {
                const targetClient = clients.find((c) => String(c.id) === String(item.client_id)) || {
                  organization_name: item.organization_name || "Company",
                };
                const pdfEntityName =
                  pdfNames[item.client_id] ||
                  DEFAULT_PDF_ENTITY_NAMES[item.client_id] ||
                  `${targetClient.organization_name} Corporate Clearing`;

                return (
                  <tr key={idx}>
                    <td>
                      <span className="delta-table-issuer-tag">Delta IoT</span>
                    </td>
                    <td>
                      <strong className="delta-code-inv">{item.invoice_number}</strong>
                    </td>
                    <td>{item.invoice_date || "—"}</td>
                    <td>{fmt(item.assessable_value)}</td>
                    <td style={{ color: "#22c55e", fontWeight: 700 }}>{fmt(item.receivable)}</td>
                    <td>
                      <span className="company-table-badge">🏢 {targetClient.organization_name}</span>
                    </td>
                    <td>
                      <span className="pdf-name-table-badge" title={pdfEntityName}>
                        <i className="bi bi-file-earmark-pdf me-1 text-danger" />
                        {pdfEntityName}
                      </span>
                    </td>
                    <td>{item.po_number ? <code>#{item.po_number}</code> : "—"}</td>
                    <td>{item.remittance_number ? <code>#{item.remittance_number}</code> : "—"}</td>
                    <td>
                      {item.remittance_number ? (
                        <span className="status-badge-green">100% Cleared</span>
                      ) : item.po_number ? (
                        <span className="status-badge-blue">PO Linked</span>
                      ) : (
                        <span className="status-badge-amber">Projected</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

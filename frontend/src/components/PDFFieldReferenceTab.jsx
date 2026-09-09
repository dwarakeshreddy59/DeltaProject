import React, { useState, useEffect, useMemo } from "react";
import { fetchHistory } from "../services/api";
import { useOrganization } from "../context/OrganizationContext";
import { fmt } from "../utils/format";
import toast from "react-hot-toast";

// Master Invoicing Origin (Constant across all clients)
const DELTA_MASTER_INFO = {
  vendor_name: "Delta IoT Solutions Private Limited",
  brand: "Delta IoT Solutions",
  standard_invoice_pattern: "DT-2627-xx-xxxx",
  sample_invoice: "DT-2627-06-5402",
  gstin: "27AAHCD2212P1ZJ",
  pan: "AAHCD2212P",
  role: "Standardized Master Invoice Issuer",
  concept_note:
    "Delta IoT Solutions issues standardized Tax Invoices (e.g. DT-2627-06-5402). While this master invoice number is uniform across all client projections, each customer organization formats and labels their PDFs differently. In particular, AGCO Remittance Advices label the remittance number as 'Doc No' or 'Document Number' rather than 'Remittance Number'.",
};

// Known company PDF profiles
const PRESET_COMPANY_PROFILES = {
  AGCO: {
    buyer_name_in_pdf: "Agco Business communications Clearing (w/c)",
    remittance_slot_name: "Doc No / Document Number",
    remittance_sample: "2000013497 (Clearing Header) / 6068264211 (Cleared Item)",
    remittance_pdf_location:
      "Column 1 of the cleared items table or top right document summary block",
    remittance_alert:
      "CRITICAL: AGCO PDFs NEVER use the term 'Remittance Number'! The remittance identifier is labeled as 'Doc No' or 'Document Number' in the first column of the payment clearance table.",
    invoice_slot_name: "Your Document / Your Ref",
    invoice_sample: "DT-2627-06-5402",
    invoice_pdf_location:
      "Column 2 ('Your Document') in the remittance items table, or top right header in Tax Invoice PDF",
    po_slot_name: "Purchase Order / PO Number",
    po_sample: "80029552",
    po_pdf_location: "Top right order summary block under buyer purchase authorization",
  },
  "JP Morgan": {
    buyer_name_in_pdf: "J.P. Morgan Chase & Co. Global Payments Division",
    remittance_slot_name: "Payment Ref / NEFT UTR Number",
    remittance_sample: "N1452600892341 / JPMC-REM-88412",
    remittance_pdf_location: "Electronic Fund Transfer Advice header and bank acknowledgment line",
    remittance_alert:
      "Look for the 14-22 character UTR / NEFT reference number at the top right of the advice.",
    invoice_slot_name: "Invoice Reference / Bill Number",
    invoice_sample: "DT-2627-06-5402",
    invoice_pdf_location: "Beneficiary Invoice / Vendor Bill Reference field",
    po_slot_name: "Work Order / Contract Reference",
    po_sample: "JPM-WO-2026-9921",
    po_pdf_location: "Section 2: Engagement Order Details",
  },
  "Black Rock": {
    buyer_name_in_pdf: "BlackRock Institutional Services & Assets Management",
    remittance_slot_name: "Voucher ID / Advice Ref",
    remittance_sample: "BLK-VCH-2026-7719",
    remittance_pdf_location: "Corporate Disbursement Clearing Sheet top voucher header",
    remittance_alert:
      "Check the clearing voucher ID stamped above the payee line items.",
    invoice_slot_name: "Tax Invoice Ref",
    invoice_sample: "DT-2627-06-5402",
    invoice_pdf_location: "Invoice Reconciliation column",
    po_slot_name: "Purchase Authorization No",
    po_sample: "BLK-PO-445892",
    po_pdf_location: "Procurement requisition summary",
  },
};

export default function PDFFieldReferenceTab({ refreshTrigger = 0 }) {
  const { clients, activeCompany, selectCompany } = useOrganization();

  const [activeTabSubView, setActiveTabSubView] = useState("cards"); // 'cards' | 'table' | 'visual_guide'
  const [selectedOrgFilter, setSelectedOrgFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // User-editable notes per client ID persisted in localStorage
  const [userNotes, setUserNotes] = useState(() => {
    try {
      const saved = localStorage.getItem("pdf_ref_user_notes");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [tempNoteText, setTempNoteText] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchHistory(null);
      if (res.data?.success) {
        setRecords(res.data?.combined || res.data?.records || []);
      }
    } catch (err) {
      console.error("Failed to load records for reference tab:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleSaveNote = (clientId) => {
    const updated = { ...userNotes, [clientId]: tempNoteText.trim() };
    setUserNotes(updated);
    localStorage.setItem("pdf_ref_user_notes", JSON.stringify(updated));
    setEditingNoteId(null);
    setTempNoteText("");
    toast.success("Saved reference tip note!");
  };

  // Build full company profile for ANY company (preset or newly registered)
  const getCompanyProfile = (company) => {
    const orgName = company.organization_name || "";
    // Check preset
    const preset = PRESET_COMPANY_PROFILES[orgName] || null;

    if (preset) {
      return {
        ...preset,
        client: company,
        isCustom: false,
      };
    }

    // Dynamic generation for newly registered organizations
    const isDocNoType =
      company.remittance_num_label?.toLowerCase().includes("doc") ||
      company.remittance_doc_label?.toLowerCase().includes("doc");

    return {
      buyer_name_in_pdf: `${orgName} Commercial & Financial Clearing Division`,
      remittance_slot_name: company.remittance_num_label || "Remittance / Clearing Number",
      remittance_sample: isDocNoType
        ? "20000XXXXX / DOC-99412"
        : `${orgName.toUpperCase().slice(0, 3)}-REM-2026-01`,
      remittance_pdf_location: isDocNoType
        ? "Document No. column in clearance table or top right advice header"
        : "Payment Advice identification block or EFT settlement summary",
      remittance_alert: isDocNoType
        ? `Note: ${orgName} formats remittance numbers as "${company.remittance_num_label}" in its PDF tables.`
        : `Look for "${company.remittance_num_label}" on page 1 of ${orgName}'s payment advice.`,
      invoice_slot_name: company.invoice_num_label || "Tax Invoice Number",
      invoice_sample: "DT-2627-xx-xxxx",
      invoice_pdf_location: `Reference column for ${company.invoice_doc_label} or header block`,
      po_slot_name: company.po_num_label || "Purchase Order / PO Number",
      po_sample: "PO-882041",
      po_pdf_location: `Top header or order reference block on ${company.po_doc_label}`,
      client: company,
      isCustom: true,
    };
  };

  // Filtered list of company profiles
  const filteredProfiles = useMemo(() => {
    return clients
      .filter((c) => {
        if (selectedOrgFilter !== "all" && String(c.id) !== String(selectedOrgFilter)) {
          return false;
        }
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        const prof = getCompanyProfile(c);
        return (
          c.organization_name?.toLowerCase().includes(q) ||
          c.client_name?.toLowerCase().includes(q) ||
          prof.buyer_name_in_pdf?.toLowerCase().includes(q) ||
          prof.remittance_slot_name?.toLowerCase().includes(q) ||
          prof.invoice_slot_name?.toLowerCase().includes(q) ||
          prof.po_slot_name?.toLowerCase().includes(q)
        );
      })
      .map(getCompanyProfile);
  }, [clients, selectedOrgFilter, searchTerm]);

  // Filtered records for master projection mapping table
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (selectedOrgFilter !== "all" && String(rec.client_id) !== String(selectedOrgFilter)) {
        return false;
      }
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        rec.invoice_number?.toLowerCase().includes(q) ||
        rec.organization_name?.toLowerCase().includes(q) ||
        rec.po_number?.toLowerCase().includes(q) ||
        rec.remittance_number?.toLowerCase().includes(q)
      );
    });
  }, [records, selectedOrgFilter, searchTerm]);

  return (
    <div className="pdf-ref-container animate-fadein">
      {/* ── Top Hero: PDF Field Reference & Terminology Guide ── */}
      <div className="ref-hero">
        <div className="ref-hero-badge-row">
          <span className="ref-hero-badge">
            <i className="bi bi-journal-bookmark-fill me-1" /> PDF Field Reference &amp; Document Guide
          </span>
          <span className="ref-sync-badge">
            <i className="bi bi-arrow-repeat me-1" /> Auto-Syncs With All Registered Organizations ({clients.length})
          </span>
        </div>

        <div className="ref-hero-content">
          <h2 className="ref-hero-title">
            Document Nomenclature &amp; PDF Field Identification Guide
          </h2>
          <p className="ref-hero-subtitle">
            A comprehensive reference for locating numbers across client PDFs. In particular, <strong>AGCO Remittance Advices</strong> list the remittance number as <strong>"Doc No"</strong> or <strong>"Document Number"</strong> in the PDF table. Whenever you register a new organization, its nomenclature profile is automatically added here.
          </p>
        </div>

        {/* Delta IoT Master Explanation Strip */}
        <div className="ref-master-banner">
          <div className="ref-master-icon">
            <i className="bi bi-diagram-3-fill" />
          </div>
          <div className="ref-master-body">
            <div className="ref-master-title">
              Master Invoicing Origin: {DELTA_MASTER_INFO.brand}
            </div>
            <div className="ref-master-desc">
              Standardized master invoices (e.g. <code>{DELTA_MASTER_INFO.sample_invoice}</code>) remain identical across all client projections. The table and cards below show how each client organization references this invoice, along with where to locate their distinct <strong>Purchase Order</strong> and <strong>Remittance / Doc No</strong> fields in the PDF.
            </div>
          </div>
        </div>

        {/* Controls Bar: Sub-views, Search, Org Filter */}
        <div className="ref-controls-bar">
          <div className="ref-views-toggle">
            <button
              type="button"
              className={`ref-toggle-btn ${activeTabSubView === "cards" ? "active" : ""}`}
              onClick={() => setActiveTabSubView("cards")}
            >
              <i className="bi bi-card-text me-1" /> Company Field Cards ({filteredProfiles.length})
            </button>
            <button
              type="button"
              className={`ref-toggle-btn ${activeTabSubView === "table" ? "active" : ""}`}
              onClick={() => setActiveTabSubView("table")}
            >
              <i className="bi bi-table me-1" /> Master Invoicing &amp; Cross-Mapping Table
            </button>
            <button
              type="button"
              className={`ref-toggle-btn ${activeTabSubView === "visual_guide" ? "active" : ""}`}
              onClick={() => setActiveTabSubView("visual_guide")}
            >
              <i className="bi bi-eye-fill me-1" /> AGCO Visual PDF Identification Cheat Sheet
            </button>
          </div>

          <div className="ref-search-wrap">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Filter by company, Doc No, PO, or field term..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ref-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="ref-search-clear"
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Organization Chips */}
        <div className="ref-org-chips-strip">
          <span className="ref-chips-label">Quick Filter:</span>
          <button
            type="button"
            className={`ref-org-chip ${selectedOrgFilter === "all" ? "active" : ""}`}
            onClick={() => setSelectedOrgFilter("all")}
          >
            <i className="bi bi-buildings-fill me-1" /> All Organizations ({clients.length})
          </button>
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ref-org-chip ${String(selectedOrgFilter) === String(c.id) ? "active" : ""}`}
              onClick={() => setSelectedOrgFilter(String(c.id))}
            >
              <span className="ref-chip-dot" />
              {c.organization_name}
            </button>
          ))}
        </div>
      </div>

      {/* ── VIEW 1: Company Field Cards ── */}
      {activeTabSubView === "cards" && (
        <div className="ref-cards-grid animate-fadein">
          {filteredProfiles.map((prof) => {
            const client = prof.client;
            const isAgco = client.organization_name?.toUpperCase() === "AGCO";
            const note = userNotes[client.id] || "";

            return (
              <div
                key={client.id}
                className={`ref-company-card ${isAgco ? "ref-card-agco" : ""}`}
              >
                {/* Company Header */}
                <div className="ref-card-header">
                  <div className="ref-card-identity">
                    {/* Neutral Pure White Logo Container */}
                    <div className="ref-company-avatar">
                      {client.logo_url ? (
                        <img
                          src={client.logo_url}
                          alt={client.organization_name}
                          className="ref-logo-img"
                        />
                      ) : (
                        <span className="ref-avatar-initials">
                          {client.organization_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="ref-company-name-row">
                        <span className="ref-company-name">{client.organization_name}</span>
                        {isAgco && (
                          <span className="ref-agco-badge">
                            <i className="bi bi-star-fill me-1" /> Primary Reference
                          </span>
                        )}
                        {prof.isCustom && (
                          <span className="ref-custom-badge">Auto-Registered</span>
                        )}
                      </div>
                      <div className="ref-company-sub">
                        {client.client_name || "Enterprise Client"} · {client.point_of_contact || "Active Organization"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-ref-open-workspace"
                    onClick={() => selectCompany(client.id)}
                    title={`Open workspace for ${client.organization_name}`}
                  >
                    Open Workspace <i className="bi bi-arrow-right ms-1" />
                  </button>
                </div>

                {/* Identification Identifiers */}
                <div className="ref-card-id-pills">
                  <span className="ref-id-pill">
                    <strong>GSTIN:</strong> {client.gst_number || "—"}
                  </span>
                  <span className="ref-id-pill">
                    <strong>PAN:</strong> {client.pan_number || "—"}
                  </span>
                  <span className="ref-id-pill ref-buyer-pdf-pill">
                    <strong>In PDF Entity:</strong> {prof.buyer_name_in_pdf}
                  </span>
                </div>

                {/* Remittance Slot Highlight (Special Attention Box) */}
                <div className="ref-slot-box ref-slot-remittance">
                  <div className="ref-slot-header">
                    <div className="ref-slot-title">
                      <i className="bi bi-cash-stack me-1" /> Remittance Advice Identification
                    </div>
                    <span className="ref-slot-tag ref-tag-remit">
                      Slot: {client.remittance_doc_label}
                    </span>
                  </div>

                  {/* CRITICAL ALERT CALLOUT (AGCO 'Doc No' or custom note) */}
                  <div className="ref-alert-callout">
                    <i className="bi bi-exclamation-triangle-fill me-2" />
                    <div>
                      <strong>Where to look in PDF:</strong> {prof.remittance_alert}
                    </div>
                  </div>

                  <div className="ref-slot-grid">
                    <div className="ref-slot-item">
                      <span className="ref-slot-k">Field Label in PDF:</span>
                      <span className="ref-slot-v ref-highlight-code">
                        {prof.remittance_slot_name}
                      </span>
                    </div>
                    <div className="ref-slot-item">
                      <span className="ref-slot-k">Sample Number in PDF:</span>
                      <span className="ref-slot-v">
                        <code>{prof.remittance_sample}</code>
                      </span>
                    </div>
                    <div className="ref-slot-item" style={{ gridColumn: "1 / -1" }}>
                      <span className="ref-slot-k">Exact PDF Location:</span>
                      <span className="ref-slot-v">{prof.remittance_pdf_location}</span>
                    </div>
                  </div>
                </div>

                {/* Invoice & PO Slots Grid */}
                <div className="ref-dual-slots">
                  {/* Tax Invoice Slot */}
                  <div className="ref-slot-box ref-slot-invoice">
                    <div className="ref-slot-header">
                      <div className="ref-slot-title">
                        <i className="bi bi-receipt me-1" /> {client.invoice_doc_label}
                      </div>
                      <span className="ref-slot-tag ref-tag-inv">
                        Slot: {client.invoice_num_label}
                      </span>
                    </div>
                    <div className="ref-slot-subitem">
                      <span className="ref-slot-k">PDF Label:</span>
                      <span className="ref-slot-v">{prof.invoice_slot_name}</span>
                    </div>
                    <div className="ref-slot-subitem">
                      <span className="ref-slot-k">Master Invoice:</span>
                      <span className="ref-slot-v">
                        <code>{prof.invoice_sample}</code> (Standard Delta IoT)
                      </span>
                    </div>
                    <div className="ref-slot-subitem">
                      <span className="ref-slot-k">Location:</span>
                      <span className="ref-slot-v">{prof.invoice_pdf_location}</span>
                    </div>
                  </div>

                  {/* Purchase Order Slot */}
                  <div className="ref-slot-box ref-slot-po">
                    <div className="ref-slot-header">
                      <div className="ref-slot-title">
                        <i className="bi bi-file-earmark-check me-1" /> {client.po_doc_label}
                      </div>
                      <span className="ref-slot-tag ref-tag-po">
                        Slot: {client.po_num_label}
                      </span>
                    </div>
                    <div className="ref-slot-subitem">
                      <span className="ref-slot-k">PDF Label:</span>
                      <span className="ref-slot-v">{prof.po_slot_name}</span>
                    </div>
                    <div className="ref-slot-subitem">
                      <span className="ref-slot-k">Sample Number:</span>
                      <span className="ref-slot-v">
                        <code>{prof.po_sample}</code>
                      </span>
                    </div>
                    <div className="ref-slot-subitem">
                      <span className="ref-slot-k">Location:</span>
                      <span className="ref-slot-v">{prof.po_pdf_location}</span>
                    </div>
                  </div>
                </div>

                {/* User Editable Guide Notes */}
                <div className="ref-user-notes-section">
                  <div className="ref-notes-header">
                    <span className="ref-notes-title">
                      <i className="bi bi-stickies me-1" /> Team Search Notes &amp; Tips
                    </span>
                    {editingNoteId !== client.id && (
                      <button
                        type="button"
                        className="btn-edit-ref-note"
                        onClick={() => {
                          setEditingNoteId(client.id);
                          setTempNoteText(note);
                        }}
                      >
                        <i className="bi bi-pencil-square me-1" />
                        {note ? "Edit Note" : "Add Custom Note"}
                      </button>
                    )}
                  </div>

                  {editingNoteId === client.id ? (
                    <div className="ref-note-editor animate-fadein">
                      <textarea
                        rows={2}
                        className="ref-note-textarea"
                        placeholder={`Enter internal tip for locating fields in ${client.organization_name} PDFs...`}
                        value={tempNoteText}
                        onChange={(e) => setTempNoteText(e.target.value)}
                      />
                      <div className="ref-note-editor-actions">
                        <button
                          type="button"
                          className="btn-ref-note-save"
                          onClick={() => handleSaveNote(client.id)}
                        >
                          Save Tip
                        </button>
                        <button
                          type="button"
                          className="btn-ref-note-cancel"
                          onClick={() => setEditingNoteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : note ? (
                    <div className="ref-saved-note-text">
                      <i className="bi bi-chat-left-quote-fill me-2" />
                      {note}
                    </div>
                  ) : (
                    <div className="ref-no-note-text">
                      No custom team tip added. Click "Add Custom Note" to document any company-specific quirks.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── VIEW 2: Master Invoicing Cross-Mapping Table ── */}
      {activeTabSubView === "table" && (
        <div className="ref-table-card animate-fadein">
          <div className="ref-table-card-header">
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text-main)" }}>
                Master Invoicing Cross-Reference &amp; Extraction Projections
              </div>
              <div style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>
                Delta IoT Solutions standardized Tax Invoices cross-mapped with Client Names, PDF Entity Names, POs, and Remittances.
              </div>
            </div>
            <div className="ref-table-stat-pills">
              <span className="ref-table-pill">
                Total Documents: <strong>{filteredRecords.length}</strong>
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="ref-data-table">
              <thead>
                <tr>
                  <th>Master Invoice (Delta IoT)</th>
                  <th>Client Organization</th>
                  <th>Buyer Name in PDF</th>
                  <th>PO Number &amp; Field</th>
                  <th>Remittance Number (In PDF)</th>
                  <th>Gross Cleared</th>
                  <th>Receivable</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                      <i className="bi bi-inbox" style={{ fontSize: "2rem", display: "block", marginBottom: ".5rem" }} />
                      No documents found matching the filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((rec, idx) => {
                    const org = rec.organization_name || "AGCO";
                    const isAgco = org.toUpperCase() === "AGCO";
                    const prof = PRESET_COMPANY_PROFILES[org] || {};
                    const buyerPdfName = prof.buyer_name_in_pdf || `${org} Clearing Division`;
                    const hasAllThree = rec.invoice_number && rec.po_number && rec.remittance_number;

                    return (
                      <tr key={idx} className={isAgco ? "ref-row-highlight" : ""}>
                        <td>
                          <div style={{ fontWeight: 700, color: "#A855F7" }}>
                            {rec.invoice_number || "—"}
                          </div>
                          <span style={{ fontSize: ".7rem", color: "var(--text-muted)" }}>
                            Master Tax Invoice
                          </span>
                        </td>
                        <td>
                          <span className="ref-table-org-badge">
                            {org}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text-main)" }}>
                            {buyerPdfName}
                          </div>
                          <span style={{ fontSize: ".7rem", color: "var(--text-muted)" }}>
                            Entity as printed in PDF
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#3B82F6" }}>
                            {rec.po_number || "—"}
                          </div>
                          <span style={{ fontSize: ".7rem", color: "var(--text-muted)" }}>
                            PO Number
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: isAgco ? "#F59E0B" : "#10B981" }}>
                            {rec.remittance_number || "—"}
                          </div>
                          <span style={{ fontSize: ".7rem", color: isAgco ? "#F59E0B" : "var(--text-muted)" }}>
                            {isAgco ? "⚠️ In PDF: Labeled as 'Doc No'" : "Remittance Number"}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {fmt(rec.remittance_gross || rec.gross_amount || 0)}
                        </td>
                        <td style={{ fontWeight: 700, color: "#10B981" }}>
                          {fmt(rec.receivable || rec.assessable_value || 0)}
                        </td>
                        <td>
                          {hasAllThree ? (
                            <span className="ref-badge-matched">
                              <i className="bi bi-check-circle-fill me-1" /> Matched
                            </span>
                          ) : (
                            <span className="ref-badge-partial">
                              <i className="bi bi-clock-history me-1" /> Partial
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VIEW 3: AGCO Visual PDF Identification Cheat Sheet ── */}
      {activeTabSubView === "visual_guide" && (
        <div className="ref-visual-guide-wrap animate-fadein">
          <div className="ref-visual-header">
            <h3>
              <i className="bi bi-file-earmark-pdf-fill text-danger me-2" />
              Visual Guide: AGCO Remittance Advice PDF Field Breakdown
            </h3>
            <p>
              This mock visual layout demonstrates where fields are located in standard AGCO Remittance Advices and why users often struggle to find the Remittance Number.
            </p>
          </div>

          <div className="ref-mockup-sheet">
            <div className="ref-mockup-paper">
              {/* Mockup Header */}
              <div className="ref-mockup-top-header">
                <div>
                  <div className="ref-mockup-company-title">
                    AGCO Business Communications Clearing (w/c)
                  </div>
                  <div className="ref-mockup-company-sub">
                    Somajiguda, Hyderabad, Telangana · Payment Advice &amp; Clearing Voucher
                  </div>
                </div>
                <div className="ref-mockup-date-box">
                  <div>Date: <strong>11.05.2026</strong></div>
                  <div>Currency: <strong>INR</strong></div>
                </div>
              </div>

              <hr className="ref-mockup-divider" />

              {/* Callout Pointer Box 1: The Remittance Number Confusion */}
              <div className="ref-mockup-callout-strip">
                <div className="ref-callout-badge-danger">
                  <i className="bi bi-arrow-down-circle-fill me-1" /> Crucial Identification Point:
                </div>
                <div className="ref-callout-text">
                  In AGCO Remittance Advice PDFs, the remittance identifier is labeled as <strong>"Document No."</strong> or <strong>"Doc No"</strong> (e.g. <code>2000013497</code> or <code>6068264211</code>). The word "Remittance" never appears on the line items!
                </div>
              </div>

              {/* Mockup Table with Visual Markers */}
              <table className="ref-mockup-table">
                <thead>
                  <tr>
                    <th className="ref-th-highlight-remit">
                      Document No. / Doc No
                      <span className="ref-th-pin">👈 REMITTANCE NO.</span>
                    </th>
                    <th className="ref-th-highlight-inv">
                      Your Document
                      <span className="ref-th-pin-blue">👈 INVOICE NO.</span>
                    </th>
                    <th>Document Date</th>
                    <th>Deductions</th>
                    <th>Gross Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="ref-tr-target">
                    <td>
                      <span className="ref-mock-val-remit">2000013497</span>
                      <div className="ref-val-hint">Extracted as Remittance Number</div>
                    </td>
                    <td>
                      <span className="ref-mock-val-inv">DT-2627-06-5402</span>
                      <div className="ref-val-hint">Delta IoT Master Invoice</div>
                    </td>
                    <td>11.05.2026</td>
                    <td>₹ 0.00</td>
                    <td><strong>₹ 1,397,655.00</strong></td>
                  </tr>
                  <tr>
                    <td>6068264211</td>
                    <td>DT-2627-05-5110</td>
                    <td>24.04.2026</td>
                    <td>₹ 0.00</td>
                    <td>₹ 1,397,655.00</td>
                  </tr>
                </tbody>
              </table>

              {/* Mockup Footer Legend */}
              <div className="ref-mockup-legend">
                <div className="ref-legend-item">
                  <span className="ref-legend-swatch ref-swatch-amber" />
                  <span>
                    <strong>Document No. (Doc No):</strong> AGCO's internal clearing reference. Mapped to the portal's <em>Remittance Number</em> slot.
                  </span>
                </div>
                <div className="ref-legend-item">
                  <span className="ref-legend-swatch ref-swatch-blue" />
                  <span>
                    <strong>Your Document:</strong> The vendor invoice number (Delta IoT Tax Invoice). Mapped to the portal's <em>Invoice Number</em> slot.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

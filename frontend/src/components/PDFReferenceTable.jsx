import React, { useState, useMemo } from "react";
import { useOrganization } from "../context/OrganizationContext";

// Known PDF Profiles for canonical companies
const KNOWN_PDF_PROFILES = {
  AGCO: {
    buyer_pdf_name: "Agco Business communications Clearing (w/c)",
    invoice_pdf_label: '"Your Document" / Tax Invoice No',
    invoice_sample: "DT-2627-06-5402",
    invoice_location: "Column 2 in Remittance table & Header on Tax Invoice",
    po_pdf_label: '"Purchase Order" / PO Number',
    po_sample: "80029552",
    po_location: "Top right of PO document under Order Details",
    remittance_pdf_label: '"Doc No" or "Document Number"',
    remittance_sample: "2000013497 (Clearing Header) / 6068264211",
    remittance_location: "Column 1 of cleared items table in Remittance PDF",
    remittance_is_special: true,
    remittance_hint:
      'CRITICAL: AGCO PDFs do NOT use the word "Remittance"! Look for "Doc No" or "Document Number" in Column 1.',
  },
  "JP Morgan": {
    buyer_pdf_name: "J.P. Morgan Chase & Co. Global Payments Division",
    invoice_pdf_label: '"Invoice Ref" / Bill Number',
    invoice_sample: "DT-2627-06-5402",
    invoice_location: "Beneficiary Invoice / Vendor Bill Reference field",
    po_pdf_label: '"Work Order" / Contract Ref',
    po_sample: "JPM-WO-2026-9921",
    po_location: "Section 2: Engagement Order Details",
    remittance_pdf_label: '"Payment Ref" / NEFT UTR No',
    remittance_sample: "N1452600892341",
    remittance_location: "Electronic Fund Transfer Advice header line",
    remittance_is_special: false,
    remittance_hint: "Look for 14-22 digit bank reference / UTR at top right.",
  },
  "Black Rock": {
    buyer_pdf_name: "BlackRock Institutional Services & Assets Management",
    invoice_pdf_label: '"Tax Invoice Ref"',
    invoice_sample: "DT-2627-06-5402",
    invoice_location: "Invoice Reconciliation breakdown column",
    po_pdf_label: '"Purchase Authorization No"',
    po_sample: "BLK-PO-445892",
    po_location: "Procurement requisition summary header",
    remittance_pdf_label: '"Voucher ID" / Advice Ref',
    remittance_sample: "BLK-VCH-2026-7719",
    remittance_location: "Top voucher clearing header stamped above payee lines",
    remittance_is_special: false,
    remittance_hint: "Check clearing voucher ID stamped at top of sheet.",
  },
};

export default function PDFReferenceTable({ onOpenRegisterModal = null }) {
  const { clients, selectCompany } = useOrganization();
  const [filterText, setFilterText] = useState("");

  const filteredClients = useMemo(() => {
    if (!filterText.trim()) return clients;
    const q = filterText.toLowerCase().trim();
    return clients.filter((c) => {
      const org = (c.organization_name || "").toLowerCase();
      const clientName = (c.client_name || "").toLowerCase();
      const remit = (c.remittance_num_label || "").toLowerCase();
      const inv = (c.invoice_num_label || "").toLowerCase();
      const po = (c.po_num_label || "").toLowerCase();
      return (
        org.includes(q) ||
        clientName.includes(q) ||
        remit.includes(q) ||
        inv.includes(q) ||
        po.includes(q)
      );
    });
  }, [clients, filterText]);

  return (
    <div className="pdf-simple-ref-wrap animate-fadein">
      {/* ── Table Header / Legend Strip ── */}
      <div className="ref-simple-header">
        <div className="ref-simple-header-left">
          <div className="ref-simple-title">
            <i className="bi bi-table text-primary me-2" />
            PDF Field Reference Guide
          </div>
          <p className="ref-simple-desc">
            Quick reference showing what each document field is named in different client PDFs.
            Standardized <strong>Delta IoT Tax Invoices</strong> are identical across all companies, while <strong>Remittance Numbers</strong> and <strong>POs</strong> differ per client.
          </p>
        </div>

        <div className="ref-simple-header-right">
          {/* Quick Search */}
          <div className="ref-simple-search">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Search company or field name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="ref-simple-input"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="ref-simple-clear"
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            )}
          </div>

          {onOpenRegisterModal && (
            <button
              type="button"
              onClick={onOpenRegisterModal}
              className="btn-ref-add-org"
            >
              <i className="bi bi-plus-circle-fill me-1" /> Register New Company
            </button>
          )}
        </div>
      </div>

      {/* ── Guidance Banner ── */}
      <div className="ref-simple-callout">
        <div className="ref-callout-icon">
          <i className="bi bi-info-circle-fill" />
        </div>
        <div className="ref-callout-body">
          <strong>Key Note on AGCO:</strong> In AGCO Remittance Advice PDFs, the remittance number is printed as <strong>"Doc No"</strong> or <strong>"Document Number"</strong> in the clearing items table (e.g. <code>2000013497</code> or <code>6068264211</code>). The word "Remittance" is NOT used on the line items.
        </div>
      </div>

      {/* ── The Clean, Responsive Reference Table ── */}
      <div className="ref-simple-table-box table-responsive">
        <table className="ref-simple-table">
          <thead>
            <tr>
              <th style={{ minWidth: "190px" }}>Company / Organization</th>
              <th style={{ minWidth: "160px" }}>Master Invoicing (Standard)</th>
              <th style={{ minWidth: "200px" }}>In PDF: Invoice Field</th>
              <th style={{ minWidth: "180px" }}>In PDF: PO Field</th>
              <th style={{ minWidth: "260px" }} className="th-highlight-remit">
                In PDF: Remittance Field <span className="badge-critical">CRITICAL</span>
              </th>
              <th style={{ minWidth: "200px" }}>Where to Look in PDF</th>
              <th style={{ minWidth: "130px", textAlign: "center" }}>Workspace</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "var(--text-muted)" }}>
                  No organizations found matching "{filterText}".
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const orgName = client.organization_name || "";
                const isAgco = orgName.toUpperCase() === "AGCO";
                const profile = KNOWN_PDF_PROFILES[orgName] || {
                  buyer_pdf_name: `${orgName} Commercial Division`,
                  invoice_pdf_label: `"${client.invoice_num_label || "Invoice Number"}"`,
                  invoice_sample: "DT-2627-xx-xxxx",
                  invoice_location: `Reference field for ${client.invoice_doc_label || "Invoice"}`,
                  po_pdf_label: `"${client.po_num_label || "PO Number"}"`,
                  po_sample: "PO-XXXXXX",
                  po_location: `Top header on ${client.po_doc_label || "Purchase Order"}`,
                  remittance_pdf_label: `"${client.remittance_num_label || "Remittance Number"}"`,
                  remittance_sample: client.remittance_num_label?.toLowerCase().includes("doc")
                    ? "20000XXXXX"
                    : "REM-XXXXX",
                  remittance_location: `Payment clearing breakdown or header on ${client.remittance_doc_label || "Remittance"}`,
                  remittance_is_special: client.remittance_num_label?.toLowerCase().includes("doc"),
                  remittance_hint: `Check for ${client.remittance_num_label || "Remittance Number"} in payment advice table.`,
                };

                return (
                  <tr key={client.id} className={isAgco ? "tr-agco-highlight" : ""}>
                    {/* Company Identity */}
                    <td>
                      <div className="ref-cell-company">
                        <div className="ref-cell-logo">
                          {client.logo_url ? (
                            <img src={client.logo_url} alt={orgName} />
                          ) : (
                            <span>{orgName.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="ref-cell-org-name">
                            {orgName}
                            {isAgco && <span className="ref-badge-agco">AGCO</span>}
                            {!KNOWN_PDF_PROFILES[orgName] && (
                              <span className="ref-badge-auto">Auto-Added</span>
                            )}
                          </div>
                          <div className="ref-cell-sub">
                            {client.client_name || "Enterprise"}
                          </div>
                          <div className="ref-cell-gst">
                            GST: {client.gst_number || "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Master Invoicing (Constant Delta IoT) */}
                    <td>
                      <div className="ref-cell-master">
                        <span className="ref-master-tag">Delta IoT Solutions</span>
                        <div className="ref-master-code">DT-2627-xx-xxxx</div>
                        <div className="ref-cell-muted">Standard Tax Invoice</div>
                      </div>
                    </td>

                    {/* Invoice in PDF */}
                    <td>
                      <div className="ref-cell-field">
                        <div className="ref-field-name">{profile.invoice_pdf_label}</div>
                        <div className="ref-field-sample">
                          Sample: <code>{profile.invoice_sample}</code>
                        </div>
                        <div className="ref-cell-muted">{profile.invoice_location}</div>
                      </div>
                    </td>

                    {/* PO in PDF */}
                    <td>
                      <div className="ref-cell-field">
                        <div className="ref-field-name">{profile.po_pdf_label}</div>
                        <div className="ref-field-sample">
                          Sample: <code>{profile.po_sample}</code>
                        </div>
                        <div className="ref-cell-muted">{profile.po_location}</div>
                      </div>
                    </td>

                    {/* Remittance in PDF (Critical Callout) */}
                    <td className="td-highlight-remit">
                      <div className="ref-cell-remit">
                        <div className="ref-remit-title">
                          {isAgco ? (
                            <span className="ref-remit-warn">
                              ⚠️ Labeled as "Doc No" or "Document Number"
                            </span>
                          ) : (
                            <span className="ref-remit-normal">{profile.remittance_pdf_label}</span>
                          )}
                        </div>
                        <div className="ref-field-sample">
                          Sample: <code>{profile.remittance_sample}</code>
                        </div>
                        <div className="ref-remit-hint-box">
                          {profile.remittance_hint}
                        </div>
                      </div>
                    </td>

                    {/* Where to Look */}
                    <td>
                      <div className="ref-cell-location">
                        <i className="bi bi-geo-alt-fill text-muted me-1" />
                        {profile.remittance_location}
                      </div>
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="btn-ref-enter-workspace"
                        onClick={() => selectCompany(client.id)}
                        title={`Open workspace for ${orgName}`}
                      >
                        Open <i className="bi bi-arrow-right ms-1" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Table Footer Summary Strip ── */}
      <div className="ref-simple-footer">
        <div>
          Showing <strong>{filteredClients.length}</strong> registered {filteredClients.length === 1 ? "organization" : "organizations"}. When you register a new company, it is automatically added to this table.
        </div>
        <div className="ref-footer-pills">
          <span className="ref-footer-pill">
            <i className="bi bi-check-circle-fill text-success me-1" /> Master Invoicing: Standardized
          </span>
          <span className="ref-footer-pill">
            <i className="bi bi-exclamation-circle-fill text-warning me-1" /> AGCO Remittance: "Doc No"
          </span>
        </div>
      </div>
    </div>
  );
}

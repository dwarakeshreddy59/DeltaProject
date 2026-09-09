import React from "react";
import { fmt } from "../utils/format";
import { useOrganization } from "../context/OrganizationContext";

export default function ExtractedTableView({ po = {}, invoice = {}, remittance = {}, calcData = {} }) {
  const { nomenclature } = useOrganization();

  const fields = [
    // Invoice Fields
    { section: nomenclature.invoice_doc_label, label: `${nomenclature.invoice_num_label} (Document No.)`, value: invoice.invoice_number || "—", type: "badge", badgeColor: "#A855F7" },
    { section: nomenclature.invoice_doc_label, label: `${nomenclature.invoice_doc_label} Date`, value: invoice.invoice_date || "—", type: "text" },
    { section: nomenclature.invoice_doc_label, label: `${nomenclature.po_num_label} (Ref in ${nomenclature.invoice_doc_label})`, value: invoice.po_number || "—", type: "badge", badgeColor: "#C084FC" },
    { section: nomenclature.invoice_doc_label, label: "Description (Filename without numbers)", value: invoice.description || "—", type: "text" },
    { section: nomenclature.invoice_doc_label, label: "Billing Period", value: invoice.invoice_period || "—", type: "text" },
    { section: nomenclature.invoice_doc_label, label: "Assessable Value (Taxable Amount)", value: fmt(invoice.assessable_value), type: "money" },
    { section: nomenclature.invoice_doc_label, label: "Total Tax", value: fmt(invoice.total_tax), type: "money" },
    { section: nomenclature.invoice_doc_label, label: "Total Invoice Value", value: fmt(invoice.total_invoice_value), type: "money" },

    // Purchase Order Fields
    { section: nomenclature.po_doc_label, label: `${nomenclature.po_num_label}`, value: po.po_number || "—", type: "badge", badgeColor: "#C084FC" },
    { section: nomenclature.po_doc_label, label: "PO Date", value: po.po_date || "—", type: "text" },
    { section: nomenclature.po_doc_label, label: "Original Description", value: po.description || "—", type: "text" },
    { section: nomenclature.po_doc_label, label: "PO Validity", value: po.delivery_date || "—", type: "text" },
    { section: nomenclature.po_doc_label, label: `Total ${nomenclature.po_doc_label} Amount`, value: fmt(po.total_amount), type: "money" },

    // Remittance Fields
    { section: nomenclature.remittance_doc_label, label: `${nomenclature.remittance_num_label} (Document No.)`, value: remittance.remittance_number || "—", type: "badge", badgeColor: "#22C55E" },
    { section: nomenclature.remittance_doc_label, label: `${nomenclature.remittance_doc_label} Date`, value: remittance.remittance_date || "—", type: "text" },
    { section: nomenclature.remittance_doc_label, label: `${nomenclature.invoice_num_label} (Ref in Remittance)`, value: remittance.invoice_number || "—", type: "badge", badgeColor: "#A855F7" },
    { section: nomenclature.remittance_doc_label, label: "Description / Notes", value: remittance.description || "—", type: "text" },
    { section: nomenclature.remittance_doc_label, label: "Gross Amount", value: fmt(remittance.gross_amount), type: "money" },
    { section: nomenclature.remittance_doc_label, label: "Total Gross Amount", value: fmt(remittance.total_gross_amount), type: "money" },

    // Financial Calculation Fields
    { section: "Calculations", label: "GST Rate (Fixed)", value: `${calcData.gst_rate ?? 18}%`, type: "text" },
    { section: "Calculations", label: "GST Amount (Assessable × 18%)", value: fmt(calcData.gst_amount), type: "money" },
    { section: "Calculations", label: "TDS Rate Selected", value: `${calcData.tds_rate ?? 2}%`, type: "text" },
    { section: "Calculations", label: "TDS Amount (Assessable × TDS%)", value: fmt(calcData.tds_amount), type: "tds" },
    { section: "Calculations", label: "Net Receivable (Assessable − TDS + GST)", value: fmt(calcData.receivable), type: "receivable" },
  ];

  return (
    <div className="search-wrapper mb-4" style={{ marginTop: "1.5rem" }}>
      <div className="search-header" style={{ background: "linear-gradient(135deg, #181033 0%, #24134d 50%, #361775 100%)", borderBottom: "2px solid #7C3AED" }}>
        <div className="search-title">
          <i className="bi bi-grid-3x3-gap-fill" style={{ color: "#A855F7" }} />
          All Extracted Data (Master Table View)
          <span style={{ background: "rgba(168,85,247,.2)", border: "1px solid rgba(168,85,247,.5)", color: "#fff", borderRadius: 20, padding: ".15rem .6rem", fontSize: ".72rem" }}>
            22 Columns / Fields
          </span>
        </div>
      </div>

      <div className="history-body">
        {/* Horizontal Master Row Table */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h6 style={{ fontSize: ".85rem", fontWeight: 800, color: "var(--text-main)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".75rem" }}>
            <i className="bi bi-layout-three-columns me-1" style={{ color: "#A855F7" }} />Consolidated Master Record (22 Columns)
          </h6>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th style={{ background: "#7C3AED", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>{nomenclature.invoice_num_label}</th>
                  <th style={{ background: "#7C3AED", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Invoice Date</th>
                  <th style={{ background: "#7C3AED", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Invoice Period</th>
                  <th style={{ background: "#7C3AED", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Assessable Value</th>
                  <th style={{ background: "#7C3AED", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Total Tax</th>
                  <th style={{ background: "#7C3AED", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Total Invoice Value</th>
                  <th style={{ background: "#9333EA", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>{nomenclature.po_num_label}</th>
                  <th style={{ background: "#9333EA", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>PO Date</th>
                  <th style={{ background: "#9333EA", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>PO Validity</th>
                  <th style={{ background: "#9333EA", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Total Amount</th>
                  <th style={{ background: "#16A34A", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>{nomenclature.remittance_num_label}</th>
                  <th style={{ background: "#16A34A", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Remittance Date</th>
                  <th style={{ background: "#16A34A", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Gross Amount</th>
                  <th style={{ background: "#16A34A", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Total Gross Amount</th>
                  <th style={{ background: "#6D28D9", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>GST (18%)</th>
                  <th style={{ background: "#6D28D9", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>TDS ({calcData.tds_rate}%)</th>
                  <th style={{ background: "#6D28D9", color: "#ffffff", fontWeight: 800, padding: ".75rem 1rem" }}>Receivable</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="id-badge">{invoice.invoice_number || "—"}</span></td>
                  <td>{invoice.invoice_date || "—"}</td>
                  <td>{invoice.invoice_period || "—"}</td>
                  <td className="money">{fmt(invoice.assessable_value)}</td>
                  <td className="money">{fmt(invoice.total_tax)}</td>
                  <td className="money">{fmt(invoice.total_invoice_value)}</td>
                  <td><span className="id-badge badge-po">{po.po_number || "—"}</span></td>
                  <td>{po.po_date || "—"}</td>
                  <td>{po.delivery_date || "—"}</td>
                  <td className="money">{fmt(po.total_amount)}</td>
                  <td><span className="id-badge badge-remit">{remittance.remittance_number || "—"}</span></td>
                  <td>{remittance.remittance_date || "—"}</td>
                  <td className="money">{fmt(remittance.gross_amount)}</td>
                  <td className="money">{fmt(remittance.total_gross_amount)}</td>
                  <td className="money">{fmt(calcData.gst_amount)}</td>
                  <td className="tds-cell">{fmt(calcData.tds_amount)}</td>
                  <td className="receivable-cell" style={{ fontSize: ".9rem", fontWeight: 800 }}>{fmt(calcData.receivable)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Structured Field-by-Field Matrix Table */}
        <h6 style={{ fontSize: ".85rem", fontWeight: 800, color: "var(--text-main)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".75rem" }}>
          <i className="bi bi-list-check me-1" style={{ color: "#A855F7" }} />Detailed Field Breakdown (All Rows)
        </h6>
        <div className="history-table-wrap">
          <table className="info-table" style={{ width: "100%" }}>
            <thead>
              <tr style={{ background: "linear-gradient(135deg, #181033 0%, #24134d 50%, #361775 100%)", borderBottom: "2px solid #7C3AED" }}>
                <th style={{ width: "22%", padding: ".75rem 1rem", color: "#ffffff", fontWeight: 800 }}>Document / Category</th>
                <th style={{ width: "48%", padding: ".75rem 1rem", color: "#ffffff", fontWeight: 800 }}>Field Name &amp; Description</th>
                <th style={{ width: "30%", padding: ".75rem 1rem", color: "#ffffff", fontWeight: 800 }}>Extracted / Computed Value</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(168, 85, 247, 0.12)" }}>
                  <td style={{ padding: ".55rem 1rem", fontWeight: 600, color: "var(--text-muted)", fontSize: ".8rem" }}>
                    <span style={{
                      display: "inline-block",
                      padding: ".15rem .5rem",
                      borderRadius: 4,
                      fontSize: ".72rem",
                      fontWeight: 700,
                      background: "rgba(168, 85, 247, 0.12)",
                      color: "var(--purple-violet)",
                      border: "1px solid rgba(168, 85, 247, 0.25)"
                    }}>
                      {f.section}
                    </span>
                  </td>
                  <td style={{ padding: ".55rem 1rem", color: "var(--text-main)", fontSize: ".82rem" }}>
                    {f.label}
                  </td>
                  <td style={{ padding: ".55rem 1rem" }}>
                    {f.type === "money" && <span className="val-money" style={{ fontWeight: 700, fontFamily: "Courier New, monospace" }}>{f.value}</span>}
                    {f.type === "tds" && <span style={{ fontWeight: 700, color: "var(--danger-red)", fontFamily: "Courier New, monospace" }}>{f.value}</span>}
                    {f.type === "receivable" && <span style={{ fontWeight: 800, color: "var(--success-green)", fontFamily: "Courier New, monospace", fontSize: ".95rem" }}>{f.value}</span>}
                    {f.type === "badge" && <span className="id-badge">{f.value}</span>}
                    {f.type === "text" && <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{f.value}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

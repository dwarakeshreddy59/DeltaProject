import React from "react";
import { fmt, inr } from "../utils/format";

export default function ExtractedTableView({ po = {}, invoice = {}, remittance = {}, calcData = {} }) {
  const fields = [
    // Invoice Fields
    { section: "Invoice", label: "Invoice Number (Document No.)", value: invoice.invoice_number || "—", type: "badge", badgeColor: "#1565c0" },
    { section: "Invoice", label: "Invoice Date (Document Date)", value: invoice.invoice_date || "—", type: "text" },
    { section: "Invoice", label: "PO Number (Ref in Invoice)", value: invoice.po_number || "—", type: "badge", badgeColor: "#d97706" },
    { section: "Invoice", label: "Description (Filename without numbers)", value: invoice.description || "—", type: "text" },
    { section: "Invoice", label: "Invoice Period", value: invoice.invoice_period || "—", type: "text" },
    { section: "Invoice", label: "Assessable Value (Taxable Amount)", value: fmt(invoice.assessable_value), type: "money" },
    { section: "Invoice", label: "Total Tax", value: fmt(invoice.total_tax), type: "money" },
    { section: "Invoice", label: "Total Invoice Value", value: fmt(invoice.total_invoice_value), type: "money" },

    // Purchase Order Fields
    { section: "Purchase Order", label: "PO Number", value: po.po_number || "—", type: "badge", badgeColor: "#d97706" },
    { section: "Purchase Order", label: "PO Date", value: po.po_date || "—", type: "text" },
    { section: "Purchase Order", label: "PO Description (Filename)", value: po.description || "—", type: "text" },
    { section: "Purchase Order", label: "Delivery Date / PO Validity", value: po.delivery_date || "—", type: "text" },
    { section: "Purchase Order", label: "Total PO Amount", value: fmt(po.total_amount), type: "money" },

    // Remittance Fields
    { section: "Remittance", label: "Remittance Number (Document No.)", value: remittance.remittance_number || "—", type: "badge", badgeColor: "#059669" },
    { section: "Remittance", label: "Remittance Date (Document Date)", value: remittance.remittance_date || "—", type: "text" },
    { section: "Remittance", label: "Invoice Number (Ref in Remittance)", value: remittance.invoice_number || "—", type: "badge", badgeColor: "#1565c0" },
    { section: "Remittance", label: "Remittance Description / Notes", value: remittance.description || "—", type: "text" },
    { section: "Remittance", label: "Gross Amount", value: fmt(remittance.gross_amount), type: "money" },
    { section: "Remittance", label: "Total Gross Amount", value: fmt(remittance.total_gross_amount), type: "money" },

    // Financial Calculation Fields
    { section: "Calculations", label: "GST Rate (Fixed)", value: `${calcData.gst_rate ?? 18}%`, type: "text" },
    { section: "Calculations", label: "GST Amount (Assessable × 18%)", value: fmt(calcData.gst_amount), type: "money" },
    { section: "Calculations", label: "TDS Rate Selected", value: `${calcData.tds_rate ?? 2}%`, type: "text" },
    { section: "Calculations", label: "TDS Amount (Assessable × TDS%)", value: fmt(calcData.tds_amount), type: "tds" },
    { section: "Calculations", label: "Net Receivable (Assessable − TDS + GST)", value: fmt(calcData.receivable), type: "receivable" },
  ];

  return (
    <div className="search-wrapper mb-4" style={{ marginTop: "1.5rem" }}>
      <div className="search-header" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" }}>
        <div className="search-title">
          <i className="bi bi-grid-3x3-gap-fill" />
          All Extracted Data (Master Table View)
          <span style={{ background: "rgba(255,255,255,.15)", borderRadius: 20, padding: ".15rem .6rem", fontSize: ".72rem" }}>
            22 Columns / Fields
          </span>
        </div>
      </div>

      <div className="history-body">
        {/* Horizontal Master Row Table */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h6 style={{ fontSize: ".8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".75rem" }}>
            <i className="bi bi-layout-three-columns me-1" />Horizontal Consolidated Row
          </h6>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th style={{ background: "#1565c0" }}>Invoice No</th>
                  <th style={{ background: "#1565c0" }}>Invoice Date</th>
                  <th style={{ background: "#1565c0" }}>Invoice Period</th>
                  <th style={{ background: "#1565c0" }}>Assessable Val</th>
                  <th style={{ background: "#1565c0" }}>Total Tax</th>
                  <th style={{ background: "#1565c0" }}>Total Inv Val</th>
                  <th style={{ background: "#d97706" }}>PO Number</th>
                  <th style={{ background: "#d97706" }}>PO Date</th>
                  <th style={{ background: "#d97706" }}>Delivery Date</th>
                  <th style={{ background: "#d97706" }}>Total PO Amt</th>
                  <th style={{ background: "#059669" }}>Remittance No</th>
                  <th style={{ background: "#059669" }}>Remittance Date</th>
                  <th style={{ background: "#059669" }}>Gross Amt</th>
                  <th style={{ background: "#059669" }}>Total Gross Amt</th>
                  <th style={{ background: "#4338ca" }}>GST (18%)</th>
                  <th style={{ background: "#4338ca" }}>TDS ({calcData.tds_rate}%)</th>
                  <th style={{ background: "#4338ca" }}>Receivable</th>
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
                  <td><span className="id-badge" style={{ background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" }}>{po.po_number || "—"}</span></td>
                  <td>{po.po_date || "—"}</td>
                  <td>{po.delivery_date || "—"}</td>
                  <td className="money">{fmt(po.total_amount)}</td>
                  <td><span className="id-badge" style={{ background: "#f0fdf4", color: "#065f46", borderColor: "#a7f3d0" }}>{remittance.remittance_number || "—"}</span></td>
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
        <h6 style={{ fontSize: ".8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: ".75rem" }}>
          <i className="bi bi-list-check me-1" />Detailed Field Breakdown (All Rows)
        </h6>
        <div className="history-table-wrap">
          <table className="info-table" style={{ width: "100%" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ width: "22%", padding: ".6rem 1rem" }}>Document / Category</th>
                <th style={{ width: "48%", padding: ".6rem 1rem" }}>Field Name &amp; Description</th>
                <th style={{ width: "30%", padding: ".6rem 1rem" }}>Extracted / Computed Value</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: ".55rem 1rem", fontWeight: 600, color: "#475569", fontSize: ".8rem" }}>
                    <span style={{
                      display: "inline-block",
                      padding: ".15rem .5rem",
                      borderRadius: 4,
                      fontSize: ".72rem",
                      fontWeight: 700,
                      background: f.section === "Invoice" ? "#eff6ff" : f.section === "Purchase Order" ? "#fffbeb" : f.section === "Remittance" ? "#f0fdf4" : "#f5f3ff",
                      color: f.section === "Invoice" ? "#1d4ed8" : f.section === "Purchase Order" ? "#b45309" : f.section === "Remittance" ? "#047857" : "#6d28d9"
                    }}>
                      {f.section}
                    </span>
                  </td>
                  <td style={{ padding: ".55rem 1rem", color: "#334155", fontSize: ".82rem" }}>
                    {f.label}
                  </td>
                  <td style={{ padding: ".55rem 1rem" }}>
                    {f.type === "money" && <span className="val-money" style={{ fontWeight: 700, color: "#1565c0", fontFamily: "Courier New, monospace" }}>{f.value}</span>}
                    {f.type === "tds" && <span style={{ fontWeight: 700, color: "#ef4444", fontFamily: "Courier New, monospace" }}>{f.value}</span>}
                    {f.type === "receivable" && <span style={{ fontWeight: 800, color: "#10b981", fontFamily: "Courier New, monospace", fontSize: ".95rem" }}>{f.value}</span>}
                    {f.type === "badge" && <span className="id-badge" style={{ color: f.badgeColor }}>{f.value}</span>}
                    {f.type === "text" && <span style={{ fontWeight: 600, color: "#1e293b" }}>{f.value}</span>}
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

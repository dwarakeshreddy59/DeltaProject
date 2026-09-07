import React from "react";
import { inr } from "../utils/format";

const Row = ({ label, value, type = "text" }) => {
  const isEmpty = value === null || value === undefined || value === "" || value === 0;
  let tdClass = "result-td";
  let displayVal;

  if (isEmpty) {
    displayVal = <span className="val-empty">—</span>;
  } else if (type === "money") {
    displayVal = inr(value);
    tdClass += " val-money";
  } else if (type === "highlight") {
    displayVal = value;
    tdClass += " val-highlight";
  } else if (type === "badge") {
    displayVal = <span className="badge-val badge-remit">{value}</span>;
  } else {
    displayVal = value;
  }

  return (
    <tr>
      <th className="result-th">{label}</th>
      <td className={tdClass}>{displayVal}</td>
    </tr>
  );
};

export default function RemittanceCard({ remittance = {} }) {
  const items = Array.isArray(remittance.items) ? remittance.items : [];

  return (
    <div className="result-card">
      <div className="card-head card-head-remit">
        <div className="card-head-icon"><i className="bi bi-cash-stack" /></div>
        Remittance
      </div>
      <div className="card-body-custom">
        <table className="info-table">
          <tbody>
            <Row label="Remittance Number"   value={remittance.remittance_number} type="badge" />
            <Row label="Remittance Date"     value={remittance.remittance_date}   type="highlight" />
            <Row label="Invoice Number (Ref)" value={remittance.invoice_number}   type="badge" />
            {remittance.description && (
              <Row label="Description / Note" value={remittance.description} type="text" />
            )}
            <Row label="Gross Amount"        value={remittance.gross_amount}      type="money" />
            <Row label="Total Gross Amount"  value={remittance.total_gross_amount} type="money" />
          </tbody>
        </table>

        {/* Multiple Line Items / Invoices Breakdown */}
        {items.length > 1 && (
          <div style={{ marginTop: "1rem", paddingTop: ".75rem", borderTop: "1px dashed rgba(168, 85, 247, 0.3)" }}>
            <div style={{ fontSize: ".75rem", fontWeight: 700, color: "#22C55E", textTransform: "uppercase", marginBottom: ".5rem", display: "flex", alignItems: "center", gap: "5px" }}>
              <i className="bi bi-list-nested" /> Cleared Invoices Breakdown ({items.length} items)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: ".78rem", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22C55E" }}>
                    <th style={{ padding: "4px 8px", textAlign: "left" }}>Doc / Ref</th>
                    <th style={{ padding: "4px 8px", textAlign: "left" }}>Invoice No</th>
                    <th style={{ padding: "4px 8px", textAlign: "left" }}>Description</th>
                    <th style={{ padding: "4px 8px", textAlign: "right" }}>Gross Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <td style={{ padding: "4px 8px", color: "var(--text-muted)" }}>{it.doc_number || "—"}</td>
                      <td style={{ padding: "4px 8px", fontWeight: 600, color: "var(--purple-primary)" }}>{it.invoice_number || "—"}</td>
                      <td style={{ padding: "4px 8px", color: "var(--text-main)" }}>{it.description || "—"}</td>
                      <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, color: "var(--success-green)" }}>{inr(it.gross_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

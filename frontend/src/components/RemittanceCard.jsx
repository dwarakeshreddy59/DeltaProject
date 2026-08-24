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
    displayVal = <span className="badge-val" style={{ background: "#f0fdf4", color: "#065f46", borderColor: "#a7f3d0" }}>{value}</span>;
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
            <Row label="Gross Amount"        value={remittance.gross_amount}      type="money" />
            <Row label="Total Gross Amount"  value={remittance.total_gross_amount} type="money" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

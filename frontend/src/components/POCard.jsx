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
    displayVal = <span className="badge-val" style={{ background: "rgba(192, 132, 252, 0.15)", color: "#C084FC", borderColor: "rgba(192, 132, 252, 0.3)" }}>{value}</span>;
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

export default function POCard({ po = {} }) {
  return (
    <div className="result-card">
      <div className="card-head card-head-po">
        <div className="card-head-icon"><i className="bi bi-file-text" /></div>
        Purchase Order
      </div>
      <div className="card-body-custom">
        <table className="info-table">
          <tbody>
            <Row label="PO Number"                 value={po.po_number}     type="badge" />
            <Row label="PO Date"                   value={po.po_date}       type="highlight" />
            <Row label="Description"               value={po.description} />
            <Row label="Delivery Date / PO Validity" value={po.delivery_date} />
            <Row label="Total PO Amount"           value={po.total_amount}  type="money" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

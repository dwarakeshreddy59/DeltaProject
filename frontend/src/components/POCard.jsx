import React from "react";
import { inr } from "../utils/format";
import { useOrganization } from "../context/OrganizationContext";

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
    displayVal = <span className="badge-val badge-po">{value}</span>;
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

export default function POCard({ po = {}, onViewPdf = null }) {
  const { nomenclature } = useOrganization();

  return (
    <div className="result-card">
      <div className="card-head card-head-po">
        <div className="card-head-icon"><i className="bi bi-file-text" /></div>
        <span>{nomenclature.po_doc_label || "Purchase Order"}</span>
        {onViewPdf && (
          <button
            type="button"
            className="btn-card-pdf"
            onClick={() => onViewPdf({ type: "po", data: po })}
            title="View Source PDF"
          >
            <i className="bi bi-file-earmark-pdf-fill" /> View PDF
          </button>
        )}
      </div>
      <div className="card-body-custom">
        <table className="info-table">
          <tbody>
            <Row label={nomenclature.po_num_label || "PO Number"} value={po.po_number} type="badge" />
            <Row label={nomenclature.po_date_label || "PO Date"} value={po.po_date} type="highlight" />
            <Row label={nomenclature.po_desc_label || "Original Description"} value={po.description} />
            <Row label={nomenclature.po_validity_label || "PO Validity"} value={po.delivery_date} />
            <Row label={nomenclature.po_total_label || "Total Amount"} value={po.total_amount} type="money" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

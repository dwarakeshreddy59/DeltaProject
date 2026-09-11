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
    displayVal = <span className="badge-val">{value}</span>;
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

export default function InvoiceCard({ invoice = {}, onViewPdf = null }) {
  const { nomenclature } = useOrganization();

  return (
    <div className="result-card">
      <div className="card-head card-head-invoice">
        <div className="card-head-icon"><i className="bi bi-receipt" /></div>
        <span>{nomenclature.invoice_doc_label || "Invoice"}</span>
        {onViewPdf && (
          <button
            type="button"
            className="btn-card-pdf"
            onClick={() => onViewPdf({ type: "invoice", data: invoice })}
            title="View Source PDF"
          >
            <i className="bi bi-file-earmark-pdf-fill" /> View PDF
          </button>
        )}
      </div>
      <div className="card-body-custom">
        <table className="info-table">
          <tbody>
            <Row label={nomenclature.invoice_num_label || "Invoice Number"} value={invoice.invoice_number} type="badge" />
            <Row label={nomenclature.invoice_date_label || "Invoice Date"} value={invoice.invoice_date} type="highlight" />
            <Row label={`${nomenclature.po_num_label || "PO Number"} (Ref)`} value={invoice.po_number} type="badge" />
            <Row label={nomenclature.invoice_desc_label || "Description"} value={invoice.description} />
            <Row label={nomenclature.invoice_period_label || "Invoice Period"} value={invoice.invoice_period} />
            <Row label={nomenclature.invoice_assessable_label || "Assessable Value"} value={invoice.assessable_value} type="money" />
            <Row label={nomenclature.invoice_tax_label || "Total Tax"} value={invoice.total_tax} type="money" />
            <Row label={nomenclature.invoice_total_label || "Total Invoice Value"} value={invoice.total_invoice_value} type="money" />
          </tbody>
        </table>
      </div>
    </div>
  );
}

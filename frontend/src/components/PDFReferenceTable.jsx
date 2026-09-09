import React from "react";
import { useOrganization } from "../context/OrganizationContext";

export default function PDFReferenceTable() {
  const { clients } = useOrganization();

  // Helper to get PDF field name for a client
  const getInvoicePdfName = (client) => {
    const org = (client.organization_name || "").toUpperCase();
    if (org === "AGCO") return 'Document ("Your Document")';
    if (org.includes("JP")) return "Invoice Ref / Bill No";
    if (org.includes("BLACK")) return "Tax Invoice Ref";
    return client.invoice_num_label || client.invoice_doc_label || "Invoice Number";
  };

  const getRemittancePdfName = (client) => {
    const org = (client.organization_name || "").toUpperCase();
    if (org === "AGCO") return 'Doc No ("Document Number")';
    if (org.includes("JP")) return "Payment Ref / UTR Number";
    if (org.includes("BLACK")) return "Voucher ID / Advice Ref";
    return client.remittance_num_label || client.remittance_doc_label || "Remittance Number";
  };

  const getPoPdfName = (client) => {
    const org = (client.organization_name || "").toUpperCase();
    if (org === "AGCO") return "Purchase Order";
    if (org.includes("JP")) return "Work Order";
    if (org.includes("BLACK")) return "Purchase Authorization";
    return client.po_num_label || client.po_doc_label || "PO Number";
  };

  return (
    <div className="pure-ref-table-wrap animate-fadein">
      <div className="pure-ref-title">PDF Document Field Reference</div>
      <div className="pure-ref-desc">
        Left shows Delta IoT (standard application fields), right shows company names and how those fields appear in their PDFs.
      </div>

      {/* ── Table: Delta IoT on Left, Companies on Right ── */}
      <div className="table-responsive" style={{ marginTop: "1rem" }}>
        <table className="pure-text-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>Delta IoT (Application Field)</th>
              {clients.map((c) => (
                <th key={c.id}>
                  {c.organization_name} (In PDF)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Invoice Number</strong>
              </td>
              {clients.map((c) => (
                <td key={c.id}>
                  {getInvoicePdfName(c)}
                </td>
              ))}
            </tr>
            <tr>
              <td>
                <strong>Remittance Number</strong>
              </td>
              {clients.map((c) => (
                <td key={c.id}>
                  {getRemittancePdfName(c)}
                </td>
              ))}
            </tr>
            <tr>
              <td>
                <strong>PO Number</strong>
              </td>
              {clients.map((c) => (
                <td key={c.id}>
                  {getPoPdfName(c)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Company List Table ── */}
      <div className="table-responsive" style={{ marginTop: "2rem" }}>
        <table className="pure-text-table">
          <thead>
            <tr>
              <th>Delta IoT (Application)</th>
              <th>Company Name</th>
              <th>Invoice in PDF</th>
              <th>Remittance in PDF</th>
              <th>PO in PDF</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>Delta IoT</td>
                <td>
                  <strong>{c.organization_name}</strong>
                </td>
                <td>{getInvoicePdfName(c)}</td>
                <td>{getRemittancePdfName(c)}</td>
                <td>{getPoPdfName(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

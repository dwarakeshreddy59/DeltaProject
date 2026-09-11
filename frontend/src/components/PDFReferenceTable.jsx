import React from "react";
import { useOrganization } from "../context/OrganizationContext";

/**
 * PDFReferenceTable - Pure text reference mapping table
 * Left: Delta IoT (Application Field)
 * Right: Company PDF Field Names (AGCO as primary example + all dynamically registered companies)
 */
export default function PDFReferenceTable() {
  const { clients } = useOrganization();

  // Ensure AGCO is always primary reference company, followed by other registered clients
  const sortedClients = React.useMemo(() => {
    const list = Array.isArray(clients) ? [...clients] : [];
    const agcoIndex = list.findIndex(
      (c) => (c.organization_name || "").toUpperCase() === "AGCO"
    );

    let agcoClient;
    if (agcoIndex !== -1) {
      agcoClient = list.splice(agcoIndex, 1)[0];
    } else {
      // Fallback AGCO definition if not yet in DB
      agcoClient = {
        id: "agco_ref",
        organization_name: "AGCO",
        invoice_num_label: "Document No",
        po_num_label: "PO Nr",
        remittance_num_label: "Document Number",
      };
    }

    return [agcoClient, ...list];
  }, [clients]);

  // Helper to get PDF field name for any company dynamically
  const getPdfField = (client, fieldKey) => {
    switch (fieldKey) {
      // ── Tax Invoice Fields ──
      case "invoice_number":
        return client.invoice_num_label || "Invoice Number";
      case "invoice_date":
        return client.invoice_date_label || "Invoice Date";
      case "description":
        return client.invoice_desc_label || "Description";
      case "invoice_period":
        return client.invoice_period_label || "Invoice Period";
      case "assessable_value":
        return client.invoice_assessable_label || "Assessable Value";
      case "total_tax":
        return client.invoice_tax_label || "Total Tax";
      case "total_invoice_value":
        return client.invoice_total_label || "Total Invoice Value";

      // ── Purchase Order Fields ──
      case "po_number":
        return client.po_num_label || "PO Number";
      case "po_date":
        return client.po_date_label || "PO Date";
      case "po_description":
        return client.po_desc_label || "Original Description";
      case "po_validity":
        return client.po_validity_label || "PO Validity";
      case "total_amount":
        return client.po_total_label || "Total Amount";

      // ── Remittance Advice Fields ──
      case "remittance_number":
        return client.remittance_num_label || "Remittance Number";
      case "remittance_date":
        return client.remittance_date_label || "Remittance Date";
      case "gross_amount":
        return client.remittance_gross_label || "Gross Amount";
      case "total_gross_amount":
        return client.remittance_total_label || "Total Gross Amount";

      default:
        return "—";
    }
  };

  const sections = [
    {
      title: "Tax Invoice Fields",
      fields: [
        { delta: "Invoice Number", key: "invoice_number" },
        { delta: "Invoice Date", key: "invoice_date" },
        { delta: "Description", key: "description" },
        { delta: "Invoice Period", key: "invoice_period" },
        { delta: "Assessable Value", key: "assessable_value" },
        { delta: "Total Tax", key: "total_tax" },
        { delta: "Total Invoice Value", key: "total_invoice_value" },
      ],
    },
    {
      title: "Purchase Order (PO) Fields",
      fields: [
        { delta: "PO Number", key: "po_number" },
        { delta: "PO Date", key: "po_date" },
        { delta: "Original Description", key: "po_description" },
        { delta: "PO Validity", key: "po_validity" },
        { delta: "Total Amount", key: "total_amount" },
      ],
    },
    {
      title: "Remittance Advice Fields",
      fields: [
        { delta: "Remittance Number", key: "remittance_number" },
        { delta: "Remittance Date", key: "remittance_date" },
        { delta: "Gross Amount", key: "gross_amount" },
        { delta: "Total Gross Amount", key: "total_gross_amount" },
      ],
    },
  ];

  const totalCols = 1 + sortedClients.length;

  return (
    <div className="pure-ref-table-wrap animate-fadein">
      <div className="pure-ref-title">PDF Document Field Reference Table</div>
      <div className="pure-ref-desc">
        Standard Delta IoT application fields on the left mapped directly against how each field appears inside the client's PDF documents on the right.
      </div>

      <div className="table-responsive" style={{ marginTop: "1.25rem" }}>
        <table className="pure-text-table">
          <thead>
            <tr>
              <th style={{ width: "260px", minWidth: "220px" }}>
                Delta IoT (Application Field)
              </th>
              {sortedClients.map((client) => (
                <th key={client.id} style={{ minWidth: "180px" }}>
                  {client.organization_name} (In PDF)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section, sIdx) => (
              <React.Fragment key={sIdx}>
                <tr className="pure-table-section-row">
                  <td colSpan={totalCols} className="table-section-header">
                    {section.title}
                  </td>
                </tr>
                {section.fields.map((field, fIdx) => (
                  <tr key={fIdx}>
                    <td>
                      <strong>{field.delta}</strong>
                    </td>
                    {sortedClients.map((client) => (
                      <td key={client.id}>
                        {getPdfField(client, field.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

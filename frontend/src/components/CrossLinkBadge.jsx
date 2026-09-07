import React from "react";

export default function CrossLinkBadge({ po, invoice, remittance }) {
  const poNum  = invoice?.po_number  || po?.po_number        || "Not found";
  const invNum = invoice?.invoice_number                     || "Not found";
  const remNum = remittance?.remittance_number               || "Not found";

  return (
    <div className="crosslink-bar">
      <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: ".07em", color: "#64748b", whiteSpace: "nowrap" }}>
        <i className="bi bi-diagram-3 me-1" />Document Chain
      </div>
      <div className="crosslink-chain">
        <ChainItem label="Purchase Order" value={poNum} badgeClass="badge-po" />
        <span className="chain-arrow"><i className="bi bi-arrow-right" /></span>
        <ChainItem label="Invoice" value={invNum} badgeClass="badge-inv" />
        <span className="chain-arrow"><i className="bi bi-arrow-right" /></span>
        <ChainItem label="Remittance" value={remNum} badgeClass="badge-remit" />
      </div>
    </div>
  );
}

function ChainItem({ label, value, badgeClass = "" }) {
  const missing = value === "Not found";
  return (
    <div className="chain-item">
      <div className="chain-label">{label}</div>
      <div className={`chain-value ${badgeClass}`} style={{
        borderColor: missing ? "rgba(239, 68, 68, 0.4)" : undefined,
        color: missing ? "#ef4444" : undefined,
        background: missing ? "rgba(239, 68, 68, 0.12)" : undefined,
      }}>
        {missing
          ? <><i className="bi bi-exclamation-circle me-1" />Not found</>
          : value
        }
      </div>
    </div>
  );
}

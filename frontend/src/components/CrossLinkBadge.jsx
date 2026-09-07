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
        <ChainItem label="Purchase Order" value={poNum} color="#0284c7" />
        <span className="chain-arrow"><i className="bi bi-arrow-right" /></span>
        <ChainItem label="Invoice" value={invNum} color="#0abab5" />
        <span className="chain-arrow"><i className="bi bi-arrow-right" /></span>
        <ChainItem label="Remittance" value={remNum} color="#059669" />
      </div>
    </div>
  );
}

function ChainItem({ label, value, color }) {
  const missing = value === "Not found";
  return (
    <div className="chain-item">
      <div className="chain-label">{label}</div>
      <div className="chain-value" style={{
        borderColor: missing ? "#fca5a5" : undefined,
        color: missing ? "#ef4444" : color,
        background: missing ? "#fff1f2" : undefined,
      }}>
        {missing
          ? <><i className="bi bi-exclamation-circle me-1" />Not found</>
          : value
        }
      </div>
    </div>
  );
}

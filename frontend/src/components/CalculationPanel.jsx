import React, { useState } from "react";
import { inr, fmt } from "../utils/format";

const TDS_OPTIONS = [
  { label: "0% (Nil)",           value: 0.0,  title: "Section 197 (Nil / Non-deduction Certificate)" },
  { label: "0.1% (Goods)",       value: 0.1,  title: "Section 194Q (Purchase of Goods > ₹50L)" },
  { label: "1% (Contractor)",    value: 1.0,  title: "Section 194C (Works Contract - Individual / HUF)" },
  { label: "2% (Standard/Tech)", value: 2.0,  title: "Section 194C (Corporate Contractor) / 194J (Tech)" },
  { label: "5% (Rent/Comm)",     value: 5.0,  title: "Section 194I (Rent) / 194H (Commission)" },
  { label: "10% (Prof. Fees)",   value: 10.0, title: "Section 194J (Professional & Legal Fees)" },
];

/**
 * Fully independent calculation panel.
 * calcData and onTdsChange come from useExtraction hook.
 * Changing TDS ONLY updates this panel — never re-renders data cards.
 */
export default function CalculationPanel({ calcData, onTdsChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState("");

  if (!calcData) return null;

  const {
    assessable_value    = 0,
    gst_rate            = 18,
    gst_amount          = 0,
    total_invoice_value = 0,
    tds_rate            = 2,
    tds_amount          = 0,
    receivable          = 0,
  } = calcData;

  const handleCustomApply = (e) => {
    e.preventDefault();
    const val = parseFloat(customVal);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      onTdsChange(val);
      setShowCustom(false);
    }
  };

  const isPreset = TDS_OPTIONS.some((o) => o.value === Number(tds_rate));

  return (
    <div className="calc-wrapper animate-slideup">
      <div className="calc-header">
        <div className="calc-title">
          <i className="bi bi-calculator-fill" />
          Financial Calculations &amp; Tax Deductions
        </div>
        <div className="live-badge">
          <div className="live-dot" />
          Live — updates independently
        </div>
      </div>

      <div className="calc-body">
        {/* Formula */}
        <div className="formula-banner">
          <i className="bi bi-info-circle-fill" />
          <span>
            <strong>GST</strong> = Assessable × 18%&emsp;|&emsp;
            <strong>Total Invoice</strong> = Assessable + GST&emsp;|&emsp;
            <strong>TDS</strong> = Assessable × TDS%&emsp;|&emsp;
            <strong>Receivable</strong> = Assessable − TDS + GST
          </span>
        </div>

        {/* TDS selector — situation-based */}
        <div className="tds-selector-row" style={{ flexWrap: "wrap", gap: ".5rem" }}>
          <span className="tds-label">TDS Situation / Rate:</span>
          {TDS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onTdsChange(o.value); setShowCustom(false); }}
              title={o.title}
              style={{
                padding: ".4rem .85rem",
                borderRadius: 8,
                border: "1.5px solid",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: ".82rem",
                transition: "all .2s",
                background: Number(tds_rate) === o.value ? "linear-gradient(135deg, #7C3AED, #A855F7)" : "var(--bg-card)",
                borderColor: Number(tds_rate) === o.value ? "#A855F7" : "var(--border-subtle)",
                color: Number(tds_rate) === o.value ? "#fff" : "var(--text-main)",
                boxShadow: Number(tds_rate) === o.value ? "0 0 16px rgba(168, 85, 247, 0.55)" : "none",
              }}
            >
              {o.label}
            </button>
          ))}

          {!showCustom ? (
            <button
              type="button"
              onClick={() => { setShowCustom(true); setCustomVal(String(tds_rate)); }}
              style={{
                padding: ".4rem .85rem",
                borderRadius: 8,
                border: "1.5px dashed var(--border-medium)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: ".82rem",
                background: !isPreset ? "linear-gradient(135deg, #7C3AED, #A855F7)" : "transparent",
                color: !isPreset ? "#fff" : "var(--text-muted)",
              }}
            >
              {!isPreset ? `Custom (${tds_rate}%)` : "⚙️ Custom %..."}
            </button>
          ) : (
            <form onSubmit={handleCustomApply} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={customVal}
                onChange={(e) => setCustomVal(e.target.value)}
                placeholder="Rate"
                style={{
                  width: "70px",
                  padding: ".35rem .5rem",
                  borderRadius: 6,
                  border: "1.5px solid #A855F7",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: ".82rem",
                  fontWeight: 700,
                }}
                autoFocus
              />
              <span style={{ fontSize: ".82rem", fontWeight: 700, color: "var(--text-muted)" }}>%</span>
              <button
                type="submit"
                style={{
                  padding: ".35rem .65rem",
                  borderRadius: 6,
                  border: "none",
                  background: "#10B981",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: ".8rem",
                  cursor: "pointer",
                }}
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                style={{
                  padding: ".35rem .5rem",
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: ".8rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </form>
          )}

          <span style={{ fontSize: ".75rem", color: "#A1A1AA", marginLeft: ".25rem", alignSelf: "center" }}>
            (Live calculation updates)
          </span>
        </div>

        {/* Tiles */}
        <div className="calc-tiles">
          <Tile cls="t-assessable" label="Assessable Value"  value={inr(assessable_value)} vcls="v-blue" />
          <Tile cls="t-gst"        label={`GST (${gst_rate}%)`}      value={inr(gst_amount)}      vcls="v-teal" />
          <Tile cls="t-total"      label="Total Invoice Value" value={inr(total_invoice_value)} vcls="v-green" />
          <Tile cls="t-tds"        label={`TDS (${tds_rate}%)`}      value={inr(tds_amount)}      vcls="v-red" />
        </div>

        {/* Receivable */}
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="receivable-tile btn-shine">
              <div className="rec-label">Net Receivable</div>
              <div className="rec-value">{inr(receivable)}</div>
              <div className="rec-formula">= Assessable − TDS + GST</div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="calc-breakdown mt-3">
          <div className="breakdown-row">
            <span className="br-label">Assessable Value</span>
            <span className="br-val br-assessable">+ {fmt(assessable_value)}</span>
          </div>
          <div className="breakdown-row">
            <span className="br-label">GST ({gst_rate}%)</span>
            <span className="br-val br-gst">+ {fmt(gst_amount)}</span>
          </div>
          <div className="breakdown-row">
            <span className="br-label">TDS ({tds_rate}%)</span>
            <span className="br-val tds-cell">− {fmt(tds_amount)}</span>
          </div>
          <div className="breakdown-row" style={{ paddingTop: ".5rem", borderTop: "2px solid rgba(168, 85, 247, 0.3)", marginTop: ".25rem" }}>
            <span className="br-label" style={{ fontWeight: 700, color: "var(--text-main)" }}>Net Receivable</span>
            <span className="br-val receivable-cell" style={{ fontSize: "1.05rem", fontWeight: 800 }}>{fmt(receivable)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ cls, label, value, vcls }) {
  return (
    <div className={`calc-tile ${cls}`}>
      <div className="tile-label">{label}</div>
      <div className={`tile-value ${vcls}`}>{value}</div>
    </div>
  );
}

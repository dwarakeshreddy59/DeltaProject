import React from "react";
import { inr, fmt } from "../utils/format";

const TDS_OPTIONS = [
  { label: "0.1%", value: 0.1 },
  { label: "2%",   value: 2.0 },
  { label: "10%",  value: 10.0 },
];

/**
 * Fully independent calculation panel.
 * calcData and onTdsChange come from useExtraction hook.
 * Changing TDS ONLY updates this panel — never re-renders data cards.
 */
export default function CalculationPanel({ calcData, onTdsChange }) {
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

  return (
    <div className="calc-wrapper">
      <div className="calc-header">
        <div className="calc-title">
          <i className="bi bi-calculator-fill" />
          Financial Calculations
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

        {/* TDS selector — independent of data cards */}
        <div className="tds-selector-row">
          <span className="tds-label">Change TDS Rate:</span>
          {TDS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onTdsChange(o.value)}
              style={{
                padding: ".4rem .9rem",
                borderRadius: 8,
                border: "1.5px solid",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: ".82rem",
                transition: "all .2s",
                background: tds_rate === o.value ? "linear-gradient(135deg,#0abab5,#089793)" : "var(--bg-card)",
                borderColor: tds_rate === o.value ? "#0abab5" : "var(--border-subtle)",
                color: tds_rate === o.value ? "#fff" : "var(--text-main)",
                boxShadow: tds_rate === o.value ? "0 4px 12px rgba(10,186,181,.4)" : "none",
              }}
            >
              {o.label}
            </button>
          ))}
          <span style={{ fontSize: ".75rem", color: "#4b7270", marginLeft: ".5rem" }}>
            (does not affect extracted data above)
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
            <div className="receivable-tile">
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
            <span className="br-val" style={{ color: "#075955" }}>+ {fmt(assessable_value)}</span>
          </div>
          <div className="breakdown-row">
            <span className="br-label">GST ({gst_rate}%)</span>
            <span className="br-val" style={{ color: "#0abab5" }}>+ {fmt(gst_amount)}</span>
          </div>
          <div className="breakdown-row">
            <span className="br-label">TDS ({tds_rate}%)</span>
            <span className="br-val" style={{ color: "#ef4444" }}>− {fmt(tds_amount)}</span>
          </div>
          <div className="breakdown-row" style={{ paddingTop: ".5rem", borderTop: "2px solid #81d8d0", marginTop: ".25rem" }}>
            <span className="br-label" style={{ fontWeight: 700, color: "#022624" }}>Net Receivable</span>
            <span className="br-val" style={{ color: "#075955", fontSize: "1rem" }}>{fmt(receivable)}</span>
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

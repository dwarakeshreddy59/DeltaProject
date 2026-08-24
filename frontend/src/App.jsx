import React, { useState } from "react";
import Navbar from "./components/Navbar";
import UploadTab from "./components/UploadTab";
import RecordsTab from "./components/RecordsTab";
import SearchTab from "./components/SearchTab";
import { useExtraction } from "./hooks/useExtraction";

const TABS = [
  { id: "upload",  icon: "bi-cloud-upload-fill",  label: "Upload & Extract" },
  { id: "records", icon: "bi-table",               label: "All Records"      },
  { id: "search",  icon: "bi-search",              label: "Search by ID"     },
];

export default function App() {
  const { loading, results, calcData, extract, recalc } = useExtraction();
  const [activeTab,      setActiveTab]      = useState("upload");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [uploadCount,    setUploadCount]    = useState(0);

  const handleExtract = async (formData) => {
    await extract(formData);
    setRefreshTrigger((n) => n + 1);
    setUploadCount((n) => n + 1);
    // Auto-switch to records tab after successful extraction
  };

  return (
    <div className="app-shell">
      <Navbar />

      {/* ── Hero ── */}
      <div className="hero-banner">
        <div className="hero-content">
          <div className="hero-badge">
            <i className="bi bi-lightning-charge-fill" />Powered by AI Extraction
          </div>
          <h1 className="hero-title">PDF Data Extraction &amp;<br />Financial Analysis Portal</h1>
          <p className="hero-subtitle">
            Upload Invoice, PO &amp; Remittance PDFs — extract data, compute GST/TDS, store in PostgreSQL.
          </p>

          <div className="hero-stats">
            <HeroStat icon="bi-file-earmark-text" bg="linear-gradient(135deg,#3b82f6,#1d4ed8)"
              value={uploadCount} label="Extractions" trend="This session" />
            <HeroStat icon="bi-currency-rupee" bg="linear-gradient(135deg,#10b981,#059669)"
              value={results ? `₹${Number(calcData?.receivable||0).toLocaleString("en-IN",{minimumFractionDigits:2})}` : "₹0"}
              label="Net Receivable" trend="Last extraction" isStr />
            <HeroStat icon="bi-percent" bg="linear-gradient(135deg,#f59e0b,#d97706)"
              value={results ? `${calcData?.tds_rate??2}%` : "—"} label="TDS Rate" trend="Selected" isStr />
            <HeroStat icon="bi-database-check" bg="linear-gradient(135deg,#8b5cf6,#6d28d9)"
              value="Live" label="PostgreSQL" trend="Auto-saving" isStr />
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="tab-bar-wrap">
        <div className="tab-bar">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              <i className={`bi ${t.icon}`} />
              <span>{t.label}</span>
              {t.id === "upload" && uploadCount > 0 && (
                <span className="tab-badge">{uploadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="main-container">
        {activeTab === "upload" && (
          <UploadTab
            loading={loading}
            results={results}
            calcData={calcData}
            onExtract={handleExtract}
            onRecalc={recalc}
            onViewRecords={() => setActiveTab("records")}
          />
        )}
        {activeTab === "records" && (
          <RecordsTab refreshTrigger={refreshTrigger} />
        )}
        {activeTab === "search" && (
          <SearchTab />
        )}
      </div>
    </div>
  );
}

function HeroStat({ icon, bg, value, label, trend, isStr }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: bg }}>
        <i className={`bi ${icon}`} style={{ color: "#fff" }} />
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-trend"><i className="bi bi-arrow-up-right" />{trend}</div>
    </div>
  );
}

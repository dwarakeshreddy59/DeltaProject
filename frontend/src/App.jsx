import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import UploadTab from "./components/UploadTab";
import RecordsTab from "./components/RecordsTab";
import SearchTab from "./components/SearchTab";
import ClientsTab from "./components/ClientsTab";
import ClientRegistrationModal from "./components/ClientRegistrationModal";
import { OrganizationProvider, useOrganization } from "./context/OrganizationContext";
import { useExtraction } from "./hooks/useExtraction";

const TABS = [
  { id: "upload",  icon: "bi-cloud-upload-fill",     label: "Upload & Extract" },
  { id: "records", icon: "bi-table",                  label: "All Records"      },
  { id: "search",  icon: "bi-search",                 label: "Search by ID"     },
  { id: "clients", icon: "bi-building-fill-gear",    label: "Organizations"    },
];

function AppContent() {
  const { activeClient, isRegisterModalOpen, closeRegisterModal } = useOrganization();
  const { loading, results, calcData, mismatchError, extract, recalc, clearMismatchError } = useExtraction();
  const [activeTab,      setActiveTab]      = useState("upload");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [uploadCount,    setUploadCount]    = useState(0);

  // ── Theme State: 'dark' (Premium Dark Purple Luxury) or 'bright' (Light Lavender) ──
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "bright" : "dark"));
  };

  const handleExtract = async (formData) => {
    const res = await extract(formData);
    if (res?.success) {
      setRefreshTrigger((n) => n + 1);
      setUploadCount((n) => n + 1);
    }
  };

  return (
    <div className="app-shell">
      {/* Global Client Registration Modal */}
      <ClientRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={closeRegisterModal}
      />

      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      {/* ── Hero ── */}
      <div className="hero-banner">
        <div className="hero-content">
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: ".5rem" }}>
            <div className="hero-badge">
              <i className="bi bi-lightning-charge-fill" />Powered by AI Extraction
            </div>
            {activeClient && (
              <div
                className="hero-badge"
                style={{
                  background: "rgba(168, 85, 247, 0.25)",
                  borderColor: "rgba(168, 85, 247, 0.5)",
                  color: "#ffffff",
                }}
              >
                <i className="bi bi-building me-1" />
                Active: <strong>{activeClient.organization_name}</strong>
              </div>
            )}
          </div>
          <h1 className="hero-title">PDF Data Extraction &amp;<br />Financial Analysis Portal</h1>
          <p className="hero-subtitle">
            Upload {activeClient?.invoice_doc_label || "Invoice"}, {activeClient?.po_doc_label || "PO"} &amp; {activeClient?.remittance_doc_label || "Remittance"} PDFs — extract data, compute GST/TDS, store in PostgreSQL.
          </p>

          <div className="hero-stats">
            <HeroStat icon="bi-file-earmark-text" bg="linear-gradient(135deg, #7C3AED, #5B21B6)"
              value={uploadCount} label="Extractions" trend="This session" />
            <HeroStat icon="bi-currency-rupee" bg="linear-gradient(135deg, #22C55E, #15803D)"
              value={results ? `₹${Number(calcData?.receivable||0).toLocaleString("en-IN",{minimumFractionDigits:2})}` : "₹0"}
              label="Net Receivable" trend="Last extraction" isStr />
            <HeroStat icon="bi-percent" bg="linear-gradient(135deg, #A855F7, #7C3AED)"
              value={results ? `${calcData?.tds_rate??2}%` : "—"} label="TDS Rate" trend="Selected" isStr />
            <HeroStat icon="bi-database-check" bg="linear-gradient(135deg, #C084FC, #9333EA)"
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
        <div key={activeTab} className="animate-fadein">
          {activeTab === "upload" && (
            <UploadTab
              loading={loading}
              results={results}
              calcData={calcData}
              mismatchError={mismatchError}
              onExtract={handleExtract}
              onRecalc={recalc}
              onViewRecords={() => setActiveTab("records")}
              onClearMismatch={clearMismatchError}
            />
          )}
          {activeTab === "records" && (
            <RecordsTab refreshTrigger={refreshTrigger} />
          )}
          {activeTab === "search" && (
            <SearchTab />
          )}
          {activeTab === "clients" && (
            <ClientsTab />
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <OrganizationProvider>
      <AppContent />
    </OrganizationProvider>
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

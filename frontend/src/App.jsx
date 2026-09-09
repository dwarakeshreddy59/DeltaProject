import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import CompanyHub from "./components/CompanyHub";
import CompanyWorkspaceHeader from "./components/CompanyWorkspaceHeader";
import UploadTab from "./components/UploadTab";
import RecordsTab from "./components/RecordsTab";
import PDFFieldReferenceTab from "./components/PDFFieldReferenceTab";
import SearchTab from "./components/SearchTab";
import ClientRegistrationModal from "./components/ClientRegistrationModal";
import { OrganizationProvider, useOrganization } from "./context/OrganizationContext";
import { useExtraction } from "./hooks/useExtraction";

function AppContent() {
  const {
    activeCompany,
    isAtHub,
    goToHub,
    nomenclature,
    isRegisterModalOpen,
    closeRegisterModal,
    refreshClients,
  } = useOrganization();

  const {
    loading,
    results,
    calcData,
    mismatchError,
    extract,
    recalc,
    clearMismatchError,
  } = useExtraction();

  const [activeTab, setActiveTab] = useState("upload");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [uploadCount, setUploadCount] = useState(0);

  // ── Theme State: 'dark' (Premium Dark Purple Luxury) or 'bright' (Light Lavender) ──
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleSwitchTab = (e) => {
      if (e?.detail) setActiveTab(e.detail);
    };
    window.addEventListener("switch_tab", handleSwitchTab);
    return () => window.removeEventListener("switch_tab", handleSwitchTab);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "bright" : "dark"));
  };

  const handleExtract = async (formData) => {
    const res = await extract(formData);
    if (res?.success) {
      setRefreshTrigger((n) => n + 1);
      setUploadCount((n) => n + 1);
      if (refreshClients) refreshClients();
    }
  };

  const workspaceTabs = [
    {
      id: "upload",
      icon: "bi-cloud-upload-fill",
      label: `Upload & Extract (${nomenclature.invoice_doc_label})`,
    },
    {
      id: "records",
      icon: "bi-table",
      label: `${activeCompany?.organization_name || "Company"} Records`,
    },
    {
      id: "reference",
      icon: "bi-journal-bookmark-fill",
      label: "PDF Field Reference",
    },
    {
      id: "search",
      icon: "bi-search",
      label: "Search Documents",
    },
  ];

  return (
    <div className="app-shell">
      {/* Global Client Registration Modal */}
      <ClientRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={closeRegisterModal}
      />

      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      {/* ── CONDITIONAL LAYOUT: 1. COMPANY HUB vs 2. COMPANY WORKSPACE ── */}
      {isAtHub || !activeCompany ? (
        /* ── 1. HOME GATEWAY: COMPANY SELECTION & REGISTRATION HUB ── */
        <CompanyHub />
      ) : (
        /* ── 2. INSIDE COMPANY WORKSPACE ── */
        <div className="company-workspace-container animate-fadein">
          {/* Top Company Identity & Switcher Banner */}
          <CompanyWorkspaceHeader />

          {/* Mini Stats Bar for Active Company — Total Extraction Metrics on Top */}
          <div className="ws-stats-row">
            <HeroStat
              icon="bi-file-earmark-text"
              bg="linear-gradient(135deg, #7C3AED, #5B21B6)"
              value={(activeCompany?.invoices_count || 0) + uploadCount}
              label="Total Extractions"
              trend={`${activeCompany?.invoices_count || 0} in Database · ${uploadCount} new`}
            />
            <HeroStat
              icon="bi-currency-rupee"
              bg="linear-gradient(135deg, #22C55E, #15803D)"
              value={`₹${Number(
                (activeCompany?.total_receivable || 0) + (results ? (calcData?.receivable || 0) : 0)
              ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              label="Total Net Receivable"
              trend="Cumulative across invoices"
              isStr
            />
            <HeroStat
              icon="bi-cash-coin"
              bg="linear-gradient(135deg, #A855F7, #7C3AED)"
              value={`₹${Number(
                (activeCompany?.total_assessable || 0) + (results ? (calcData?.assessable_value || 0) : 0)
              ).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
              label="Total Assessable Value"
              trend="Taxable base (18% GST)"
              isStr
            />
            <HeroStat
              icon="bi-database-check"
              bg="linear-gradient(135deg, #C084FC, #9333EA)"
              value="Live DB"
              label="PostgreSQL Stored"
              trend={`${activeCompany?.pos_count || 0} POs · ${activeCompany?.remittances_count || 0} Remittances`}
              isStr
            />
          </div>

          {/* ── Workspace Tab Bar ── */}
          <div className="tab-bar-wrap" style={{ marginTop: "1rem" }}>
            <div className="tab-bar">
              {workspaceTabs.map((t) => (
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

              <button
                type="button"
                className="tab-btn tab-btn-all-companies"
                onClick={goToHub}
                title="Return to Home Company Hub"
              >
                <i className="bi bi-grid-fill" />
                <span>All Companies / Hub</span>
              </button>
            </div>
          </div>

          {/* ── Workspace Tab Content ── */}
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
              {activeTab === "reference" && (
                <PDFFieldReferenceTab refreshTrigger={refreshTrigger} />
              )}
              {activeTab === "search" && (
                <SearchTab />
              )}
            </div>
          </div>
        </div>
      )}
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
      <div className="stat-trend">
        <i className="bi bi-arrow-up-right" />
        {trend}
      </div>
    </div>
  );
}

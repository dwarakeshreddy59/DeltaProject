import React from "react";
import { useOrganization } from "../context/OrganizationContext";

export default function Navbar({ theme = "dark", onToggleTheme }) {
  const { activeCompany, isAtHub, goToHub, openRegisterModal } = useOrganization();

  return (
    <nav className="portal-navbar">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={goToHub}
          className="brand"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
          title="Return to Home Company Selection Hub"
        >
          <div className="brand-icon">
            <i className="bi bi-file-earmark-bar-graph-fill" />
          </div>
          <div>
            PDF Data Portal
            <span className="brand-subtitle">Multi-Company Financial Extraction</span>
          </div>
        </button>

        {/* Current Context Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          {!isAtHub && activeCompany ? (
            <div className="nav-active-company-chip">
              <span className="chip-dot" />
              <i className="bi bi-building me-1" />
              <strong>{activeCompany.organization_name}</strong>
              <button
                type="button"
                onClick={goToHub}
                className="chip-switch-btn"
                title="Switch to another company"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="nav-hub-chip">
              <i className="bi bi-grid-1x2-fill me-1" />
              Company Selection Hub
            </div>
          )}
        </div>
      </div>

      <div className="nav-actions">
        {/* Quick Register Company Action */}
        <button
          type="button"
          onClick={openRegisterModal}
          className="btn-nav btn-register-nav"
          title="Register a new client/organization"
        >
          <i className="bi bi-plus-circle-fill" />
          <span>Register Company</span>
        </button>

        {/* Theme Mode Toggle (Dark Purple / Light Lavender) */}
        <button
          type="button"
          className="btn-theme-toggle"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Switch to Light Lavender Mode" : "Switch to Dark Purple Luxury Mode"}
          aria-label="Toggle Dark/Light Mode"
        >
          {theme === "dark" ? (
            <>
              <i className="bi bi-sun-fill theme-icon-sun" />
              <span className="theme-toggle-label">Light Mode</span>
            </>
          ) : (
            <>
              <i className="bi bi-moon-stars-fill theme-icon-moon" />
              <span className="theme-toggle-label">Dark Purple</span>
            </>
          )}
        </button>

        <div className="nav-divider" />

        <a className="btn-nav" href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
          <i className="bi bi-code-slash" />API Docs
        </a>
        <div className="nav-divider" />
        <a className="btn-nav btn-green" href="/export/excel">
          <i className="bi bi-file-earmark-excel-fill" />Export Excel
        </a>
      </div>
    </nav>
  );
}

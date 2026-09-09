import React, { useState, useRef, useEffect } from "react";
import { useOrganization } from "../context/OrganizationContext";

export default function Navbar({ theme = "dark", onToggleTheme }) {
  const { clients, activeClient, selectClient, openRegisterModal } = useOrganization();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="portal-navbar">
      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
        <a href="/" className="brand">
          <div className="brand-icon">
            <i className="bi bi-file-earmark-bar-graph-fill" />
          </div>
          <div>
            PDF Data Portal
            <span className="brand-subtitle">Invoice · PO · Remittance Extractor</span>
          </div>
        </a>

        {/* ── Organization Switcher Dropdown ── */}
        <div className="org-switcher-wrap" ref={dropdownRef}>
          <button
            type="button"
            className={`btn-org-switcher ${dropdownOpen ? "open" : ""}`}
            onClick={() => setDropdownOpen((v) => !v)}
            title="Active Organization & Nomenclature Profile"
          >
            <div className="org-switcher-avatar">
              {activeClient?.logo_url ? (
                <img
                  src={activeClient.logo_url}
                  alt={activeClient.organization_name}
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <i className="bi bi-building-fill" />
              )}
            </div>
            <div className="org-switcher-text">
              <span className="org-switcher-label">Organization</span>
              <span className="org-switcher-name">
                {activeClient?.organization_name || "AGCO"}
              </span>
            </div>
            <i className={`bi bi-chevron-${dropdownOpen ? "up" : "down"} org-switcher-chevron`} />
          </button>

          {dropdownOpen && (
            <div className="org-switcher-dropdown animate-popin">
              <div className="org-dropdown-header">
                <span>Select Organization</span>
                <span className="badge-pill">{clients.length} Total</span>
              </div>

              <div className="org-dropdown-list">
                {clients.map((c) => {
                  const isSelected = Number(c.id) === Number(activeClient?.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`org-dropdown-item ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        selectClient(c.id);
                        setDropdownOpen(false);
                      }}
                    >
                      <div className="org-item-avatar">
                        {c.logo_url ? (
                          <img
                            src={c.logo_url}
                            alt={c.organization_name}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          c.organization_name?.slice(0, 2).toUpperCase() || "OR"
                        )}
                      </div>
                      <div className="org-item-details">
                        <div className="org-item-title">{c.organization_name}</div>
                        <div className="org-item-sub">
                          {c.invoice_doc_label} · {c.po_doc_label}
                        </div>
                      </div>
                      {isSelected && (
                        <i className="bi bi-check-circle-fill org-item-check" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="org-dropdown-footer">
                <button
                  type="button"
                  className="btn-add-org"
                  onClick={() => {
                    setDropdownOpen(false);
                    openRegisterModal();
                  }}
                >
                  <i className="bi bi-plus-circle-fill" /> Register New Company
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="nav-actions">
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

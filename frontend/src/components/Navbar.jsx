import React from "react";

export default function Navbar({ theme = "dark", onToggleTheme }) {
  return (
    <nav className="portal-navbar">
      <a href="/" className="brand">
        <div className="brand-icon">
          <i className="bi bi-file-earmark-bar-graph-fill" />
        </div>
        <div>
          PDF Data Portal
          <span className="brand-subtitle">Invoice · PO · Remittance Extractor</span>
        </div>
      </a>

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

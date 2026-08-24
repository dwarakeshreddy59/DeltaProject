import React from "react";

export default function Navbar() {
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

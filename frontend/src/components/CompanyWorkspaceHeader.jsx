import React from "react";
import { useOrganization } from "../context/OrganizationContext";

export default function CompanyWorkspaceHeader() {
  const { activeCompany, nomenclature, goToHub, openRegisterModal, openLogoModal } = useOrganization();

  if (!activeCompany) return null;

  return (
    <div className="workspace-header-banner animate-slideup">
      {/* Top Breadcrumb row */}
      <div className="workspace-breadcrumb-row">
        <button
          type="button"
          onClick={goToHub}
          className="workspace-back-btn"
          title="Return to Company Selection Hub"
        >
          <i className="bi bi-arrow-left-circle-fill" /> Back to Company Selection
        </button>
        <span className="workspace-breadcrumb-sep">/</span>
        <span className="workspace-breadcrumb-active">
          <i className="bi bi-building me-1" />
          {activeCompany.organization_name} Workspace
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: ".6rem" }}>
          <button
            type="button"
            onClick={() => openLogoModal(activeCompany)}
            className="btn-ws-logo"
            title="Add or change company logo anytime"
          >
            <i className="bi bi-camera-fill me-1" />
            {activeCompany.logo_url ? "Change Logo" : "Add Logo"}
          </button>
          <button
            type="button"
            onClick={openRegisterModal}
            className="btn-ws-register"
          >
            <i className="bi bi-plus-circle" /> Register Another Company
          </button>
          <button
            type="button"
            onClick={goToHub}
            className="btn-ws-switch"
          >
            <i className="bi bi-arrow-left-right" /> Switch Company
          </button>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="workspace-main-row">
        {/* Company Identity */}
        <div className="workspace-identity">
          <div
            className="workspace-avatar"
            onClick={() => openLogoModal(activeCompany)}
            title="Click to Add or Change Logo anytime"
            role="button"
            tabIndex={0}
          >
            {activeCompany.logo_url ? (
              <img
                src={activeCompany.logo_url}
                alt={activeCompany.organization_name}
                onError={(e) => {
                  e.target.style.display = "none";
                  if (e.target.nextSibling) e.target.nextSibling.style.display = "inline";
                }}
              />
            ) : null}
            <span style={{ display: activeCompany.logo_url ? "none" : "inline" }}>
              {activeCompany.organization_name?.slice(0, 2).toUpperCase() || "CO"}
            </span>
            <div className="avatar-edit-hover-badge" title="Change Logo">
              <i className="bi bi-camera-fill" />
            </div>
          </div>

          <div className="workspace-details">
            <div style={{ display: "flex", alignItems: "center", gap: ".6rem", flexWrap: "wrap" }}>
              <h2 className="workspace-org-name">{activeCompany.organization_name}</h2>
              <span className="workspace-active-badge">
                <i className="bi bi-check-circle-fill" /> Active Workspace
              </span>
            </div>

            <div className="workspace-client-name">
              <i className="bi bi-person-badge me-1" />
              Department: <strong>{activeCompany.client_name || "Operations"}</strong>
            </div>

            <div className="workspace-tax-tags">
              {activeCompany.gst_number && (
                <span className="workspace-tax-tag">
                  GSTIN: <strong>{activeCompany.gst_number}</strong>
                </span>
              )}
              {activeCompany.pan_number && (
                <span className="workspace-tax-tag">
                  PAN: <strong>{activeCompany.pan_number}</strong>
                </span>
              )}
              {activeCompany.point_of_contact && (
                <span className="workspace-tax-tag">
                  <i className="bi bi-envelope me-1" />
                  {activeCompany.point_of_contact}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Nomenclature Snapshot for this company */}
        <div className="workspace-nomen-card">
          <div className="workspace-nomen-title">
            <i className="bi bi-tags-fill me-1" /> Active Terminology Profile:
          </div>
          <div className="workspace-nomen-grid">
            <div className="ws-nomen-item item-invoice">
              <div className="ws-nomen-type">Invoice Slot:</div>
              <div className="ws-nomen-val">
                {nomenclature.invoice_doc_label} (<strong>{nomenclature.invoice_num_label}</strong>)
              </div>
            </div>
            <div className="ws-nomen-item item-po">
              <div className="ws-nomen-type">PO Slot:</div>
              <div className="ws-nomen-val">
                {nomenclature.po_doc_label} (<strong>{nomenclature.po_num_label}</strong>)
              </div>
            </div>
            <div className="ws-nomen-item item-remit">
              <div className="ws-nomen-type">Remittance Slot:</div>
              <div className="ws-nomen-val">
                {nomenclature.remittance_doc_label} (<strong>{nomenclature.remittance_num_label}</strong>)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

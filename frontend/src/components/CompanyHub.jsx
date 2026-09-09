import React, { useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { deleteClient } from "../services/api";
import toast from "react-hot-toast";

export default function CompanyHub() {
  const { clients, selectCompany, openRegisterModal, refreshClients } = useOrganization();
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const filteredClients = clients.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      (c.organization_name || "").toLowerCase().includes(q) ||
      (c.client_name || "").toLowerCase().includes(q) ||
      (c.gst_number || "").toLowerCase().includes(q) ||
      (c.pan_number || "").toLowerCase().includes(q)
    );
  });

  const handleDelete = async (e, client) => {
    e.stopPropagation();
    if (client.id === 1) {
      toast.error("Initial Organization (AGCO) cannot be deleted.");
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete "${client.organization_name}"? Stored records linked to this company will be unassigned.`
      )
    ) {
      return;
    }

    setDeletingId(client.id);
    try {
      const res = await deleteClient(client.id);
      if (res.data?.success) {
        toast.success(`Deleted ${client.organization_name}`);
        await refreshClients();
      }
    } catch (err) {
      toast.error("Delete failed: " + (err?.response?.data?.detail || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="company-hub-container animate-fadein">
      {/* ── Hub Hero ── */}
      <div className="hub-hero">
        <div className="hub-hero-content">
          <div className="hero-badge">
            <i className="bi bi-buildings-fill" /> Multi-Company Financial Portal
          </div>
          <h1 className="hub-hero-title">Select Company to Enter Workspace</h1>
          <p className="hub-hero-subtitle">
            Choose a registered organization below to manage its custom document nomenclature, upload PDFs, and inspect financial calculations — or register a brand new company.
          </p>

          {/* Search & Actions Bar */}
          <div className="hub-search-bar">
            <div className="hub-search-input-wrap">
              <i className="bi bi-search" />
              <input
                type="text"
                placeholder="Search companies by name, GSTIN, or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="hub-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="hub-search-clear"
                >
                  <i className="bi bi-x-circle-fill" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={openRegisterModal}
              className="btn-register-company-primary"
            >
              <i className="bi bi-plus-circle-fill" /> Register New Company
            </button>
          </div>
        </div>
      </div>

      {/* ── Companies Grid ── */}
      <div className="hub-grid-section">
        <div className="hub-section-header">
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
            <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text-main)" }}>
              Registered Organizations
            </span>
            <span className="hub-count-pill">
              {clients.length} {clients.length === 1 ? "Company" : "Companies"}
            </span>
          </div>
          <span style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>
            Click any company card to open its workspace
          </span>
        </div>

        <div className="row g-4">
          {/* Action Card: Register New Company (Always First Card) */}
          <div className="col-lg-6 col-xl-4">
            <div
              className="hub-add-card animate-popin"
              onClick={openRegisterModal}
              role="button"
              tabIndex={0}
            >
              <div className="hub-add-icon-glow">
                <i className="bi bi-building-fill-add" />
              </div>
              <h3 className="hub-add-title">Register New Company</h3>
              <p className="hub-add-desc">
                Add an organization with custom logo, GSTIN, PAN, and specific document nomenclature (e.g. <strong>DO Number</strong> instead of Invoice No, <strong>Work Order</strong> instead of PO).
              </p>
              <div className="btn-add-action">
                <i className="bi bi-plus-lg me-1" /> Register &amp; Setup Now ➔
              </div>
            </div>
          </div>

          {/* Registered Company Cards */}
          {filteredClients.map((client) => {
            const totalDocs =
              (client.invoices_count || 0) +
              (client.pos_count || 0) +
              (client.remittances_count || 0);

            return (
              <div key={client.id} className="col-lg-6 col-xl-4">
                <div
                  className="hub-company-card animate-popin"
                  onClick={() => selectCompany(client.id)}
                  role="button"
                  tabIndex={0}
                >
                  {/* Top Bar: Avatar & Title */}
                  <div className="hub-card-head">
                    <div className="hub-card-avatar">
                      {client.logo_url ? (
                        <img
                          src={client.logo_url}
                          alt={client.organization_name}
                          onError={(e) => {
                            e.target.style.display = "none";
                            if (e.target.nextSibling) e.target.nextSibling.style.display = "inline";
                          }}
                        />
                      ) : null}
                      <span style={{ display: client.logo_url ? "none" : "inline" }}>
                        {client.organization_name?.slice(0, 2).toUpperCase() || "CO"}
                      </span>
                    </div>

                    <div className="hub-card-info">
                      <h4 className="hub-card-name" title={client.organization_name}>
                        {client.organization_name}
                      </h4>
                      <div className="hub-card-sub">
                        <i className="bi bi-person-badge me-1" />
                        {client.client_name || "Primary Department"}
                        {client.id === 1 && (
                          <span className="hub-default-tag">Default #1</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Legal IDs & Contact Box */}
                  <div className="hub-card-legal-box">
                    <div className="hub-legal-row">
                      <span className="hub-legal-lbl">GSTIN:</span>
                      <span className="hub-legal-val">{client.gst_number || "—"}</span>
                    </div>
                    <div className="hub-legal-row">
                      <span className="hub-legal-lbl">PAN:</span>
                      <span className="hub-legal-val">{client.pan_number || "—"}</span>
                    </div>
                    {client.point_of_contact && (
                      <div className="hub-legal-row">
                        <span className="hub-legal-lbl">Contact:</span>
                        <span className="hub-legal-val" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {client.point_of_contact}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Custom Nomenclature Badges */}
                  <div className="hub-card-nomen-box">
                    <div className="hub-nomen-title">Document Nomenclature:</div>
                    <div className="hub-nomen-tags">
                      <span className="hub-nomen-chip chip-invoice">
                        <i className="bi bi-receipt me-1" />
                        {client.invoice_doc_label} ({client.invoice_num_label})
                      </span>
                      <span className="hub-nomen-chip chip-po">
                        <i className="bi bi-file-text me-1" />
                        {client.po_doc_label} ({client.po_num_label})
                      </span>
                      <span className="hub-nomen-chip chip-remit">
                        <i className="bi bi-cash-stack me-1" />
                        {client.remittance_doc_label} ({client.remittance_num_label})
                      </span>
                    </div>
                  </div>

                  {/* Footer & Enter Button */}
                  <div className="hub-card-foot">
                    <span className="hub-stored-count">
                      <i className="bi bi-database-check me-1" />
                      <strong>{totalDocs}</strong> Stored Doc(s)
                    </span>

                    <div style={{ display: "flex", alignItems: "center", gap: ".45rem" }}>
                      {client.id !== 1 && (
                        <button
                          type="button"
                          className="btn-card-delete"
                          onClick={(e) => handleDelete(e, client)}
                          disabled={deletingId === client.id}
                          title="Delete Company"
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-enter-workspace"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectCompany(client.id);
                        }}
                      >
                        Enter Workspace <i className="bi bi-arrow-right ms-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

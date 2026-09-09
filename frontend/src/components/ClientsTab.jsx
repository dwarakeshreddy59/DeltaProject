import React, { useState } from "react";
import { useOrganization } from "../context/OrganizationContext";
import { deleteClient } from "../services/api";
import ClientRegistrationModal from "./ClientRegistrationModal";
import toast from "react-hot-toast";

export default function ClientsTab() {
  const {
    clients,
    activeClientId,
    selectClient,
    refreshClients,
    isRegisterModalOpen,
    openRegisterModal,
    closeRegisterModal,
  } = useOrganization();

  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (client) => {
    if (client.id === 1) {
      toast.error("Initial Organization (Delta IoT Solutions) cannot be deleted.");
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete "${client.organization_name}"? Records linked to this client will be unassigned.`
      )
    ) {
      return;
    }

    setDeletingId(client.id);
    try {
      const res = await deleteClient(client.id);
      if (res.data?.success) {
        toast.success(`Deleted ${client.organization_name}`);
        if (activeClientId === client.id) {
          selectClient(1); // fallback to default
        }
        await refreshClients();
      }
    } catch (err) {
      toast.error("Failed to delete client: " + (err?.response?.data?.detail || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="search-wrapper animate-fadein">
      {/* Registration Modal */}
      <ClientRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={closeRegisterModal}
      />

      {/* Header */}
      <div
        className="search-header"
        style={{
          background: "linear-gradient(135deg, #181033 0%, #24134d 50%, #361775 100%)",
          borderBottom: "2px solid #7C3AED",
        }}
      >
        <div className="search-title" style={{ color: "#ffffff" }}>
          <i className="bi bi-building-fill-gear" style={{ color: "#A855F7" }} />
          Registered Organizations &amp; Client Entities
          <span className="rec-count-badge">
            {clients.length} {clients.length === 1 ? "Organization" : "Organizations"} Registered
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: ".75rem" }}>
          <button
            onClick={openRegisterModal}
            className="btn-extract"
            style={{
              borderRadius: 10,
              padding: ".45rem 1rem",
              fontSize: ".82rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #7C3AED, #A855F7)",
              color: "#fff",
              border: "1.5px solid #C084FC",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: ".45rem",
              boxShadow: "0 0 15px rgba(168, 85, 247, 0.4)",
            }}
          >
            <i className="bi bi-plus-circle-fill" /> Register New Organization
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div
        className="db-verify-bar"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <i className="bi bi-info-circle-fill" style={{ color: "#A855F7" }} />
        <span style={{ color: "var(--text-muted)", fontSize: ".82rem" }}>
          Each organization can have distinct legal details, branding logos, and custom document terminology (e.g. <strong>Delivery Order vs Invoice</strong>, <strong>Work Order vs PO</strong>). Select any company below to activate its nomenclature throughout the portal.
        </span>
      </div>

      {/* Clients Grid */}
      <div style={{ padding: "1.75rem", background: "var(--bg-card-subtle)" }}>
        <div className="row g-4">
          {clients.map((c) => {
            const isActive = Number(c.id) === Number(activeClientId);
            const totalDocs = (c.invoices_count || 0) + (c.pos_count || 0) + (c.remittances_count || 0);

            return (
              <div key={c.id} className="col-lg-6 col-xl-4">
                <div
                  className={`client-card animate-popin ${isActive ? "client-card-active" : ""}`}
                  style={{
                    background: "var(--bg-card)",
                    border: isActive ? "2px solid #A855F7" : "1.5px solid var(--border-subtle)",
                    borderRadius: 16,
                    padding: "1.4rem",
                    position: "relative",
                    transition: "all .25s ease",
                    boxShadow: isActive
                      ? "0 0 25px rgba(168, 85, 247, 0.35), 0 8px 24px rgba(0,0,0,0.12)"
                      : "0 2px 10px rgba(0,0,0,0.04)",
                  }}
                >
                  {/* Active Badge */}
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        top: "1rem",
                        right: "1rem",
                        background: "linear-gradient(135deg, #16A34A, #22C55E)",
                        color: "#ffffff",
                        borderRadius: 20,
                        padding: ".2rem .75rem",
                        fontSize: ".7rem",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: ".35rem",
                        boxShadow: "0 0 12px rgba(34, 197, 94, 0.4)",
                      }}
                    >
                      <i className="bi bi-check-circle-fill" /> ACTIVE NOW
                    </div>
                  )}

                  {/* Header: Logo & Names */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.1rem" }}>
                    <div
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 12,
                        background: "var(--bg-card-subtle)",
                        border: "1.5px solid var(--border-medium)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {c.logo_url ? (
                        <img
                          src={c.logo_url}
                          alt={c.organization_name}
                          style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: "1.25rem",
                            color: "#A855F7",
                            textTransform: "uppercase",
                          }}
                        >
                          {c.organization_name?.slice(0, 2) || "OR"}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h5
                        style={{
                          margin: 0,
                          fontSize: "1.05rem",
                          fontWeight: 800,
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={c.organization_name}
                      >
                        {c.organization_name}
                      </h5>
                      <div
                        style={{
                          fontSize: ".8rem",
                          color: "var(--purple-primary)",
                          fontWeight: 600,
                          marginTop: ".2rem",
                        }}
                      >
                        <i className="bi bi-person-badge me-1" />
                        {c.client_name || "Primary Account"}
                        {c.id === 1 && (
                          <span
                            style={{
                              marginLeft: ".5rem",
                              background: "rgba(168, 85, 247, 0.15)",
                              color: "#A855F7",
                              padding: ".1rem .45rem",
                              borderRadius: 4,
                              fontSize: ".68rem",
                              fontWeight: 800,
                            }}
                          >
                            Default #1
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tax & Contact Identifiers */}
                  <div
                    style={{
                      background: "var(--bg-card-subtle)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      padding: ".75rem .9rem",
                      marginBottom: "1rem",
                      fontSize: ".78rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".35rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>GSTIN:</span>
                      <strong style={{ fontFamily: "monospace", letterSpacing: ".5px", color: "var(--text-main)" }}>
                        {c.gst_number || "—"}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".35rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>PAN:</span>
                      <strong style={{ fontFamily: "monospace", letterSpacing: ".5px", color: "var(--text-main)" }}>
                        {c.pan_number || "—"}
                      </strong>
                    </div>
                    {c.point_of_contact && (
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: ".35rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Contact:</span>
                        <span style={{ color: "var(--text-main)", maxWidth: 180, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.point_of_contact}
                        </span>
                      </div>
                    )}
                    {c.address && (
                      <div style={{ marginTop: ".45rem", paddingTop: ".45rem", borderTop: "1px dashed var(--border-subtle)", color: "var(--text-muted)", fontSize: ".72rem", lineHeight: 1.3 }}>
                        <i className="bi bi-geo-alt me-1" />
                        {c.address}
                      </div>
                    )}
                  </div>

                  {/* Custom Nomenclature Badges */}
                  <div style={{ marginBottom: "1.1rem" }}>
                    <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: ".45rem" }}>
                      Custom Nomenclature Mapping:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: ".35rem" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: ".75rem", background: "rgba(168, 85, 247, 0.08)", padding: ".25rem .55rem", borderRadius: 6 }}>
                        <span style={{ color: "#A855F7", fontWeight: 700 }}>
                          <i className="bi bi-receipt me-1" /> Invoice:
                        </span>
                        <strong style={{ color: "var(--text-main)" }}>
                          {c.invoice_doc_label} ({c.invoice_num_label})
                        </strong>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: ".75rem", background: "rgba(192, 132, 252, 0.08)", padding: ".25rem .55rem", borderRadius: 6 }}>
                        <span style={{ color: "#C084FC", fontWeight: 700 }}>
                          <i className="bi bi-file-text me-1" /> PO:
                        </span>
                        <strong style={{ color: "var(--text-main)" }}>
                          {c.po_doc_label} ({c.po_num_label})
                        </strong>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: ".75rem", background: "rgba(34, 197, 94, 0.08)", padding: ".25rem .55rem", borderRadius: 6 }}>
                        <span style={{ color: "#22C55E", fontWeight: 700 }}>
                          <i className="bi bi-cash-stack me-1" /> Remittance:
                        </span>
                        <strong style={{ color: "var(--text-main)" }}>
                          {c.remittance_doc_label} ({c.remittance_num_label})
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Document Counts & Bottom Actions */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: ".9rem",
                      borderTop: "1px solid var(--border-subtle)",
                      flexWrap: "wrap",
                      gap: ".6rem",
                    }}
                  >
                    <div style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
                      <i className="bi bi-file-earmark-check me-1" />
                      <strong>{totalDocs}</strong> stored doc(s)
                    </div>

                    <div style={{ display: "flex", gap: ".5rem" }}>
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={() => {
                            selectClient(c.id);
                            toast.success(`Active company switched to ${c.organization_name}`);
                          }}
                          style={{
                            background: "linear-gradient(135deg, #7C3AED, #9333EA)",
                            color: "#ffffff",
                            border: "1px solid #C084FC",
                            borderRadius: 8,
                            padding: ".35rem .85rem",
                            fontSize: ".75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <i className="bi bi-arrow-repeat me-1" /> Activate
                        </button>
                      ) : (
                        <span
                          style={{
                            color: "#22C55E",
                            fontSize: ".75rem",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            gap: ".3rem",
                          }}
                        >
                          <i className="bi bi-check2-circle" /> Current Portal View
                        </span>
                      )}

                      {c.id !== 1 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          disabled={deletingId === c.id}
                          style={{
                            background: "rgba(239, 68, 68, 0.12)",
                            color: "var(--danger-red)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: 8,
                            padding: ".35rem .65rem",
                            fontSize: ".75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          title="Delete Organization"
                        >
                          <i className="bi bi-trash3" />
                        </button>
                      )}
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

import React, { useState, useRef } from "react";
import { registerClient } from "../services/api";
import { useOrganization } from "../context/OrganizationContext";
import toast from "react-hot-toast";

const PRESETS = [
  {
    label: "Standard Corporate",
    invoice_doc: "Tax Invoice",
    invoice_num: "Invoice Number",
    po_doc: "Purchase Order",
    po_num: "PO Number",
    rem_doc: "Remittance Advice",
    rem_num: "Remittance Number",
  },
  {
    label: "Logistics & Supply (DO / WO)",
    invoice_doc: "Delivery Order (DO)",
    invoice_num: "DO Number",
    po_doc: "Work Order",
    po_num: "Work Order No",
    rem_doc: "Payment Voucher",
    rem_num: "Payment Voucher No",
  },
  {
    label: "Contractor & Services",
    invoice_doc: "Commercial Bill",
    invoice_num: "Bill Number",
    po_doc: "Service Order",
    po_num: "Service Order No",
    rem_doc: "Settlement Advice",
    rem_num: "Settlement Ref No",
  },
];

export default function ClientRegistrationModal({ isOpen, onClose }) {
  const { refreshClients, selectClient } = useOrganization();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    organization_name: "",
    client_name: "",
    gst_number: "",
    pan_number: "",
    address: "",
    point_of_contact: "",
    invoice_doc_label: "Tax Invoice",
    invoice_num_label: "Invoice Number",
    po_doc_label: "Purchase Order",
    po_num_label: "PO Number",
    remittance_doc_label: "Remittance Advice",
    remittance_num_label: "Remittance Number",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleApplyPreset = (preset) => {
    setForm((prev) => ({
      ...prev,
      invoice_doc_label: preset.invoice_doc,
      invoice_num_label: preset.invoice_num,
      po_doc_label: preset.po_doc,
      po_num_label: preset.po_num,
      remittance_doc_label: preset.rem_doc,
      remittance_num_label: preset.rem_num,
    }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.organization_name.trim()) {
      toast.error("Organization Name is required");
      return;
    }
    if (!form.client_name.trim()) {
      toast.error("Client Name / Contact Person is required");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach((key) => {
        fd.append(key, form[key]);
      });
      if (logoFile) {
        fd.append("logo_file", logoFile);
      }

      const res = await registerClient(fd);
      if (res.data?.success && res.data?.client) {
        const newClient = res.data.client;
        toast.success(`🎉 ${newClient.organization_name} registered successfully!`);
        await refreshClients();
        selectClient(newClient.id);
        onClose();
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="client-modal-backdrop animate-fadein">
      <div className="client-modal-dialog animate-popin">
        {/* Header */}
        <div className="client-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: ".75rem" }}>
            <div className="client-modal-icon">
              <i className="bi bi-building-fill-add" />
            </div>
            <div>
              <h4 className="client-modal-title">Register Organization / Client</h4>
              <p className="client-modal-subtitle">
                Configure company details, logo, and custom document nomenclature (e.g. DO vs Invoice)
              </p>
            </div>
          </div>
          <button
            type="button"
            className="client-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="client-modal-body">
          {/* Section 1: Core Organization Identity */}
          <div className="client-modal-section">
            <div className="client-section-title">
              <i className="bi bi-buildings" /> 1. Company &amp; Client Identity
            </div>
            <div className="row g-3">
              <div className="col-md-7">
                <label className="client-form-label">
                  Organization / Company Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="organization_name"
                  value={form.organization_name}
                  onChange={handleChange}
                  placeholder="e.g. Tata Steel Logistics Ltd or Reliance Infra"
                  className="client-form-input"
                  required
                />
              </div>

              <div className="col-md-5">
                <label className="client-form-label">
                  Client / Dept Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="client_name"
                  value={form.client_name}
                  onChange={handleChange}
                  placeholder="e.g. Logistics Admin or Procurement"
                  className="client-form-input"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="client-form-label">GSTIN / Tax ID</label>
                <input
                  type="text"
                  name="gst_number"
                  value={form.gst_number}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, gst_number: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. 27AAACT1234F1Z5"
                  maxLength={15}
                  className="client-form-input"
                  style={{ textTransform: "uppercase", letterSpacing: "1px" }}
                />
              </div>

              <div className="col-md-6">
                <label className="client-form-label">PAN Number</label>
                <input
                  type="text"
                  name="pan_number"
                  value={form.pan_number}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, pan_number: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. AAACT1234F"
                  maxLength={10}
                  className="client-form-input"
                  style={{ textTransform: "uppercase", letterSpacing: "1px" }}
                />
              </div>

              <div className="col-md-12">
                <label className="client-form-label">Point of Contact (Email / Phone / Desk)</label>
                <input
                  type="text"
                  name="point_of_contact"
                  value={form.point_of_contact}
                  onChange={handleChange}
                  placeholder="e.g. contact@company.com · +91 98765 43210"
                  className="client-form-input"
                />
              </div>

              <div className="col-md-12">
                <label className="client-form-label">Registered Office Address</label>
                <textarea
                  name="address"
                  rows={2}
                  value={form.address}
                  onChange={handleChange}
                  placeholder="e.g. Sector 18, Commercial Complex, Bandra Kurla Complex, Mumbai 400051"
                  className="client-form-input"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Company Logo Upload */}
          <div className="client-modal-section">
            <div className="client-section-title">
              <i className="bi bi-image" /> 2. Company Brand Logo (Optional)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
              <div
                className="client-modal-logo-preview"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 14,
                  background: "#FFFFFF",
                  border: "2px dashed #CBD5E1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                }}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6, background: "#FFFFFF" }}
                  />
                ) : (
                  <i className="bi bi-buildings" style={{ fontSize: "1.8rem", color: "#94A3B8" }} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoChange}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: "linear-gradient(135deg, #7C3AED, #9333EA)",
                      border: "1.5px solid #C084FC",
                      color: "#fff",
                      borderRadius: 8,
                      padding: ".4rem .9rem",
                      fontSize: ".8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: ".4rem",
                    }}
                  >
                    <i className="bi bi-upload" />
                    {logoPreview ? "Change Logo Image" : "Upload Company Logo"}
                  </button>

                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "var(--danger-red)",
                        borderRadius: 8,
                        padding: ".4rem .75rem",
                        fontSize: ".8rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <i className="bi bi-trash3 me-1" /> Remove
                    </button>
                  )}
                </div>
                <div style={{ fontSize: ".73rem", color: "var(--text-muted)", marginTop: ".35rem" }}>
                  PNG, JPG, SVG or WebP. Max 5MB. Displayed in navbar &amp; company badges.
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Custom Document Nomenclature & Terminology */}
          <div className="client-modal-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem", marginBottom: ".6rem" }}>
              <div className="client-section-title" style={{ marginBottom: 0 }}>
                <i className="bi bi-tags" /> 3. Document Nomenclature (Custom Terminology)
              </div>
              <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                {PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      background: "var(--bg-card-subtle)",
                      border: "1px solid var(--border-medium)",
                      color: "var(--purple-violet)",
                      borderRadius: 6,
                      padding: ".25rem .55rem",
                      fontSize: ".7rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: ".78rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Customize how documents and ID numbers are named for this company (e.g. <strong>DO Number</strong> instead of Invoice No, <strong>Work Order</strong> instead of PO).
            </p>

            <div className="row g-3">
              {/* Slot 1: Invoice Nomenclature */}
              <div className="col-md-4">
                <div className="nomenclature-box" style={{ borderTop: "3px solid #A855F7" }}>
                  <div className="nomenclature-box-title" style={{ color: "#A855F7" }}>
                    <i className="bi bi-receipt me-1" /> Invoice Slot
                  </div>
                  <label className="client-form-label">Document Name</label>
                  <input
                    type="text"
                    name="invoice_doc_label"
                    value={form.invoice_doc_label}
                    onChange={handleChange}
                    placeholder="e.g. Delivery Order (DO)"
                    className="client-form-input client-form-input-sm"
                  />
                  <label className="client-form-label mt-2">Document # Label</label>
                  <input
                    type="text"
                    name="invoice_num_label"
                    value={form.invoice_num_label}
                    onChange={handleChange}
                    placeholder="e.g. DO Number"
                    className="client-form-input client-form-input-sm"
                  />
                </div>
              </div>

              {/* Slot 2: PO Nomenclature */}
              <div className="col-md-4">
                <div className="nomenclature-box" style={{ borderTop: "3px solid #C084FC" }}>
                  <div className="nomenclature-box-title" style={{ color: "#C084FC" }}>
                    <i className="bi bi-file-text me-1" /> PO Slot
                  </div>
                  <label className="client-form-label">Document Name</label>
                  <input
                    type="text"
                    name="po_doc_label"
                    value={form.po_doc_label}
                    onChange={handleChange}
                    placeholder="e.g. Work Order"
                    className="client-form-input client-form-input-sm"
                  />
                  <label className="client-form-label mt-2">Document # Label</label>
                  <input
                    type="text"
                    name="po_num_label"
                    value={form.po_num_label}
                    onChange={handleChange}
                    placeholder="e.g. Work Order No"
                    className="client-form-input client-form-input-sm"
                  />
                </div>
              </div>

              {/* Slot 3: Remittance Nomenclature */}
              <div className="col-md-4">
                <div className="nomenclature-box" style={{ borderTop: "3px solid #22C55E" }}>
                  <div className="nomenclature-box-title" style={{ color: "#22C55E" }}>
                    <i className="bi bi-cash-stack me-1" /> Remittance Slot
                  </div>
                  <label className="client-form-label">Document Name</label>
                  <input
                    type="text"
                    name="remittance_doc_label"
                    value={form.remittance_doc_label}
                    onChange={handleChange}
                    placeholder="e.g. Payment Voucher"
                    className="client-form-input client-form-input-sm"
                  />
                  <label className="client-form-label mt-2">Document # Label</label>
                  <input
                    type="text"
                    name="remittance_num_label"
                    value={form.remittance_num_label}
                    onChange={handleChange}
                    placeholder="e.g. Voucher Ref No"
                    className="client-form-input client-form-input-sm"
                  />
                </div>
              </div>
            </div>

            {/* Live Nomenclature Preview */}
            <div className="nomenclature-preview-bar">
              <div style={{ fontSize: ".73rem", fontWeight: 700, color: "var(--text-muted)" }}>
                <i className="bi bi-eye-fill me-1" />Live Preview of UI Badges:
              </div>
              <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginTop: ".35rem" }}>
                <span className="id-badge">
                  {form.invoice_num_label || "Invoice Number"}: #10024
                </span>
                <span className="id-badge badge-po">
                  {form.po_num_label || "PO Number"}: #80029552
                </span>
                <span className="id-badge badge-remit">
                  {form.remittance_num_label || "Remittance Number"}: #2000013497
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="client-modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-modal-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-modal-primary"
            >
              {loading ? (
                <>
                  <span className="spinner-ring" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Registering...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle-fill" />
                  Register &amp; Activate Company
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

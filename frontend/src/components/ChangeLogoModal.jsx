import React, { useState, useRef, useEffect } from "react";
import { updateClient } from "../services/api";
import { useOrganization } from "../context/OrganizationContext";
import toast from "react-hot-toast";

export default function ChangeLogoModal({ company, isOpen, onClose }) {
  const { refreshClients } = useOrganization();
  const fileInputRef = useRef(null);

  const [logoMode, setLogoMode] = useState("file"); // 'file' | 'url'
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && company) {
      setSelectedFile(null);
      setFilePreview(company.logo_url || "");
      setUrlInput(company.logo_url?.startsWith("http") ? company.logo_url : "");
      setLogoMode("file");
    }
  }, [isOpen, company]);

  if (!isOpen || !company) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file (.png, .jpg, .svg, .webp)");
      return;
    }
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setFilePreview(objectUrl);
  };

  const handleRemoveLogo = () => {
    setSelectedFile(null);
    setFilePreview("");
    setUrlInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();

      if (logoMode === "file") {
        if (selectedFile) {
          formData.append("logo_file", selectedFile);
        } else if (!filePreview) {
          // Explicitly cleared/removed logo
          formData.append("logo_url", "");
        }
      } else {
        formData.append("logo_url", urlInput.trim());
      }

      const res = await updateClient(company.id, formData);
      if (res.data?.success) {
        toast.success(`Logo updated for ${company.organization_name}!`);
        await refreshClients();
        onClose();
      } else {
        toast.error("Failed to update logo");
      }
    } catch (err) {
      console.error("Failed to update logo:", err);
      toast.error("Error updating logo: " + (err?.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const currentPreview = logoMode === "file" ? filePreview : urlInput;

  return (
    <div className="modal-backdrop-custom animate-fadein" onClick={onClose}>
      <div
        className="modal-card-custom logo-modal-card animate-scaleup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-custom-header">
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
            <div className="logo-modal-badge-icon">
              <i className="bi bi-camera-fill" />
            </div>
            <div>
              <h3 className="modal-custom-title" style={{ margin: 0 }}>
                Add or Change Company Logo
              </h3>
              <div style={{ fontSize: ".82rem", color: "var(--text-muted)", marginTop: ".15rem" }}>
                Update branding for <strong>{company.organization_name}</strong> anytime
              </div>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="modal-custom-body" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Live Preview Box */}
          <div className="logo-preview-box">
            <div className="logo-preview-avatar">
              {currentPreview ? (
                <img
                  src={currentPreview}
                  alt={company.organization_name}
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <span className="logo-preview-initials">
                  {company.organization_name?.slice(0, 2).toUpperCase() || "CO"}
                </span>
              )}
            </div>
            <div className="logo-preview-info">
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>
                {company.organization_name}
              </div>
              <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: ".1rem" }}>
                {currentPreview ? "Previewing selected logo" : "No logo set (showing initials)"}
              </div>
              {currentPreview && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="btn-remove-logo-inline"
                  title="Remove logo and use initials"
                >
                  <i className="bi bi-trash3 me-1" /> Remove Logo
                </button>
              )}
            </div>
          </div>

          {/* Mode Switcher: File Upload vs URL */}
          <div className="logo-mode-tabs">
            <button
              type="button"
              className={`logo-mode-tab ${logoMode === "file" ? "active" : ""}`}
              onClick={() => setLogoMode("file")}
            >
              <i className="bi bi-cloud-arrow-up-fill me-1" /> Upload Image File
            </button>
            <button
              type="button"
              className={`logo-mode-tab ${logoMode === "url" ? "active" : ""}`}
              onClick={() => setLogoMode("url")}
            >
              <i className="bi bi-link-45deg me-1" /> Image Web Link (URL)
            </button>
          </div>

          {/* File Upload Mode */}
          {logoMode === "file" && (
            <div className="logo-dropzone" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div className="logo-dropzone-icon">
                <i className="bi bi-images" />
              </div>
              <div style={{ fontWeight: 700, fontSize: ".9rem", color: "var(--text-main)" }}>
                Click to browse or drop company logo image
              </div>
              <div style={{ fontSize: ".76rem", color: "var(--text-muted)", marginTop: ".25rem" }}>
                Supports PNG, SVG, JPG, WebP with transparent or solid background
              </div>
              {selectedFile && (
                <div className="logo-selected-file-chip">
                  <i className="bi bi-check-circle-fill text-success me-1" />
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          )}

          {/* URL Mode */}
          {logoMode === "url" && (
            <div className="modal-field-group">
              <label className="modal-label">Logo Image URL</label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="modal-input"
              />
              <div style={{ fontSize: ".74rem", color: "var(--text-muted)", marginTop: ".25rem" }}>
                Paste any direct image URL. A live preview will show above.
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-custom-footer" style={{ marginTop: ".5rem" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-modal-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-modal-submit"
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" /> Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-1" /> Save Logo
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

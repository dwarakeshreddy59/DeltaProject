import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { fetchClients } from "../services/api";

const DEFAULT_NOMENCLATURE = {
  invoice_doc_label: "Tax Invoice",
  invoice_num_label: "Invoice Number",
  po_doc_label: "Purchase Order",
  po_num_label: "PO Number",
  remittance_doc_label: "Remittance Advice",
  remittance_num_label: "Remittance Number",
};

const DEFAULT_CLIENT = {
  id: 1,
  client_name: "AGCO Admin",
  organization_name: "AGCO",
  logo_url: "",
  gst_number: "27AAHCD2212P1ZJ",
  pan_number: "AAHCD2212P",
  address: "Flat No 203, 2nd Floor, Lumbni Rockdale Compound, Diamond Block, Somajiguda, Hyderabad, Telangana - 500082",
  point_of_contact: "accounts@agco.com",
  ...DEFAULT_NOMENCLATURE,
};

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const [clients, setClients] = useState([DEFAULT_CLIENT]);
  // activeCompanyId can be null (meaning user is on the Home Company Hub)
  const [activeCompanyId, setActiveCompanyId] = useState(() => {
    const saved = localStorage.getItem("active_company_id");
    return saved ? Number(saved) : null; // default to null so landing page shows Company Hub!
  });
  const [loadingClients, setLoadingClients] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await fetchClients();
      if (res.data?.success && Array.isArray(res.data?.clients) && res.data.clients.length > 0) {
        setClients(res.data.clients);
      }
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const selectCompany = useCallback((id) => {
    const numId = Number(id);
    setActiveCompanyId(numId);
    localStorage.setItem("active_company_id", String(numId));
  }, []);

  const goToHub = useCallback(() => {
    setActiveCompanyId(null);
    localStorage.removeItem("active_company_id");
  }, []);

  const isAtHub = activeCompanyId === null;

  const activeCompany = useMemo(() => {
    if (activeCompanyId === null) return null;
    const found = clients.find((c) => Number(c.id) === Number(activeCompanyId));
    return found || null;
  }, [clients, activeCompanyId]);

  const nomenclature = useMemo(() => {
    if (!activeCompany) return DEFAULT_NOMENCLATURE;
    return {
      invoice_doc_label: activeCompany?.invoice_doc_label || DEFAULT_NOMENCLATURE.invoice_doc_label,
      invoice_num_label: activeCompany?.invoice_num_label || DEFAULT_NOMENCLATURE.invoice_num_label,
      po_doc_label: activeCompany?.po_doc_label || DEFAULT_NOMENCLATURE.po_doc_label,
      po_num_label: activeCompany?.po_num_label || DEFAULT_NOMENCLATURE.po_num_label,
      remittance_doc_label: activeCompany?.remittance_doc_label || DEFAULT_NOMENCLATURE.remittance_doc_label,
      remittance_num_label: activeCompany?.remittance_num_label || DEFAULT_NOMENCLATURE.remittance_num_label,
    };
  }, [activeCompany]);

  const openRegisterModal = () => setIsRegisterModalOpen(true);
  const closeRegisterModal = () => setIsRegisterModalOpen(false);

  const value = {
    clients,
    activeCompany,
    activeCompanyId,
    selectCompany,
    goToHub,
    isAtHub,
    // Backwards-compat aliases
    activeClient: activeCompany || DEFAULT_CLIENT,
    activeClientId: activeCompanyId || 1,
    selectClient: selectCompany,
    nomenclature,
    loadingClients,
    refreshClients: loadClients,
    isRegisterModalOpen,
    openRegisterModal,
    closeRegisterModal,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

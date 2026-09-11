import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { fetchClients } from "../services/api";

export const DEFAULT_NOMENCLATURE = {
  // Invoice Slot
  invoice_doc_label: "Tax Invoice",
  invoice_num_label: "Invoice Number",
  invoice_date_label: "Invoice Date",
  invoice_desc_label: "Description",
  invoice_period_label: "Invoice Period",
  invoice_assessable_label: "Assessable Value",
  invoice_tax_label: "Total Tax",
  invoice_total_label: "Total Invoice Value",

  // PO Slot
  po_doc_label: "Purchase Order",
  po_num_label: "PO Number",
  po_date_label: "PO Date",
  po_desc_label: "Original Description",
  po_validity_label: "PO Validity",
  po_total_label: "Total Amount",

  // Remittance Slot
  remittance_doc_label: "Remittance Advice",
  remittance_num_label: "Remittance Number",
  remittance_date_label: "Remittance Date",
  remittance_gross_label: "Gross Amount",
  remittance_total_label: "Total Gross Amount",
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
  invoices_count: 0,
  total_receivable: 0,
  total_assessable: 0,
  total_tax: 0,
  pos_count: 0,
  total_po_amount: 0,
  remittances_count: 0,
  total_remittance_gross: 0,
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
  const [logoModalCompany, setLogoModalCompany] = useState(null);

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
    const res = {};
    for (const key of Object.keys(DEFAULT_NOMENCLATURE)) {
      res[key] = activeCompany?.[key] || DEFAULT_NOMENCLATURE[key];
    }
    return res;
  }, [activeCompany]);

  const openRegisterModal = () => setIsRegisterModalOpen(true);
  const closeRegisterModal = () => setIsRegisterModalOpen(false);

  const openLogoModal = useCallback((company) => {
    setLogoModalCompany(company || activeCompany || clients[0] || null);
  }, [activeCompany, clients]);

  const closeLogoModal = useCallback(() => {
    setLogoModalCompany(null);
  }, []);

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
    logoModalCompany,
    isLogoModalOpen: Boolean(logoModalCompany),
    openLogoModal,
    closeLogoModal,
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

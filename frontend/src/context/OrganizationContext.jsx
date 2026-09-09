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
  client_name: "Delta Admin",
  organization_name: "Delta IoT Solutions Private Limited",
  logo_url: "",
  gst_number: "27AAHCD2212P1ZJ",
  pan_number: "AAHCD2212P",
  address: "Plot 42, Electronics City Phase 1, Bangalore 560100",
  point_of_contact: "contact@deltaiotsolutions.com",
  ...DEFAULT_NOMENCLATURE,
};

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const [clients, setClients] = useState([DEFAULT_CLIENT]);
  const [activeClientId, setActiveClientId] = useState(() => {
    const saved = localStorage.getItem("active_client_id");
    return saved ? Number(saved) : 1;
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

  const selectClient = useCallback((id) => {
    const numId = Number(id);
    setActiveClientId(numId);
    localStorage.setItem("active_client_id", String(numId));
  }, []);

  const activeClient = useMemo(() => {
    const found = clients.find((c) => Number(c.id) === Number(activeClientId));
    return found || clients[0] || DEFAULT_CLIENT;
  }, [clients, activeClientId]);

  const nomenclature = useMemo(() => {
    return {
      invoice_doc_label: activeClient?.invoice_doc_label || DEFAULT_NOMENCLATURE.invoice_doc_label,
      invoice_num_label: activeClient?.invoice_num_label || DEFAULT_NOMENCLATURE.invoice_num_label,
      po_doc_label: activeClient?.po_doc_label || DEFAULT_NOMENCLATURE.po_doc_label,
      po_num_label: activeClient?.po_num_label || DEFAULT_NOMENCLATURE.po_num_label,
      remittance_doc_label: activeClient?.remittance_doc_label || DEFAULT_NOMENCLATURE.remittance_doc_label,
      remittance_num_label: activeClient?.remittance_num_label || DEFAULT_NOMENCLATURE.remittance_num_label,
    };
  }, [activeClient]);

  const openRegisterModal = () => setIsRegisterModalOpen(true);
  const closeRegisterModal = () => setIsRegisterModalOpen(false);

  const value = {
    clients,
    activeClient,
    activeClientId,
    selectClient,
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

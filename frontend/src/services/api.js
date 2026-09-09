import axios from "axios";

const BASE = "";

/** Upload 3 PDFs + TDS rate */
export const uploadPDFs = (formData) =>
  axios.post(`${BASE}/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

/** Recalculate with new TDS rate */
export const recalculate = (assessable_value, tds_rate, invoice_number) =>
  axios.post(`${BASE}/recalculate`, { assessable_value, tds_rate, invoice_number });

/** All saved records (joined view + individual tables) */
export const fetchHistory = (clientId = null) =>
  axios.get(`${BASE}/records/all`, {
    params: clientId ? { client_id: clientId } : {},
  });

/** Search DB by a specific field value */
export const searchById = (field, query) =>
  axios.get(`${BASE}/search`, { params: { field, q: query } });

/** Client / Organization Management API */
export const fetchClients = () => axios.get(`${BASE}/clients`);

export const fetchClient = (clientId) => axios.get(`${BASE}/clients/${clientId}`);

export const registerClient = (formData) =>
  axios.post(`${BASE}/clients`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateClient = (clientId, formData) =>
  axios.put(`${BASE}/clients/${clientId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteClient = (clientId) =>
  axios.delete(`${BASE}/clients/${clientId}`);

/** Delete an invoice record */
export const deleteInvoice = (invoiceNumber) =>
  axios.delete(`${BASE}/records/invoices/${encodeURIComponent(invoiceNumber)}`);

/** Delete a PO record */
export const deletePO = (poNumber) =>
  axios.delete(`${BASE}/records/pos/${encodeURIComponent(poNumber)}`);

/** Delete a Remittance record */
export const deleteRemittance = (remittanceNumber) =>
  axios.delete(`${BASE}/records/remittances/${encodeURIComponent(remittanceNumber)}`);

/** Delete all records from database */
export const clearAllRecords = () =>
  axios.delete(`${BASE}/records/all`);

/** Excel export URL */
export const exportExcelUrl = () => `${BASE}/export/excel`;


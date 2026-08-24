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
export const fetchHistory = () => axios.get(`${BASE}/records/all`);

/** Search DB by a specific field value */
export const searchById = (field, query) =>
  axios.get(`${BASE}/search`, { params: { field, q: query } });

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

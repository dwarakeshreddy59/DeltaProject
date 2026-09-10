import React, { useState, useEffect, useCallback } from "react";
import { fmt } from "../utils/format";
import { fetchHistory, deleteInvoice, deletePO, deleteRemittance, clearAllRecords, recalculate } from "../services/api";
import { useOrganization } from "../context/OrganizationContext";
import toast from "react-hot-toast";
import PDFViewerModal from "./PDFViewerModal";

const PAGE_SIZE = 10;

export const TDS_SITUATIONS = [
  { value: 0.0,  label: "0% (Nil / Exempt - Sec 197)", shortLabel: "0% (Nil)", badge: "Nil / Exempt", section: "Section 197 (Nil / Non-deduction Exemption)" },
  { value: 0.1,  label: "0.1% (Purchase of Goods - Sec 194Q)", shortLabel: "0.1% (Goods)", badge: "194Q Goods", section: "Section 194Q (Purchase of Goods > ₹50L)" },
  { value: 1.0,  label: "1% (Contractor Ind/HUF - Sec 194C)", shortLabel: "1% (194C Ind)", badge: "194C Ind/HUF", section: "Section 194C (Works Contract - Individual / HUF)" },
  { value: 2.0,  label: "2% (Company Contractor / Tech - Sec 194C/J)", shortLabel: "2% (Standard)", badge: "194C/J Standard", section: "Section 194C (Corporate Contractor) / 194J (Technical Services)" },
  { value: 5.0,  label: "5% (Rent / Commission - Sec 194I/H)", shortLabel: "5% (Rent/Comm)", badge: "194I/H Rent", section: "Section 194I (Rent on Land/Building) / 194H (Commission/Brokerage)" },
  { value: 10.0, label: "10% (Professional Fees - Sec 194J)", shortLabel: "10% (Prof. Fees)", badge: "194J Prof", section: "Section 194J (Professional & Legal Fees / Royalty)" },
];

export function getSectionDescription(rate) {
  const num = Number(rate);
  const match = TDS_SITUATIONS.find((s) => s.value === num);
  if (match) return match.section;
  return `Custom Scenario (${rate}%)`;
}

/**
 * Inline Interactive TDS Selector for Table Cells
 */
export function TableTdsSelector({ rate = 2.0, isUpdating, onSelect }) {
  const [isCustom, setIsCustom] = useState(false);
  const [customVal, setCustomVal] = useState(String(rate));

  const numRate = Number(rate);
  const isKnown = TDS_SITUATIONS.some((s) => s.value === numRate);

  const handleSelect = (e) => {
    const val = e.target.value;
    if (val === "custom") {
      setIsCustom(true);
      setCustomVal(String(rate));
    } else {
      setIsCustom(false);
      onSelect(parseFloat(val));
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const parsed = parseFloat(customVal);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      onSelect(parsed);
      setIsCustom(false);
    } else {
      toast.error("Enter a valid percentage between 0% and 100%");
    }
  };

  if (isCustom) {
    return (
      <form onSubmit={handleCustomSubmit} className="tds-custom-input-wrap">
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={customVal}
          onChange={(e) => setCustomVal(e.target.value)}
          className="tds-inline-input"
          autoFocus
          disabled={isUpdating}
        />
        <span className="tds-pct-symbol">%</span>
        <button type="submit" className="btn-tds-confirm" disabled={isUpdating} title="Apply TDS Rate">
          <i className="bi bi-check" />
        </button>
        <button type="button" className="btn-tds-cancel" onClick={() => setIsCustom(false)} title="Cancel">
          <i className="bi bi-x" />
        </button>
      </form>
    );
  }

  return (
    <div className="tds-selector-inline-wrap">
      <select
        className={`tds-select-inline ${isUpdating ? "updating" : ""}`}
        value={isKnown ? numRate : "custom_active"}
        onChange={handleSelect}
        disabled={isUpdating}
        title="Change TDS Rate according to scenario"
      >
        {TDS_SITUATIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
        {!isKnown && (
          <option value="custom_active">
            Custom ({numRate}%)
          </option>
        )}
        <option value="custom">⚙️ Custom %...</option>
      </select>
      {isUpdating && <span className="spinner-border spinner-border-sm text-primary ms-1" role="status" />}
    </div>
  );
}

/**
 * Calculation Breakdown Modal showing step-by-step waterfall math
 */
export function CalculationBreakdownModal({ record, onClose, onUpdateTds, isUpdating }) {
  if (!record) return null;

  const assessable = Number(record.assessable_value || 0);
  const gstRate = 18.0;
  const gstAmount = Number(record.gst_amount || (assessable * 0.18));
  const totalInv = Number(record.total_invoice_value || (assessable + gstAmount));
  const tdsRate = Number(record.tds_rate ?? 2.0);
  const tdsAmount = Number(record.tds_amount || (assessable * (tdsRate / 100)));
  const receivable = Number(record.receivable || (assessable - tdsAmount + gstAmount));

  return (
    <div className="modal-backdrop-custom animate-fadein" onClick={onClose}>
      <div className="calc-modal-card animate-slideup" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="calc-modal-header">
          <div className="d-flex align-items-center gap-2">
            <div className="calc-modal-badge-icon">
              <i className="bi bi-calculator-fill" />
            </div>
            <div>
              <h5 className="calc-modal-title mb-0">Financial Calculation Breakdown</h5>
              <div className="calc-modal-subtitle">
                Invoice: <strong>{record.invoice_number}</strong>
                {record.po_number && <> · Linked PO: <strong>{record.po_number}</strong></>}
                {record.organization_name && <> · <strong>{record.organization_name}</strong></>}
              </div>
            </div>
          </div>
          <button type="button" className="btn-close-modal" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="calc-modal-body">
          {/* Situation Switcher */}
          <div className="modal-tds-changer">
            <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-1">
              <span className="changer-label">
                <i className="bi bi-sliders me-1" style={{ color: "#A855F7" }} /> Select TDS Situation / Rate:
              </span>
              <span className="current-situation-badge">
                {getSectionDescription(tdsRate)}
              </span>
            </div>
            <div className="tds-situation-chips">
              {TDS_SITUATIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`tds-chip ${tdsRate === s.value ? "active" : ""}`}
                  onClick={() => onUpdateTds(s.value)}
                  disabled={isUpdating}
                  title={s.label}
                >
                  <span className="chip-rate">{s.value}%</span>
                  <span className="chip-tag">{s.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Formula Rule Banner */}
          <div className="calc-rule-box">
            <div className="rule-title">
              <i className="bi bi-info-circle-fill me-1" /> Standard Invoice Deduction Formula
            </div>
            <div className="rule-formula">
              <strong>Net Receivable</strong> = Assessable Value − TDS Deduction + GST (18%)
            </div>
          </div>

          {/* Step-by-Step Waterfall Calculation */}
          <div className="calc-waterfall">
            <div className="waterfall-row plus">
              <div className="wf-left">
                <span className="wf-step">Step 1</span>
                <span className="wf-title">Assessable / Taxable Value</span>
              </div>
              <span className="wf-amount money">+ {fmt(assessable)}</span>
            </div>

            <div className="waterfall-row plus">
              <div className="wf-left">
                <span className="wf-step">Step 2</span>
                <span className="wf-title">Goods & Services Tax (GST @ 18%)</span>
              </div>
              <span className="wf-amount money text-teal">+ {fmt(gstAmount)}</span>
            </div>

            <div className="waterfall-subtotal">
              <span>Total Invoice Value (Assessable + GST)</span>
              <span className="subtotal-val">{fmt(totalInv)}</span>
            </div>

            <div className="waterfall-row minus active-glow">
              <div className="wf-left">
                <span className="wf-step">Step 3</span>
                <div>
                  <span className="wf-title" style={{ color: "var(--danger-red)" }}>TDS Deduction ({tdsRate}%)</span>
                  <div className="wf-desc">
                    {fmt(assessable)} × {tdsRate}% &bull; {getSectionDescription(tdsRate)}
                  </div>
                </div>
              </div>
              <span className="wf-amount" style={{ color: "var(--danger-red)", fontWeight: 800, fontSize: "1.05rem" }}>
                − {fmt(tdsAmount)}
              </span>
            </div>

            {/* Net Receivable Grand Total */}
            <div className="waterfall-result">
              <div>
                <div className="result-label">Net Amount Receivable</div>
                <div className="result-equation">
                  {fmt(assessable)} − {fmt(tdsAmount)} + {fmt(gstAmount)}
                </div>
              </div>
              <div className="result-val">
                ₹ {fmt(receivable)}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="calc-modal-footer">
          <div className="status-note">
            <i className="bi bi-shield-check text-success me-1" />
            PostgreSQL DB automatically synced with selected TDS rate
          </div>
          <button type="button" className="btn-modal-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecordsTab({ refreshTrigger = 0 }) {
  const { clients, activeClient, nomenclature, refreshClients } = useOrganization();

  // Organization filter: defaults to active organization or "" for all
  const [selectedOrgFilter, setSelectedOrgFilter] = useState(() => {
    return activeClient?.id ? String(activeClient.id) : "";
  });

  const [data,        setData]        = useState({ combined: [], invoices: [], purchase_orders: [], remittances: [] });
  const [activeView,  setActiveView]  = useState("invoices"); // default to 1. Invoices
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [sortCol,     setSortCol]     = useState("created_at");
  const [sortDir,     setSortDir]     = useState("desc");
  const [page,        setPage]        = useState(1);
  const [filter,          setFilter]          = useState("");
  const [deletingKey,     setDeletingKey]     = useState(null);
  const [updatingInv,     setUpdatingInv]     = useState(null);
  const [activeCalcModal, setActiveCalcModal] = useState(null);
  const [pdfModal, setPdfModal] = useState({
    isOpen: false,
    docType: "invoice",
    docData: null,
    pdfUrl: null,
    title: null,
  });

  const handleViewRecordPdf = (type, row) => {
    let url = null;
    if (type === "invoice") {
      url = row.pdf_filename ? `/api/documents/${row.pdf_filename}` : (row.invoice_pdf ? `/api/documents/${row.invoice_pdf}` : null);
    } else if (type === "po") {
      url = row.pdf_filename ? `/api/documents/${row.pdf_filename}` : (row.po_pdf ? `/api/documents/${row.po_pdf}` : null);
    } else if (type === "remittance") {
      url = row.pdf_filename ? `/api/documents/${row.pdf_filename}` : (row.remittance_pdf ? `/api/documents/${row.remittance_pdf}` : null);
    }
    setPdfModal({
      isOpen: true,
      docType: type,
      docData: row,
      pdfUrl: url,
      title: null,
    });
  };

  const handleUpdateTdsRate = async (row, newRate) => {
    if (!row?.invoice_number) return;
    const invNum = row.invoice_number;
    setUpdatingInv(invNum);
    try {
      const res = await recalculate(row.assessable_value, newRate, invNum);
      if (res.data?.success) {
        const updated = res.data;
        setData((prev) => {
          const updateItem = (item) => {
            if (item.invoice_number === invNum) {
              return {
                ...item,
                tds_rate: updated.tds_rate,
                tds_amount: updated.tds_amount,
                receivable: updated.receivable,
                gst_amount: updated.gst_amount,
                total_invoice_value: updated.total_invoice_value,
              };
            }
            return item;
          };
          return {
            ...prev,
            invoices: prev.invoices.map(updateItem),
            combined: prev.combined.map(updateItem),
          };
        });

        setActiveCalcModal((prev) => {
          if (prev && prev.invoice_number === invNum) {
            return {
              ...prev,
              tds_rate: updated.tds_rate,
              tds_amount: updated.tds_amount,
              receivable: updated.receivable,
              gst_amount: updated.gst_amount,
              total_invoice_value: updated.total_invoice_value,
            };
          }
          return prev;
        });

        toast.success(
          `Applied ${updated.tds_rate}% TDS to ${invNum}! Net: ₹${fmt(updated.receivable)}`
        );
        if (refreshClients) refreshClients();
      }
    } catch (err) {
      toast.error("Failed to update TDS: " + (err?.response?.data?.detail || err.message));
    } finally {
      setUpdatingInv(null);
    }
  };

  // Sync selected filter with activeClient changes
  useEffect(() => {
    if (activeClient?.id) {
      setSelectedOrgFilter(String(activeClient.id));
    }
  }, [activeClient?.id]);

  const viewOptions = [
    {
      id: "invoices",
      label: `1. ${nomenclature.invoice_doc_label}s`,
      icon: "bi-receipt",
      desc: `${nomenclature.invoice_doc_label}s & Financials`,
    },
    {
      id: "purchase_orders",
      label: `2. ${nomenclature.po_doc_label}s`,
      icon: "bi-file-earmark-text",
      desc: `${nomenclature.po_doc_label}s & Delivery Dates`,
    },
    {
      id: "remittances",
      label: `3. ${nomenclature.remittance_doc_label}s`,
      icon: "bi-cash-stack",
      desc: `${nomenclature.remittance_doc_label}s & Gross Amounts`,
    },
    {
      id: "combined",
      label: "4. Combined Master",
      icon: "bi-table",
      desc: "Full 22-Column Joined Multi-Organization View",
    },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const clientIdParam = selectedOrgFilter ? Number(selectedOrgFilter) : null;
      const res = await fetchHistory(clientIdParam);
      const resData = res.data;
      if (resData.success) {
        setData({
          combined:        resData.combined || resData.records || [],
          invoices:        resData.invoices || [],
          purchase_orders: resData.purchase_orders || [],
          remittances:     resData.remittances || [],
        });
        setPage(1);
      } else {
        setError("Server returned an error");
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Network error";
      setError(msg);
      toast.error("Failed to load: " + msg);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgFilter]);

  useEffect(() => {
    load();
  }, [refreshTrigger, load]);

  // Current list based on active view
  const currentList = data[activeView] || [];

  // Filter
  const filtered = currentList.filter((item) =>
    !filter || Object.values(item).some((v) => String(v ?? "").toLowerCase().includes(filter.toLowerCase()))
  );

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const cmp = String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const Ico = ({ col }) =>
    sortCol !== col ? (
      <i className="bi bi-arrow-down-up ms-1" style={{ opacity: 0.3, fontSize: ".65rem" }} />
    ) : sortDir === "asc" ? (
      <i className="bi bi-sort-up ms-1" style={{ fontSize: ".65rem" }} />
    ) : (
      <i className="bi bi-sort-down ms-1" style={{ fontSize: ".65rem" }} />
    );

  // Delete Handlers
  const handleDeleteInvoice = async (invNum) => {
    if (!invNum || !window.confirm(`Delete ${nomenclature.invoice_doc_label} #${invNum}?`)) return;
    setDeletingKey(invNum);
    try {
      const { data: res } = await deleteInvoice(invNum);
      if (res.success) {
        toast.success(`Deleted #${invNum}`);
        load();
        if (refreshClients) refreshClients();
      }
    } catch (e) { toast.error("Delete failed: " + (e?.response?.data?.detail || e.message)); }
    finally { setDeletingKey(null); }
  };

  const handleDeletePO = async (poNum) => {
    if (!poNum || !window.confirm(`Delete ${nomenclature.po_doc_label} #${poNum}?`)) return;
    setDeletingKey(poNum);
    try {
      const { data: res } = await deletePO(poNum);
      if (res.success) {
        toast.success(`Deleted #${poNum}`);
        load();
        if (refreshClients) refreshClients();
      }
    } catch (e) { toast.error("Delete failed: " + (e?.response?.data?.detail || e.message)); }
    finally { setDeletingKey(null); }
  };

  const handleDeleteRemittance = async (remNum) => {
    if (!remNum || !window.confirm(`Delete ${nomenclature.remittance_doc_label} #${remNum}?`)) return;
    setDeletingKey(remNum);
    try {
      const { data: res } = await deleteRemittance(remNum);
      if (res.success) {
        toast.success(`Deleted #${remNum}`);
        load();
        if (refreshClients) refreshClients();
      }
    } catch (e) { toast.error("Delete failed: " + (e?.response?.data?.detail || e.message)); }
    finally { setDeletingKey(null); }
  };

  const handleClearAll = async () => {
    const totalCount = data.invoices.length + data.purchase_orders.length + data.remittances.length;
    if (!totalCount) return;
    if (!window.confirm("⚠️ WARNING: Delete ALL records from PostgreSQL? This action cannot be undone.")) return;

    setLoading(true);
    try {
      const { data: res } = await clearAllRecords();
      if (res.success) {
        toast.success("All tables cleared in DB");
        load();
        if (refreshClients) refreshClients();
      }
    } catch (e) { toast.error("Clear failed: " + (e?.response?.data?.detail || e.message)); }
    finally { setLoading(false); }
  };

  const activeOrgName = clients.find((c) => String(c.id) === String(selectedOrgFilter))?.organization_name;

  // Cumulative Financial & Extraction Aggregates for Selected Filter Scope
  const totalAssessable = data.invoices.reduce((acc, curr) => acc + Number(curr.assessable_value || 0), 0);
  const totalTax = data.invoices.reduce((acc, curr) => acc + Number(curr.total_tax || 0), 0);
  const totalReceivable = data.invoices.reduce((acc, curr) => acc + Number(curr.receivable || 0), 0);
  const totalPOAmount = data.purchase_orders.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalRemittanceGross = data.remittances.reduce((acc, curr) => acc + Number(curr.gross_amount || 0), 0);

  return (
    <div className="search-wrapper animate-fadein">
      {/* ── Header ── */}
      <div className="search-header">
        <div className="search-title">
          <i className="bi bi-database-fill" />
          Database Records
          <span className="rec-count-badge">
            {data.invoices.length} {nomenclature.invoice_doc_label}s · {data.purchase_orders.length} {nomenclature.po_doc_label}s · {data.remittances.length} {nomenclature.remittance_doc_label}s
          </span>
        </div>

        <div className="search-controls">
          {/* Organization Scope Dropdown Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
            <span style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--text-muted)" }}>
              <i className="bi bi-building me-1" />Org:
            </span>
            <select
              value={selectedOrgFilter}
              onChange={(e) => {
                setSelectedOrgFilter(e.target.value);
                setPage(1);
              }}
              style={{
                background: "var(--bg-card)",
                color: "var(--text-main)",
                border: "1.5px solid var(--border-medium)",
                borderRadius: 8,
                padding: ".4rem .75rem",
                fontSize: ".8rem",
                fontWeight: 700,
                outline: "none",
                cursor: "pointer",
                maxWidth: 220,
              }}
            >
              <option value="">🌐 All Organizations</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  🏢 {c.organization_name}
                </option>
              ))}
            </select>
          </div>

          <div className="search-input-wrap">
            <i className="bi bi-funnel" style={{ color: "#64748b" }} />
            <input
              className="search-input"
              placeholder={`Filter in ${viewOptions.find((v) => v.id === activeView)?.label}...`}
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              style={{
                minWidth: 180,
                background: "var(--bg-card)",
                color: "var(--text-main)",
                fontWeight: 700,
                border: "1.5px solid var(--border-medium)",
              }}
            />
            {filter && (
              <button onClick={() => setFilter("")} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginRight: ".4rem" }}>
                <i className="bi bi-x-circle-fill" />
              </button>
            )}
          </div>

          <button className="btn-refresh" onClick={load} title="Reload DB">
            <i className="bi bi-arrow-clockwise" /> Refresh
          </button>

          <a href="/export/excel" className="btn-nav btn-green" style={{ textDecoration: "none", padding: ".42rem .85rem" }}>
            <i className="bi bi-file-earmark-excel-fill" /> Export Excel
          </a>

          {(data.invoices.length > 0 || data.purchase_orders.length > 0 || data.remittances.length > 0) && (
            <button
              onClick={handleClearAll}
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                borderRadius: 8,
                padding: ".42rem .85rem",
                fontSize: ".78rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: ".35rem",
              }}
              title="Delete all records from PostgreSQL"
            >
              <i className="bi bi-trash3-fill" /> Clear DB
            </button>
          )}
        </div>
      </div>

      {/* ── Total Extractions & Financial Aggregates Strip on Top ── */}
      <div className="records-summary-strip">
        <div className="summary-strip-card">
          <div className="summary-strip-icon" style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}>
            <i className="bi bi-file-earmark-bar-graph-fill" />
          </div>
          <div className="summary-strip-info">
            <span className="summary-strip-label">Total Extractions</span>
            <span className="summary-strip-val">{data.invoices.length} Sets</span>
            <span className="summary-strip-sub">{data.purchase_orders.length} POs · {data.remittances.length} Remittances</span>
          </div>
        </div>

        <div className="summary-strip-card">
          <div className="summary-strip-icon" style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}>
            <i className="bi bi-wallet2" />
          </div>
          <div className="summary-strip-info">
            <span className="summary-strip-label">Total Net Receivable</span>
            <span className="summary-strip-val" style={{ color: "#10b981" }}>{fmt(totalReceivable)}</span>
            <span className="summary-strip-sub">Cumulative Post-TDS / GST</span>
          </div>
        </div>

        <div className="summary-strip-card">
          <div className="summary-strip-icon" style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}>
            <i className="bi bi-calculator" />
          </div>
          <div className="summary-strip-info">
            <span className="summary-strip-label">Total Assessable Value</span>
            <span className="summary-strip-val">{fmt(totalAssessable)}</span>
            <span className="summary-strip-sub">Taxable base amount</span>
          </div>
        </div>

        <div className="summary-strip-card">
          <div className="summary-strip-icon" style={{ background: "linear-gradient(135deg, #EC4899, #BE185D)" }}>
            <i className="bi bi-percent" />
          </div>
          <div className="summary-strip-info">
            <span className="summary-strip-label">Total Tax (18% GST)</span>
            <span className="summary-strip-val">{fmt(totalTax)}</span>
            <span className="summary-strip-sub">CGST + SGST / IGST</span>
          </div>
        </div>

        <div className="summary-strip-card">
          <div className="summary-strip-icon" style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)" }}>
            <i className="bi bi-file-earmark-check-fill" />
          </div>
          <div className="summary-strip-info">
            <span className="summary-strip-label">Total PO Amount</span>
            <span className="summary-strip-val">{fmt(totalPOAmount)}</span>
            <span className="summary-strip-sub">Purchase Orders placed</span>
          </div>
        </div>

        <div className="summary-strip-card">
          <div className="summary-strip-icon" style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}>
            <i className="bi bi-check2-circle" />
          </div>
          <div className="summary-strip-info">
            <span className="summary-strip-label">Total Remittance Cleared</span>
            <span className="summary-strip-val">{fmt(totalRemittanceGross)}</span>
            <span className="summary-strip-sub">Gross payout cleared</span>
          </div>
        </div>
      </div>

      {/* ── 4 Option Sub-Tabs with Dynamic Nomenclature ── */}
      <div style={{ background: "var(--bg-card-subtle)", borderBottom: "1px solid var(--border-subtle)", padding: ".75rem 1.25rem", display: "flex", gap: ".65rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: ".74rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em", marginRight: ".25rem" }}>
          Select View:
        </span>
        {viewOptions.map((opt) => {
          const count = opt.id === "combined" ? data.combined.length : data[opt.id]?.length || 0;
          const isActive = activeView === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => { setActiveView(opt.id); setPage(1); setFilter(""); }}
              style={{
                background: isActive ? "linear-gradient(135deg, #7C3AED, #A855F7)" : "var(--bg-card)",
                color: isActive ? "#ffffff" : "var(--text-main)",
                border: `1.5px solid ${isActive ? "#A855F7" : "var(--border-subtle)"}`,
                borderRadius: 10,
                padding: ".45rem .95rem",
                fontSize: ".82rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: ".5rem",
                transition: "all .2s",
                boxShadow: isActive ? "0 4px 18px rgba(168,85,247,.45)" : "0 1px 3px rgba(0,0,0,.04)",
                transform: isActive ? "translateY(-1px)" : "none",
              }}
            >
              <i className={`bi ${opt.icon}`} style={{ color: isActive ? "#ffffff" : "#A855F7" }} />
              {opt.label}
              <span
                style={{
                  background: isActive ? "rgba(255,255,255,0.25)" : "var(--bg-card-subtle)",
                  color: isActive ? "#ffffff" : "var(--text-muted)",
                  border: isActive ? "1px solid rgba(255,255,255,0.4)" : "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: ".05rem .45rem",
                  fontSize: ".7rem",
                  fontWeight: 800,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Sub-Tab Info Bar ── */}
      <div className="db-verify-bar" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-subtle)" }}>
        <i className="bi bi-info-circle-fill" style={{ color: "#A855F7" }} />
        <span style={{ color: "var(--text-muted)" }}>
          Viewing <strong>{viewOptions.find((v) => v.id === activeView)?.desc}</strong> ({filtered.length} of {currentList.length} records)
          {selectedOrgFilter ? (
            <> filtered for <strong>{activeOrgName || "Selected Organization"}</strong>.</>
          ) : (
            <> across <strong>All Organizations</strong>.</>
          )}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="history-body">
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "1rem 1.25rem", margin: "1rem", color: "#991b1b", display: "flex", gap: ".75rem", alignItems: "center" }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: "1.1rem" }} />
            <div><strong>Error:</strong> {error}</div>
            <button onClick={load} style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: ".4rem .9rem", cursor: "pointer", fontWeight: 700 }}>Retry</button>
          </div>
        )}

        {loading && (
          <div style={{ padding: "2rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer-row" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {!loading && !error && pageData.length === 0 && (
          <div className="empty-state animate-fadein">
            <i className="bi bi-inbox empty-icon" />
            <p style={{ fontWeight: 600 }}>
              {filter
                ? `No records match "${filter}" in ${viewOptions.find((v) => v.id === activeView)?.label}`
                : `No records found in ${viewOptions.find((v) => v.id === activeView)?.label}${selectedOrgFilter ? ` for ${activeOrgName}` : ""}.`}
            </p>
            {filter && (
              <button onClick={() => setFilter("")} className="btn-refresh" style={{ marginTop: ".75rem" }}>
                Clear Filter
              </button>
            )}
          </div>
        )}

        {/* ── 1. INVOICES TABLE (Dynamic Header) ── */}
        {!loading && pageData.length > 0 && activeView === "invoices" && (
          <div className="animate-fadein">
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: 110, textAlign: "center" }}>Action</th>
                    <th onClick={() => handleSort("invoice_number")}>{nomenclature.invoice_num_label} <Ico col="invoice_number" /></th>
                    <th onClick={() => handleSort("invoice_date")}>Invoice Date <Ico col="invoice_date" /></th>
                    <th onClick={() => handleSort("po_number")}>Linked {nomenclature.po_num_label} <Ico col="po_number" /></th>
                    <th onClick={() => handleSort("description")}>Description <Ico col="description" /></th>
                    <th onClick={() => handleSort("invoice_period")}>Period <Ico col="invoice_period" /></th>
                    <th onClick={() => handleSort("assessable_value")}>Assessable Value <Ico col="assessable_value" /></th>
                    <th onClick={() => handleSort("total_tax")}>Tax Amount <Ico col="total_tax" /></th>
                    <th onClick={() => handleSort("total_invoice_value")}>Total Value <Ico col="total_invoice_value" /></th>
                    <th onClick={() => handleSort("gst_amount")}>GST (18%) <Ico col="gst_amount" /></th>
                    <th onClick={() => handleSort("tds_rate")} style={{ minWidth: 155 }}>TDS Rate / Situation <Ico col="tds_rate" /></th>
                    <th onClick={() => handleSort("tds_amount")} style={{ minWidth: 120 }}>TDS Deduction <Ico col="tds_amount" /></th>
                    <th onClick={() => handleSort("receivable")} style={{ minWidth: 165 }}>Net Receivable <Ico col="receivable" /></th>
                    <th onClick={() => handleSort("created_at")}>Saved At <Ico col="created_at" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i} className="animate-fadein" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: ".35rem", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleViewRecordPdf("invoice", r)}
                            className="btn-pdf-pill"
                            title="View Source Invoice PDF"
                          >
                            <i className="bi bi-file-earmark-pdf-fill text-danger" /> PDF
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(r.invoice_number)}
                            disabled={deletingKey === r.invoice_number}
                            className="btn-del-sm"
                            title="Delete record"
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </td>
                      <td><span className="id-badge">{r.invoice_number || "—"}</span></td>
                      <td>{r.invoice_date || "—"}</td>
                      <td><span className="id-badge badge-po">{r.po_number || "—"}</span></td>
                      <td style={{ minWidth: 180, maxWidth: 320, wordBreak: "break-word", whiteSpace: "normal", lineHeight: 1.4 }}>{r.description || "—"}</td>
                      <td>{r.invoice_period || "—"}</td>
                      <td className="money">{fmt(r.assessable_value)}</td>
                      <td className="money">{fmt(r.total_tax)}</td>
                      <td className="money" style={{ fontWeight: 800 }}>{fmt(r.total_invoice_value)}</td>
                      <td className="money">{fmt(r.gst_amount)}</td>
                      <td>
                        <TableTdsSelector
                          rate={r.tds_rate}
                          isUpdating={updatingInv === r.invoice_number}
                          onSelect={(newRate) => handleUpdateTdsRate(r, newRate)}
                        />
                      </td>
                      <td className="tds-cell">
                        <div style={{ fontWeight: 700, color: "var(--danger-red)", whiteSpace: "nowrap" }}>
                          − {fmt(r.tds_amount)}
                        </div>
                        <div className="calc-subtext">
                          {r.tds_rate}% of {fmt(r.assessable_value)}
                        </div>
                      </td>
                      <td className="receivable-cell">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
                          <div>
                            <div style={{ fontWeight: 800, color: "var(--success-green)", fontSize: ".92rem", whiteSpace: "nowrap" }}>
                              {fmt(r.receivable)}
                            </div>
                            <div className="calc-subtext" title="Assessable - TDS + GST">
                              = Base − TDS + GST
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-calc-pill"
                            onClick={() => setActiveCalcModal(r)}
                            title="View Step-by-Step Calculation Breakdown"
                          >
                            <i className="bi bi-calculator-fill me-1" />
                            Calc
                          </button>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-muted)", fontSize: ".72rem", whiteSpace: "nowrap" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationRow page={page} setPage={setPage} totalPages={totalPages} sorted={sorted} />
          </div>
        )}

        {/* ── 2. PURCHASE ORDERS TABLE (Dynamic Header) ── */}
        {!loading && pageData.length > 0 && activeView === "purchase_orders" && (
          <div className="animate-fadein">
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: 110, textAlign: "center" }}>Action</th>
                    <th onClick={() => handleSort("po_number")}>{nomenclature.po_num_label} <Ico col="po_number" /></th>
                    <th onClick={() => handleSort("po_date")}>PO Date <Ico col="po_date" /></th>
                    <th onClick={() => handleSort("description")}>Description <Ico col="description" /></th>
                    <th onClick={() => handleSort("delivery_date")}>PO Validity <Ico col="delivery_date" /></th>
                    <th onClick={() => handleSort("total_amount")}>Total Amount <Ico col="total_amount" /></th>
                    <th onClick={() => handleSort("created_at")}>Saved At <Ico col="created_at" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i} className="animate-fadein" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: ".35rem", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleViewRecordPdf("po", r)}
                            className="btn-pdf-pill"
                            title="View Source PO PDF"
                          >
                            <i className="bi bi-file-earmark-pdf-fill text-danger" /> PDF
                          </button>
                          <button
                            onClick={() => handleDeletePO(r.po_number)}
                            disabled={deletingKey === r.po_number}
                            className="btn-del-sm"
                            title="Delete record"
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </td>
                      <td><span className="id-badge badge-po">{r.po_number || "—"}</span></td>
                      <td>{r.po_date || "—"}</td>
                      <td style={{ minWidth: 200, maxWidth: 350, wordBreak: "break-word", whiteSpace: "normal", lineHeight: 1.4 }}>{r.description || "—"}</td>
                      <td>{r.delivery_date || "—"}</td>
                      <td className="money" style={{ fontWeight: 800, fontSize: ".9rem" }}>{fmt(r.total_amount)}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: ".72rem", whiteSpace: "nowrap" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationRow page={page} setPage={setPage} totalPages={totalPages} sorted={sorted} />
          </div>
        )}

        {/* ── 3. REMITTANCES TABLE (Dynamic Header) ── */}
        {!loading && pageData.length > 0 && activeView === "remittances" && (
          <div className="animate-fadein">
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: 110, textAlign: "center" }}>Action</th>
                    <th onClick={() => handleSort("remittance_number")}>{nomenclature.remittance_num_label} <Ico col="remittance_number" /></th>
                    <th onClick={() => handleSort("remittance_date")}>Remittance Date <Ico col="remittance_date" /></th>
                    <th onClick={() => handleSort("invoice_number")}>Linked {nomenclature.invoice_num_label} <Ico col="invoice_number" /></th>
                    <th onClick={() => handleSort("description")}>Description / Notes <Ico col="description" /></th>
                    <th onClick={() => handleSort("gross_amount")}>Gross Amount <Ico col="gross_amount" /></th>
                    <th onClick={() => handleSort("total_gross_amount")}>Total Gross Amount <Ico col="total_gross_amount" /></th>
                    <th onClick={() => handleSort("created_at")}>Saved At <Ico col="created_at" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i} className="animate-fadein" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: ".35rem", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleViewRecordPdf("remittance", r)}
                            className="btn-pdf-pill"
                            title="View Source Remittance PDF"
                          >
                            <i className="bi bi-file-earmark-pdf-fill text-danger" /> PDF
                          </button>
                          <button
                            onClick={() => handleDeleteRemittance(r.remittance_number)}
                            disabled={deletingKey === r.remittance_number}
                            className="btn-del-sm"
                            title="Delete record"
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </td>
                      <td><span className="id-badge badge-remit">{r.remittance_number || "—"}</span></td>
                      <td>{r.remittance_date || "—"}</td>
                      <td><span className="id-badge">{r.invoice_number || "—"}</span></td>
                      <td style={{ minWidth: 200, maxWidth: 350, wordBreak: "break-word", whiteSpace: "normal", lineHeight: 1.4 }}>{r.description || "—"}</td>
                      <td className="money" style={{ fontWeight: 800 }}>{fmt(r.gross_amount)}</td>
                      <td className="money">{fmt(r.total_gross_amount)}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: ".72rem", whiteSpace: "nowrap" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationRow page={page} setPage={setPage} totalPages={totalPages} sorted={sorted} />
          </div>
        )}

        {/* ── 4. COMBINED MASTER VIEW (Dynamic Headers & Organization Column) ── */}
        {!loading && pageData.length > 0 && activeView === "combined" && (
          <div className="animate-fadein">
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: 175, textAlign: "center" }}>Action / PDFs</th>
                    <th>Organization</th>
                    <th onClick={() => handleSort("invoice_number")}>{nomenclature.invoice_num_label} <Ico col="invoice_number" /></th>
                    <th onClick={() => handleSort("invoice_date")}>Invoice Date <Ico col="invoice_date" /></th>
                    <th onClick={() => handleSort("inv_description")}>Description <Ico col="inv_description" /></th>
                    <th onClick={() => handleSort("invoice_period")}>Period <Ico col="invoice_period" /></th>
                    <th onClick={() => handleSort("assessable_value")}>Assessable <Ico col="assessable_value" /></th>
                    <th onClick={() => handleSort("gst_amount")}>GST 18% <Ico col="gst_amount" /></th>
                    <th onClick={() => handleSort("total_invoice_value")}>Total Inv. <Ico col="total_invoice_value" /></th>
                    <th onClick={() => handleSort("tds_rate")} style={{ minWidth: 155 }}>TDS Rate / Situation <Ico col="tds_rate" /></th>
                    <th onClick={() => handleSort("tds_amount")} style={{ minWidth: 120 }}>TDS Deduction <Ico col="tds_amount" /></th>
                    <th onClick={() => handleSort("receivable")} style={{ minWidth: 165 }}>Net Receivable <Ico col="receivable" /></th>
                    <th onClick={() => handleSort("po_number")}>{nomenclature.po_num_label} <Ico col="po_number" /></th>
                    <th onClick={() => handleSort("po_date")}>PO Date <Ico col="po_date" /></th>
                    <th onClick={() => handleSort("delivery_date")}>PO Validity <Ico col="delivery_date" /></th>
                    <th onClick={() => handleSort("total_amount")}>PO Total <Ico col="total_amount" /></th>
                    <th onClick={() => handleSort("remittance_number")}>{nomenclature.remittance_num_label} <Ico col="remittance_number" /></th>
                    <th onClick={() => handleSort("remittance_date")}>Remittance Date <Ico col="remittance_date" /></th>
                    <th onClick={() => handleSort("gross_amount")}>Gross Amt <Ico col="gross_amount" /></th>
                    <th onClick={() => handleSort("total_gross_amount")}>Total Gross <Ico col="total_gross_amount" /></th>
                    <th onClick={() => handleSort("created_at")}>Saved At <Ico col="created_at" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i} className="animate-fadein" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: ".25rem", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => handleViewRecordPdf("invoice", r)}
                            className="btn-pdf-pill"
                            title={`View Source ${nomenclature.invoice_doc_label} PDF`}
                          >
                            <i className="bi bi-file-earmark-pdf" /> Inv
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewRecordPdf("po", r)}
                            className="btn-pdf-pill"
                            title={`View Source ${nomenclature.po_doc_label} PDF`}
                          >
                            <i className="bi bi-file-earmark-pdf" /> PO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewRecordPdf("remittance", r)}
                            className="btn-pdf-pill"
                            title={`View Source ${nomenclature.remittance_doc_label} PDF`}
                          >
                            <i className="bi bi-file-earmark-pdf" /> Rem
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(r.invoice_number)}
                            disabled={deletingKey === r.invoice_number}
                            className="btn-del-sm"
                            title="Delete"
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: ".3rem",
                            fontSize: ".75rem",
                            fontWeight: 700,
                            color: "var(--purple-violet)",
                            background: "rgba(168, 85, 247, 0.12)",
                            padding: ".2rem .55rem",
                            borderRadius: 6,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <i className="bi bi-building" />
                          {r.organization_name || "AGCO"}
                        </span>
                      </td>
                      <td><span className="id-badge">{r.invoice_number || "—"}</span></td>
                      <td>{r.invoice_date || "—"}</td>
                      <td style={{ minWidth: 180, maxWidth: 350, wordBreak: "break-word", whiteSpace: "normal", lineHeight: 1.4 }}>{r.inv_description || r.po_description || r.rem_description || "—"}</td>
                      <td>{r.invoice_period || "—"}</td>
                      <td className="money">{fmt(r.assessable_value)}</td>
                      <td className="money">{fmt(r.gst_amount)}</td>
                      <td className="money">{fmt(r.total_invoice_value)}</td>
                      <td>
                        <TableTdsSelector
                          rate={r.tds_rate}
                          isUpdating={updatingInv === r.invoice_number}
                          onSelect={(newRate) => handleUpdateTdsRate(r, newRate)}
                        />
                      </td>
                      <td className="tds-cell">
                        <div style={{ fontWeight: 700, color: "var(--danger-red)", whiteSpace: "nowrap" }}>
                          − {fmt(r.tds_amount)}
                        </div>
                        <div className="calc-subtext">
                          {r.tds_rate}% of {fmt(r.assessable_value)}
                        </div>
                      </td>
                      <td className="receivable-cell" style={{ fontWeight: 800 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
                          <div>
                            <div style={{ color: "var(--success-green)", fontSize: ".92rem", whiteSpace: "nowrap" }}>
                              {fmt(r.receivable)}
                            </div>
                            <div className="calc-subtext" title="Assessable - TDS + GST">
                              = Base − TDS + GST
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-calc-pill"
                            onClick={() => setActiveCalcModal(r)}
                            title="View Step-by-Step Calculation Breakdown"
                          >
                            <i className="bi bi-calculator-fill me-1" />
                            Calc
                          </button>
                        </div>
                      </td>
                      <td><span className="id-badge badge-po">{r.po_number || "—"}</span></td>
                      <td>{r.po_date || "—"}</td>
                      <td>{r.delivery_date || "—"}</td>
                      <td className="money">{fmt(r.total_amount)}</td>
                      <td><span className="id-badge badge-remit">{r.remittance_number || "—"}</span></td>
                      <td>{r.remittance_date || "—"}</td>
                      <td className="money">{fmt(r.gross_amount)}</td>
                      <td className="money">{fmt(r.total_gross_amount)}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: ".72rem", whiteSpace: "nowrap" }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString("en-IN") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationRow page={page} setPage={setPage} totalPages={totalPages} sorted={sorted} />
          </div>
        )}
      </div>

      {/* ── Calculation Breakdown Modal ── */}
      {activeCalcModal && (
        <CalculationBreakdownModal
          record={activeCalcModal}
          onClose={() => setActiveCalcModal(null)}
          onUpdateTds={(newRate) => handleUpdateTdsRate(activeCalcModal, newRate)}
          isUpdating={updatingInv === activeCalcModal.invoice_number}
        />
      )}

      {/* ── Interactive PDF Document Viewer Modal ── */}
      <PDFViewerModal
        isOpen={pdfModal.isOpen}
        onClose={() => setPdfModal((prev) => ({ ...prev, isOpen: false }))}
        docType={pdfModal.docType}
        docData={pdfModal.docData}
        pdfUrl={pdfModal.pdfUrl}
        title={pdfModal.title}
      />
    </div>
  );
}

function PaginationRow({ page, setPage, totalPages, sorted }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-row">
      <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} record(s)</span>
      <div className="page-btns">
        <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
        <button className="page-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
        {Array.from({ length: Math.min(7, totalPages) }, (_, idx) => {
          const pg = Math.max(1, Math.min(page - 3, totalPages - 6)) + idx;
          return (
            <button key={pg} className={`page-btn ${pg === page ? "active" : ""}`} onClick={() => setPage(pg)}>
              {pg}
            </button>
          );
        })}
        <button className="page-btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
        <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
      </div>
    </div>
  );
}

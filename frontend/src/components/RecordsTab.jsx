import React, { useState, useEffect, useCallback } from "react";
import { fmt } from "../utils/format";
import { fetchHistory, deleteInvoice, deletePO, deleteRemittance, clearAllRecords } from "../services/api";
import { useOrganization } from "../context/OrganizationContext";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

export default function RecordsTab({ refreshTrigger = 0 }) {
  const { clients, activeClient, nomenclature } = useOrganization();

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
  const [filter,      setFilter]      = useState("");
  const [deletingKey, setDeletingKey] = useState(null);

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
      if (res.success) { toast.success(`Deleted #${invNum}`); load(); }
    } catch (e) { toast.error("Delete failed: " + (e?.response?.data?.detail || e.message)); }
    finally { setDeletingKey(null); }
  };

  const handleDeletePO = async (poNum) => {
    if (!poNum || !window.confirm(`Delete ${nomenclature.po_doc_label} #${poNum}?`)) return;
    setDeletingKey(poNum);
    try {
      const { data: res } = await deletePO(poNum);
      if (res.success) { toast.success(`Deleted #${poNum}`); load(); }
    } catch (e) { toast.error("Delete failed: " + (e?.response?.data?.detail || e.message)); }
    finally { setDeletingKey(null); }
  };

  const handleDeleteRemittance = async (remNum) => {
    if (!remNum || !window.confirm(`Delete ${nomenclature.remittance_doc_label} #${remNum}?`)) return;
    setDeletingKey(remNum);
    try {
      const { data: res } = await deleteRemittance(remNum);
      if (res.success) { toast.success(`Deleted #${remNum}`); load(); }
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
      if (res.success) { toast.success("All tables cleared in DB"); load(); }
    } catch (e) { toast.error("Clear failed: " + (e?.response?.data?.detail || e.message)); }
    finally { setLoading(false); }
  };

  const activeOrgName = clients.find((c) => String(c.id) === String(selectedOrgFilter))?.organization_name;

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
                    <th style={{ width: 70, textAlign: "center" }}>Action</th>
                    <th onClick={() => handleSort("invoice_number")}>{nomenclature.invoice_num_label} <Ico col="invoice_number" /></th>
                    <th onClick={() => handleSort("invoice_date")}>Date <Ico col="invoice_date" /></th>
                    <th onClick={() => handleSort("po_number")}>Linked {nomenclature.po_num_label} <Ico col="po_number" /></th>
                    <th onClick={() => handleSort("description")}>Description <Ico col="description" /></th>
                    <th onClick={() => handleSort("invoice_period")}>Period <Ico col="invoice_period" /></th>
                    <th onClick={() => handleSort("assessable_value")}>Assessable Value <Ico col="assessable_value" /></th>
                    <th onClick={() => handleSort("total_tax")}>Tax Amount <Ico col="total_tax" /></th>
                    <th onClick={() => handleSort("total_invoice_value")}>Total Value <Ico col="total_invoice_value" /></th>
                    <th onClick={() => handleSort("gst_amount")}>GST (18%) <Ico col="gst_amount" /></th>
                    <th onClick={() => handleSort("tds_rate")}>TDS% <Ico col="tds_rate" /></th>
                    <th onClick={() => handleSort("tds_amount")}>TDS Amount <Ico col="tds_amount" /></th>
                    <th onClick={() => handleSort("receivable")}>Net Receivable <Ico col="receivable" /></th>
                    <th onClick={() => handleSort("created_at")}>Saved At <Ico col="created_at" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i} className="animate-fadein" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => handleDeleteInvoice(r.invoice_number)}
                          disabled={deletingKey === r.invoice_number}
                          className="btn-del-sm"
                        >
                          <i className="bi bi-trash3" /> Delete
                        </button>
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
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{r.tds_rate}%</td>
                      <td className="tds-cell">{fmt(r.tds_amount)}</td>
                      <td className="receivable-cell">{fmt(r.receivable)}</td>
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
                    <th style={{ width: 70, textAlign: "center" }}>Action</th>
                    <th onClick={() => handleSort("po_number")}>{nomenclature.po_num_label} <Ico col="po_number" /></th>
                    <th onClick={() => handleSort("po_date")}>Date <Ico col="po_date" /></th>
                    <th onClick={() => handleSort("description")}>Description <Ico col="description" /></th>
                    <th onClick={() => handleSort("delivery_date")}>Delivery Date / Validity <Ico col="delivery_date" /></th>
                    <th onClick={() => handleSort("total_amount")}>Total Amount <Ico col="total_amount" /></th>
                    <th onClick={() => handleSort("created_at")}>Saved At <Ico col="created_at" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i} className="animate-fadein" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => handleDeletePO(r.po_number)}
                          disabled={deletingKey === r.po_number}
                          className="btn-del-sm"
                        >
                          <i className="bi bi-trash3" /> Delete
                        </button>
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
                    <th style={{ width: 70, textAlign: "center" }}>Action</th>
                    <th onClick={() => handleSort("remittance_number")}>{nomenclature.remittance_num_label} <Ico col="remittance_number" /></th>
                    <th onClick={() => handleSort("remittance_date")}>Payment Date <Ico col="remittance_date" /></th>
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
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => handleDeleteRemittance(r.remittance_number)}
                          disabled={deletingKey === r.remittance_number}
                          className="btn-del-sm"
                        >
                          <i className="bi bi-trash3" /> Delete
                        </button>
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
                    <th style={{ width: 70, textAlign: "center" }}>Action</th>
                    <th>Organization</th>
                    <th onClick={() => handleSort("invoice_number")}>{nomenclature.invoice_num_label} <Ico col="invoice_number" /></th>
                    <th onClick={() => handleSort("invoice_date")}>Inv. Date <Ico col="invoice_date" /></th>
                    <th onClick={() => handleSort("inv_description")}>Description <Ico col="inv_description" /></th>
                    <th onClick={() => handleSort("invoice_period")}>Period <Ico col="invoice_period" /></th>
                    <th onClick={() => handleSort("assessable_value")}>Assessable <Ico col="assessable_value" /></th>
                    <th onClick={() => handleSort("gst_amount")}>GST 18% <Ico col="gst_amount" /></th>
                    <th onClick={() => handleSort("total_invoice_value")}>Total Inv. <Ico col="total_invoice_value" /></th>
                    <th onClick={() => handleSort("tds_rate")}>TDS% <Ico col="tds_rate" /></th>
                    <th onClick={() => handleSort("tds_amount")}>TDS Amt <Ico col="tds_amount" /></th>
                    <th onClick={() => handleSort("receivable")}>Receivable <Ico col="receivable" /></th>
                    <th onClick={() => handleSort("po_number")}>{nomenclature.po_num_label} <Ico col="po_number" /></th>
                    <th onClick={() => handleSort("po_date")}>PO Date <Ico col="po_date" /></th>
                    <th onClick={() => handleSort("delivery_date")}>Delivery <Ico col="delivery_date" /></th>
                    <th onClick={() => handleSort("total_amount")}>PO Total <Ico col="total_amount" /></th>
                    <th onClick={() => handleSort("remittance_number")}>{nomenclature.remittance_num_label} <Ico col="remittance_number" /></th>
                    <th onClick={() => handleSort("remittance_date")}>Rem. Date <Ico col="remittance_date" /></th>
                    <th onClick={() => handleSort("gross_amount")}>Gross Amt <Ico col="gross_amount" /></th>
                    <th onClick={() => handleSort("total_gross_amount")}>Total Gross <Ico col="total_gross_amount" /></th>
                    <th onClick={() => handleSort("created_at")}>Saved At <Ico col="created_at" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i} className="animate-fadein" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => handleDeleteInvoice(r.invoice_number)}
                          disabled={deletingKey === r.invoice_number}
                          className="btn-del-sm"
                        >
                          <i className="bi bi-trash3" /> Delete
                        </button>
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
                          {r.organization_name || "Delta IoT Solutions"}
                        </span>
                      </td>
                      <td><span className="id-badge">{r.invoice_number || "—"}</span></td>
                      <td>{r.invoice_date || "—"}</td>
                      <td style={{ minWidth: 180, maxWidth: 350, wordBreak: "break-word", whiteSpace: "normal", lineHeight: 1.4 }}>{r.inv_description || r.po_description || r.rem_description || "—"}</td>
                      <td>{r.invoice_period || "—"}</td>
                      <td className="money">{fmt(r.assessable_value)}</td>
                      <td className="money">{fmt(r.gst_amount)}</td>
                      <td className="money">{fmt(r.total_invoice_value)}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{r.tds_rate}%</td>
                      <td className="tds-cell">{fmt(r.tds_amount)}</td>
                      <td className="receivable-cell" style={{ fontWeight: 800 }}>{fmt(r.receivable)}</td>
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

import React, { useState, useEffect, useCallback } from "react";
import { fmt } from "../utils/format";
import { fetchHistory, searchById } from "../services/api";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

const SEARCH_FIELDS = [
  { label: "All Fields",         value: "all" },
  { label: "Invoice No.",        value: "invoice_number" },
  { label: "PO No.",             value: "po_number" },
  { label: "Remittance No.",     value: "remittance_number" },
  { label: "Invoice Date",       value: "invoice_date" },
  { label: "PO Date",            value: "po_date" },
];

export default function SearchPanel({ visible = true, refreshTrigger = 0 }) {
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [query,      setQuery]      = useState("");
  const [searchType, setSearchType] = useState("all");
  const [sortCol,    setSortCol]    = useState("created_at");
  const [sortDir,    setSortDir]    = useState("desc");
  const [page,       setPage]       = useState(1);
  const [totalDb,    setTotalDb]    = useState(0);

  // ── Load from DB ────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchHistory();
      if (data.success) {
        setRecords(data.records || []);
        setTotalDb(data.total || 0);
        setPage(1);
      }
    } catch {
      toast.error("Failed to load records from DB");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (visible) load(); }, [visible, refreshTrigger, load]);

  // ── Server-side search by ID ─────────────────────────────
  const handleSearch = async () => {
    if (!query.trim()) { load(); return; }
    setLoading(true);
    try {
      const { data } = await searchById(searchType, query.trim());
      if (data.success) {
        setRecords(data.records || []);
        setTotalDb(data.total || 0);
        setPage(1);
        if (data.total === 0) toast("No records found for that search.", { icon: "🔍" });
        else toast.success(`Found ${data.total} record(s)`);
      }
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => { setQuery(""); setSearchType("all"); load(); };

  // ── Client-side sort ─────────────────────────────────────
  const sorted = [...records].sort((a, b) => {
    const av = a[sortCol] ?? "";
    const bv = b[sortCol] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }) =>
    sortCol !== col
      ? <i className="bi bi-arrow-down-up ms-1" style={{ opacity: .3, fontSize: ".7rem" }} />
      : sortDir === "asc"
        ? <i className="bi bi-sort-up ms-1" style={{ fontSize: ".7rem" }} />
        : <i className="bi bi-sort-down ms-1" style={{ fontSize: ".7rem" }} />;

  if (!visible) return null;

  return (
    <div className="search-wrapper">
      {/* ── Header ── */}
      <div className="search-header">
        <div className="search-title">
          <i className="bi bi-database-fill" />
          All Extracted Records
          <span style={{ background: "rgba(255,255,255,.15)", borderRadius: 20, padding: ".1rem .6rem", fontSize: ".72rem", fontWeight: 700 }}>
            {totalDb} stored in DB
          </span>
        </div>

        <div className="search-controls">
          {/* Field Selector */}
          <select
            className="search-type-select"
            value={searchType}
            onChange={e => setSearchType(e.target.value)}
            title="Search field"
          >
            {SEARCH_FIELDS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* Search Input */}
          <div className="search-input-wrap">
            <i className="bi bi-search" />
            <input
              className="search-input"
              placeholder={searchType === "all" ? "Search all fields..." : `Search by ${SEARCH_FIELDS.find(f=>f.value===searchType)?.label}...`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
          </div>

          {/* Search Button */}
          <button className="btn-search" onClick={handleSearch}>
            <i className="bi bi-search" />Search
          </button>

          {/* Clear */}
          {query && (
            <button className="btn-refresh" onClick={handleClear} title="Clear search">
              <i className="bi bi-x-lg" /> Clear
            </button>
          )}

          {/* Refresh */}
          <button className="btn-refresh" onClick={load} title="Reload all from DB">
            <i className="bi bi-arrow-clockwise" />
          </button>

          {/* Export Excel */}
          <a href="/export/excel" className="btn-nav btn-green" style={{ textDecoration: "none", padding: ".42rem .85rem" }}>
            <i className="bi bi-file-earmark-excel-fill" />Export Excel
          </a>
        </div>
      </div>

      {/* ── Quick ID Search Pills ── */}
      <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: ".65rem 1.25rem", display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: ".72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" }}>
          Quick Search:
        </span>
        {["invoice_number", "po_number", "remittance_number"].map(f => (
          <button
            key={f}
            onClick={() => setSearchType(f)}
            style={{
              background: searchType === f ? "#eff6ff" : "#fff",
              border: `1.5px solid ${searchType === f ? "#93c5fd" : "#e2e8f0"}`,
              color: searchType === f ? "#1d4ed8" : "#64748b",
              borderRadius: 7,
              padding: ".25rem .65rem",
              fontSize: ".73rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            <i className={`bi ${f === "invoice_number" ? "bi-receipt" : f === "po_number" ? "bi-file-text" : "bi-cash-stack"} me-1`} />
            {SEARCH_FIELDS.find(s => s.value === f)?.label}
          </button>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="history-body">
        {loading ? (
          <div className="loading-overlay">
            <div className="spinner-ring" />
            <p style={{ color: "#64748b", fontSize: ".85rem" }}>Loading from PostgreSQL...</p>
          </div>
        ) : pageData.length === 0 ? (
          <div className="empty-state">
            <i className="bi bi-inbox empty-icon" />
            <p style={{ fontWeight: 600 }}>
              {query ? `No records match "${query}"` : "No records in DB yet. Upload your first PDFs!"}
            </p>
            {query && (
              <button onClick={handleClear} style={{ marginTop: ".75rem", background: "var(--blue)", color: "#fff", border: "none", borderRadius: 8, padding: ".45rem 1rem", cursor: "pointer", fontSize: ".82rem" }}>
                Clear Search & Show All
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Result Info */}
            {query && (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: ".55rem 1rem", marginBottom: ".85rem", fontSize: ".8rem", color: "#1d4ed8", display: "flex", alignItems: "center", gap: ".5rem" }}>
                <i className="bi bi-search" />
                Showing <strong>{records.length}</strong> result(s) for <strong>"{query}"</strong> in <strong>{SEARCH_FIELDS.find(f => f.value === searchType)?.label}</strong>
                <button onClick={handleClear} style={{ marginLeft: "auto", background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", fontWeight: 600, fontSize: ".78rem" }}>
                  Clear &times;
                </button>
              </div>
            )}

            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort("invoice_number")}>Invoice No. <SortIcon col="invoice_number" /></th>
                    <th onClick={() => handleSort("invoice_date")}>Inv. Date <SortIcon col="invoice_date" /></th>
                    <th onClick={() => handleSort("inv_description")}>Description <SortIcon col="inv_description" /></th>
                    <th onClick={() => handleSort("invoice_period")}>Period <SortIcon col="invoice_period" /></th>
                    <th onClick={() => handleSort("assessable_value")}>Assessable <SortIcon col="assessable_value" /></th>
                    <th onClick={() => handleSort("gst_amount")}>GST (18%) <SortIcon col="gst_amount" /></th>
                    <th onClick={() => handleSort("total_invoice_value")}>Total Inv. <SortIcon col="total_invoice_value" /></th>
                    <th onClick={() => handleSort("tds_rate")}>TDS% <SortIcon col="tds_rate" /></th>
                    <th onClick={() => handleSort("tds_amount")}>TDS Amt <SortIcon col="tds_amount" /></th>
                    <th onClick={() => handleSort("receivable")}>Receivable <SortIcon col="receivable" /></th>
                    <th onClick={() => handleSort("po_number")}>PO No. <SortIcon col="po_number" /></th>
                    <th onClick={() => handleSort("po_date")}>PO Date <SortIcon col="po_date" /></th>
                    <th onClick={() => handleSort("delivery_date")}>Delivery Date <SortIcon col="delivery_date" /></th>
                    <th onClick={() => handleSort("total_amount")}>PO Total <SortIcon col="total_amount" /></th>
                    <th onClick={() => handleSort("remittance_number")}>Remittance No. <SortIcon col="remittance_number" /></th>
                    <th onClick={() => handleSort("remittance_date")}>Rem. Date <SortIcon col="remittance_date" /></th>
                    <th onClick={() => handleSort("gross_amount")}>Gross Amt <SortIcon col="gross_amount" /></th>
                    <th onClick={() => handleSort("total_gross_amount")}>Total Gross <SortIcon col="total_gross_amount" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i}>
                      <td><span className="id-badge">{r.invoice_number || "—"}</span></td>
                      <td>{r.invoice_date || "—"}</td>
                      <td style={{ minWidth: 180, maxWidth: 350, wordBreak: "break-word", whiteSpace: "normal", lineHeight: 1.4 }}>{r.inv_description || "—"}</td>
                      <td>{r.invoice_period || "—"}</td>
                      <td className="money">{fmt(r.assessable_value)}</td>
                      <td className="money">{fmt(r.gst_amount)}</td>
                      <td className="money">{fmt(r.total_invoice_value)}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{r.tds_rate}%</td>
                      <td className="tds-cell">{fmt(r.tds_amount)}</td>
                      <td className="receivable-cell">{fmt(r.receivable)}</td>
                      <td><span className="id-badge" style={{ background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" }}>{r.po_number || "—"}</span></td>
                      <td>{r.po_date || "—"}</td>
                      <td>{r.delivery_date || "—"}</td>
                      <td className="money">{fmt(r.total_amount)}</td>
                      <td><span className="id-badge" style={{ background: "#f0fdf4", color: "#065f46", borderColor: "#a7f3d0" }}>{r.remittance_number || "—"}</span></td>
                      <td>{r.remittance_date || "—"}</td>
                      <td className="money">{fmt(r.gross_amount)}</td>
                      <td className="money">{fmt(r.total_gross_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination-row">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} record(s)
                {query && ` (searched ${totalDb} total in DB)`}
              </span>
              <div className="page-btns">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + idx;
                  return (
                    <button key={pg} className={`page-btn ${pg === page ? "active" : ""}`} onClick={() => setPage(pg)}>{pg}</button>
                  );
                })}
                <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { fmt } from "../utils/format";
import { searchById, deleteInvoice } from "../services/api";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

const FIELDS = [
  { label: "All Fields",         value: "all",               icon: "bi-search" },
  { label: "Invoice No.",        value: "invoice_number",    icon: "bi-receipt" },
  { label: "PO No.",             value: "po_number",         icon: "bi-file-earmark-text" },
  { label: "Remittance No.",     value: "remittance_number", icon: "bi-cash-stack" },
  { label: "Description",        value: "description",       icon: "bi-card-text" },
  { label: "Invoice Date",       value: "invoice_date",      icon: "bi-calendar3" },
  { label: "PO Date",            value: "po_date",           icon: "bi-calendar-event" },
];

export default function SearchTab() {
  const [query,      setQuery]      = useState("");
  const [field,      setField]      = useState("all");
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [page,       setPage]       = useState(1);
  const [sortCol,    setSortCol]    = useState("created_at");
  const [sortDir,    setSortDir]    = useState("desc");
  const [deletingId, setDeletingId] = useState(null);

  const handleSearch = async (overrideQ, overrideField) => {
    const q = overrideQ !== undefined ? overrideQ : query;
    const f = overrideField !== undefined ? overrideField : field;
    if (!q.trim()) {
      toast("Please enter a keyword or ID to search.", { icon: "💡" });
      return;
    }
    setLoading(true);
    try {
      const { data } = await searchById(f, q.trim());
      if (data.success) {
        setRecords(data.records || []);
        setSearched(true);
        setPage(1);
        if (data.total === 0) {
          toast("No matching records found.", { icon: "🔍" });
        } else {
          toast.success(`Found ${data.total} record(s) matching "${q.trim()}"`);
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || "Search failed";
      toast.error("Search failed: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    setRecords([]);
    setSearched(false);
    setPage(1);
  };

  const handleCopy = (text, label) => {
    if (!text || text === "—") return;
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}: ${text}`);
  };

  const handleDelete = async (invNum) => {
    if (!invNum || !window.confirm(`Are you sure you want to delete invoice #${invNum} and linked data?`)) return;
    setDeletingId(invNum);
    try {
      const { data } = await deleteInvoice(invNum);
      if (data.success) {
        toast.success(`Invoice #${invNum} deleted.`);
        setRecords((prev) => prev.filter((r) => r.invoice_number !== invNum));
      }
    } catch (e) {
      toast.error("Delete failed: " + (e?.response?.data?.detail || e.message));
    } finally {
      setDeletingId(null);
    }
  };

  // Sort
  const sorted = [...records].sort((a, b) => {
    const valA = String(a[sortCol] ?? "");
    const valB = String(b[sortCol] ?? "");
    const cmp = valA.localeCompare(valB, undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData   = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <i className="bi bi-arrow-down-up ms-1" style={{ opacity: 0.3, fontSize: ".65rem" }} />;
    return sortDir === "asc" ? (
      <i className="bi bi-sort-up ms-1" style={{ fontSize: ".7rem", color: "#38bdf8" }} />
    ) : (
      <i className="bi bi-sort-down ms-1" style={{ fontSize: ".7rem", color: "#38bdf8" }} />
    );
  };

  return (
    <div className="search-wrapper animate-fadein">
      {/* ── Search Header ── */}
      <div className="search-header" style={{ background: "linear-gradient(135deg, #181033 0%, #24134d 50%, #361775 100%)", borderBottom: "2px solid #7C3AED" }}>
        <div className="search-title" style={{ color: "#ffffff" }}>
          <i className="bi bi-search-heart-fill" style={{ color: "#A855F7" }} />
          Smart Database Search &amp; Discovery
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: ".65rem" }}>
          <a href="/export/excel" className="btn-nav btn-green" style={{ textDecoration: "none", padding: ".4rem .85rem", fontSize: ".78rem" }}>
            <i className="bi bi-file-earmark-excel-fill" /> Export All to Excel
          </a>
        </div>
      </div>

      {/* ── Search Controls Panel ── */}
      <div style={{ padding: "1.75rem", background: "var(--bg-card)", borderBottom: "1px solid var(--border-subtle)" }}>
        {/* Quick field selector pills */}
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
          <span style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em", marginRight: ".3rem" }}>
            Search Target:
          </span>
          {FIELDS.map((f) => {
            const isSelected = field === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setField(f.value)}
                style={{
                  background: isSelected ? "linear-gradient(135deg, #7C3AED, #A855F7)" : "var(--bg-card-subtle)",
                  color: isSelected ? "#ffffff" : "var(--text-main)",
                  border: `1.5px solid ${isSelected ? "#A855F7" : "var(--border-subtle)"}`,
                  borderRadius: 10,
                  padding: ".45rem .95rem",
                  fontSize: ".82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all .2s cubic-bezier(0.16,1,0.3,1)",
                  display: "flex",
                  alignItems: "center",
                  gap: ".45rem",
                  boxShadow: isSelected ? "0 0 16px rgba(168, 85, 247, 0.45)" : "none",
                  transform: isSelected ? "translateY(-1px)" : "none",
                }}
              >
                <i className={`bi ${f.icon}`} style={{ color: isSelected ? "#ffffff" : "#A855F7" }} />
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Input Row */}
        <div style={{ display: "flex", gap: ".85rem", alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
            <i className="bi bi-search" style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "1rem" }} />
            <input
              className="search-input"
              style={{
                width: "100%",
                padding: ".75rem 2.8rem .75rem 2.75rem",
                fontSize: ".95rem",
                borderRadius: 12,
                border: "2px solid var(--border-medium)",
                background: "var(--bg-card)",
                color: "var(--text-main)",
                fontWeight: 700,
                fontFamily: "inherit",
                transition: "all .2s",
                outline: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
              placeholder={`Type to search in ${FIELDS.find((f2) => f2.value === field)?.label}... (e.g. invoice no, PO no, description, date)`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  position: "absolute",
                  right: ".85rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "#e2e8f0",
                  border: "none",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#475569",
                  cursor: "pointer",
                  fontSize: ".75rem",
                }}
                title="Clear input"
              >
                <i className="bi bi-x-lg" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <button
            className="btn-extract"
            onClick={() => handleSearch()}
            disabled={loading}
            style={{
              borderRadius: 12,
              padding: ".75rem 2rem",
              fontSize: ".9rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #7C3AED, #A855F7)",
              color: "#fff",
              border: "1.5px solid #C084FC",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: ".6rem",
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.45)",
              transition: "all .2s",
            }}
          >
            {loading ? (
              <>
                <div className="spinner-ring" style={{ width: 18, height: 18, borderWidth: 2.5 }} />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <i className="bi bi-search" />
                <span>Search</span>
              </>
            )}
          </button>

          {searched && (
            <button
              onClick={handleClear}
              style={{
                background: "rgba(168, 85, 247, 0.12)",
                border: "1.5px solid rgba(168, 85, 247, 0.25)",
                borderRadius: 12,
                padding: ".75rem 1.4rem",
                fontSize: ".85rem",
                fontWeight: 700,
                color: "#C084FC",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: ".4rem",
                transition: "all .2s",
              }}
            >
              <i className="bi bi-arrow-counterclockwise" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Search Results Body ── */}
      <div className="history-body">
        {/* Initial Prompt State */}
        {!searched && !loading && (
          <div style={{ textAlign: "center", padding: "4rem 1.5rem", color: "var(--text-muted)" }} className="animate-fadein">
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                background: "linear-gradient(135deg, #181033, #291557)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
                fontSize: "2rem",
                color: "#A855F7",
                border: "1.5px solid #7C3AED",
                boxShadow: "0 0 25px rgba(168, 85, 247, 0.35)",
              }}
            >
              <i className="bi bi-search" />
            </div>
            <h5 style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--text-main)", marginBottom: ".4rem" }}>
              Instant Multi-Field Search
            </h5>
            <p style={{ fontSize: ".88rem", maxWidth: 520, margin: "0 auto 1.5rem", lineHeight: 1.5, color: "#A1A1AA" }}>
              Search across <strong>Invoices</strong>, <strong>Purchase Orders</strong>, <strong>Remittances</strong>, <strong>Descriptions</strong>, or <strong>Dates</strong> with partial match and zero-normalization.
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ padding: "2rem" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="shimmer-row" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {/* Empty Search Result */}
        {searched && records.length === 0 && !loading && (
          <div className="empty-state animate-fadein">
            <i className="bi bi-binoculars empty-icon" style={{ color: "#A855F7" }} />
            <h5 style={{ fontWeight: 700, color: "var(--text-main)", marginTop: ".5rem" }}>
              No matches found for "<strong>{query}</strong>"
            </h5>
            <p style={{ fontSize: ".83rem", color: "#A1A1AA", marginTop: ".25rem" }}>
              Target: {FIELDS.find((f) => f.value === field)?.label}. Try searching with a broader keyword or switch to "All Fields".
            </p>
            <button
              onClick={() => { setField("all"); handleSearch(query, "all"); }}
              style={{
                marginTop: "1rem",
                background: "rgba(124, 58, 237, 0.15)",
                color: "#C084FC",
                border: "1.5px solid #7C3AED",
                borderRadius: 8,
                padding: ".45rem 1rem",
                fontSize: ".82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <i className="bi bi-search me-1" /> Search in All Fields
            </button>
          </div>
        )}

        {/* Success Results Table */}
        {records.length > 0 && !loading && (
          <div className="animate-fadein">
            {/* Results Banner */}
            <div
              style={{
                background: "var(--bg-card-subtle)",
                border: "1.5px solid var(--border-medium)",
                borderRadius: 10,
                padding: ".75rem 1.25rem",
                marginBottom: "1rem",
                fontSize: ".85rem",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: ".75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
                <i className="bi bi-check-circle-fill" style={{ color: "#22C55E", fontSize: "1.1rem" }} />
                <span>
                  Found <strong>{records.length}</strong> matching record(s) for <strong>"{query}"</strong> in <strong>{FIELDS.find((f) => f.value === field)?.label}</strong>
                </span>
              </div>
              <span style={{ fontSize: ".75rem", fontWeight: 800, color: "#ffffff", background: "linear-gradient(135deg, #7C3AED, #A855F7)", border: "1px solid #C084FC", padding: ".2rem .6rem", borderRadius: 6, boxShadow: "0 0 10px rgba(168, 85, 247, 0.4)" }}>
                Page {page} of {totalPages}
              </span>
            </div>

            {/* Table Wrap */}
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th style={{ width: 65, textAlign: "center" }}>Action</th>
                    <th onClick={() => handleSort("invoice_number")}>Invoice No. <SortIcon col="invoice_number" /></th>
                    <th onClick={() => handleSort("invoice_date")}>Inv. Date <SortIcon col="invoice_date" /></th>
                    <th onClick={() => handleSort("inv_description")}>Description <SortIcon col="inv_description" /></th>
                    <th onClick={() => handleSort("assessable_value")}>Assessable Val <SortIcon col="assessable_value" /></th>
                    <th onClick={() => handleSort("gst_amount")}>GST (18%) <SortIcon col="gst_amount" /></th>
                    <th onClick={() => handleSort("total_invoice_value")}>Total Inv. Val <SortIcon col="total_invoice_value" /></th>
                    <th onClick={() => handleSort("tds_rate")}>TDS% <SortIcon col="tds_rate" /></th>
                    <th onClick={() => handleSort("tds_amount")}>TDS Amt <SortIcon col="tds_amount" /></th>
                    <th onClick={() => handleSort("receivable")}>Net Receivable <SortIcon col="receivable" /></th>
                    <th onClick={() => handleSort("po_number")}>PO No. <SortIcon col="po_number" /></th>
                    <th onClick={() => handleSort("po_date")}>PO Date <SortIcon col="po_date" /></th>
                    <th onClick={() => handleSort("total_amount")}>PO Total <SortIcon col="total_amount" /></th>
                    <th onClick={() => handleSort("remittance_number")}>Remittance No. <SortIcon col="remittance_number" /></th>
                    <th onClick={() => handleSort("remittance_date")}>Rem. Date <SortIcon col="remittance_date" /></th>
                    <th onClick={() => handleSort("gross_amount")}>Gross Amt <SortIcon col="gross_amount" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i} className="animate-fadein" style={{ animationDelay: `${i * 0.04}s` }}>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => handleDelete(r.invoice_number)}
                          disabled={deletingId === r.invoice_number}
                          className="btn-del-sm"
                          title="Delete this record"
                        >
                          <i className="bi bi-trash3" /> Del
                        </button>
                      </td>
                      <td>
                        <span
                          className="id-badge"
                          style={{ cursor: "pointer", color: "#A855F7" }}
                          title="Click to copy"
                          onClick={() => handleCopy(r.invoice_number, "Invoice No")}
                        >
                          {r.invoice_number || "—"}
                          {r.invoice_number && <i className="bi bi-copy ms-1" style={{ opacity: 0.5, fontSize: ".65rem" }} />}
                        </span>
                      </td>
                      <td>{r.invoice_date || "—"}</td>
                      <td style={{ minWidth: 180, maxWidth: 350, wordBreak: "break-word", whiteSpace: "normal", lineHeight: 1.4 }}>
                        {r.inv_description || r.po_description || r.rem_description || "—"}
                      </td>
                      <td className="money">{fmt(r.assessable_value)}</td>
                      <td className="money">{fmt(r.gst_amount)}</td>
                      <td className="money" style={{ fontWeight: 800 }}>{fmt(r.total_invoice_value)}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{r.tds_rate}%</td>
                      <td className="tds-cell">{fmt(r.tds_amount)}</td>
                      <td className="receivable-cell" style={{ fontWeight: 800, color: "#22C55E" }}>{fmt(r.receivable)}</td>
                      <td>
                        <span
                          className="id-badge"
                          style={{ background: "rgba(192, 132, 252, 0.15)", color: "#C084FC", borderColor: "rgba(192, 132, 252, 0.3)", cursor: "pointer" }}
                          title="Click to copy"
                          onClick={() => handleCopy(r.po_number, "PO No")}
                        >
                          {r.po_number || "—"}
                          {r.po_number && <i className="bi bi-copy ms-1" style={{ opacity: 0.5, fontSize: ".65rem" }} />}
                        </span>
                      </td>
                      <td>{r.po_date || "—"}</td>
                      <td className="money">{fmt(r.total_amount)}</td>
                      <td>
                        <span
                          className="id-badge"
                          style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22C55E", borderColor: "rgba(34, 197, 94, 0.3)", cursor: "pointer" }}
                          title="Click to copy"
                          onClick={() => handleCopy(r.remittance_number, "Remittance No")}
                        >
                          {r.remittance_number || "—"}
                          {r.remittance_number && <i className="bi bi-copy ms-1" style={{ opacity: 0.5, fontSize: ".65rem" }} />}
                        </span>
                      </td>
                      <td>{r.remittance_date || "—"}</td>
                      <td className="money">{fmt(r.gross_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-row">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} records
                </span>
                <div className="page-btns">
                  <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                  <button className="page-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>‹</button>
                  {Array.from({ length: totalPages }, (_, idx) => (
                    <button
                      key={idx + 1}
                      className={`page-btn ${page === idx + 1 ? "active" : ""}`}
                      onClick={() => setPage(idx + 1)}
                    >
                      {idx + 1}
                    </button>
                  ))}
                  <button className="page-btn" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
                  <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


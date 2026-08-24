import React, { useState } from "react";
import { fmt } from "../utils/format";
import { searchById } from "../services/api";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

const FIELDS = [
  { label: "Invoice No.",        value: "invoice_number"    },
  { label: "PO No.",             value: "po_number"         },
  { label: "Remittance No.",     value: "remittance_number" },
  { label: "Invoice Date",       value: "invoice_date"      },
  { label: "PO Date",            value: "po_date"           },
  { label: "All Fields",         value: "all"               },
];

export default function SearchTab() {
  const [query,   setQuery]   = useState("");
  const [field,   setField]   = useState("invoice_number");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page,    setPage]    = useState(1);

  const handleSearch = async () => {
    if (!query.trim()) { toast("Please enter a search term."); return; }
    setLoading(true);
    try {
      const { data } = await searchById(field, query.trim());
      if (data.success) {
        setRecords(data.records || []);
        setSearched(true);
        setPage(1);
        if (data.total === 0) toast("No records found.", { icon: "🔍" });
        else toast.success(`Found ${data.total} record(s)`);
      }
    } catch { toast.error("Search failed"); }
    finally { setLoading(false); }
  };

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageData   = records.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  return (
    <div className="search-wrapper">
      {/* Header */}
      <div className="search-header" style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)" }}>
        <div className="search-title">
          <i className="bi bi-search" />Search Records by ID
        </div>
      </div>

      {/* Search Panel */}
      <div style={{ padding:"1.75rem", borderBottom:"1px solid #e2e8f0" }}>
        <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap", marginBottom:"1.5rem" }}>
          {/* Quick field pills */}
          {FIELDS.map(f => (
            <button key={f.value} onClick={() => setField(f.value)}
              style={{
                background: field===f.value ? "var(--blue)" : "#fff",
                color: field===f.value ? "#fff" : "#64748b",
                border: `1.5px solid ${field===f.value ? "var(--blue)" : "#e2e8f0"}`,
                borderRadius: 10, padding:".45rem 1rem",
                fontSize:".8rem", fontWeight:600, cursor:"pointer", transition:"all .15s",
                display:"flex", alignItems:"center", gap:".4rem",
                boxShadow: field===f.value ? "0 4px 14px rgba(37,99,235,.3)" : "none",
              }}>
              <i className={`bi ${f.value==="invoice_number"?"bi-receipt":f.value==="po_number"?"bi-file-text":f.value==="remittance_number"?"bi-cash-stack":f.value==="invoice_date"||f.value==="po_date"?"bi-calendar3":"bi-search"}`} />
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Input Row */}
        <div style={{ display:"flex", gap:"1rem", alignItems:"stretch", flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:240, position:"relative" }}>
            <i className="bi bi-search" style={{ position:"absolute", left:".9rem", top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }} />
            <input
              className="search-input"
              style={{ width:"100%", padding:".7rem 1rem .7rem 2.4rem", fontSize:".9rem", borderRadius:12 }}
              placeholder={`Enter ${FIELDS.find(f2=>f2.value===field)?.label ?? "search term"}...`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleSearch()}
            />
          </div>
          <button className="btn-extract" onClick={handleSearch} disabled={loading}
            style={{ borderRadius:12, padding:".7rem 2rem", fontSize:".9rem" }}>
            {loading ? <><div className="spinner-ring" style={{ width:18, height:18, borderWidth:2 }} />Searching...</>
              : <><i className="bi bi-search" />Search</>}
          </button>
          {searched && (
            <button onClick={() => { setQuery(""); setRecords([]); setSearched(false); }}
              style={{ background:"#f1f5f9", border:"1.5px solid #e2e8f0", borderRadius:12, padding:".7rem 1.25rem", fontSize:".85rem", fontWeight:600, color:"#64748b", cursor:"pointer" }}>
              <i className="bi bi-x-circle me-1" />Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="history-body">
        {!searched && !loading && (
          <div style={{ textAlign:"center", padding:"3.5rem 1rem", color:"#94a3b8" }}>
            <i className="bi bi-search" style={{ fontSize:"3rem", display:"block", marginBottom:"1rem", opacity:.25 }} />
            <p style={{ fontWeight:600, fontSize:".95rem" }}>Select a field and type to search</p>
            <p style={{ fontSize:".82rem", marginTop:".35rem" }}>Search by Invoice No., PO No., Remittance No., or Date</p>
          </div>
        )}
        {searched && records.length === 0 && !loading && (
          <div className="empty-state">
            <i className="bi bi-binoculars empty-icon" />
            <p style={{ fontWeight:600 }}>No records found for "<strong>{query}</strong>"</p>
          </div>
        )}
        {records.length > 0 && (
          <>
            <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:".6rem 1rem", marginBottom:".85rem", fontSize:".82rem", color:"#1d4ed8", display:"flex", alignItems:"center", gap:".5rem" }}>
              <i className="bi bi-check-circle-fill" />
              Found <strong>{records.length}</strong> record(s) for <strong>"{query}"</strong> in <strong>{FIELDS.find(f=>f.value===field)?.label}</strong>
            </div>
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Invoice No.</th><th>Inv. Date</th><th>Description</th>
                    <th>Assessable</th><th>GST</th><th>Total Inv.</th>
                    <th>TDS%</th><th>TDS Amt</th><th>Receivable</th>
                    <th>PO No.</th><th>PO Date</th><th>PO Total</th>
                    <th>Remittance No.</th><th>Rem. Date</th><th>Gross</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((r, i) => (
                    <tr key={i}>
                      <td><span className="id-badge">{r.invoice_number||"—"}</span></td>
                      <td>{r.invoice_date||"—"}</td>
                      <td style={{ maxWidth:140, overflow:"hidden", textOverflow:"ellipsis" }}>{r.inv_description||"—"}</td>
                      <td className="money">{fmt(r.assessable_value)}</td>
                      <td className="money">{fmt(r.gst_amount)}</td>
                      <td className="money">{fmt(r.total_invoice_value)}</td>
                      <td style={{ textAlign:"center", fontWeight:700 }}>{r.tds_rate}%</td>
                      <td className="tds-cell">{fmt(r.tds_amount)}</td>
                      <td className="receivable-cell">{fmt(r.receivable)}</td>
                      <td><span className="id-badge" style={{ background:"#fffbeb", color:"#92400e", borderColor:"#fde68a" }}>{r.po_number||"—"}</span></td>
                      <td>{r.po_date||"—"}</td>
                      <td className="money">{fmt(r.total_amount)}</td>
                      <td><span className="id-badge" style={{ background:"#f0fdf4", color:"#065f46", borderColor:"#a7f3d0" }}>{r.remittance_number||"—"}</span></td>
                      <td>{r.remittance_date||"—"}</td>
                      <td className="money">{fmt(r.gross_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination-row">
                <span>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,records.length)} of {records.length}</span>
                <div className="page-btns">
                  {Array.from({length:totalPages},(_,i) => (
                    <button key={i+1} className={`page-btn ${page===i+1?"active":""}`} onClick={() => setPage(i+1)}>{i+1}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

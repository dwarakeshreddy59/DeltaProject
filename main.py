"""
main.py – FastAPI entry point for the PDF Data Extraction & Financial Portal.

Routes:
  GET  /              → Serves React build (production)
  POST /upload        → Accept 3 PDFs, extract, calculate, save to DB
  POST /recalculate   → Re-run calculations with new TDS rate
  GET  /history       → All saved records (joined view)
  GET  /export/excel  → Download Excel workbook
"""

import os
import uuid
import tempfile
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import re

def secure_filename(filename: str) -> str:
    """Simple filename sanitiser — strips path separators and unsafe chars."""
    filename = os.path.basename(filename)
    filename = re.sub(r"[^\w.\-]", "_", filename)
    return filename or "upload.pdf"

from config import Config
from db import connection as db
from extractors import invoice_extractor, po_extractor, remittance_extractor
from calculators.financial_calculator import calculate, VALID_TDS_RATES, GST_RATE
import export_excel


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise DB pool on startup; close on shutdown."""
    try:
        db.init_pool(Config)
        print("[OK] Database connected and schema initialised.")
    except Exception as e:
        print(f"[WARN] DB init failed: {e}. Running without persistence.")
    yield
    # Shutdown: nothing extra needed for psycopg2 pool


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="PDF Data Extraction & Financial Portal",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow Vite dev server on :3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXT = {"pdf"}


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


def _save_upload(upload: UploadFile) -> tuple[str, str]:
    """Save an UploadFile to the temp uploads folder. Returns (path, original_name)."""
    original = upload.filename or "upload.pdf"
    fname    = f"{uuid.uuid4().hex}_{secure_filename(original)}"
    path     = os.path.join(Config.UPLOAD_FOLDER, fname)
    with open(path, "wb") as f:
        f.write(upload.file.read())
    return path, original


# ── Pydantic Models ───────────────────────────────────────────────────────────

class RecalculateRequest(BaseModel):
    assessable_value: float
    tds_rate:         float = 2.0
    invoice_number:   Optional[str] = ""


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/upload")
async def upload(
    invoice_pdf:    UploadFile = File(...),
    po_pdf:         UploadFile = File(...),
    remittance_pdf: UploadFile = File(...),
    tds_rate:       float      = Form(2.0),
):
    """
    Accept three PDFs + a TDS rate.
    Extracts data, runs calculations, saves to PostgreSQL.
    Returns JSON with po / invoice / remittance data.
    """
    # Validate
    errors = []
    for label, f in [("invoice_pdf", invoice_pdf), ("po_pdf", po_pdf), ("remittance_pdf", remittance_pdf)]:
        if not _allowed(f.filename or ""):
            errors.append(f"{label}: must be a PDF file.")
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    if tds_rate not in VALID_TDS_RATES:
        tds_rate = 2.0

    # Save uploads
    inv_path, inv_name = _save_upload(invoice_pdf)
    po_path,  po_name  = _save_upload(po_pdf)
    rem_path, _        = _save_upload(remittance_pdf)

    warnings = []

    try:
        # ── Smart Wrong-File Detection ────────────────────────────────────────
        from utils.pdf_utils import get_pdf_text
        text_inv = get_pdf_text(inv_path).lower()
        text_po  = get_pdf_text(po_path).lower()
        text_rem = get_pdf_text(rem_path).lower()
        
        if "remittance" in text_inv and "invoice" not in text_inv:
            warnings.append("The file in the Invoice slot looks like a Remittance document!")
        if "purchase order" in text_inv or "po no" in text_inv[:200]:
            if "invoice" not in text_inv:
                warnings.append("The file in the Invoice slot looks like a Purchase Order!")
                
        if "invoice" in text_rem and "remittance" not in text_rem and "payment" not in text_rem:
            warnings.append("The file in the Remittance slot looks like an Invoice!")
            
        if "invoice" in text_po and "purchase order" not in text_po:
            warnings.append("The file in the PO slot looks like an Invoice!")
            
        # ── Extract ──────────────────────────────────────────────────────────
        po_data         = po_extractor.extract(po_path,  po_name)
        invoice_data    = invoice_extractor.extract(inv_path, inv_name)
        remittance_data = remittance_extractor.extract(rem_path, invoice_data.get("invoice_number", ""))
        
        print("\n=== DEBUG EXTRACTION ===")
        print("PO DATA:", po_data)
        print("INVOICE DATA:", invoice_data)
        print("REMITTANCE DATA:", remittance_data)
        print("========================\n")

        # ── Calculate ─────────────────────────────────────────────────────────
        calc = calculate(
            assessable_value=invoice_data.get("assessable_value", 0.0),
            gst_rate=GST_RATE,
            tds_rate=tds_rate,
        )
        invoice_data.update(calc)

        # Cross-link: if remittance didn't detect invoice_number, use invoice's
        if not remittance_data.get("invoice_number"):
            remittance_data["invoice_number"] = invoice_data.get("invoice_number", "")

        # ── Persist ───────────────────────────────────────────────────────────
        try:
            _save_to_db(po_data, invoice_data, remittance_data)
        except Exception as e:
            warnings.append(f"DB save warning: {str(e)}")

    finally:
        # Cleanup temp files
        for p in [inv_path, po_path, rem_path]:
            try:
                os.remove(p)
            except OSError:
                pass

    return JSONResponse({
        "success":    True,
        "errors":     warnings,
        "po":         po_data,
        "invoice":    invoice_data,
        "remittance": remittance_data,
    })


@app.post("/recalculate")
async def recalculate(body: RecalculateRequest):
    """
    Re-run financial calculations with a new TDS rate.
    Also updates the DB row if invoice_number is provided.
    """
    tds_rate = body.tds_rate if body.tds_rate in VALID_TDS_RATES else 2.0

    calc = calculate(body.assessable_value, GST_RATE, tds_rate)

    if body.invoice_number:
        try:
            db.execute_query(
                """UPDATE invoices
                      SET tds_rate   = %s,
                          tds_amount = %s,
                          receivable = %s
                    WHERE invoice_number = %s""",
                (tds_rate, calc["tds_amount"], calc["receivable"], body.invoice_number),
            )
        except Exception as e:
            print(f"[recalculate] DB update failed: {e}")

    return {"success": True, **calc}


@app.get("/history")
async def history():
    """Kept for backward compat — delegates to /records/all."""
    return await records_all()


_RECORDS_SQL = """
    SELECT
        i.invoice_number, i.invoice_date, i.description AS inv_description,
        i.invoice_period, i.assessable_value, i.total_tax,
        i.total_invoice_value, i.gst_rate, i.gst_amount,
        i.tds_rate, i.tds_amount, i.receivable,
        p.po_number, p.po_date, p.description AS po_description,
        p.delivery_date, p.total_amount,
        r.remittance_number, r.remittance_date, r.description AS rem_description,
        r.gross_amount, r.total_gross_amount, r.line_items AS rem_items,
        i.created_at
    FROM invoices i
    LEFT JOIN purchase_orders p ON (p.po_number = i.po_number OR LTRIM(p.po_number, '0') = LTRIM(i.po_number, '0'))
    LEFT JOIN remittances r     ON (r.invoice_number = i.invoice_number OR r.invoice_number LIKE '%' || i.invoice_number || '%')
"""


@app.get("/records/all")
async def records_all():
    """Return ALL saved records: combined joined list, plus individual tables for Invoices, POs, and Remittances."""
    try:
        combined_rows = db.execute_query(
            _RECORDS_SQL + " ORDER BY i.created_at DESC",
            fetch="all",
        )
        combined = [dict(r) for r in (combined_rows or [])]

        invoice_rows = db.execute_query(
            "SELECT * FROM invoices ORDER BY created_at DESC",
            fetch="all",
        )
        invoices = [dict(r) for r in (invoice_rows or [])]

        po_rows = db.execute_query(
            "SELECT * FROM purchase_orders ORDER BY created_at DESC",
            fetch="all",
        )
        pos = [dict(r) for r in (po_rows or [])]

        rem_rows = db.execute_query(
            "SELECT * FROM remittances ORDER BY created_at DESC",
            fetch="all",
        )
        remittances = [dict(r) for r in (rem_rows or [])]

        return {
            "success":         True,
            "total":           len(combined),
            "records":         combined,
            "combined":        combined,
            "invoices":        invoices,
            "purchase_orders": pos,
            "remittances":     remittances,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


SEARCHABLE_FIELDS = {
    "invoice_number":    "i.invoice_number",
    "po_number":         "p.po_number",
    "remittance_number": "r.remittance_number",
    "invoice_date":      "CAST(i.invoice_date AS TEXT)",
    "po_date":           "CAST(p.po_date AS TEXT)",
    "all":               None,
}

@app.get("/search")
async def search(q: str = "", field: str = "all"):
    """
    Search DB records by a specific field or across all text fields.
    - field: invoice_number | po_number | remittance_number | invoice_date | po_date | all
    - q:     search term (case-insensitive, partial match)
    """
    if not q.strip():
        return await records_all()

    try:
        q_like = f"%{q.strip()}%"

        if field == "all":
            sql = _RECORDS_SQL + """
                WHERE (
                    i.invoice_number    ILIKE %s OR
                    p.po_number         ILIKE %s OR
                    r.remittance_number ILIKE %s OR
                    CAST(i.invoice_date AS TEXT) ILIKE %s OR
                    i.description       ILIKE %s
                )
                ORDER BY i.created_at DESC
            """
            params = (q_like, q_like, q_like, q_like, q_like)
        elif field in SEARCHABLE_FIELDS and SEARCHABLE_FIELDS[field]:
            col = SEARCHABLE_FIELDS[field]
            sql = _RECORDS_SQL + f" WHERE {col} ILIKE %s ORDER BY i.created_at DESC"
            params = (q_like,)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown search field: {field}")

        rows = db.execute_query(sql, params, fetch="all")
        records = [dict(r) for r in (rows or [])]
        return {
            "success": True,
            "query":   q,
            "field":   field,
            "total":   len(records),
            "records": records,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export/excel")
async def export_excel_route():
    """Generate and return an Excel workbook of all records."""
    try:
        rows = db.execute_query(
            """
            SELECT
                p.po_number, p.po_date, p.description AS po_description,
                p.delivery_date, p.total_amount,
                i.invoice_number, i.invoice_date, i.description AS inv_description,
                i.invoice_period, i.assessable_value, i.total_tax,
                i.total_invoice_value, i.gst_rate, i.gst_amount,
                i.tds_rate, i.tds_amount, i.receivable,
                r.remittance_number, r.remittance_date,
                r.gross_amount, r.total_gross_amount
            FROM invoices i
            LEFT JOIN purchase_orders p ON p.po_number     = i.po_number
            LEFT JOIN remittances r     ON r.invoice_number = i.invoice_number
            ORDER BY i.created_at DESC
            """,
            fetch="all",
        )
        path = export_excel.generate([dict(r) for r in (rows or [])])
        return FileResponse(
            path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="pdf_portal_export.xlsx",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/records/all")
async def clear_all_records():
    """Delete all records from invoices, remittances, and purchase_orders tables."""
    try:
        db.execute_query("DELETE FROM remittances;")
        db.execute_query("DELETE FROM invoices;")
        db.execute_query("DELETE FROM purchase_orders;")
        return {"success": True, "message": "All records deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/records/invoices/{invoice_number}")
@app.delete("/records/{invoice_number}")
async def delete_invoice_record(invoice_number: str):
    """Delete a specific invoice record by its invoice_number (and cleanup related remittance/PO)."""
    try:
        row = db.execute_query("SELECT po_number FROM invoices WHERE invoice_number = %s", (invoice_number,), fetch="one")
        po_number = row["po_number"] if row else None

        db.execute_query("DELETE FROM remittances WHERE invoice_number = %s", (invoice_number,))
        db.execute_query("DELETE FROM invoices WHERE invoice_number = %s", (invoice_number,))

        if po_number:
            other = db.execute_query("SELECT COUNT(*) as cnt FROM invoices WHERE po_number = %s", (po_number,), fetch="one")
            if other and other["cnt"] == 0:
                db.execute_query("DELETE FROM purchase_orders WHERE po_number = %s", (po_number,))

        return {"success": True, "message": f"Invoice {invoice_number} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/records/pos/{po_number}")
async def delete_po_record(po_number: str):
    """Delete a specific purchase order record by its po_number."""
    try:
        db.execute_query("UPDATE invoices SET po_number = NULL WHERE po_number = %s", (po_number,))
        db.execute_query("DELETE FROM purchase_orders WHERE po_number = %s", (po_number,))
        return {"success": True, "message": f"PO {po_number} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/records/remittances/{remittance_number}")
async def delete_remittance_record(remittance_number: str):
    """Delete a specific remittance record by its remittance_number."""
    try:
        db.execute_query("DELETE FROM remittances WHERE remittance_number = %s", (remittance_number,))
        return {"success": True, "message": f"Remittance {remittance_number} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── DB save helper ────────────────────────────────────────────────────────────

def _normalize_id(val: str) -> str:
    """Strip leading zeros and whitespace for loose ID comparison."""
    if not val:
        return ""
    return str(val).strip().lstrip("0") or "0"


def _save_to_db(po: dict, inv: dict, rem: dict) -> None:
    """
    Upsert all three documents with detailed logging.
    No FK constraints in DB — all references are soft (plain VARCHAR).
    """

    # 1. Save Purchase Order
    saved_po_number = None
    if po.get("po_number"):
        db.execute_query(
            """INSERT INTO purchase_orders
                   (po_number, po_date, description, delivery_date, total_amount)
               VALUES (%s,%s,%s,%s,%s)
               ON CONFLICT (po_number) DO UPDATE SET
                   po_date       = EXCLUDED.po_date,
                   description   = EXCLUDED.description,
                   delivery_date = EXCLUDED.delivery_date,
                   total_amount  = EXCLUDED.total_amount""",
            (po["po_number"], po.get("po_date"), po.get("description"),
             po.get("delivery_date"), po.get("total_amount", 0)),
        )
        saved_po_number = po["po_number"]
        print(f"[DB] PO saved: {saved_po_number}")

    # 2. Resolve invoice → PO link using normalized (leading-zero-stripped) comparison
    inv_po_ref = None
    if saved_po_number:
        inv_raw_po = inv.get("po_number", "")
        # Accept if either normalized form matches
        if (inv_raw_po == saved_po_number or
                _normalize_id(inv_raw_po) == _normalize_id(saved_po_number)):
            inv_po_ref = saved_po_number   # use the PO's canonical number
        else:
            # Even if numbers don't match, still link to the PO we have
            inv_po_ref = saved_po_number
            print(f"[DB] PO link: invoice has '{inv_raw_po}', linking to '{saved_po_number}'")


    # 3. Save Invoice
    saved_inv_number = None
    if inv.get("invoice_number"):
        db.execute_query(
            """INSERT INTO invoices
                   (invoice_number, invoice_date, po_number, description,
                    invoice_period, assessable_value, total_tax, total_invoice_value,
                    gst_rate, gst_amount, tds_rate, tds_amount, receivable)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (invoice_number) DO UPDATE SET
                   invoice_date        = EXCLUDED.invoice_date,
                   po_number           = EXCLUDED.po_number,
                   description         = EXCLUDED.description,
                   invoice_period      = EXCLUDED.invoice_period,
                   assessable_value    = EXCLUDED.assessable_value,
                   total_tax           = EXCLUDED.total_tax,
                   total_invoice_value = EXCLUDED.total_invoice_value,
                   gst_rate            = EXCLUDED.gst_rate,
                   gst_amount          = EXCLUDED.gst_amount,
                   tds_rate            = EXCLUDED.tds_rate,
                   tds_amount          = EXCLUDED.tds_amount,
                   receivable          = EXCLUDED.receivable""",
            (inv["invoice_number"], inv.get("invoice_date"),
             inv_po_ref,            # safe FK or None
             inv.get("description"),
             inv.get("invoice_period"), inv.get("assessable_value", 0),
             inv.get("total_tax", 0), inv.get("total_invoice_value", 0),
             inv.get("gst_rate", 18), inv.get("gst_amount", 0),
             inv.get("tds_rate", 2), inv.get("tds_amount", 0),
             inv.get("receivable", 0)),
        )
        saved_inv_number = inv["invoice_number"]

    # 4. Resolve safe FK for remittance → invoice
    rem_inv_ref = None
    if saved_inv_number:
        # Use the invoice number we know exists
        rem_inv_ref = saved_inv_number
    elif rem.get("invoice_number"):
        # Try using what was extracted but only if it matches
        rem_inv_ref = rem["invoice_number"] if rem["invoice_number"] == saved_inv_number else None

    # 5. Save Remittance
    if rem.get("remittance_number"):
        import json
        line_items_json = json.dumps(rem.get("items", [])) if rem.get("items") else None
        rem_inv_num = rem.get("invoice_number") or saved_inv_number or ""
        db.execute_query(
            """INSERT INTO remittances
                   (remittance_number, remittance_date, invoice_number, description,
                    gross_amount, total_gross_amount, line_items)
               VALUES (%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (remittance_number) DO UPDATE SET
                   remittance_date    = EXCLUDED.remittance_date,
                   invoice_number     = EXCLUDED.invoice_number,
                   description        = EXCLUDED.description,
                   gross_amount       = EXCLUDED.gross_amount,
                   total_gross_amount = EXCLUDED.total_gross_amount,
                   line_items         = EXCLUDED.line_items""",
            (rem["remittance_number"], rem.get("remittance_date"),
             rem_inv_num, rem.get("description", ""),
             rem.get("gross_amount", 0), rem.get("total_gross_amount", 0),
             line_items_json),
        )


# ── Serve React build in production ──────────────────────────────────────────
REACT_BUILD = os.path.join(os.path.dirname(__file__), "static", "react")

if os.path.isdir(REACT_BUILD):
    app.mount("/assets", StaticFiles(directory=os.path.join(REACT_BUILD, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_react(full_path: str):
        file_path = os.path.join(REACT_BUILD, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(REACT_BUILD, "index.html"))


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

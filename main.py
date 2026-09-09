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
LOGOS_FOLDER = os.path.join(Config.UPLOAD_FOLDER, "logos")
os.makedirs(LOGOS_FOLDER, exist_ok=True)
app.mount("/uploads/logos", StaticFiles(directory=LOGOS_FOLDER), name="client_logos")

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
    client_id:      Optional[int] = Form(None),
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
        # ── Smart Strict Document Classification & Validation ────────────────
        from utils.pdf_utils import classify_pdf_document

        inv_class = classify_pdf_document(inv_path)
        po_class  = classify_pdf_document(po_path)
        rem_class = classify_pdf_document(rem_path)

        mismatches = []
        if inv_class["type"] != "INVOICE":
            mismatches.append({
                "slot": "invoice",
                "slot_label": "Invoice PDF Slot",
                "filename": inv_name,
                "detected_type": inv_class["type"],
                "detected_label": inv_class["label"],
                "expected_type": "INVOICE",
                "expected_label": "Tax Invoice",
                "message": f"Uploaded file is a {inv_class['label']}. Expected: Tax Invoice.",
            })
        if po_class["type"] != "PURCHASE_ORDER":
            mismatches.append({
                "slot": "po",
                "slot_label": "Purchase Order Slot",
                "filename": po_name,
                "detected_type": po_class["type"],
                "detected_label": po_class["label"],
                "expected_type": "PURCHASE_ORDER",
                "expected_label": "Purchase Order",
                "message": f"Uploaded file is a {po_class['label']}. Expected: Purchase Order.",
            })
        if rem_class["type"] != "REMITTANCE":
            mismatches.append({
                "slot": "remittance",
                "slot_label": "Remittance PDF Slot",
                "filename": remittance_pdf.filename or "remittance.pdf",
                "detected_type": rem_class["type"],
                "detected_label": rem_class["label"],
                "expected_type": "REMITTANCE",
                "expected_label": "Remittance Advice",
                "message": f"Uploaded file is a {rem_class['label']}. Expected: Remittance Advice.",
            })

        if mismatches:
            slot_types = {
                "invoice": inv_class["type"],
                "po": po_class["type"],
                "remittance": rem_class["type"],
            }
            inv_source = next((s for s, t in slot_types.items() if t == "INVOICE"), None)
            po_source  = next((s for s, t in slot_types.items() if t == "PURCHASE_ORDER"), None)
            rem_source = next((s for s, t in slot_types.items() if t == "REMITTANCE"), None)

            can_auto_fix = (inv_source is not None and po_source is not None and rem_source is not None)
            auto_fix_mapping = None
            if can_auto_fix:
                auto_fix_mapping = {
                    "invoice": inv_source,
                    "po": po_source,
                    "remittance": rem_source,
                }

            can_swap = False
            swap_pair = None
            if len(mismatches) == 2:
                s1, s2 = mismatches[0], mismatches[1]
                if s1["detected_type"] == s2["expected_type"] and s2["detected_type"] == s1["expected_type"]:
                    can_swap = True
                    swap_pair = [s1["slot"], s2["slot"]]

            return JSONResponse(
                status_code=422,
                content={
                    "success": False,
                    "error_type": "WRONG_FILE_MISMATCH",
                    "title": "Wrong PDF Document Detected",
                    "message": "One or more documents were placed in the wrong upload slot. Extraction and database saving have been blocked to protect your records.",
                    "mismatches": mismatches,
                    "can_auto_fix": can_auto_fix,
                    "auto_fix_mapping": auto_fix_mapping,
                    "can_auto_swap": can_swap,
                    "swap_pair": swap_pair,
                },
            )

        # ── Extract (Only runs when all 3 documents are 100% verified) ───────
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
            _save_to_db(po_data, invoice_data, remittance_data, client_id=client_id)
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
        "client_id":  client_id,
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


# ── Client / Organization Endpoints ──────────────────────────────────────────

@app.get("/clients")
async def get_clients():
    """List all registered clients/companies with record counts."""
    sql = """
        SELECT
            c.id, c.client_name, c.organization_name, c.logo_url,
            c.gst_number, c.pan_number, c.address, c.point_of_contact,
            c.invoice_doc_label, c.invoice_num_label,
            c.po_doc_label, c.po_num_label,
            c.remittance_doc_label, c.remittance_num_label,
            c.created_at,
            COUNT(DISTINCT i.id) as invoices_count,
            COUNT(DISTINCT p.id) as pos_count,
            COUNT(DISTINCT r.id) as remittances_count
        FROM clients c
        LEFT JOIN invoices i ON i.client_id = c.id
        LEFT JOIN purchase_orders p ON p.client_id = c.id
        LEFT JOIN remittances r ON r.client_id = c.id
        GROUP BY c.id
        ORDER BY c.id ASC;
    """
    try:
        rows = db.execute_query(sql, fetch="all")
        clients = [dict(r) for r in (rows or [])]
        return {"success": True, "total": len(clients), "clients": clients}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/clients/{client_id}")
async def get_client(client_id: int):
    """Retrieve a single registered client."""
    row = db.execute_query("SELECT * FROM clients WHERE id = %s;", (client_id,), fetch="one")
    if not row:
        raise HTTPException(status_code=404, detail=f"Client {client_id} not found.")
    return {"success": True, "client": dict(row)}


@app.post("/clients")
async def register_client(
    client_name: str = Form(...),
    organization_name: str = Form(...),
    gst_number: Optional[str] = Form(""),
    pan_number: Optional[str] = Form(""),
    address: Optional[str] = Form(""),
    point_of_contact: Optional[str] = Form(""),
    invoice_doc_label: Optional[str] = Form("Tax Invoice"),
    invoice_num_label: Optional[str] = Form("Invoice Number"),
    po_doc_label: Optional[str] = Form("Purchase Order"),
    po_num_label: Optional[str] = Form("PO Number"),
    remittance_doc_label: Optional[str] = Form("Remittance Advice"),
    remittance_num_label: Optional[str] = Form("Remittance Number"),
    logo_file: Optional[UploadFile] = File(None),
    logo_url: Optional[str] = Form(""),
):
    """Register a new client/organization with optional logo and custom document nomenclature."""
    def _unwrap(v, d=""):
        return d if (v is None or hasattr(v, "default")) else str(v)

    c_name = _unwrap(client_name, "").strip()
    org_name = _unwrap(organization_name, "").strip()
    gst = _unwrap(gst_number, "").strip().upper()
    pan = _unwrap(pan_number, "").strip().upper()
    addr = _unwrap(address, "").strip()
    poc = _unwrap(point_of_contact, "").strip()
    inv_doc = _unwrap(invoice_doc_label, "Tax Invoice").strip() or "Tax Invoice"
    inv_num = _unwrap(invoice_num_label, "Invoice Number").strip() or "Invoice Number"
    po_doc = _unwrap(po_doc_label, "Purchase Order").strip() or "Purchase Order"
    po_num = _unwrap(po_num_label, "PO Number").strip() or "PO Number"
    rem_doc = _unwrap(remittance_doc_label, "Remittance Advice").strip() or "Remittance Advice"
    rem_num = _unwrap(remittance_num_label, "Remittance Number").strip() or "Remittance Number"
    l_url = _unwrap(logo_url, "")

    try:
        final_logo_url = l_url
        if logo_file and hasattr(logo_file, "filename") and logo_file.filename:
            logo_ext = logo_file.filename.rsplit(".", 1)[-1].lower() if "." in logo_file.filename else "png"
            logo_fname = f"logo_{uuid.uuid4().hex[:12]}.{logo_ext}"
            logo_dest = os.path.join(LOGOS_FOLDER, logo_fname)
            with open(logo_dest, "wb") as f:
                f.write(logo_file.file.read())
            final_logo_url = f"/uploads/logos/{logo_fname}"

        inserted = db.execute_query(
            """
            INSERT INTO clients (
                client_name, organization_name, logo_url, gst_number, pan_number,
                address, point_of_contact,
                invoice_doc_label, invoice_num_label,
                po_doc_label, po_num_label,
                remittance_doc_label, remittance_num_label
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *;
            """,
            (
                c_name, org_name, final_logo_url,
                gst, pan, addr, poc,
                inv_doc, inv_num,
                po_doc, po_num,
                rem_doc, rem_num,
            ),
            fetch="one",
        )
        return {"success": True, "client": dict(inserted)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/clients/{client_id}")
async def update_client(
    client_id: int,
    client_name: Optional[str] = Form(None),
    organization_name: Optional[str] = Form(None),
    gst_number: Optional[str] = Form(None),
    pan_number: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    point_of_contact: Optional[str] = Form(None),
    invoice_doc_label: Optional[str] = Form(None),
    invoice_num_label: Optional[str] = Form(None),
    po_doc_label: Optional[str] = Form(None),
    po_num_label: Optional[str] = Form(None),
    remittance_doc_label: Optional[str] = Form(None),
    remittance_num_label: Optional[str] = Form(None),
    logo_file: Optional[UploadFile] = File(None),
    logo_url: Optional[str] = Form(None),
):
    """Update an existing client's details or nomenclature."""
    def _unwrap(v, d=None):
        return d if (v is None or hasattr(v, "default")) else str(v)

    c_name = _unwrap(client_name, None)
    org_name = _unwrap(organization_name, None)
    gst = _unwrap(gst_number, None)
    if gst: gst = gst.upper()
    pan = _unwrap(pan_number, None)
    if pan: pan = pan.upper()
    addr = _unwrap(address, None)
    poc = _unwrap(point_of_contact, None)
    inv_doc = _unwrap(invoice_doc_label, None)
    inv_num = _unwrap(invoice_num_label, None)
    po_doc = _unwrap(po_doc_label, None)
    po_num = _unwrap(po_num_label, None)
    rem_doc = _unwrap(remittance_doc_label, None)
    rem_num = _unwrap(remittance_num_label, None)
    l_url = _unwrap(logo_url, None)

    try:
        existing = db.execute_query("SELECT * FROM clients WHERE id = %s;", (client_id,), fetch="one")
        if not existing:
            raise HTTPException(status_code=404, detail=f"Client {client_id} not found.")

        final_logo_url = existing["logo_url"]
        if logo_file and hasattr(logo_file, "filename") and logo_file.filename:
            logo_ext = logo_file.filename.rsplit(".", 1)[-1].lower() if "." in logo_file.filename else "png"
            logo_fname = f"logo_{uuid.uuid4().hex[:12]}.{logo_ext}"
            logo_dest = os.path.join(LOGOS_FOLDER, logo_fname)
            with open(logo_dest, "wb") as f:
                f.write(logo_file.file.read())
            final_logo_url = f"/uploads/logos/{logo_fname}"
        elif l_url is not None:
            final_logo_url = l_url

        updated = db.execute_query(
            """
            UPDATE clients SET
                client_name          = COALESCE(%s, client_name),
                organization_name    = COALESCE(%s, organization_name),
                logo_url             = %s,
                gst_number           = COALESCE(%s, gst_number),
                pan_number           = COALESCE(%s, pan_number),
                address              = COALESCE(%s, address),
                point_of_contact     = COALESCE(%s, point_of_contact),
                invoice_doc_label    = COALESCE(%s, invoice_doc_label),
                invoice_num_label    = COALESCE(%s, invoice_num_label),
                po_doc_label         = COALESCE(%s, po_doc_label),
                po_num_label         = COALESCE(%s, po_num_label),
                remittance_doc_label = COALESCE(%s, remittance_doc_label),
                remittance_num_label = COALESCE(%s, remittance_num_label)
            WHERE id = %s
            RETURNING *;
            """,
            (
                c_name, org_name, final_logo_url,
                gst, pan, addr, poc,
                inv_doc, inv_num,
                po_doc, po_num,
                rem_doc, rem_num,
                client_id,
            ),
            fetch="one",
        )
        return {"success": True, "client": dict(updated)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/clients/{client_id}")
async def delete_client(client_id: int):
    """Delete a client and unassign its records."""
    if client_id == 1:
        raise HTTPException(status_code=400, detail="Default organization (Client #1) cannot be deleted.")
    try:
        db.execute_query("UPDATE invoices SET client_id = NULL WHERE client_id = %s;", (client_id,))
        db.execute_query("UPDATE purchase_orders SET client_id = NULL WHERE client_id = %s;", (client_id,))
        db.execute_query("UPDATE remittances SET client_id = NULL WHERE client_id = %s;", (client_id,))
        db.execute_query("DELETE FROM clients WHERE id = %s;", (client_id,))
        return {"success": True, "message": f"Client {client_id} deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
async def history(client_id: Optional[int] = None):
    """Kept for backward compat — delegates to /records/all."""
    return await records_all(client_id=client_id)


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
        i.client_id,
        c.organization_name, c.client_name, c.logo_url, c.gst_number AS client_gstin,
        i.created_at
    FROM invoices i
    LEFT JOIN purchase_orders p ON (p.po_number = i.po_number OR LTRIM(COALESCE(p.po_number, ''), '0') = LTRIM(COALESCE(i.po_number, ''), '0'))
    LEFT JOIN remittances r     ON (r.invoice_number = i.invoice_number OR POSITION(COALESCE(i.invoice_number, '___') IN COALESCE(r.invoice_number, '')) > 0)
    LEFT JOIN clients c         ON c.id = i.client_id
"""


@app.get("/records/all")
async def records_all(client_id: Optional[int] = None):
    """Return ALL saved records: combined joined list, plus individual tables for Invoices, POs, and Remittances."""
    try:
        if client_id:
            combined_rows = db.execute_query(
                _RECORDS_SQL + " WHERE i.client_id = %s ORDER BY i.created_at DESC",
                (client_id,),
                fetch="all",
            )
            invoice_rows = db.execute_query(
                "SELECT * FROM invoices WHERE client_id = %s ORDER BY created_at DESC",
                (client_id,),
                fetch="all",
            )
            po_rows = db.execute_query(
                "SELECT * FROM purchase_orders WHERE client_id = %s ORDER BY created_at DESC",
                (client_id,),
                fetch="all",
            )
            rem_rows = db.execute_query(
                "SELECT * FROM remittances WHERE client_id = %s ORDER BY created_at DESC",
                (client_id,),
                fetch="all",
            )
        else:
            combined_rows = db.execute_query(
                _RECORDS_SQL + " ORDER BY i.created_at DESC",
                fetch="all",
            )
            invoice_rows = db.execute_query(
                "SELECT * FROM invoices ORDER BY created_at DESC",
                fetch="all",
            )
            po_rows = db.execute_query(
                "SELECT * FROM purchase_orders ORDER BY created_at DESC",
                fetch="all",
            )
            rem_rows = db.execute_query(
                "SELECT * FROM remittances ORDER BY created_at DESC",
                fetch="all",
            )

        combined = [dict(r) for r in (combined_rows or [])]
        invoices = [dict(r) for r in (invoice_rows or [])]
        pos = [dict(r) for r in (po_rows or [])]
        remittances = [dict(r) for r in (rem_rows or [])]

        return {
            "success":         True,
            "total":           len(combined),
            "client_id":       client_id,
            "records":         combined,
            "combined":        combined,
            "invoices":        invoices,
            "purchase_orders": pos,
            "remittances":     remittances,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


SEARCHABLE_FIELDS = {
    "invoice_number":    "(i.invoice_number ILIKE %s OR r.invoice_number ILIKE %s)",
    "po_number":         "(p.po_number ILIKE %s OR i.po_number ILIKE %s OR LTRIM(COALESCE(p.po_number, ''), '0') ILIKE %s OR LTRIM(COALESCE(i.po_number, ''), '0') ILIKE %s)",
    "remittance_number": "(r.remittance_number ILIKE %s)",
    "description":       "(i.description ILIKE %s OR p.description ILIKE %s OR r.description ILIKE %s)",
    "invoice_date":      "(CAST(i.invoice_date AS TEXT) ILIKE %s)",
    "po_date":           "(CAST(p.po_date AS TEXT) ILIKE %s)",
    "all":               None,
}

@app.get("/search")
async def search(q: str = "", field: str = "all"):
    """
    Search DB records by a specific field or across all text fields.
    - field: invoice_number | po_number | remittance_number | description | invoice_date | po_date | all
    - q:     search term (case-insensitive, partial match)
    """
    if not q.strip():
        return await records_all()

    try:
        clean_q = q.strip()
        q_like = f"%{clean_q}%"
        q_ltrim = f"%{clean_q.lstrip('0')}%" if clean_q.lstrip('0') else q_like

        if field == "all":
            sql = _RECORDS_SQL + """
                WHERE (
                    i.invoice_number    ILIKE %s OR
                    r.invoice_number    ILIKE %s OR
                    p.po_number         ILIKE %s OR
                    i.po_number         ILIKE %s OR
                    LTRIM(COALESCE(p.po_number, ''), '0') ILIKE %s OR
                    r.remittance_number ILIKE %s OR
                    i.description       ILIKE %s OR
                    p.description       ILIKE %s OR
                    r.description       ILIKE %s OR
                    i.invoice_period    ILIKE %s OR
                    CAST(i.invoice_date AS TEXT) ILIKE %s OR
                    CAST(p.po_date AS TEXT)      ILIKE %s OR
                    CAST(r.remittance_date AS TEXT) ILIKE %s
                )
                ORDER BY i.created_at DESC
            """
            params = (
                q_like, q_like, q_like, q_like, q_ltrim,
                q_like, q_like, q_like, q_like, q_like,
                q_like, q_like, q_like
            )
        elif field == "po_number":
            sql = _RECORDS_SQL + " WHERE " + SEARCHABLE_FIELDS["po_number"] + " ORDER BY i.created_at DESC"
            params = (q_like, q_like, q_ltrim, q_ltrim)
        elif field == "description":
            sql = _RECORDS_SQL + " WHERE " + SEARCHABLE_FIELDS["description"] + " ORDER BY i.created_at DESC"
            params = (q_like, q_like, q_like)
        elif field == "invoice_number":
            sql = _RECORDS_SQL + " WHERE " + SEARCHABLE_FIELDS["invoice_number"] + " ORDER BY i.created_at DESC"
            params = (q_like, q_like)
        elif field in SEARCHABLE_FIELDS and SEARCHABLE_FIELDS[field]:
            sql = _RECORDS_SQL + f" WHERE {SEARCHABLE_FIELDS[field]} ORDER BY i.created_at DESC"
            params = (q_like,)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown search field: {field}")

        rows = db.execute_query(sql, params, fetch="all")
        records = [dict(r) for r in (rows or [])]
        return {
            "success": True,
            "query":   clean_q,
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


def _save_to_db(po: dict, inv: dict, rem: dict, client_id: Optional[int] = None) -> None:
    """
    Upsert all three documents with detailed logging and optional client_id association.
    No FK constraints in DB — all references are soft (plain VARCHAR).
    """

    # 1. Save Purchase Order
    saved_po_number = None
    if po.get("po_number"):
        db.execute_query(
            """INSERT INTO purchase_orders
                   (client_id, po_number, po_date, description, delivery_date, total_amount)
               VALUES (%s,%s,%s,%s,%s,%s)
               ON CONFLICT (po_number) DO UPDATE SET
                   client_id     = COALESCE(EXCLUDED.client_id, purchase_orders.client_id),
                   po_date       = EXCLUDED.po_date,
                   description   = EXCLUDED.description,
                   delivery_date = EXCLUDED.delivery_date,
                   total_amount  = EXCLUDED.total_amount""",
            (client_id, po["po_number"], po.get("po_date"), po.get("description"),
             po.get("delivery_date"), po.get("total_amount", 0)),
        )
        saved_po_number = po["po_number"]
        print(f"[DB] PO saved: {saved_po_number} (client_id={client_id})")

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
                   (client_id, invoice_number, invoice_date, po_number, description,
                    invoice_period, assessable_value, total_tax, total_invoice_value,
                    gst_rate, gst_amount, tds_rate, tds_amount, receivable)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (invoice_number) DO UPDATE SET
                   client_id           = COALESCE(EXCLUDED.client_id, invoices.client_id),
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
            (client_id, inv["invoice_number"], inv.get("invoice_date"),
             inv_po_ref,            # safe FK or None
             inv.get("description"),
             inv.get("invoice_period"), inv.get("assessable_value", 0),
             inv.get("total_tax", 0), inv.get("total_invoice_value", 0),
             inv.get("gst_rate", 18), inv.get("gst_amount", 0),
             inv.get("tds_rate", 2), inv.get("tds_amount", 0),
             inv.get("receivable", 0)),
        )
        saved_inv_number = inv["invoice_number"]
        print(f"[DB] Invoice saved: {saved_inv_number} (client_id={client_id})")

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
                   (client_id, remittance_number, remittance_date, invoice_number, description,
                    gross_amount, total_gross_amount, line_items)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (remittance_number) DO UPDATE SET
                   client_id          = COALESCE(EXCLUDED.client_id, remittances.client_id),
                   remittance_date    = EXCLUDED.remittance_date,
                   invoice_number     = EXCLUDED.invoice_number,
                   description        = EXCLUDED.description,
                   gross_amount       = EXCLUDED.gross_amount,
                   total_gross_amount = EXCLUDED.total_gross_amount,
                   line_items         = EXCLUDED.line_items""",
            (client_id, rem["remittance_number"], rem.get("remittance_date"),
             rem_inv_num, rem.get("description", ""),
             rem.get("gross_amount", 0), rem.get("total_gross_amount", 0),
             line_items_json),
        )
        print(f"[DB] Remittance saved: {rem['remittance_number']} (client_id={client_id})")


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

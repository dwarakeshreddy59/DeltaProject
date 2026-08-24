"""
app.py – Flask entry point for the PDF Data Extraction & Financial Portal.

Routes:
  GET  /              → Main UI
  POST /upload        → Accept 3 PDFs, extract, calculate, save to DB → JSON
  POST /recalculate   → Re-run calculations with new TDS rate → JSON
  GET  /history       → Return all saved records from DB → JSON
  GET  /export/excel  → Download all records as Excel workbook
"""

import os
import json
import uuid
from flask import Flask, request, jsonify, render_template, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from config import Config
from db import connection as db
from extractors import invoice_extractor, po_extractor, remittance_extractor
from calculators.financial_calculator import calculate, VALID_TDS_RATES, GST_RATE
import export_excel

# ── App setup ─────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder="static/react", static_url_path="/")
CORS(app, origins=["http://localhost:3000"])   # allow Vite dev server
app.config.from_object(Config)

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

ALLOWED_EXT = {"pdf"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


# ── Startup ───────────────────────────────────────────────────────────────────

with app.app_context():
    try:
        db.init_pool(Config)
        print("✅ Database connected and schema initialised.")
    except Exception as e:
        print(f"⚠️  DB init failed: {e}. Running without persistence.")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    """Serve the React build in production. In dev, Vite handles this."""
    # API routes are handled before this catch-all
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


@app.route("/upload", methods=["POST"])
def upload():
    """
    Accept multipart form with:
        invoice_pdf, po_pdf, remittance_pdf, tds_rate (optional)
    Returns JSON with all extracted + calculated fields.
    """
    errors = []

    invoice_file    = request.files.get("invoice_pdf")
    po_file         = request.files.get("po_pdf")
    remittance_file = request.files.get("remittance_pdf")
    tds_rate        = float(request.form.get("tds_rate", 2.0))

    if tds_rate not in VALID_TDS_RATES:
        tds_rate = 2.0

    saved = {}
    for label, f in [("invoice", invoice_file), ("po", po_file), ("remittance", remittance_file)]:
        if f and allowed_file(f.filename):
            fname = f"{uuid.uuid4().hex}_{secure_filename(f.filename)}"
            path  = os.path.join(app.config["UPLOAD_FOLDER"], fname)
            f.save(path)
            saved[label] = {"path": path, "original": f.filename}
        else:
            errors.append(f"Missing or invalid file: {label}_pdf")

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    # ── Extract ──────────────────────────────────────────────────────────────
    po_data         = po_extractor.extract(saved["po"]["path"],         saved["po"]["original"])
    invoice_data    = invoice_extractor.extract(saved["invoice"]["path"], saved["invoice"]["original"])
    remittance_data = remittance_extractor.extract(saved["remittance"]["path"])

    # ── Calculate ─────────────────────────────────────────────────────────────
    calc = calculate(
        assessable_value=invoice_data.get("assessable_value", 0.0),
        gst_rate=GST_RATE,
        tds_rate=tds_rate,
    )
    invoice_data.update(calc)

    # If remittance didn't detect invoice_number, use the one from invoice
    if not remittance_data.get("invoice_number"):
        remittance_data["invoice_number"] = invoice_data.get("invoice_number", "")

    # ── Persist ───────────────────────────────────────────────────────────────
    try:
        _save_to_db(po_data, invoice_data, remittance_data, saved)
    except Exception as e:
        errors.append(f"DB save warning: {str(e)}")

    # ── Cleanup temp files ────────────────────────────────────────────────────
    for info in saved.values():
        try:
            os.remove(info["path"])
        except OSError:
            pass

    return jsonify({
        "success":   True,
        "errors":    errors,
        "po":        po_data,
        "invoice":   invoice_data,
        "remittance": remittance_data,
    })


@app.route("/recalculate", methods=["POST"])
def recalculate():
    """
    Re-run financial calculations when TDS dropdown changes.
    Body JSON: { assessable_value, tds_rate, invoice_number (optional) }
    """
    body             = request.get_json(force=True)
    assessable_value = float(body.get("assessable_value", 0))
    tds_rate         = float(body.get("tds_rate", 2.0))
    invoice_number   = body.get("invoice_number", "")

    if tds_rate not in VALID_TDS_RATES:
        tds_rate = 2.0

    calc = calculate(assessable_value, GST_RATE, tds_rate)

    # Update DB if invoice_number provided
    if invoice_number:
        try:
            db.execute_query(
                """UPDATE invoices
                      SET tds_rate  = %s,
                          tds_amount= %s,
                          receivable = %s
                    WHERE invoice_number = %s""",
                (tds_rate, calc["tds_amount"], calc["receivable"], invoice_number),
            )
        except Exception as e:
            print(f"[recalculate] DB update failed: {e}")

    return jsonify({"success": True, **calc})


@app.route("/history", methods=["GET"])
def history():
    """Return all saved records joined across all three tables."""
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
                r.gross_amount, r.total_gross_amount,
                i.created_at
            FROM invoices i
            LEFT JOIN purchase_orders p ON p.po_number = i.po_number
            LEFT JOIN remittances r     ON r.invoice_number = i.invoice_number
            ORDER BY i.created_at DESC
            """,
            fetch="all",
        )
        return jsonify({"success": True, "records": [dict(r) for r in (rows or [])]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e), "records": []}), 500


@app.route("/export/excel", methods=["GET"])
def export_excel_route():
    """Generate and stream an Excel workbook of all records."""
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
            LEFT JOIN purchase_orders p ON p.po_number = i.po_number
            LEFT JOIN remittances r     ON r.invoice_number = i.invoice_number
            ORDER BY i.created_at DESC
            """,
            fetch="all",
        )
        path = export_excel.generate([dict(r) for r in (rows or [])])
        return send_file(path, as_attachment=True, download_name="pdf_portal_export.xlsx")
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ── DB save helper ────────────────────────────────────────────────────────────

def _save_to_db(po: dict, inv: dict, rem: dict, saved: dict) -> None:
    """Upsert all three records; invoice inserts after PO due to FK."""

    # 1. PO
    if po.get("po_number"):
        db.execute_query(
            """INSERT INTO purchase_orders
                   (po_number, po_date, description, delivery_date, total_amount, raw_text)
               VALUES (%s,%s,%s,%s,%s,%s)
               ON CONFLICT (po_number) DO UPDATE SET
                   po_date      = EXCLUDED.po_date,
                   description  = EXCLUDED.description,
                   delivery_date= EXCLUDED.delivery_date,
                   total_amount = EXCLUDED.total_amount""",
            (
                po.get("po_number"),
                po.get("po_date"),
                po.get("description"),
                po.get("delivery_date"),
                po.get("total_amount", 0),
                "",  # raw_text omitted for brevity
            ),
        )

    # 2. Invoice
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
            (
                inv.get("invoice_number"),
                inv.get("invoice_date"),
                inv.get("po_number") or None,
                inv.get("description"),
                inv.get("invoice_period"),
                inv.get("assessable_value", 0),
                inv.get("total_tax", 0),
                inv.get("total_invoice_value", 0),
                inv.get("gst_rate", 18),
                inv.get("gst_amount", 0),
                inv.get("tds_rate", 2),
                inv.get("tds_amount", 0),
                inv.get("receivable", 0),
            ),
        )

    # 3. Remittance
    if rem.get("remittance_number"):
        db.execute_query(
            """INSERT INTO remittances
                   (remittance_number, remittance_date, invoice_number,
                    gross_amount, total_gross_amount)
               VALUES (%s,%s,%s,%s,%s)
               ON CONFLICT (remittance_number) DO UPDATE SET
                   remittance_date    = EXCLUDED.remittance_date,
                   invoice_number     = EXCLUDED.invoice_number,
                   gross_amount       = EXCLUDED.gross_amount,
                   total_gross_amount = EXCLUDED.total_gross_amount""",
            (
                rem.get("remittance_number"),
                rem.get("remittance_date"),
                rem.get("invoice_number") or None,
                rem.get("gross_amount", 0),
                rem.get("total_gross_amount", 0),
            ),
        )


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)

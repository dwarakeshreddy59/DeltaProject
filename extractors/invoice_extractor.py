"""
invoice_extractor.py – Extract all required fields from an Invoice PDF.
"""

import re
from utils.pdf_utils import (
    get_pdf_text, get_pdf_tables,
    find_value_after_label, find_date_after_label, find_amount_after_label,
    clean_number, clean_description, filename_description, is_valid_id,
    extract_smart_id, clean_extracted_id, extract_spatial_field,
)

_INVOICE_NUM_LABELS = [
    r"document\s*(?:no\.?|number|#)",
    r"invoice\s*(?:no\.?|number|#)",
    r"tax\s*invoice\s*(?:no\.?|number|#)",
    r"bill\s*(?:no\.?|number|#)",
    r"doc\.?\s*no\.?",
]

_INVOICE_DATE_LABELS = [
    r"document\s*date",
    r"invoice\s*date",
    r"bill\s*date",
    r"date\s*of\s*invoice",
    r"date\s*of\s*issue",
    r"dated",
    r"\bdate\b",
]

_PO_NUM_LABELS = [
    r"p\.?o\.?\s*(?:no\.?|number|#|ref(?:erence)?|nr\.?)",
    r"(?:po|purchase)\s*order\s*(?:change\s*)?(?:no\.?|number|#|ref(?:erence)?|nr\.?)",
    r"po\s*reference",
    r"buyer['\s]*order\s*no",
    r"customer\s*po",
    r"order\s*no\.?",
]

_INVOICE_PERIOD_LABELS = [
    r"invoice\s*period",
    r"billing\s*period",
    r"service\s*period",
    r"for\s*the\s*(?:month|period)\s*of",
    r"period\s*of\s*service",
]

_DESC_LABELS = [
    r"description\s*of\s*(?:goods|services|service|items?)",
    r"item\s*description",
    r"service\s*description",
    r"details\s*of\s*(?:service|goods)",
    r"scope\s*of\s*work",
    r"nature\s*of\s*(?:service|goods)",
    r"particulars",
    r"item\s*name",
    r"description",
]

_ASSESSABLE_LABELS = [
    r"assessable\s*value",
    r"taxable\s*value",
    r"taxable\s*amount",
    r"total\s*taxable",
    r"basic\s*amount",
    r"amount\s*before\s*tax",
    r"sub\s*total",
]

_TOTAL_TAX_LABELS = [
    r"total\s*tax\s*(?:amount)?",
    r"total\s*gst\s*(?:amount)?",
    r"gst\s*(?:amount|total)",
    r"igst\s*(?:amount)?",
    r"cgst\s*\+\s*sgst",
    r"total\s*tax",
]

_TOTAL_INVOICE_VALUE_LABELS = [
    r"total\s*invoice\s*value",
    r"invoice\s*total",
    r"grand\s*total",
    r"net\s*payable",
    r"total\s*payable",
    r"net\s*amount",
    r"total\s*amount\s*(?:payable|due)?",
]


def extract(pdf_path: str, filename: str) -> dict:
    text   = get_pdf_text(pdf_path)
    tables = get_pdf_tables(pdf_path)

    print(f"\n=== INVOICE RAW TEXT (first 800 chars) ===\n{text[:800]}\n=== END ===\n")

    inv_num     = _extract_invoice_number(text, tables, pdf_path)
    inv_date    = find_date_after_label(text, _INVOICE_DATE_LABELS)
    po_num      = _extract_po_number(text, tables, pdf_path)
    inv_period  = _extract_period(text)
    description = filename_description(filename, inv_num)
    assessable  = _extract_assessable(text, tables)
    total_tax   = _extract_total_tax(text, tables)
    total_val   = _extract_total_invoice(text, tables)

    # Normalize PO Number (strip leading zeros so it connects with PO table: 0080029552 -> 80029552)
    if po_num and po_num.isdigit():
        po_num = po_num.lstrip("0") or po_num

    # If total_tax looks like a rate (< 2), zero it out — it was a percentage, not an amount
    if total_tax < 2:
        total_tax = 0.0

    # Derive missing values
    if total_val > 0 and assessable == 0.0:
        assessable = round(total_val - total_tax, 2)
    elif assessable > 0 and total_val == 0.0:
        gst = round(assessable * 18 / 100, 2)
        total_val = round(assessable + gst, 2)

    return {
        "invoice_number":      inv_num,
        "invoice_date":        inv_date,
        "po_number":           po_num,
        "description":         description,
        "invoice_period":      inv_period,
        "assessable_value":    assessable,
        "total_tax":           total_tax,
        "total_invoice_value": total_val,
    }


def _extract_invoice_number(text: str, tables: list, pdf_path: str = None) -> str:
    # 1. Smart Multi-Layout Extractor (beside, down-to-it, malformed separators, 2D table grid, spatial)
    smart_id = extract_smart_id(text, _INVOICE_NUM_LABELS, tables=tables, pdf_path=pdf_path, min_len=3, require_digit=False)
    if smart_id:
        return smart_id

    # 2. Direct regex search fallback
    m = re.search(
        r"(?:Document|Invoice|Tax\s*Invoice|Bill|Doc)\s*(?:No\.?|Number|#)\s*[:\-]?\s*([A-Za-z0-9\-_/]+)",
        text, re.IGNORECASE
    )
    if m:
        cand = clean_extracted_id(m.group(1))
        if is_valid_id(cand):
            return cand

    val = find_value_after_label(text, _INVOICE_NUM_LABELS)
    if val:
        token = clean_extracted_id(val.split()[0])
        if is_valid_id(token):
            return token

    return _search_tables(tables, ["document no", "invoice no", "bill no", "tax invoice"])


def _extract_po_number(text: str, tables: list, pdf_path: str = None) -> str:
    smart_id = extract_smart_id(text, _PO_NUM_LABELS, tables=tables, pdf_path=pdf_path, min_len=4, require_digit=True)
    if smart_id and not smart_id.lower().startswith("date"):
        return smart_id

    m = re.search(
        r"(?:PO|P\.O\.|Purchase\s*Order)\s*(?:No\.?|Number|#)?\s*[:\-]?\s*([A-Za-z0-9\-_/]{4,})",
        text, re.IGNORECASE
    )
    if m:
        val = clean_extracted_id(m.group(1))
        if is_valid_id(val, min_len=4, require_digit=True) and not val.lower().startswith("date"):
            return val

    val = find_value_after_label(text, _PO_NUM_LABELS)
    if val:
        token = clean_extracted_id(val.split()[0])
        if is_valid_id(token, min_len=4, require_digit=True):
            return token

    return _search_tables(tables, ["p.o no", "po no", "purchase order no", "order no"])


def _extract_period(text: str) -> str:
    val = find_value_after_label(text, _INVOICE_PERIOD_LABELS)
    if val:
        return val[:60].strip()
    m = re.search(
        r"(?:for\s+the\s+(?:month|period)\s+of)\s+([A-Za-z0-9\s,.\-/]{3,40})",
        text, re.IGNORECASE
    )
    if m:
        return m.group(1).strip()[:60]
    return ""


def _extract_description(text: str, tables: list, filename: str, inv_num: str = "", po_num: str = "") -> str:
    """Extract item/service description from PDF tables (supporting multiple rows/lines), label patterns, or cleaned filename."""
    # 1. Search tables for Description / Particulars column across all rows and lines
    table_descs = []
    for table in tables:
        if not table or len(table) < 2:
            continue
        header_row = [str(c).lower() if c else "" for c in table[0]]
        desc_col_idx = -1
        for idx, h in enumerate(header_row):
            if any(k in h for k in ["description", "particular", "service", "item name", "details", "scope of work"]):
                desc_col_idx = idx
                break
        
        if desc_col_idx >= 0:
            for row in table[1:]:
                if row and len(row) > desc_col_idx and row[desc_col_idx]:
                    cell_val = str(row[desc_col_idx]).strip()
                    if any(bad in cell_val.lower() for bad in ["total", "cgst", "sgst", "igst", "taxable", "hsn", "subtotal", "amount in words"]):
                        continue
                    # Split lines inside the cell
                    for line_part in cell_val.split("\n"):
                        cleaned = clean_description(line_part[:100], inv_num=inv_num, po_num=po_num)
                        if len(cleaned) > 2 and not cleaned.isdigit() and cleaned not in table_descs:
                            table_descs.append(cleaned)

    if table_descs:
        return ", ".join(table_descs)

    # 2. Search labels in text (collect multiple lines)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    text_descs = []
    for i, line in enumerate(lines):
        for pat in _DESC_LABELS:
            if re.search(pat, line, re.IGNORECASE):
                after = re.sub(pat, "", line, flags=re.IGNORECASE).strip(":- \t")
                if after:
                    c = clean_description(after[:100], inv_num=inv_num, po_num=po_num)
                    if len(c) > 2 and not c.isdigit() and c not in text_descs:
                        text_descs.append(c)
                # Look ahead for up to 6 subsequent description lines
                for j in range(1, 7):
                    if i + j < len(lines):
                        nxt = lines[i + j]
                        if re.search(r"^(?:Total|Taxable|GST|Amount|Bank|Terms|Declaration|HSN|SAC|Assessable|Assessable Value|Total Tax)\b", nxt, re.IGNORECASE):
                            break
                        c = clean_description(nxt[:100], inv_num=inv_num, po_num=po_num)
                        if len(c) > 2 and not c.isdigit() and c not in text_descs:
                            text_descs.append(c)
                if text_descs:
                    return ", ".join(text_descs)

    # 3. Fallback: clean filename
    return clean_description(filename_description(filename), inv_num=inv_num, po_num=po_num)



def _extract_assessable(text: str, tables: list) -> float:
    val = find_amount_after_label(text, _ASSESSABLE_LABELS)
    if val > 0:
        return val
    for table in tables:
        for row in table:
            if not row:
                continue
            row_text = " ".join(str(c) for c in row if c).lower()
            if any(k in row_text for k in ["assessable", "taxable", "basic amount"]):
                for cell in reversed(row):
                    n = clean_number(str(cell))
                    if n > 1:
                        return n
    return 0.0


def _extract_total_tax(text: str, tables: list) -> float:
    val = find_amount_after_label(text, _TOTAL_TAX_LABELS)
    if val > 2:
        return val
    for table in tables:
        for row in table:
            if not row:
                continue
            row_text = " ".join(str(c) for c in row if c).lower()
            if any(k in row_text for k in ["total tax", "total gst", "igst", "cgst"]):
                for cell in reversed(row):
                    n = clean_number(str(cell))
                    if n > 2:
                        return n
    return 0.0


def _extract_total_invoice(text: str, tables: list) -> float:
    val = find_amount_after_label(text, _TOTAL_INVOICE_VALUE_LABELS)
    if val > 0:
        return val
    for table in tables:
        for row in table:
            if not row:
                continue
            row_text = " ".join(str(c) for c in row if c).lower()
            if any(k in row_text for k in ["grand total", "total invoice", "net payable", "net amount"]):
                for cell in reversed(row):
                    n = clean_number(str(cell))
                    if n > 0:
                        return n
    return 0.0


def _search_tables(tables: list, labels: list) -> str:
    for table in tables:
        for row in table:
            if not row:
                continue
            for idx, cell in enumerate(row):
                if cell and any(lbl in str(cell).lower() for lbl in labels):
                    for j in range(idx + 1, len(row)):
                        v = str(row[j]).strip() if row[j] else ""
                        if is_valid_id(v):
                            return v
    return ""

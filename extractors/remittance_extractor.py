"""
remittance_extractor.py – Extract fields from a Remittance / Payment Advice PDF.
Supports multiple line items / gross amounts / descriptions.
"""

import re
from utils.pdf_utils import (
    get_pdf_text, get_pdf_tables,
    find_value_after_label, find_date_after_label,
    clean_number, is_valid_id, DATE_REGEX,
)

_REM_NUM_LABELS = [
    r"document\s*(?:number|no\.?|#)",
    r"remittance\s*(?:no\.?|number|#|ref)",
    r"payment\s*(?:ref(?:erence)?|no\.?|number|id)",
    r"voucher\s*(?:no\.?|number)",
    r"cheque\s*(?:no\.?|number)",
    r"neft\s*(?:ref|no\.?|number|utr)",
    r"utr\s*(?:no\.?|number)?",
    r"transaction\s*(?:id|ref|no\.?)",
    r"doc\.?\s*no\.?",
]

_REM_DATE_LABELS = [
    r"remittance\s*date",
    r"payment\s*date",
    r"document\s*date",
    r"value\s*date",
    r"transaction\s*date",
    r"date\s*of\s*payment",
    r"advice\s*date",
    r"dated",
    r"^date\b",
    r"\bdate\b",
]

_INV_REF_LABELS = [
    r"your\s*document",
    r"your\s*ref(?:erence)?",
    r"invoice\s*(?:no\.?|number|#|ref)",
    r"against\s*invoice",
    r"bill\s*(?:no\.?|number)",
    r"inv\.?\s*(?:no\.?|#)",
]


def extract(pdf_path: str, target_invoice_number: str = "") -> dict:
    text   = get_pdf_text(pdf_path)
    tables = get_pdf_tables(pdf_path)

    print(f"\n=== REMITTANCE RAW TEXT (first 800 chars) ===\n{text[:800]}\n=== END ===\n")

    doc_num  = _extract_doc_number(text, tables)
    rem_date = _extract_remittance_date(text)
    items    = _extract_all_cleared_items(text, tables)
    total_gross = _extract_total_amount(text, tables, items)

    # Resolve primary gross_amount, invoice_number, and description
    inv_ref = ""
    gross_amount = 0.0
    desc = ""

    if items:
        # Check if any item matches the uploaded target invoice
        matched_item = None
        if target_invoice_number:
            target_norm = target_invoice_number.strip().lower()
            for it in items:
                if it.get("invoice_number", "").strip().lower() == target_norm:
                    matched_item = it
                    break

        if matched_item:
            inv_ref = matched_item["invoice_number"]
            gross_amount = matched_item["gross_amount"]
            desc = matched_item.get("description", "")
        else:
            # Combine invoice numbers and descriptions if multiple
            inv_ref = ", ".join(dict.fromkeys(it["invoice_number"] for it in items if it.get("invoice_number")))
            gross_amount = items[0]["gross_amount"] if len(items) == 1 else total_gross
            desc = "; ".join(dict.fromkeys(it["description"] for it in items if it.get("description")))
    else:
        inv_ref = _extract_single_invoice_ref(text, tables)
        gross_amount = total_gross

    if not gross_amount and total_gross > 0:
        gross_amount = total_gross
    if not total_gross and gross_amount > 0:
        total_gross = gross_amount

    return {
        "remittance_number":  doc_num,
        "remittance_date":    rem_date,
        "invoice_number":     inv_ref,
        "description":         desc,
        "gross_amount":       gross_amount,
        "total_gross_amount": total_gross,
        "items":              items,
    }


def _extract_doc_number(text: str, tables: list) -> str:
    """Find doc/voucher/UTR/payment reference number (must contain digits)."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # 1. Label-based search across lines
    for i, line in enumerate(lines[:25]):
        for pat in _REM_NUM_LABELS:
            m = re.search(pat, line, re.IGNORECASE)
            if m:
                after = line[m.end():].strip(":- \t")
                tokens = [t for t in after.split() if is_valid_id(t, min_len=4, require_digit=True)]
                if tokens:
                    return tokens[0]
                for j in range(1, 4):
                    if i + j < len(lines):
                        cand_line = lines[i + j].strip(":- \t")
                        tokens = [t for t in cand_line.split() if is_valid_id(t, min_len=4, require_digit=True)]
                        if tokens:
                            return tokens[0]

    # 2. General regex finditer
    for m in re.finditer(r"(?:Document\s*(?:Number|No\.?|#)|Voucher\s*(?:No\.?|Number)|Payment\s*(?:Ref|No)|UTR)\s*[:\-]?\s*([A-Za-z0-9\-_/]{4,30})", text, re.IGNORECASE):
        val = m.group(1).strip()
        if is_valid_id(val, min_len=4, require_digit=True):
            return val

    # 3. Table search
    val = _table_value(tables, ["document number", "remittance no", "payment ref", "voucher no", "utr", "transaction id"])
    if val:
        return val

    # 4. Fallback: 8-12 digit ID in header
    for m in re.finditer(r"\b(\d{8,12})\b", text[:400]):
        cand = m.group(1)
        if cand != "0008005972" and not cand.startswith("00"):
            return cand

    return ""


def _extract_remittance_date(text: str) -> str:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for i, line in enumerate(lines[:25]):
        for pat in _REM_DATE_LABELS:
            if re.search(pat, line, re.IGNORECASE):
                d = DATE_REGEX.search(line)
                if d:
                    return d.group()
                for j in range(1, 4):
                    if i + j < len(lines):
                        d = DATE_REGEX.search(lines[i + j])
                        if d:
                            return d.group()
    # Fallback to any date in header
    for line in lines[:15]:
        d = DATE_REGEX.search(line)
        if d:
            return d.group()
    return ""


def _extract_all_cleared_items(text: str, tables: list) -> list:
    """
    Extract all cleared invoice rows, gross amounts, and descriptions.
    Pattern: <doc_num> <invoice_no> <date> <deductions> <gross_amount>
    e.g. 6068264211 DT-2627-05-5110 11.05.2026 0,00 1.397.655,00
         Apr2026-Engineering
    """
    items = []
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # 1. Text row scanning
    for idx, line in enumerate(lines):
        m_row = re.search(
            r"\b(\d{5,})\s+([A-Za-z0-9\-_/]{4,30})\s+(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+([0-9.,]+)\s+([0-9.,]+)",
            line,
        )
        if m_row:
            d_no = m_row.group(1)
            inv_no = m_row.group(2)
            d_date = m_row.group(3)
            ded = clean_number(m_row.group(4))
            gross = clean_number(m_row.group(5))

            item_desc = ""
            if idx + 1 < len(lines):
                next_l = lines[idx + 1]
                if not re.search(r"^\d{5,}|Total|AGCO|BATAVIA", next_l, re.IGNORECASE):
                    item_desc = next_l.strip()

            if is_valid_id(inv_no, min_len=4, require_digit=True):
                items.append({
                    "doc_number": d_no,
                    "invoice_number": inv_no,
                    "date": d_date,
                    "deductions": ded,
                    "gross_amount": gross,
                    "description": item_desc,
                })

    # 2. Table scanning (if text rows not found)
    if not items:
        for table in tables:
            if not table or len(table) < 2:
                continue
            header_row = [str(c).lower() if c else "" for c in table[0]]
            inv_col = -1
            amt_col = -1
            desc_col = -1
            for idx, h in enumerate(header_row):
                if any(k in h for k in ["your document", "your ref", "invoice no", "bill no"]):
                    inv_col = idx
                if any(k in h for k in ["gross amount", "amount", "payment", "cleared"]):
                    amt_col = idx
                if any(k in h for k in ["description", "text", "particular"]):
                    desc_col = idx

            if inv_col >= 0:
                for row in table[1:]:
                    if row and len(row) > inv_col:
                        cand = str(row[inv_col]).strip()
                        if is_valid_id(cand, min_len=4, require_digit=True):
                            amt = 0.0
                            if amt_col >= 0 and len(row) > amt_col:
                                amt = clean_number(row[amt_col])
                            desc_txt = ""
                            if desc_col >= 0 and len(row) > desc_col:
                                desc_txt = str(row[desc_col]).strip()
                            items.append({
                                "doc_number": "",
                                "invoice_number": cand,
                                "date": "",
                                "deductions": 0.0,
                                "gross_amount": amt,
                                "description": desc_txt,
                            })

    return items


def _extract_single_invoice_ref(text: str, tables: list) -> str:
    m = re.search(
        r"(?:Your\s*Document|Invoice|Bill|Inv)\s*(?:No\.?|Number|#|Ref)?\s*[:\-]?\s*([A-Za-z0-9\-_/]{3,30})",
        text, re.IGNORECASE,
    )
    if m and is_valid_id(m.group(1), min_len=3, require_digit=True):
        return m.group(1).strip()

    val = find_value_after_label(text, _INV_REF_LABELS)
    if val:
        token = val.split()[0]
        if is_valid_id(token, min_len=3, require_digit=True):
            return token

    return _table_value(tables, ["your document", "invoice no", "bill no", "invoice number"])


def _extract_total_amount(text: str, tables: list, items: list) -> float:
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # 1. Search for Total / INR / Grand Total
    for line in lines:
        if re.search(r"^(?:Total\s*Total|Total|INR)\b", line, re.IGNORECASE):
            amt = clean_number(line)
            if amt > 100:
                return amt

    # 2. Sum of line items
    if items:
        tot = sum(it.get("gross_amount", 0) for it in items)
        if tot > 0:
            return tot

    # 3. Search tables
    for table in tables:
        for row in table:
            if not row:
                continue
            row_text = " ".join(str(c) for c in row if c).lower()
            if "total" in row_text:
                for cell in reversed(row):
                    amt = clean_number(str(cell))
                    if amt > 100:
                        return amt

    return 0.0


def _table_value(tables: list, labels: list) -> str:
    for table in tables:
        for row in table:
            if not row:
                continue
            for idx, cell in enumerate(row):
                if cell and any(lbl in str(cell).lower() for lbl in labels):
                    for j in range(idx + 1, len(row)):
                        v = str(row[j]).strip() if row[j] else ""
                        if is_valid_id(v, min_len=3, require_digit=True):
                            return v
    return ""

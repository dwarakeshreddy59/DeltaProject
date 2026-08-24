"""
remittance_extractor.py – Extract fields from a Remittance / Payment Advice PDF.
"""

import re
from utils.pdf_utils import (
    get_pdf_text, get_pdf_tables,
    find_value_after_label, find_date_after_label,
    clean_number, is_valid_id, DATE_REGEX,
)

_REM_NUM_LABELS = [
    r"document\s*number",
    r"remittance\s*(?:no\.?|number|#|ref|advice)",
    r"payment\s*(?:ref(?:erence)?|no\.?|number|id|advice)",
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
_GROSS_LABELS = [
    r"gross\s*amount",
    r"invoice\s*amount",
    r"amount\s*(?:paid|remitted|payable|due)",
    r"payment\s*amount",
    r"net\s*amount\s*paid",
    r"total\s*amount\s*paid",
]
_TOTAL_LABELS = [
    r"total\s*(?:gross\s*)?amount",
    r"total\s*total",
    r"total\s*payment",
    r"grand\s*total",
    r"net\s*payable",
    r"total\s*remittance",
    r"total",
]


def extract(pdf_path: str) -> dict:
    text   = get_pdf_text(pdf_path)
    tables = get_pdf_tables(pdf_path)

    print(f"\n=== REMITTANCE RAW TEXT (first 800 chars) ===\n{text[:800]}\n=== END ===\n")

    doc_num  = _extract_doc_number(text, tables)
    rem_date = _extract_remittance_date(text)
    inv_ref, row_gross = _extract_cleared_row(text, tables)
    
    if not inv_ref:
        inv_ref = _extract_invoice_ref(text, tables)

    gross, total_gross = _extract_amounts(text, tables, row_gross)

    return {
        "remittance_number":  doc_num,
        "remittance_date":    rem_date,
        "invoice_number":     inv_ref,
        "gross_amount":       gross,
        "total_gross_amount": total_gross,
    }


def _extract_doc_number(text: str, tables: list) -> str:
    """Find doc/voucher/UTR/payment reference number (must contain digits)."""
    m = re.search(
        r"(?:Document\s*Number|Remittance|Payment|Voucher|UTR|NEFT|Transaction|Cheque)"
        r"\s*(?:No\.?|Number|#|Ref|ID)?\s*[:\-]?\s*([A-Za-z0-9\-_/]{4,30})",
        text, re.IGNORECASE,
    )
    if m and is_valid_id(m.group(1), min_len=4, require_digit=True):
        return m.group(1).strip()

    val = find_value_after_label(text, _REM_NUM_LABELS)
    if val:
        token = val.split()[0]
        if is_valid_id(token, min_len=4, require_digit=True):
            return token

    return _table_value(tables, ["document number", "remittance no", "payment ref", "voucher no", "utr", "transaction id"])


def _extract_remittance_date(text: str) -> str:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for i, line in enumerate(lines[:20]):
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


def _extract_cleared_row(text: str, tables: list) -> tuple[str, float]:
    """
    Search for cleared invoices table row in text:
    Pattern: <doc_num> <invoice_no> <date> <deductions> <gross_amount>
    e.g. '6068421035 DT-2627-06-5402 18.06.2026 0,00 156.679,38'
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for line in lines:
        m = re.search(
            r"\b\d{5,}\s+([A-Za-z0-9\-_/]{4,30})\s+\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s+[0-9.,]+\s+([0-9.,]+)",
            line,
        )
        if m:
            inv = m.group(1).strip()
            amt = clean_number(m.group(2))
            if is_valid_id(inv, min_len=4, require_digit=True):
                return inv, amt

    # Also search tables
    for table in tables:
        if not table or len(table) < 2:
            continue
        header_row = [str(c).lower() if c else "" for c in table[0]]
        inv_col = -1
        amt_col = -1
        for idx, h in enumerate(header_row):
            if any(k in h for k in ["your document", "your ref", "invoice no", "bill no"]):
                inv_col = idx
            if any(k in h for k in ["gross amount", "amount", "payment", "cleared"]):
                amt_col = idx
        if inv_col >= 0:
            for row in table[1:]:
                if row and len(row) > inv_col:
                    cand = str(row[inv_col]).strip()
                    if is_valid_id(cand, min_len=4, require_digit=True):
                        amt = 0.0
                        if amt_col >= 0 and len(row) > amt_col:
                            amt = clean_number(row[amt_col])
                        return cand, amt

    return "", 0.0


def _extract_invoice_ref(text: str, tables: list) -> str:
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


def _extract_amounts(text: str, tables: list, row_gross: float = 0.0) -> tuple[float, float]:
    """
    Extract (gross_amount, total_gross_amount).
    """
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    
    total_val = 0.0
    # Search for lines starting with Total or INR
    for line in lines:
        if re.search(r"^(?:Total\s*Total|Total|INR)\b", line, re.IGNORECASE):
            amt = clean_number(line)
            if amt > total_val:
                total_val = amt

    if row_gross > 0:
        gross = row_gross
    else:
        gross = _label_amount(text, tables, _GROSS_LABELS)

    if total_val == 0.0:
        total_val = _label_amount(text, tables, _TOTAL_LABELS)

    if gross == 0.0 and total_val > 0:
        gross = total_val
    elif total_val == 0.0 and gross > 0:
        total_val = gross

    # Fallback: scan all lines for largest amount
    if gross == 0.0:
        amounts = []
        for line in lines:
            if any(k in line.lower() for k in ["total", "gross", "inr", "rs", "payment"]):
                amt = clean_number(line)
                if amt > 100:
                    amounts.append(amt)
        if amounts:
            gross = max(amounts)
            total_val = max(amounts)

    return gross, total_val


def _label_amount(text: str, tables: list, labels: list) -> float:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for i, line in enumerate(lines):
        for pat in labels:
            if re.search(pat, line, re.IGNORECASE):
                after = re.sub(re.compile(pat, re.IGNORECASE), "", line)
                n = clean_number(after)
                if n > 100:
                    return n
                for j in range(1, 4):
                    if i + j < len(lines):
                        n = clean_number(lines[i + j])
                        if n > 100:
                            return n

    for table in tables:
        for row in table:
            if not row:
                continue
            row_text = " ".join(str(c) for c in row if c).lower()
            if any(re.search(p, row_text, re.IGNORECASE) for p in labels):
                for cell in reversed(row):
                    n = clean_number(str(cell))
                    if n > 100:
                        return n
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

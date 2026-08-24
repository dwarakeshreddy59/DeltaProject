"""
po_extractor.py – Extract all required fields from a Purchase Order PDF.
"""
import re, os
from utils.pdf_utils import (
    get_pdf_text, get_pdf_tables,
    find_value_after_label, find_date_after_label,
    clean_number, clean_description, filename_description, is_valid_id,
)

_PO_NUM_LABELS = [
    r"p\.?o\.?\s*(?:no\.?|number|#|ref|nr\.?)",
    r"purchase\s*order\s*(?:change\s*)?(?:no\.?|number|#|nr\.?)",
    r"order\s*(?:no\.?|number|#|nr\.?)",
    r"our\s*order\s*(?:no\.?|number|nr\.?)",
]
_PO_DATE_LABELS = [
    r"p\.?o\.?\s*date",
    r"purchase\s*order\s*date",
    r"order\s*date",
    r"date\s*of\s*order",
    r"order\s*placed\s*(?:on)?",
    r"issued\s*(?:on|date)",
    r"^date\b",
    r"\bdate\b",
]
_DELIVERY_DATE_LABELS = [
    r"delivery\s*date",
    r"deliver(?:y|ed)\s*(?:by|on)",
    r"required\s*(?:by|date|delivery)",
    r"po\s*validity",
    r"valid(?:ity)?\s*(?:till|upto|up\s*to)",
    r"expected\s*(?:delivery|date)",
    r"due\s*date",
    r"schedule(?:d)?\s*date",
]
_DESC_LABELS = [
    r"description\s*of\s*(?:goods|services|service|items?)",
    r"short\s*text",
    r"item\s*description",
    r"service\s*description",
    r"material\s*(?:/\s*)?description",
    r"item\s*details",
    r"particulars",
    r"description",
]
_TOTAL_AMOUNT_LABELS = [
    r"total\s*(?:po\s*)?amount",
    r"grand\s*total",
    r"order\s*value",
    r"total\s*value",
    r"net\s*total",
    r"total\s*(?:order\s*)?price",
]

_DATE_RE = re.compile(
    r"\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}"
    r"|\d{4}[./-]\d{1,2}[./-]\d{1,2}"
    r"|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{2,4}"
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[,\s]+\d{2,4})\b",
    re.IGNORECASE,
)


def extract(pdf_path: str, filename: str) -> dict:
    text   = get_pdf_text(pdf_path)
    tables = get_pdf_tables(pdf_path)

    print(f"\n=== PO RAW TEXT (first 800 chars) ===\n{text[:800]}\n=== END ===\n")

    po_num        = _extract_po_number(text, tables, filename)
    po_date       = _find_date(text, _PO_DATE_LABELS)
    delivery_date = _find_date(text, _DELIVERY_DATE_LABELS)
    description   = _extract_description(text, tables, filename, po_num)
    total_amount  = _extract_total(text, tables)

    # Normalize PO Number (strip leading zeros: 0080029552 -> 80029552)
    if po_num and po_num.isdigit():
        po_num = po_num.lstrip("0") or po_num

    return {
        "po_number":     po_num,
        "po_date":       po_date,
        "description":   description,
        "delivery_date": delivery_date,
        "total_amount":  total_amount,
    }


def _find_date(text: str, label_patterns: list) -> str:
    """Find a date near the given label patterns with extended format support."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    for i, line in enumerate(lines):
        for pat in label_patterns:
            if re.search(pat, line, re.IGNORECASE):
                # 1. After the label on same line
                after = re.sub(re.compile(pat, re.IGNORECASE), "", line)
                d = _DATE_RE.search(after)
                if d:
                    return d.group()
                # 2. Whole line might contain date
                d = _DATE_RE.search(line)
                if d:
                    return d.group()
                # 3. Next several lines
                for j in range(1, 6):
                    if i + j < len(lines):
                        d = _DATE_RE.search(lines[i + j])
                        if d:
                            return d.group()

    # Global fallback: find any date in first half of document
    half = text[:len(text)//2]
    d = _DATE_RE.search(half)
    if d:
        return d.group()
    return ""


def _extract_po_number(text: str, tables: list, filename: str) -> str:
    m = re.search(
        r"(?:PO|P\.O\.|Purchase\s*Order|Order)\s*(?:Change\s*)?(?:No\.?|Number|#|Nr\.?)?\s*[:\-]?\s*([A-Za-z0-9\-_/]{4,30})",
        text, re.IGNORECASE,
    )
    if m:
        val = m.group(1).strip()
        if is_valid_id(val, min_len=4, require_digit=True):
            return val

    val = find_value_after_label(text, _PO_NUM_LABELS)
    if val:
        token = val.split()[0]
        if is_valid_id(token, min_len=4, require_digit=True):
            return token

    res = _table_value(tables, ["p.o no", "po no", "order no", "po number"])
    if res:
        return res

    m2 = re.match(r"^(\d{5,})", os.path.splitext(os.path.basename(filename))[0])
    if m2:
        return m2.group(1)

    return ""


def _extract_description(text: str, tables: list, filename: str, po_num: str = "") -> str:
    """Extract description from PO tables, labels, or cleaned filename."""
    # 1. Search tables for Description / Short Text column
    for table in tables:
        if not table or len(table) < 2:
            continue
        header_row = [str(c).lower() if c else "" for c in table[0]]
        desc_col_idx = -1
        for idx, h in enumerate(header_row):
            if any(k in h for k in ["description", "short text", "material", "item details", "service", "particular"]):
                desc_col_idx = idx
                break
        
        if desc_col_idx >= 0:
            for row in table[1:]:
                if row and len(row) > desc_col_idx and row[desc_col_idx]:
                    cell_val = str(row[desc_col_idx]).strip()
                    if any(bad in cell_val.lower() for bad in ["total", "subtotal", "tax", "gst", "amount"]):
                        continue
                    if len(cell_val) > 2 and not cell_val.isdigit():
                        return clean_description(cell_val[:100], po_num=po_num)

    # 2. Search labels in text
    val = find_value_after_label(text, _DESC_LABELS)
    if val:
        cleaned_val = clean_description(val[:100], po_num=po_num)
        if len(cleaned_val) > 3 and not any(bad in cleaned_val.lower() for bad in ["total", "taxable", "hsn", "amount"]):
            return cleaned_val

    # 3. Fallback: clean filename
    return clean_description(filename_description(filename), po_num=po_num)


def _extract_total(text: str, tables: list) -> float:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for i, line in enumerate(lines):
        for pat in _TOTAL_AMOUNT_LABELS:
            if re.search(pat, line, re.IGNORECASE):
                after = re.sub(re.compile(pat, re.IGNORECASE), "", line)
                n = clean_number(after)
                if n > 0:
                    return n
                for j in range(1, 4):
                    if i + j < len(lines):
                        n = clean_number(lines[i + j])
                        if n > 0:
                            return n

    for table in tables:
        for row in table:
            if not row:
                continue
            row_text = " ".join(str(c) for c in row if c).lower()
            if "total" in row_text:
                for cell in reversed(row):
                    n = clean_number(str(cell))
                    if n > 0:
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
                        if is_valid_id(v, min_len=4, require_digit=True):
                            return v
    return ""

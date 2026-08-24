"""
pdf_utils.py – Shared helpers for reading PDF text, amounts, and extracting fields.
"""

import re
import os
import pdfplumber
import fitz  # PyMuPDF

# Words that should NEVER be accepted as a document number / ID
_ID_BLACKLIST = {
    "und", "and", "the", "for", "from", "date", "no", "number", "ref",
    "change", "amount", "advice", "payment", "total", "net", "gross",
    "value", "tax", "rate", "invoice", "order", "purchase", "remittance",
    "doc", "document", "bill", "receipt", "voucher", "yes", "not", "null",
    "na", "n/a", "none", "pending", "proceding", "proceeding", "against",
    "per", "unit", "qty", "quantity", "price", "gst", "igst", "cgst",
    "sgst", "tds", "vat", "pan", "gstin", "bank", "name", "dear", "sir",
    "to", "be", "in", "of", "or", "by", "as", "at", "on", "up", "is",
    "it", "an", "we", "us", "our", "your", "with", "this", "that", "then",
    "deductions", "cleared", "details", "item", "description", "service",
}

DATE_REGEX = re.compile(
    r"\b(?:\d{1,2}[./-]\d{1,2}[./-]\d{2,4}"
    r"|\d{4}[./-]\d{1,2}[./-]\d{1,2}"
    r"|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,]+\d{2,4}"
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[\s,]+\d{2,4})\b",
    re.IGNORECASE,
)


def extract_text_pdfplumber(pdf_path: str) -> str:
    text_parts = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text(x_tolerance=3, y_tolerance=3)
                if t:
                    text_parts.append(t)
    except Exception as e:
        print(f"[pdfplumber] Error: {e}")
    return "\n".join(text_parts)


def extract_text_pymupdf(pdf_path: str) -> str:
    text_parts = []
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            text_parts.append(page.get_text("text"))
        doc.close()
    except Exception as e:
        print(f"[PyMuPDF] Error: {e}")
    return "\n".join(text_parts)


def get_pdf_text(pdf_path: str) -> str:
    text = extract_text_pdfplumber(pdf_path)
    if len(text.strip()) < 50:
        text = extract_text_pymupdf(pdf_path)
    return text


def get_pdf_tables(pdf_path: str) -> list:
    all_tables = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                if tables:
                    all_tables.extend(tables)
    except Exception as e:
        print(f"[pdf_utils] Table error: {e}")
    return all_tables


def clean_number(value) -> float:
    """
    Robust numeric amount parser. Handles:
      - European / SAP format: '156.679,38' -> 156679.38, '0,00' -> 0.0
      - Indian format: '1,45,073.50' -> 145073.5, '9,36,383.50' -> 936383.5
      - US / Standard format: '156,679.38' -> 156679.38
      - Plain numeric: '145073.50', '6068421035'
      - Currency symbols: '₹ 1,45,073.50', 'INR 156.679,38', 'Rs. 500'
    """
    if value is None:
        return 0.0
    val_str = str(value).strip()
    if not val_str:
        return 0.0

    # Strip currency words and symbols
    s = re.sub(r"(?i)\b(?:INR|Rs\.?|USD|EUR|GBP)\b", "", val_str)
    s = re.sub(r"[\u20b9$€£]", "", s).strip()

    # Find number token
    m = re.search(r"[-+]?\d[\d.,\s]*\d|\b\d\b", s)
    if not m:
        return 0.0

    tok = m.group(0).replace(" ", "")
    try:
        if "." in tok and "," in tok:
            if tok.rfind(",") > tok.rfind("."):
                # European format: 156.679,38 -> 156679.38
                return float(tok.replace(".", "").replace(",", "."))
            else:
                # Indian / US format: 1,45,073.50 -> 145073.50
                return float(tok.replace(",", ""))
        elif "," in tok:
            parts = tok.split(",")
            if len(parts) == 2 and len(parts[1]) <= 2:
                # 0,00 -> 0.0, 156,38 -> 156.38
                return float(parts[0] + "." + parts[1])
            else:
                # 1,45,073 -> 145073.0
                return float(tok.replace(",", ""))
        elif "." in tok:
            parts = tok.split(".")
            if len(parts) > 2:
                return float("".join(parts))
            return float(tok)
        else:
            return float(tok)
    except Exception:
        return 0.0


def is_valid_id(token: str, min_len: int = 3, require_digit: bool = True) -> bool:
    """
    Returns True if token looks like a real document ID (not a common word or junk).
    """
    if not token or len(token) < min_len:
        return False
    if token.lower() in _ID_BLACKLIST:
        return False
    # Must contain at least one digit if require_digit=True
    if require_digit and not re.search(r"\d", token):
        return False
    return True


def filename_description(filename: str) -> str:
    """Strip extension and trailing numbers from filename."""
    name = os.path.splitext(filename)[0]
    name = re.sub(r"[_\-\s]+\d+$", "", name)
    return name.strip("_- ")


def clean_description(desc: str, inv_num: str = "", po_num: str = "") -> str:
    """Clean description string by stripping invoice/PO number prefixes and punctuation."""
    if not desc:
        return ""
    d = str(desc).strip()
    # Strip invoice number if present
    if inv_num:
        d = re.sub(re.escape(inv_num), "", d, flags=re.IGNORECASE)
    # Strip PO number if present (with or without leading zeros)
    if po_num:
        d = re.sub(re.escape(po_num), "", d, flags=re.IGNORECASE)
        norm_po = po_num.lstrip("0")
        if norm_po and norm_po != po_num:
            d = re.sub(re.escape(norm_po), "", d, flags=re.IGNORECASE)
    # Clean leading/trailing symbols and underscores
    d = re.sub(r"^[\s_\-–:|/.]+|[\s_\-–:|/.]+$", "", d)
    d = re.sub(r"[\s_]+", " ", d).strip()
    return d


def find_value_after_label(text: str, label_patterns: list, line_lookahead: int = 3) -> str:
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for i, line in enumerate(lines):
        for pattern in label_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                after = line[match.end():].strip(": \t-=")
                if after:
                    return after
                for j in range(1, line_lookahead + 1):
                    if i + j < len(lines):
                        candidate = lines[i + j].strip(": \t-=")
                        if candidate:
                            return candidate
    return ""


def find_date_after_label(text: str, label_patterns: list, line_lookahead: int = 5) -> str:
    """Find an actual DATE string near any of the label patterns."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for i, line in enumerate(lines):
        for pattern in label_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                # 1. Same line after label
                after = line[match.end():]
                d = DATE_REGEX.search(after)
                if d:
                    return d.group()
                # 2. Full line
                d = DATE_REGEX.search(line)
                if d:
                    return d.group()
                # 3. Subsequent lines
                for j in range(1, line_lookahead + 1):
                    if i + j < len(lines):
                        d = DATE_REGEX.search(lines[i + j])
                        if d:
                            return d.group()
    return ""


def find_amount_after_label(text: str, label_patterns: list, line_lookahead: int = 3) -> float:
    """Find a numeric currency amount after a label — must be > 1 to avoid rate/percent fields."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    for i, line in enumerate(lines):
        for pattern in label_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                after = line[match.end():].strip(": \t-=")
                amt = clean_number(after)
                if amt > 1:
                    return amt
                for j in range(1, line_lookahead + 1):
                    if i + j < len(lines):
                        amt = clean_number(lines[i + j])
                        if amt > 1:
                            return amt
    return 0.0

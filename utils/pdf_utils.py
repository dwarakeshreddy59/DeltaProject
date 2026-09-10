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
    r"|\d{1,2}[\s\-/.](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-/,.]\d{2,4}"
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-/,.]\d{1,2}[\s\-/,.]\d{2,4})\b",
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


def filename_description(filename: str, doc_num: str = "") -> str:
    """
    Strip invoice/PO numbers and trailing numbers from filename to get clean description.
    e.g. 'DT-2526-11-5101_Product Engineering_Aug-25_AGCO.pdf' -> 'Product Engineering_Aug-25_AGCO'
         '81003200_Engineering Resources deployed_FY-2025.pdf' -> 'Engineering Resources deployed_FY-2025'
         'DT-2627-06-5402_AGCO 3D Scanning.pdf' -> 'AGCO 3D Scanning'
         '80029552_Scanning.PDF' -> 'Scanning'
    """
    if not filename:
        return ""
    base = os.path.splitext(os.path.basename(filename))[0]

    # Strip specific document number if passed
    if doc_num:
        base = re.sub(r"^" + re.escape(doc_num) + r"[\s_\-–]+", "", base, flags=re.IGNORECASE)
        norm = doc_num.lstrip("0")
        if norm and norm != doc_num:
            base = re.sub(r"^" + re.escape(norm) + r"[\s_\-–]+", "", base, flags=re.IGNORECASE)

    # Strip leading invoice patterns (e.g. DT-2627-06-5402_ or INV-2024-001_)
    base = re.sub(r"^[A-Za-z]{2,5}[-_]\d{2,4}[-_]\d{2}[-_]\d{2,5}[\s_\-–]+", "", base)
    # Strip leading PO/Doc digit numbers (e.g. 81003200_ or 0080029552_)
    base = re.sub(r"^\d{5,12}[\s_\-–]+", "", base)

    # Clean leading and trailing punctuation
    base = re.sub(r"^[\s_\-–.:]+|[\s_\-–.:]+$", "", base)
    return base.strip()


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


def clean_extracted_id(val: str) -> str:
    """
    Cleans raw captured document ID tokens from OCR/PDF artifacts and malformed separators.
    Handles:
      - Trailing/leading punctuation & separators: ';-224324' -> '224324', ':-23264778' -> '23264778'
      - Stripping repeated label fragments: 'number ;-224324' -> '224324', 'no. 224324' -> '224324'
      - Stripping quotes, colons, semicolons, dashes, tildes, slashes
    """
    if not val:
        return ""
    s = str(val).strip()

    # Strip any leading repeated label words like "number", "no", "doc", "ref"
    s = re.sub(r"^(?:n+umber|t?number|no\.?|nr\.?|doc\.?|ref\.?|id|#)[\s:;\-=_~|/]+", "", s, flags=re.IGNORECASE)

    # Strip leading/trailing noisy punctuation symbols: ; - : = _ ~ / \ | . ,
    s = re.sub(r"^[\s:;\-=_~|/.,]+", "", s)
    s = re.sub(r"[\s:;\-=_~|/.,]+$", "", s)

    # If the token contains whitespace, pick the first token that satisfies is_valid_id
    parts = s.split()
    if len(parts) > 1:
        for p in parts:
            p_clean = re.sub(r"^[\s:;\-=_~|/.,]+|[\s:;\-=_~|/.,]+$", "", p)
            if is_valid_id(p_clean, min_len=3, require_digit=True):
                return p_clean
        s = parts[0]
        s = re.sub(r"^[\s:;\-=_~|/.,]+|[\s:;\-=_~|/.,]+$", "", s)

    return s.strip()


def extract_spatial_field(
    pdf_path: str,
    label_patterns: list,
    min_len: int = 3,
    require_digit: bool = True,
) -> str:
    """
    Extracts text using 2D spatial geometry when PDF reading order is disorganized.
    Finds words matching the label, then extracts words within bounding boxes:
      1. To the right: [label.x1, label.top - 3, label.x1 + 320, label.bottom + 3]
      2. Directly underneath: [label.x0 - 20, label.bottom, label.x1 + 180, label.bottom + 45]
    """
    if not pdf_path or not os.path.isfile(pdf_path):
        return ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return ""
            page = pdf.pages[0]
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            if not words:
                return ""

            for i, w in enumerate(words):
                for lookahead in [1, 2, 3]:
                    if i + lookahead <= len(words):
                        phrase = " ".join(words[k]["text"] for k in range(i, i + lookahead))
                        matched = False
                        for pat in label_patterns:
                            if re.search(pat, phrase, re.IGNORECASE):
                                matched = True
                                break
                        if matched:
                            lbl_x0 = words[i]["x0"]
                            lbl_x1 = words[i + lookahead - 1]["x1"]
                            lbl_top = min(words[k]["top"] for k in range(i, i + lookahead))
                            lbl_bottom = max(words[k]["bottom"] for k in range(i, i + lookahead))

                            # 1. Look to the right (same horizontal band)
                            right_words = [
                                w2 for w2 in words
                                if w2["x0"] >= lbl_x1 - 2
                                and w2["x0"] <= lbl_x1 + 320
                                and abs(w2["top"] - lbl_top) <= 8
                            ]
                            if right_words:
                                right_text = " ".join(w2["text"] for w2 in right_words)
                                cand = clean_extracted_id(right_text)
                                if is_valid_id(cand, min_len=min_len, require_digit=require_digit):
                                    return cand

                            # 2. Look directly below (vertical column underneath)
                            below_words = [
                                w2 for w2 in words
                                if w2["top"] >= lbl_bottom - 2
                                and w2["top"] <= lbl_bottom + 45
                                and w2["x0"] >= lbl_x0 - 20
                                and w2["x1"] <= lbl_x1 + 180
                            ]
                            if below_words:
                                below_text = " ".join(w2["text"] for w2 in below_words)
                                cand = clean_extracted_id(below_text)
                                if is_valid_id(cand, min_len=min_len, require_digit=require_digit):
                                    return cand
    except Exception as e:
        print(f"[extract_spatial_field] Error: {e}")
    return ""


def extract_smart_id(
    text: str,
    label_patterns: list,
    tables: list = None,
    pdf_path: str = None,
    min_len: int = 3,
    require_digit: bool = True,
    line_lookahead: int = 4,
) -> str:
    """
    Universal Automated Multi-Layout Field Extractor.
    Cascades across 5 intelligent strategies:
      1. INLINE (Beside): Label and ID on same line, tolerating repeated words (e.g. 'number number')
         and malformed separators (e.g. ';-224324', ': - 23264778').
      2. STACKED / DOWN-TO-IT (Below): Label on one line, ID on subsequent line(s), skipping blank/noise lines.
      3. TABLE MATRIX: Searching table cell to the right or table cell directly beneath.
      4. 2D SPATIAL PROXIMITY: Using pdfplumber word coordinates to extract text physically
         adjacent (right or below) regardless of PDF line flow.
      5. REGEX FALLBACK: Direct regex scans across the entire document text.
    """
    if not text:
        text = ""

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Extended label patterns to tolerate OCR typos (e.g. documnet) and repeated words
    tolerant_patterns = []
    for pat in label_patterns:
        tolerant_patterns.append(pat)
        if "document" in pat.lower():
            tolerant_patterns.append(pat.replace("document", r"docu?m(?:en|ne)t?"))
            tolerant_patterns.append(pat.replace("document", r"doc\.?"))
            tolerant_patterns.append(r"docu?m(?:en|ne)t?\s*(?:t?n+umber|no\.?|nr\.?|#)*")
        if "invoice" in pat.lower():
            tolerant_patterns.append(pat.replace("invoice", r"inv(?:oice)?\.?"))
        if "purchase" in pat.lower():
            tolerant_patterns.append(pat.replace("purchase", r"(?:po|purchase)"))

    # -------------------------------------------------------------
    # STRATEGY 1: INLINE / BESIDE (Label and ID on the same line)
    # Tolerates: repeated words ("number number"), malformed separators (";-", ": -")
    # -------------------------------------------------------------
    for line in lines:
        for pat in tolerant_patterns:
            # Must not be preceded by hyphen or alphanumeric (e.g. MVA-PO- should not match label PO)
            regex = (
                rf"(?<![A-Za-z0-9\-_/])(?:{pat})"
                rf"(?:\s+(?:n+umber|t?number|no\.?|#|nr\.?))*"
                rf"[\s:;\-=_~|/]+"
                rf"([A-Za-z0-9/_\-\.]{{{min_len},40}})"
            )
            m = re.search(regex, line, re.IGNORECASE)
            if m:
                cand = clean_extracted_id(m.group(1))
                if is_valid_id(cand, min_len=min_len, require_digit=require_digit):
                    return cand

            m_label = re.search(rf"(?<![A-Za-z0-9\-_/])(?:{pat})(?:\s+(?:n+umber|t?number|no\.?|#|nr\.?))*[\s:;\-=_~|/]+", line, re.IGNORECASE)
            if m_label and m_label.end() < len(line):
                rest = line[m_label.end():].strip()
                cand = clean_extracted_id(rest)
                if is_valid_id(cand, min_len=min_len, require_digit=require_digit):
                    return cand

    # -------------------------------------------------------------
    # STRATEGY 2: STACKED / DOWN-TO-IT (ID is on subsequent line below label)
    # -------------------------------------------------------------
    for i, line in enumerate(lines):
        for pat in tolerant_patterns:
            m_sub = re.search(rf"(?<![A-Za-z0-9\-_/])(?:{pat})(?:\s+(?:n+umber|t?number|no\.?|#|nr\.?))*[\s:;\-=_~|/]*", line, re.IGNORECASE)
            if m_sub:
                after = line[m_sub.end():].strip()
                cleaned_after = clean_extracted_id(after)
                if not is_valid_id(cleaned_after, min_len=min_len, require_digit=require_digit):
                    m_label = m_sub

            if m_label:
                for k in range(1, line_lookahead + 1):
                    if i + k < len(lines):
                        cand_line = lines[i + k].strip()
                        if not cand_line:
                            continue
                        if re.match(r"^(?:date|invoice\s*date|po\s*date|bill\s*to|gstin|page|vendor|buyer)\b", cand_line, re.IGNORECASE):
                            continue
                        cand = clean_extracted_id(cand_line)
                        if is_valid_id(cand, min_len=min_len, require_digit=require_digit):
                            return cand

    # -------------------------------------------------------------
    # STRATEGY 3: TABLE GRID (Cell beside or Cell directly below)
    # -------------------------------------------------------------
    if tables:
        for table in tables:
            if not table:
                continue
            for r_idx, row in enumerate(table):
                if not row:
                    continue
                for c_idx, cell in enumerate(row):
                    if not cell:
                        continue
                    cell_str = str(cell).strip()
                    for pat in tolerant_patterns:
                        if re.search(pat, cell_str, re.IGNORECASE):
                            # 3A: Horizontal pair (cell beside)
                            if c_idx + 1 < len(row) and row[c_idx + 1]:
                                cand = clean_extracted_id(str(row[c_idx + 1]))
                                if is_valid_id(cand, min_len=min_len, require_digit=require_digit):
                                    return cand
                            # 3B: Vertical pair (cell directly below)
                            if r_idx + 1 < len(table) and len(table[r_idx + 1]) > c_idx and table[r_idx + 1][c_idx]:
                                cand = clean_extracted_id(str(table[r_idx + 1][c_idx]))
                                if is_valid_id(cand, min_len=min_len, require_digit=require_digit):
                                    return cand

    # -------------------------------------------------------------
    # STRATEGY 4: 2D SPATIAL PROXIMITY (pdfplumber bounding box)
    # -------------------------------------------------------------
    if pdf_path:
        cand_spatial = extract_spatial_field(pdf_path, tolerant_patterns, min_len=min_len, require_digit=require_digit)
        if cand_spatial:
            return cand_spatial

    return ""


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


def classify_pdf_document(source: str) -> dict:
    """
    Analyzes a PDF file path or text and determines whether it is:
      - 'INVOICE' (Tax Invoice / e-Invoice)
      - 'PURCHASE_ORDER' (Purchase Order / PO Change)
      - 'REMITTANCE' (Remittance Advice / Payment Advice)
      - 'UNKNOWN' (Unrecognized document)

    Returns:
      {
        'type': 'INVOICE' | 'PURCHASE_ORDER' | 'REMITTANCE' | 'UNKNOWN',
        'label': 'Tax Invoice' | 'Purchase Order' | 'Remittance Advice' | 'Unrecognized Document',
        'confidence': float,
        'scores': dict,
        'matched_cues': list
      }
    """
    text = ""
    if os.path.isfile(source):
        text = get_pdf_text(source)
    else:
        text = str(source)
    
    t = text.lower()
    scores = {"INVOICE": 0, "PURCHASE_ORDER": 0, "REMITTANCE": 0}
    cues = {"INVOICE": [], "PURCHASE_ORDER": [], "REMITTANCE": []}

    # 1. Remittance cues
    if "remittance advice" in t:
        scores["REMITTANCE"] += 15
        cues["REMITTANCE"].append("remittance advice")
    if "invoices identified below have now been cleared" in t or "have now been cleared" in t:
        scores["REMITTANCE"] += 15
        cues["REMITTANCE"].append("cleared invoices notice")
    if "our accounting clerk" in t or "your account with us" in t:
        scores["REMITTANCE"] += 10
        cues["REMITTANCE"].append("accounting clerk / account reference")
    if "payment advice" in t:
        scores["REMITTANCE"] += 12
        cues["REMITTANCE"].append("payment advice")
    if "remittance" in t:
        scores["REMITTANCE"] += 5
        cues["REMITTANCE"].append("remittance keyword")

    # 2. Purchase Order cues
    if "purchase order change" in t:
        scores["PURCHASE_ORDER"] += 15
        cues["PURCHASE_ORDER"].append("purchase order change")
    if "purchase order" in t:
        scores["PURCHASE_ORDER"] += 12
        cues["PURCHASE_ORDER"].append("purchase order")
    if "po nr" in t or "po no" in t or "po number" in t:
        scores["PURCHASE_ORDER"] += 10
        cues["PURCHASE_ORDER"].append("po number identifier")
    if "purchasing company" in t:
        scores["PURCHASE_ORDER"] += 10
        cues["PURCHASE_ORDER"].append("purchasing company")
    if "delivery and payment terms" in t:
        scores["PURCHASE_ORDER"] += 8
        cues["PURCHASE_ORDER"].append("delivery and payment terms")
    if "vendor (agco" in t or "buyer order" in t:
        scores["PURCHASE_ORDER"] += 8
        cues["PURCHASE_ORDER"].append("vendor / buyer order")

    # 3. Invoice cues
    if "tax invoice" in t:
        scores["INVOICE"] += 15
        cues["INVOICE"].append("tax invoice header")
    if "e-invoice" in t:
        scores["INVOICE"] += 12
        cues["INVOICE"].append("e-invoice header")
    if "irn :" in t or "irn:" in t:
        scores["INVOICE"] += 12
        cues["INVOICE"].append("irn (invoice reference number)")
    if "acknowledgement no" in t:
        scores["INVOICE"] += 10
        cues["INVOICE"].append("acknowledgement number")
    if "details of receiver" in t or "details of consignee" in t:
        scores["INVOICE"] += 10
        cues["INVOICE"].append("details of receiver / consignee")
    if "supply type code" in t or "reverse charge" in t:
        scores["INVOICE"] += 8
        cues["INVOICE"].append("gst supply type / reverse charge")
    if "document no :" in t and ("acknowledgement" in t or "b2b" in t):
        scores["INVOICE"] += 10
        cues["INVOICE"].append("b2b document number")

    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]

    # Penalize cross-matches if contradictory strong cues exist
    # e.g., if a remittance has the word 'invoice' in 'invoices identified below have now been cleared'
    if best_type == "REMITTANCE" and "cleared invoices notice" in cues["REMITTANCE"]:
        scores["INVOICE"] = 0

    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]

    LABELS = {
        "INVOICE": "Tax Invoice",
        "PURCHASE_ORDER": "Purchase Order",
        "REMITTANCE": "Remittance Advice",
        "UNKNOWN": "Unrecognized Document",
    }

    if best_score < 10:
        return {
            "type": "UNKNOWN",
            "label": "Unrecognized Document",
            "confidence": 0.0,
            "scores": scores,
            "matched_cues": [],
        }

    total_sc = sum(scores.values()) or 1
    confidence = round(best_score / total_sc, 2)

    return {
        "type": best_type,
        "label": LABELS[best_type],
        "confidence": confidence,
        "scores": scores,
        "matched_cues": cues[best_type],
    }


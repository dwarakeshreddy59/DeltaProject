import os
import sys
import fitz  # PyMuPDF
from utils.pdf_utils import (
    extract_smart_id,
    clean_extracted_id,
    is_valid_id,
)
from extractors.invoice_extractor import _extract_invoice_number, _extract_po_number
from extractors.po_extractor import _extract_po_number as _extract_po_num_po
from extractors.remittance_extractor import _extract_doc_number

def run_tests():
    print("=" * 60)
    print("RUNNING MULTI-LAYOUT SMART PDF EXTRACTION TEST SUITE")
    print("=" * 60)

    # -------------------------------------------------------------
    # 1. TEST SUITE: BESIDE / INLINE LAYOUTS
    # -------------------------------------------------------------
    print("\n[1] Testing 'Beside' (Inline) Layouts:")
    beside_cases = [
        ("Company A\nDocument Number 23264778\nInvoice Date: 12/04/2026", "23264778"),
        ("Delta Corp\nDocument Number: 23264778\nTotal: 1000", "23264778"),
        ("Invoice No. DT-2627-06-5402\nDate: 01/06/2026", "DT-2627-06-5402"),
        ("PO Nr 80029552\nDate: 15/05/2026", "80029552"),
        ("Remittance Advice\nDocument Number 2000013497\nDate: 20/05/2026", "2000013497"),
        ("documnet nnumber 23264778\nDate: 10/05/2026", "23264778"),
    ]
    for text, expected in beside_cases:
        res = extract_smart_id(text, [r"document\s*(?:no\.?|number|#)", r"invoice\s*(?:no\.?|number|#)", r"po\s*(?:nr\.?|no\.?)"])
        assert res == expected, f"FAILED beside case: got '{res}', expected '{expected}'"
        print(f"  [PASS] Beside: '{expected}' matched successfully")

    # -------------------------------------------------------------
    # 2. TEST SUITE: DOWN-TO-IT / STACKED LAYOUTS
    # -------------------------------------------------------------
    print("\n[2] Testing 'Down to it' (Stacked / Vertical) Layouts:")
    down_cases = [
        ("Company B Header\nDocument Number\n23264778\nInvoice Date: 12/04/2026", "23264778"),
        ("Company B Header\nDocument Number:\n\n23264778\nTotal: 500", "23264778"),
        ("Client Alpha\nPO Number\n\n\n80029552\nDate: 02/05/2026", "80029552"),
        ("AGCO Payment\nDocument Number\n2000013497\nTotal: 145000", "2000013497"),
        ("Company X\nDocument Number : -\n\n88997766\nNet: 20000", "88997766"),
    ]
    for text, expected in down_cases:
        res = extract_smart_id(text, [r"document\s*(?:no\.?|number|#)", r"po\s*(?:no\.?|number|#)"])
        assert res == expected, f"FAILED down-to-it case: got '{res}', expected '{expected}'"
        print(f"  [PASS] Down to it: '{expected}' matched successfully")

    # -------------------------------------------------------------
    # 3. TEST SUITE: MALFORMED SEPARATORS, REPEATED TOKENS & TYPOS
    # -------------------------------------------------------------
    print("\n[3] Testing Malformed Separators (;-), Repeated Words & Typos:")
    malformed_cases = [
        ("Company C Header\ndocumnet number number ;-224324\nDate: 10/05/2026", "224324"),
        ("Vendor Tax Invoice\nDocument No. No. : - 897612\nAssessable: 1000", "897612"),
        ("Supplier PO\nPO Number Number ;-- 80029552\nDelivery: 2026-06-01", "80029552"),
        ("Doc No: -: 445566\nItem: Hardware", "445566"),
        ("documnet number number ;- 998877\nPeriod: May-2026", "998877"),
        ("Invoice No: - 776655\nTax: 18%", "776655"),
        ("Document Number\n;-224324\nDate: 01/01/2026", "224324"),
    ]
    for text, expected in malformed_cases:
        res = extract_smart_id(text, [r"document\s*(?:no\.?|number|#)", r"invoice\s*(?:no\.?|number|#)", r"po\s*(?:no\.?|number|#)"])
        assert res == expected, f"FAILED malformed case: got '{res}', expected '{expected}'"
        print(f"  [PASS] Malformed/Repeated: '{expected}' normalized and extracted")

    # -------------------------------------------------------------
    # 4. TEST SUITE: 2D TABLE GRIDS
    # -------------------------------------------------------------
    print("\n[4] Testing 2D Table Grids:")
    # Horizontal cell pair
    t_horiz = [[None, "Document Number", "23264778", "Date", "2026-05-12"]]
    res_th = extract_smart_id("", [r"document\s*(?:no\.?|number|#)"], tables=[t_horiz])
    assert res_th == "23264778", f"FAILED horizontal table: got '{res_th}'"
    print("  [PASS] Table Horizontal Cell Beside: '23264778'")

    # Vertical cell pair (cell directly underneath in header matrix)
    t_vert = [
        ["Document Number", "Invoice Date", "Total Value"],
        ["99887766", "2026-05-12", "150000.00"]
    ]
    res_tv = extract_smart_id("", [r"document\s*(?:no\.?|number|#)"], tables=[t_vert])
    assert res_tv == "99887766", f"FAILED vertical table: got '{res_tv}'"
    print("  [PASS] Table Vertical Cell Below: '99887766'")

    # -------------------------------------------------------------
    # 5. TEST SUITE: REAL PDF EXTRACTION WITH MALFORMED LAYOUTS
    # -------------------------------------------------------------
    print("\n[5] Testing Real Synthesized PDF File Extraction:")
    test_pdf_dir = r"C:\pdf-extractor-portal\test_temp_pdfs"
    os.makedirs(test_pdf_dir, exist_ok=True)

    # PDF 1: documnet number number ;-224324
    pdf1_path = os.path.join(test_pdf_dir, "test_malformed_invoice.pdf")
    doc1 = fitz.open()
    p1 = doc1.new_page()
    p1.insert_text((50, 50), "Tax Invoice - Multi-Layout Enterprise")
    p1.insert_text((50, 80), "documnet number number ;-224324")
    p1.insert_text((50, 110), "Document Date: 15/06/2026")
    p1.insert_text((50, 140), "Assessable Value: 100000.00")
    p1.insert_text((50, 170), "Total Tax: 18000.00")
    p1.insert_text((50, 200), "Total Invoice Value: 118000.00")
    doc1.save(pdf1_path)
    doc1.close()

    ext1 = _extract_invoice_number("documnet number number ;-224324", [], pdf1_path)
    assert ext1 == "224324", f"Real PDF 1 extraction failed: got '{ext1}'"
    print(f"  [PASS] Real PDF (documnet number number ;-224324) -> Extracted: {ext1}")

    # PDF 2: Stacked Down-to-it layout
    pdf2_path = os.path.join(test_pdf_dir, "test_stacked_po.pdf")
    doc2 = fitz.open()
    p2 = doc2.new_page()
    p2.insert_text((50, 50), "Purchase Order Document")
    p2.insert_text((50, 80), "PO Number")
    p2.insert_text((50, 100), "80029552")
    p2.insert_text((50, 130), "Date: 20/06/2026")
    p2.insert_text((50, 160), "Total Amount: 75000.00")
    doc2.save(pdf2_path)
    doc2.close()

    ext2 = _extract_po_num_po("Purchase Order Document\nPO Number\n80029552\nDate: 20/06/2026", [], "test.pdf", pdf2_path)
    assert ext2 == "80029552", f"Real PDF 2 extraction failed: got '{ext2}'"
    print(f"  [PASS] Real PDF (Stacked PO Number down to it) -> Extracted: {ext2}")

    # PDF 3: Remittance advice with beside layout and doc number
    pdf3_path = os.path.join(test_pdf_dir, "test_remittance.pdf")
    doc3 = fitz.open()
    p3 = doc3.new_page()
    p3.insert_text((50, 50), "Remittance Advice")
    p3.insert_text((50, 80), "Document Number: 2000013497")
    p3.insert_text((50, 110), "Payment Date: 22/06/2026")
    p3.insert_text((50, 140), "Total Gross Amount: 145073.50")
    doc3.save(pdf3_path)
    doc3.close()

    ext3 = _extract_doc_number("Remittance Advice\nDocument Number: 2000013497\nPayment Date: 22/06/2026", [], pdf3_path)
    assert ext3 == "2000013497", f"Real PDF 3 extraction failed: got '{ext3}'"
    print(f"  [PASS] Real PDF (Remittance beside layout) -> Extracted: {ext3}")

    # Cleanup temp test files
    for p in [pdf1_path, pdf2_path, pdf3_path]:
        try:
            os.remove(p)
        except Exception:
            pass
    try:
        os.rmdir(test_pdf_dir)
    except Exception:
        pass

    print("\n" + "=" * 60)
    print("ALL TESTS IN TEST SUITE PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

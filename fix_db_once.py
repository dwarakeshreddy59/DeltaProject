import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from config import Config
from db import connection as db
db.init_pool(Config)

# 1. Clean bad old records
db.execute_query("DELETE FROM purchase_orders WHERE po_number = %s", ("Change",))
print("Cleaned bad PO 'Change'.")

# 2. Link invoice to correct PO (strip leading zeros in comparison)
db.execute_query("UPDATE invoices SET po_number = %s WHERE invoice_number = %s", ("80029552", "DT-2627-06-5402"))
print("Invoice po_number set to 80029552.")

# 3. Verify join
r = db.execute_query("""
    SELECT i.invoice_number, i.po_number, p.po_number AS po_matched, r.remittance_number
    FROM invoices i
    LEFT JOIN purchase_orders p ON p.po_number = i.po_number
    LEFT JOIN remittances r ON r.invoice_number = i.invoice_number
""", fetch="all")
print("JOIN OK:", [dict(x) for x in (r or [])])

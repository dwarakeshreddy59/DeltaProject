"""
financial_calculator.py – GST, TDS and Receivable calculations.
All monetary values are floats rounded to 2 decimal places.
"""


def calculate(assessable_value: float, gst_rate: float = 18.0, tds_rate: float = 2.0) -> dict:
    """
    Perform all financial calculations.

    Args:
        assessable_value : Taxable / Assessable value (e.g. 25500.0)
        gst_rate         : GST percentage (default 18%)
        tds_rate         : TDS percentage – one of 0.1, 2.0, 10.0

    Returns:
        dict with keys:
            assessable_value, gst_rate, gst_amount,
            total_invoice_value, tds_rate, tds_amount, receivable
    """
    gst_amount          = round(assessable_value * gst_rate / 100, 2)
    total_invoice_value = round(assessable_value + gst_amount, 2)
    tds_amount          = round(assessable_value * tds_rate / 100, 2)
    # Receivable = Taxable Value - TDS + GST
    receivable          = round(assessable_value - tds_amount + gst_amount, 2)

    return {
        "assessable_value":    round(assessable_value, 2),
        "gst_rate":            gst_rate,
        "gst_amount":          gst_amount,
        "total_invoice_value": total_invoice_value,
        "tds_rate":            tds_rate,
        "tds_amount":          tds_amount,
        "receivable":          receivable,
    }


VALID_TDS_RATES = [0.0, 0.1, 1.0, 2.0, 5.0, 10.0]
GST_RATE        = 18.0   # Fixed at 18% as per requirement

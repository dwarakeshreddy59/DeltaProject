import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { uploadPDFs, recalculate as apiRecalculate } from "../services/api";

/**
 * Custom hook – manages all extraction + calculation state.
 */
export function useExtraction() {
  const [loading, setLoading]             = useState(false);
  const [results, setResults]             = useState(null);       // { po, invoice, remittance }
  const [calcData, setCalcData]           = useState(null);       // live calculation result
  const [mismatchError, setMismatchError] = useState(null);       // 422 wrong file diagnostic data

  const extract = useCallback(async (formData) => {
    setLoading(true);
    setMismatchError(null);
    try {
      const { data } = await uploadPDFs(formData);
      if (!data.success) {
        toast.error(data.errors?.join(" | ") || "Extraction failed.");
        return { success: false };
      }
      setResults(data);
      setCalcData({
        assessable_value:    data.invoice?.assessable_value    ?? 0,
        gst_amount:          data.invoice?.gst_amount          ?? 0,
        gst_rate:            data.invoice?.gst_rate            ?? 18,
        tds_rate:            data.invoice?.tds_rate            ?? 2,
        tds_amount:          data.invoice?.tds_amount          ?? 0,
        total_invoice_value: data.invoice?.total_invoice_value ?? 0,
        receivable:          data.invoice?.receivable          ?? 0,
      });
      if (data.errors?.length) {
        toast("⚠️ " + data.errors.join(" | "), { icon: "⚠️" });
      } else {
        toast.success("Extraction complete & saved to DB!");
      }
      return { success: true, data };
    } catch (err) {
      if (err.response?.status === 422 && err.response?.data?.error_type === "WRONG_FILE_MISMATCH") {
        setMismatchError(err.response.data);
        return { success: false, mismatch: err.response.data };
      }
      toast.error("Upload error: " + (err.response?.data?.detail || err.message));
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearMismatchError = useCallback(() => {
    setMismatchError(null);
  }, []);

  const recalc = useCallback(async (tdsRate) => {
    if (!results) return;
    try {
      const { data } = await apiRecalculate(
        calcData?.assessable_value ?? 0,
        tdsRate,
        results.invoice?.invoice_number ?? ""
      );
      if (data.success) {
        setCalcData((prev) => ({ ...prev, ...data, tds_rate: tdsRate }));
      }
    } catch (err) {
      toast.error("Recalculation failed: " + err.message);
    }
  }, [results, calcData]);

  const resetExtraction = useCallback(() => {
    setResults(null);
    setCalcData(null);
    setMismatchError(null);
    toast.success("View refreshed. Ready for next upload!");
  }, []);

  return { loading, results, calcData, mismatchError, extract, recalc, clearMismatchError, resetExtraction };
}

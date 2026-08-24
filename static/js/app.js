/**
 * app.js – Frontend logic for the PDF Data Extraction Portal.
 * Handles: file upload, drag-drop, results rendering, live recalculation, history.
 */

"use strict";

// ── State ────────────────────────────────────────────────────────────────────
let currentData = {
  assessable_value: 0,
  invoice_number:   "",
  gst_rate:         18,
};


// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const inr = (n) => "₹ " + fmt(n);

const setText = (id, val) => {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? "—";
};

const setHtml = (id, html) => {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
};


// ── Drag & Drop ──────────────────────────────────────────────────────────────
["dz-invoice", "dz-po", "dz-rem"].forEach((dzId) => {
  const dz = document.getElementById(dzId);
  if (!dz) return;

  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("drag-over");
  });

  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));

  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("drag-over");
    const fileInput = dz.nextElementSibling; // the hidden <input>
    if (!fileInput) return;
    const files = e.dataTransfer.files;
    if (files.length) {
      fileInput.files = files;
      const nameEl = dz.querySelector(".file-name");
      if (nameEl) nameEl.textContent = files[0].name;
      dz.classList.add("has-file");
    }
  });
});

function showFileName(input, nameId, dzId) {
  if (input.files.length) {
    document.getElementById(nameId).textContent = input.files[0].name;
    document.getElementById(dzId).classList.add("has-file");
  }
}


// ── Form Submit ──────────────────────────────────────────────────────────────
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form   = e.target;
  const formData = new FormData(form);

  // Sync TDS dropdown from upload form to calc dropdown
  const tdsVal = document.getElementById("tds_rate_select").value;
  document.getElementById("tds_rate_calc").value = tdsVal;

  showSpinner(true);
  clearError();
  hideResults();

  try {
    const resp = await fetch("/upload", { method: "POST", body: formData });
    const data = await resp.json();

    if (!data.success) {
      showError(data.errors?.join("<br>") || "Upload failed.");
      return;
    }

    populateResults(data);
    showResults();

    // Warn if DB errors
    if (data.errors?.length) {
      showError("⚠️ Extracted OK but: " + data.errors.join(" | "), "warning");
    }

  } catch (err) {
    showError("Network error: " + err.message);
  } finally {
    showSpinner(false);
  }
});


// ── Populate Results ──────────────────────────────────────────────────────────
function populateResults(data) {
  const po  = data.po  || {};
  const inv = data.invoice || {};
  const rem = data.remittance || {};

  // ── PO
  setText("po_number",      po.po_number);
  setText("po_date",        po.po_date);
  setText("po_description", po.description);
  setText("delivery_date",  po.delivery_date);
  setText("po_total_amount", po.total_amount ? inr(po.total_amount) : "—");

  // ── Invoice
  setText("invoice_number",      inv.invoice_number);
  setText("invoice_date",        inv.invoice_date);
  setText("inv_po_number",       inv.po_number);
  setText("inv_description",     inv.description);
  setText("invoice_period",      inv.invoice_period);
  setText("assessable_value",    inv.assessable_value ? inr(inv.assessable_value) : "—");
  setText("total_tax",           inv.total_tax        ? inr(inv.total_tax)        : "—");
  setText("total_invoice_value", inv.total_invoice_value ? inr(inv.total_invoice_value) : "—");

  // ── Remittance
  setText("remittance_number",  rem.remittance_number);
  setText("remittance_date",    rem.remittance_date);
  setText("rem_invoice_number", rem.invoice_number);
  setText("gross_amount",       rem.gross_amount       ? inr(rem.gross_amount)       : "—");
  setText("total_gross_amount", rem.total_gross_amount ? inr(rem.total_gross_amount) : "—");

  // ── Cross-link badge
  const poRef  = inv.po_number || po.po_number || "?";
  const invRef = rem.invoice_number || inv.invoice_number || "?";
  setHtml(
    "crosslinkBadge",
    `<i class="bi bi-link-45deg fs-4 me-2"></i>
     <span>
       PO <strong>${poRef}</strong> → Invoice <strong>${inv.invoice_number || "?"}</strong>
       → Remittance <strong>${rem.remittance_number || "?"}</strong>
     </span>`
  );

  // ── Save state for live recalculation
  currentData.assessable_value = inv.assessable_value || 0;
  currentData.invoice_number   = inv.invoice_number   || "";

  // ── Fill calc tiles
  fillCalcTiles(inv);
}

function fillCalcTiles(inv) {
  setText("calc_assessable", inr(inv.assessable_value));
  setText("calc_gst",        inr(inv.gst_amount));
  setText("calc_total_inv",  inr(inv.total_invoice_value));
  setText("calc_tds",        inr(inv.tds_amount));
  setText("calc_receivable", inr(inv.receivable));
}


// ── Live Recalculation ────────────────────────────────────────────────────────
async function recalculate() {
  const tdsRate = parseFloat(document.getElementById("tds_rate_calc").value);

  try {
    const resp = await fetch("/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessable_value: currentData.assessable_value,
        tds_rate:         tdsRate,
        invoice_number:   currentData.invoice_number,
      }),
    });
    const data = await resp.json();
    if (data.success) {
      setText("calc_gst",       inr(data.gst_amount));
      setText("calc_total_inv", inr(data.total_invoice_value));
      setText("calc_tds",       inr(data.tds_amount));
      setText("calc_receivable",inr(data.receivable));
    }
  } catch (err) {
    console.error("Recalculate error:", err);
  }
}


// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const resp = await fetch("/history");
    const data = await resp.json();
    if (!data.success || !data.records.length) {
      alert("No history records found.");
      return;
    }
    renderHistory(data.records);
    document.getElementById("historyCard").classList.remove("d-none");
    document.getElementById("resultsSection").classList.remove("d-none");
    document.getElementById("historyCard").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    alert("Could not load history: " + err.message);
  }
}

function renderHistory(records) {
  const tbody = document.getElementById("historyBody");
  tbody.innerHTML = records.map((r) => `
    <tr>
      <td>${r.invoice_number || "—"}</td>
      <td>${r.invoice_date   || "—"}</td>
      <td>${r.po_number      || "—"}</td>
      <td>${r.invoice_period || "—"}</td>
      <td class="text-end">${fmt(r.assessable_value)}</td>
      <td class="text-end">${fmt(r.gst_amount)}</td>
      <td class="text-end fw-bold">${fmt(r.total_invoice_value)}</td>
      <td class="text-center">${r.tds_rate}%</td>
      <td class="text-end text-danger">${fmt(r.tds_amount)}</td>
      <td class="text-end fw-bold text-success">${fmt(r.receivable)}</td>
      <td>${r.remittance_number || "—"}</td>
      <td class="text-end">${fmt(r.gross_amount)}</td>
    </tr>
  `).join("");
}

function toggleHistory() {
  document.getElementById("historyCard").classList.add("d-none");
}


// ── UI Helpers ────────────────────────────────────────────────────────────────
function showSpinner(show) {
  document.getElementById("spinner").classList.toggle("d-none", !show);
  document.getElementById("submitBtn").disabled = show;
}

function showResults() {
  document.getElementById("resultsSection").classList.remove("d-none");
  document.getElementById("resultsSection").scrollIntoView({ behavior: "smooth" });
}

function hideResults() {
  document.getElementById("resultsSection").classList.add("d-none");
}

function showError(msg, type = "danger") {
  const banner = document.getElementById("errorBanner");
  banner.className = `alert alert-${type} mt-3`;
  banner.innerHTML = msg;
  banner.classList.remove("d-none");
}

function clearError() {
  document.getElementById("errorBanner").classList.add("d-none");
}

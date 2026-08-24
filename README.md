# PDF Data Extraction & Financial Portal

A full-stack web application that extracts structured data from **Invoice**, **Purchase Order**, and **Remittance** PDFs, links them by shared identifiers, performs GST/TDS/Receivable calculations, and stores everything in **PostgreSQL**.

---

## Tech Stack

| Layer     | Technology                              |
|-----------|-----------------------------------------|
| Frontend  | **React 18 + Vite** + Bootstrap 5       |
| Backend   | **Python Flask**                        |
| PDF Parse | `pdfplumber` + `PyMuPDF` (fallback)     |
| Database  | **PostgreSQL** via `psycopg2`           |
| Export    | `openpyxl` (Excel)                      |

---

## Project Structure

```
pdf-extractor-portal/
├── app.py                     # Flask API + production React serving
├── config.py                  # DB & app config (reads .env)
├── requirements.txt
├── export_excel.py            # Excel export (3 sheets)
├── .env.example               # → copy to .env with your DB credentials
│
├── db/
│   ├── connection.py          # psycopg2 pool + schema runner
│   └── schema.sql             # CREATE TABLE (POs, Invoices, Remittances)
│
├── extractors/
│   ├── invoice_extractor.py
│   ├── po_extractor.py
│   └── remittance_extractor.py
│
├── calculators/
│   └── financial_calculator.py
│
├── utils/
│   └── pdf_utils.py
│
└── frontend/                  # React + Vite app
    ├── package.json
    ├── vite.config.js         # Dev proxy → Flask :5000
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── components/
        │   ├── Navbar.jsx
        │   ├── UploadForm.jsx
        │   ├── DropZone.jsx
        │   ├── CrossLinkBadge.jsx
        │   ├── POCard.jsx
        │   ├── InvoiceCard.jsx
        │   ├── RemittanceCard.jsx
        │   ├── CalculationPanel.jsx
        │   └── HistoryTable.jsx
        ├── hooks/
        │   └── useExtraction.js
        ├── services/
        │   └── api.js
        └── utils/
            └── format.js
```

---

## Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL running locally

### 2. Clone & Configure
```bash
# Copy env file and fill in your credentials
copy .env.example .env
```

Edit `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pdf_portal
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. Create the PostgreSQL Database
```sql
CREATE DATABASE pdf_portal;
```
> Tables are **auto-created** by `app.py` on first startup.

### 4. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 5. Start Flask Backend
```bash
python app.py
```
Flask runs on **http://localhost:5000**

### 6. Install & Start React Frontend (Dev)
```bash
cd frontend
npm install
npm run dev
```
React runs on **http://localhost:3000** (proxies API calls to Flask)

---

## Production Build

```bash
cd frontend
npm run build
# Built files go to static/react/
# Flask serves them at http://localhost:5000
```

---

## Calculations

| Field             | Formula                          |
|-------------------|----------------------------------|
| GST Amount        | `Assessable × 18%`               |
| Total Invoice     | `Assessable + GST`               |
| TDS Amount        | `Assessable × TDS%` (0.1/2/10%) |
| **Net Receivable**| `Assessable − TDS + GST`         |

---

## Database Schema

```
purchase_orders  ←── (po_number FK) ───  invoices  ←── (invoice_number FK) ───  remittances
```

---

## API Endpoints

| Method | Route            | Description                        |
|--------|------------------|------------------------------------|
| POST   | `/upload`        | Upload 3 PDFs, extract & save      |
| POST   | `/recalculate`   | Recalc with new TDS rate           |
| GET    | `/history`       | All records (joined view)          |
| GET    | `/export/excel`  | Download Excel workbook            |

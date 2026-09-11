-- schema.sql – Drop FK constraints; use soft references only (app-level joining)

-- 0. Clients & Organizations
CREATE TABLE IF NOT EXISTS clients (
    id                   SERIAL PRIMARY KEY,
    client_name          VARCHAR(255) NOT NULL,
    organization_name    VARCHAR(255) NOT NULL,
    logo_url             TEXT,
    gst_number           VARCHAR(50),
    pan_number           VARCHAR(50),
    address              TEXT,
    point_of_contact     VARCHAR(255),
    invoice_doc_label    VARCHAR(100) DEFAULT 'Tax Invoice',
    invoice_num_label    VARCHAR(100) DEFAULT 'Invoice Number',
    invoice_date_label   VARCHAR(100) DEFAULT 'Invoice Date',
    invoice_desc_label   VARCHAR(100) DEFAULT 'Description',
    invoice_period_label VARCHAR(100) DEFAULT 'Invoice Period',
    invoice_assessable_label VARCHAR(100) DEFAULT 'Assessable Value',
    invoice_tax_label    VARCHAR(100) DEFAULT 'Total Tax',
    invoice_total_label  VARCHAR(100) DEFAULT 'Total Invoice Value',
    po_doc_label         VARCHAR(100) DEFAULT 'Purchase Order',
    po_num_label         VARCHAR(100) DEFAULT 'PO Number',
    po_date_label        VARCHAR(100) DEFAULT 'PO Date',
    po_desc_label        VARCHAR(100) DEFAULT 'Original Description',
    po_validity_label    VARCHAR(100) DEFAULT 'PO Validity',
    po_total_label       VARCHAR(100) DEFAULT 'Total Amount',
    remittance_doc_label VARCHAR(100) DEFAULT 'Remittance Advice',
    remittance_num_label VARCHAR(100) DEFAULT 'Remittance Number',
    remittance_date_label VARCHAR(100) DEFAULT 'Remittance Date',
    remittance_gross_label VARCHAR(100) DEFAULT 'Gross Amount',
    remittance_total_label VARCHAR(100) DEFAULT 'Total Gross Amount',
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id                SERIAL PRIMARY KEY,
    client_id         INTEGER,
    po_number         VARCHAR(200) UNIQUE NOT NULL,
    po_date           VARCHAR(50),
    description       TEXT,
    delivery_date     VARCHAR(50),
    total_amount      NUMERIC(18,2) DEFAULT 0,
    pdf_filename      VARCHAR(255),
    pdf_original_name VARCHAR(255),
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Invoices (no FK constraint on po_number — soft reference)
CREATE TABLE IF NOT EXISTS invoices (
    id                  SERIAL PRIMARY KEY,
    client_id           INTEGER,
    invoice_number      VARCHAR(200) UNIQUE NOT NULL,
    invoice_date        VARCHAR(50),
    po_number           VARCHAR(200),        -- soft ref, no FK
    description         TEXT,
    invoice_period      VARCHAR(200),
    assessable_value    NUMERIC(18,2) DEFAULT 0,
    total_tax           NUMERIC(18,2) DEFAULT 0,
    total_invoice_value NUMERIC(18,2) DEFAULT 0,
    gst_rate            NUMERIC(5,2)  DEFAULT 18.00,
    gst_amount          NUMERIC(18,2) DEFAULT 0,
    tds_rate            NUMERIC(5,2)  DEFAULT 2.00,
    tds_amount          NUMERIC(18,2) DEFAULT 0,
    receivable          NUMERIC(18,2) DEFAULT 0,
    pdf_filename        VARCHAR(255),
    pdf_original_name   VARCHAR(255),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Remittances (no FK constraint on invoice_number — soft reference)
CREATE TABLE IF NOT EXISTS remittances (
    id                 SERIAL PRIMARY KEY,
    client_id          INTEGER,
    remittance_number  VARCHAR(200) UNIQUE NOT NULL,
    remittance_date    VARCHAR(50),
    invoice_number     VARCHAR(200),        -- soft ref, no FK
    gross_amount       NUMERIC(18,2) DEFAULT 0,
    total_gross_amount NUMERIC(18,2) DEFAULT 0,
    pdf_filename       VARCHAR(255),
    pdf_original_name  VARCHAR(255),
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add client_id and PDF columns to existing tables if table already exists
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS client_id INTEGER;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS pdf_original_name VARCHAR(255);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_id INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_original_name VARCHAR(255);

ALTER TABLE remittances ADD COLUMN IF NOT EXISTS client_id INTEGER;
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS pdf_filename VARCHAR(255);
ALTER TABLE remittances ADD COLUMN IF NOT EXISTS pdf_original_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_name);
CREATE INDEX IF NOT EXISTS idx_inv_client  ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_po_client   ON purchase_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_rem_client  ON remittances(client_id);
CREATE INDEX IF NOT EXISTS idx_inv_po     ON invoices(po_number);
CREATE INDEX IF NOT EXISTS idx_rem_inv    ON remittances(invoice_number);
CREATE INDEX IF NOT EXISTS idx_inv_date   ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_inv_num    ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_po_num     ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_rem_num    ON remittances(remittance_number);

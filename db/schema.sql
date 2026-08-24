-- schema.sql – Drop FK constraints; use soft references only (app-level joining)

-- 1. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id            SERIAL PRIMARY KEY,
    po_number     VARCHAR(200) UNIQUE NOT NULL,
    po_date       VARCHAR(50),
    description   TEXT,
    delivery_date VARCHAR(50),
    total_amount  NUMERIC(18,2) DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Invoices (no FK constraint on po_number — soft reference)
CREATE TABLE IF NOT EXISTS invoices (
    id                  SERIAL PRIMARY KEY,
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
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Remittances (no FK constraint on invoice_number — soft reference)
CREATE TABLE IF NOT EXISTS remittances (
    id                 SERIAL PRIMARY KEY,
    remittance_number  VARCHAR(200) UNIQUE NOT NULL,
    remittance_date    VARCHAR(50),
    invoice_number     VARCHAR(200),        -- soft ref, no FK
    gross_amount       NUMERIC(18,2) DEFAULT 0,
    total_gross_amount NUMERIC(18,2) DEFAULT 0,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_po     ON invoices(po_number);
CREATE INDEX IF NOT EXISTS idx_rem_inv    ON remittances(invoice_number);
CREATE INDEX IF NOT EXISTS idx_inv_date   ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_inv_num    ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_po_num     ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_rem_num    ON remittances(remittance_number);

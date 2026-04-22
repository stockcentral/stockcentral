Last login: Wed Apr 22 18:42:04 on ttys000
mattworkpc@Mac ~ % PGPASSWORD=yXDeXzbicMTgNaCDAfPEAyLkgraiGLMK psql -h mainline.proxy.rlwy.net -U postgres -p 46082 -d railway -c "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0; ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_type VARCHAR(50) DEFAULT 'full';"
ALTER TABLE
ALTER TABLE
mattworkpc@Mac ~ % 

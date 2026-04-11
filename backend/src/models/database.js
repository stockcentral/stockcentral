const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shopify_shop VARCHAR(255),
        shopify_access_token TEXT,
        shopify_client_id VARCHAR(255),
        shopify_client_secret TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS vendors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(100),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        zip VARCHAR(20),
        country VARCHAR(100) DEFAULT 'US',
        contact_name VARCHAR(255),
        payment_terms VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        cost DECIMAL(10,2) DEFAULT 0,
        price DECIMAL(10,2) DEFAULT 0,
        quantity INTEGER DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 5,
        shopify_product_id VARCHAR(255),
        shopify_variant_id VARCHAR(255),
        category VARCHAR(255),
        brand VARCHAR(255),
        weight DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS vendor_skus (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
        inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
        vendor_sku VARCHAR(255) NOT NULL,
        vendor_cost DECIMAL(10,2),
        lead_time_days INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quotes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_number VARCHAR(100) UNIQUE NOT NULL,
        vendor_id UUID REFERENCES vendors(id),
        status VARCHAR(50) DEFAULT 'draft',
        notes TEXT,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        vendor_credit DECIMAL(10,2) DEFAULT 0,
        subtotal DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        requested_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS quote_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
        inventory_item_id UUID REFERENCES inventory_items(id),
        sku VARCHAR(255),
        name VARCHAR(255),
        vendor_sku VARCHAR(255),
        quantity INTEGER DEFAULT 1,
        unit_cost DECIMAL(10,2) DEFAULT 0,
        total_cost DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS purchase_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_number VARCHAR(100) UNIQUE NOT NULL,
        quote_id UUID REFERENCES quotes(id),
        vendor_id UUID REFERENCES vendors(id),
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        shipping_cost DECIMAL(10,2) DEFAULT 0,
        vendor_credit DECIMAL(10,2) DEFAULT 0,
        subtotal DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) DEFAULT 0,
        expected_date DATE,
        received_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS po_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
        inventory_item_id UUID REFERENCES inventory_items(id),
        sku VARCHAR(255),
        name VARCHAR(255),
        vendor_sku VARCHAR(255),
        quantity_ordered INTEGER DEFAULT 1,
        quantity_received INTEGER DEFAULT 0,
        unit_cost DECIMAL(10,2) DEFAULT 0,
        total_cost DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
        invoice_number VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'unpaid',
        notes TEXT,
        file_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
        invoice_id UUID REFERENCES invoices(id),
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(100),
        reference_number VARCHAR(255),
        payment_date DATE DEFAULT CURRENT_DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rmas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rma_number VARCHAR(100) UNIQUE NOT NULL,
        po_id UUID REFERENCES purchase_orders(id),
        inventory_item_id UUID REFERENCES inventory_items(id),
        shopify_order_id VARCHAR(255),
        shopify_order_number VARCHAR(255),
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        quantity INTEGER DEFAULT 1,
        reason TEXT,
        resolution VARCHAR(50),
        replacement_type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bom (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        finished_product_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
        component_id UUID REFERENCES inventory_items(id),
        quantity DECIMAL(10,4) DEFAULT 1,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS manufacturing_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mo_number VARCHAR(100) UNIQUE NOT NULL,
        finished_product_id UUID REFERENCES inventory_items(id),
        quantity INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'planned',
        start_date DATE,
        completion_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source VARCHAR(50) NOT NULL,
        external_id VARCHAR(255),
        order_number VARCHAR(255),
        customer_name VARCHAR(255),
        customer_email VARCHAR(255),
        total DECIMAL(10,2),
        status VARCHAR(100),
        order_date TIMESTAMP,
        items JSONB,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };

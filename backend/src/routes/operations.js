// RMA Routes
const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');

const rmaRouter = express.Router();
rmaRouter.use(auth);

rmaRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, ii.name as item_name, ii.sku as item_sku, v.name as vendor_name
      FROM rmas r
      LEFT JOIN inventory_items ii ON r.inventory_item_id = ii.id
      LEFT JOIN purchase_orders po ON r.po_id = po.id
      LEFT JOIN vendors v ON po.vendor_id = v.id
      ORDER BY r.created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/', async (req, res) => {
  try {
    const { po_id, inventory_item_id, shopify_order_id, shopify_order_number, customer_name, customer_email, quantity, reason, resolution, replacement_type, notes } = req.body;
    const rmaNumber = `RMA-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    // Remove from inventory
    if (inventory_item_id && quantity) {
      await pool.query('UPDATE inventory_items SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2', [quantity, inventory_item_id]);
    }
    const result = await pool.query(
      `INSERT INTO rmas (rma_number, po_id, inventory_item_id, shopify_order_id, shopify_order_number, customer_name, customer_email, quantity, reason, resolution, replacement_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [rmaNumber, po_id, inventory_item_id, shopify_order_id, shopify_order_number, customer_name, customer_email, quantity||1, reason, resolution, replacement_type, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.put('/:id', async (req, res) => {
  try {
    const { status, resolution, replacement_type, notes } = req.body;
    const result = await pool.query(
      `UPDATE rmas SET status=$1, resolution=$2, replacement_type=$3, notes=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
      [status, resolution, replacement_type, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// BOM Router
const bomRouter = express.Router();
bomRouter.use(auth);

bomRouter.get('/:productId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, ii.sku as component_sku, ii.name as component_name, ii.cost as component_cost, ii.quantity as component_stock
      FROM bom b JOIN inventory_items ii ON b.component_id = ii.id
      WHERE b.finished_product_id = $1`, [req.params.productId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

bomRouter.post('/', async (req, res) => {
  try {
    const { finished_product_id, component_id, quantity, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO bom (finished_product_id, component_id, quantity, notes) VALUES ($1,$2,$3,$4) RETURNING *',
      [finished_product_id, component_id, quantity||1, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

bomRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bom WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Manufacturing Router
const mfgRouter = express.Router();
mfgRouter.use(auth);

mfgRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT mo.*, ii.name as product_name, ii.sku as product_sku
      FROM manufacturing_orders mo LEFT JOIN inventory_items ii ON mo.finished_product_id = ii.id
      ORDER BY mo.created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

mfgRouter.post('/', async (req, res) => {
  try {
    const { finished_product_id, quantity, start_date, completion_date, notes } = req.body;
    const moNumber = `MO-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const result = await pool.query(
      `INSERT INTO manufacturing_orders (mo_number, finished_product_id, quantity, start_date, completion_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [moNumber, finished_product_id, quantity||1, start_date, completion_date, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

mfgRouter.put('/:id/complete', async (req, res) => {
  try {
    const mo = await pool.query('SELECT * FROM manufacturing_orders WHERE id = $1', [req.params.id]);
    const m = mo.rows[0];
    // Deduct components
    const bom = await pool.query('SELECT * FROM bom WHERE finished_product_id = $1', [m.finished_product_id]);
    for (const component of bom.rows) {
      await pool.query(
        'UPDATE inventory_items SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2',
        [component.quantity * m.quantity, component.component_id]
      );
    }
    // Add finished goods
    await pool.query('UPDATE inventory_items SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2', [m.quantity, m.finished_product_id]);
    await pool.query(`UPDATE manufacturing_orders SET status='completed', completion_date=NOW(), updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Invoice Router
const invoiceRouter = express.Router();
invoiceRouter.use(auth);

invoiceRouter.get('/po/:poId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE po_id = $1 ORDER BY created_at DESC', [req.params.poId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

invoiceRouter.post('/', async (req, res) => {
  try {
    const { po_id, invoice_number, amount, due_date, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO invoices (po_id, invoice_number, amount, due_date, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [po_id, invoice_number, amount, due_date, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

invoiceRouter.put('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const result = await pool.query(
      'UPDATE invoices SET status=$1, notes=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      [status, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Payment Router
const paymentRouter = express.Router();
paymentRouter.use(auth);

paymentRouter.post('/', async (req, res) => {
  try {
    const { po_id, invoice_id, amount, payment_method, reference_number, payment_date, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO payments (po_id, invoice_id, amount, payment_method, reference_number, payment_date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [po_id, invoice_id, amount, payment_method, reference_number, payment_date||new Date(), notes]
    );
    // Update invoice status if fully paid
    if (invoice_id) {
      const invoice = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoice_id]);
      const totalPaid = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE invoice_id = $1', [invoice_id]);
      if (parseFloat(totalPaid.rows[0].total) >= parseFloat(invoice.rows[0].amount)) {
        await pool.query("UPDATE invoices SET status='paid' WHERE id=$1", [invoice_id]);
      }
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { rmaRouter, bomRouter, mfgRouter, invoiceRouter, paymentRouter };

const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const generatePONumber = () => `PO-${Date.now()}-${Math.floor(Math.random()*1000)}`;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT po.*, v.name as vendor_name,
        (SELECT COUNT(*) FROM invoices WHERE po_id = po.id) as invoice_count,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE po_id = po.id) as amount_paid
      FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id
      ORDER BY po.created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const po = await pool.query(`
      SELECT po.*, v.name as vendor_name, v.email as vendor_email, v.address as vendor_address,
        v.city as vendor_city, v.state as vendor_state, v.zip as vendor_zip, v.contact_name
      FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = $1`, [req.params.id]);
    const items = await pool.query('SELECT * FROM po_items WHERE po_id = $1', [req.params.id]);
    const invoices = await pool.query('SELECT * FROM invoices WHERE po_id = $1', [req.params.id]);
    const payments = await pool.query('SELECT * FROM payments WHERE po_id = $1 ORDER BY payment_date DESC', [req.params.id]);
    res.json({ ...po.rows[0], items: items.rows, invoices: invoices.rows, payments: payments.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { vendor_id, quote_id, items, notes, shipping_cost, vendor_credit, expected_date } = req.body;
    const subtotal = items.reduce((sum, i) => sum + (i.unit_cost * i.quantity_ordered), 0);
    const total = subtotal + (shipping_cost||0) - (vendor_credit||0);
    const po = await pool.query(
      `INSERT INTO purchase_orders (po_number, vendor_id, quote_id, notes, shipping_cost, vendor_credit, subtotal, total, expected_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [generatePONumber(), vendor_id, quote_id, notes, shipping_cost||0, vendor_credit||0, subtotal, total, expected_date]
    );
    for (const item of items) {
      await pool.query(
        `INSERT INTO po_items (po_id, inventory_item_id, sku, name, vendor_sku, quantity_ordered, unit_cost, total_cost, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [po.rows[0].id, item.inventory_item_id, item.sku, item.name, item.vendor_sku, item.quantity_ordered, item.unit_cost, item.unit_cost*item.quantity_ordered, item.notes]
      );
    }
    res.json(po.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, notes, shipping_cost, vendor_credit, expected_date, received_date } = req.body;
    const result = await pool.query(
      `UPDATE purchase_orders SET status=$1, notes=$2, shipping_cost=$3, vendor_credit=$4, expected_date=$5, received_date=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [status, notes, shipping_cost, vendor_credit, expected_date, received_date, req.params.id]
    );
    // If received, update inventory
    if (status === 'received') {
      const items = await pool.query('SELECT * FROM po_items WHERE po_id = $1', [req.params.id]);
      for (const item of items.rows) {
        if (item.inventory_item_id) {
          await pool.query(
            'UPDATE inventory_items SET quantity = quantity + $1, cost = $2, updated_at = NOW() WHERE id = $3',
            [item.quantity_ordered, item.unit_cost, item.inventory_item_id]
          );
        }
      }
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM purchase_orders WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const generateQuoteNumber = () => `QR-${Date.now()}-${Math.floor(Math.random()*1000)}`;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.*, v.name as vendor_name FROM quotes q
      LEFT JOIN vendors v ON q.vendor_id = v.id ORDER BY q.created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const quote = await pool.query(`
      SELECT q.*, v.name as vendor_name, v.email as vendor_email, v.contact_name, v.address, v.city, v.state, v.zip
      FROM quotes q LEFT JOIN vendors v ON q.vendor_id = v.id WHERE q.id = $1`, [req.params.id]);
    const items = await pool.query('SELECT * FROM quote_items WHERE quote_id = $1', [req.params.id]);
    res.json({ ...quote.rows[0], items: items.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { vendor_id, items, notes, shipping_cost, vendor_credit, requested_by } = req.body;
    const subtotal = items.reduce((sum, i) => sum + ((i.unit_cost||0) * i.quantity), 0);
    const total = subtotal + (shipping_cost||0) - (vendor_credit||0);
    const quote = await pool.query(
      `INSERT INTO quotes (quote_number, vendor_id, notes, shipping_cost, vendor_credit, subtotal, total, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [generateQuoteNumber(), vendor_id, notes, shipping_cost||0, vendor_credit||0, subtotal, total, requested_by]
    );
    for (const item of items) {
      await pool.query(
        `INSERT INTO quote_items (quote_id, inventory_item_id, sku, name, vendor_sku, quantity, unit_cost, total_cost, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [quote.rows[0].id, item.inventory_item_id, item.sku, item.name, item.vendor_sku, item.quantity, item.unit_cost||0, (item.unit_cost||0)*item.quantity, item.notes]
      );
    }
    res.json(quote.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { status, notes, shipping_cost, vendor_credit, items } = req.body;
    if (items) {
      await pool.query('DELETE FROM quote_items WHERE quote_id = $1', [req.params.id]);
      for (const item of items) {
        await pool.query(
          `INSERT INTO quote_items (quote_id, inventory_item_id, sku, name, vendor_sku, quantity, unit_cost, total_cost, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [req.params.id, item.inventory_item_id, item.sku, item.name, item.vendor_sku, item.quantity, item.unit_cost||0, (item.unit_cost||0)*item.quantity, item.notes]
        );
      }
    }
    const subtotal = (items||[]).reduce((sum, i) => sum + ((i.unit_cost||0) * i.quantity), 0);
    const total = subtotal + (shipping_cost||0) - (vendor_credit||0);
    const result = await pool.query(
      `UPDATE quotes SET status=$1, notes=$2, shipping_cost=$3, vendor_credit=$4, subtotal=$5, total=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [status, notes, shipping_cost||0, vendor_credit||0, subtotal, total, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convert quote to PO
router.post('/:id/convert', async (req, res) => {
  try {
    const quote = await pool.query('SELECT * FROM quotes WHERE id = $1', [req.params.id]);
    const items = await pool.query('SELECT * FROM quote_items WHERE quote_id = $1', [req.params.id]);
    const q = quote.rows[0];
    const poNumber = `PO-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const po = await pool.query(
      `INSERT INTO purchase_orders (po_number, quote_id, vendor_id, notes, shipping_cost, vendor_credit, subtotal, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [poNumber, q.id, q.vendor_id, q.notes, q.shipping_cost, q.vendor_credit, q.subtotal, q.total]
    );
    for (const item of items.rows) {
      await pool.query(
        `INSERT INTO po_items (po_id, inventory_item_id, sku, name, vendor_sku, quantity_ordered, unit_cost, total_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [po.rows[0].id, item.inventory_item_id, item.sku, item.name, item.vendor_sku, item.quantity, item.unit_cost, item.total_cost]
      );
    }
    await pool.query(`UPDATE quotes SET status='converted', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json(po.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

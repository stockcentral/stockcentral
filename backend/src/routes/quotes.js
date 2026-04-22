const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

const generateQuoteNumber = () => `QR-${Date.now()}-${Math.floor(Math.random()*1000)}`;

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT q.*, v.name as vendor_name, q.total as total_amount,
        (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as item_count,
        (SELECT COUNT(*) FROM email_log WHERE quote_id = q.id AND direction = 'inbound') as vendor_reply_count,
        (SELECT MAX(created_at) FROM email_log WHERE quote_id = q.id AND direction = 'inbound') as last_vendor_reply
      FROM quotes q
      LEFT JOIN vendors v ON q.vendor_id = v.id
      ORDER BY q.created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const quote = await pool.query(`
      SELECT q.*, v.name as vendor_name, v.email as vendor_email, v.sales_rep_email,
        v.contact_name, v.address, v.city, v.state, v.zip
      FROM quotes q LEFT JOIN vendors v ON q.vendor_id = v.id WHERE q.id = $1`, [req.params.id]);
    const items = await pool.query('SELECT * FROM quote_items WHERE quote_id = $1', [req.params.id]);
    res.json({ ...quote.rows[0], items: items.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { vendor_id, items = [], notes, shipping_cost, vendor_credit, requested_by, shopify_order_ids, status } = req.body;
    const subtotal = items.reduce((sum, i) => sum + ((parseFloat(i.unit_cost)||0) * (parseInt(i.quantity)||0)), 0);
    const total = subtotal + (parseFloat(shipping_cost)||0) - (parseFloat(vendor_credit)||0);
    const quote = await pool.query(
      `INSERT INTO quotes (quote_number, vendor_id, notes, shipping_cost, vendor_credit, subtotal, total, requested_by, shopify_order_ids, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [generateQuoteNumber(), vendor_id||null, notes||'', parseFloat(shipping_cost)||0, parseFloat(vendor_credit)||0, subtotal, total, requested_by||null, shopify_order_ids||'', status||'draft']
    );
    for (const item of items) {
      if (!item.inventory_item_id) continue;
      await pool.query(
        `INSERT INTO quote_items (quote_id, inventory_item_id, sku, name, vendor_sku, quantity, unit_cost, total_cost, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [quote.rows[0].id, item.inventory_item_id, item.sku||'', item.name||'', item.vendor_sku||'', item.quantity||1, parseFloat(item.unit_cost)||0, (parseFloat(item.unit_cost)||0)*(parseInt(item.quantity)||1), item.notes||'']
      );
    }
    res.json(quote.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { vendor_id, status, notes, shipping_cost, vendor_credit, items = [], shopify_order_ids } = req.body;
    // Delete and re-insert items
    await pool.query('DELETE FROM quote_items WHERE quote_id = $1', [req.params.id]);
    for (const item of items) {
      if (!item.inventory_item_id) continue;
      await pool.query(
        `INSERT INTO quote_items (quote_id, inventory_item_id, sku, name, vendor_sku, quantity, unit_cost, total_cost, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [req.params.id, item.inventory_item_id, item.sku||'', item.name||'', item.vendor_sku||'', item.quantity||1, parseFloat(item.unit_cost)||0, (parseFloat(item.unit_cost)||0)*(parseInt(item.quantity)||1), item.notes||'']
      );
    }
    const subtotal = items.reduce((sum, i) => sum + ((parseFloat(i.unit_cost)||0) * (parseInt(i.quantity)||0)), 0);
    const total = subtotal + (parseFloat(shipping_cost)||0) - (parseFloat(vendor_credit)||0);
    const result = await pool.query(
      `UPDATE quotes SET vendor_id=$1, status=$2, notes=$3, shipping_cost=$4, vendor_credit=$5,
       subtotal=$6, total=$7, shopify_order_ids=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
      [vendor_id||null, status||'draft', notes||'', parseFloat(shipping_cost)||0, parseFloat(vendor_credit)||0, subtotal, total, shopify_order_ids||'', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM quote_items WHERE quote_id = $1', [req.params.id]);
    await pool.query('DELETE FROM quotes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
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
      [poNumber, q.id, q.vendor_id, q.notes, q.shipping_cost||0, q.vendor_credit||0, q.subtotal||0, q.total_amount||0]
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

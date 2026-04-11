const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const vendor = await pool.query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    const skus = await pool.query(`
      SELECT vs.*, ii.sku as internal_sku, ii.name as item_name
      FROM vendor_skus vs JOIN inventory_items ii ON vs.inventory_item_id = ii.id
      WHERE vs.vendor_id = $1`, [req.params.id]);
    res.json({ ...vendor.rows[0], vendor_skus: skus.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, address, city, state, zip, country, contact_name, payment_terms, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO vendors (name, email, phone, address, city, state, zip, country, contact_name, payment_terms, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, email, phone, address, city, state, zip, country||'US', contact_name, payment_terms, notes]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, email, phone, address, city, state, zip, country, contact_name, payment_terms, notes } = req.body;
    const result = await pool.query(
      `UPDATE vendors SET name=$1, email=$2, phone=$3, address=$4, city=$5, state=$6, zip=$7, country=$8, contact_name=$9, payment_terms=$10, notes=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [name, email, phone, address, city, state, zip, country, contact_name, payment_terms, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM vendors WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Vendor SKUs
router.post('/:id/skus', async (req, res) => {
  try {
    const { inventory_item_id, vendor_sku, vendor_cost, lead_time_days } = req.body;
    const result = await pool.query(
      `INSERT INTO vendor_skus (vendor_id, inventory_item_id, vendor_sku, vendor_cost, lead_time_days)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, inventory_item_id, vendor_sku, vendor_cost, lead_time_days]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/skus/:skuId', async (req, res) => {
  try {
    await pool.query('DELETE FROM vendor_skus WHERE id = $1', [req.params.skuId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Get all inventory items
router.get('/', async (req, res) => {
  try {
    const { search, category, low_stock } = req.query;
    let query = 'SELECT * FROM inventory_items WHERE 1=1';
    const params = [];
    if (search) { params.push(`%${search}%`); query += ` AND (sku ILIKE $${params.length} OR name ILIKE $${params.length})`; }
    if (category) { params.push(category); query += ` AND category = $${params.length}`; }
    if (low_stock === 'true') query += ` AND quantity <= low_stock_threshold`;
    query += ' ORDER BY name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single item
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create item
router.post('/', async (req, res) => {
  try {
    const { sku, name, description, cost, price, quantity, low_stock_threshold, category, brand, weight, shopify_product_id, shopify_variant_id } = req.body;
    const result = await pool.query(
      `INSERT INTO inventory_items (sku, name, description, cost, price, quantity, low_stock_threshold, category, brand, weight, shopify_product_id, shopify_variant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [sku, name, description, cost||0, price||0, quantity||0, low_stock_threshold||5, category, brand, weight, shopify_product_id, shopify_variant_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update item
router.put('/:id', async (req, res) => {
  try {
    const { sku, name, description, cost, price, quantity, low_stock_threshold, category, brand, weight } = req.body;
    const result = await pool.query(
      `UPDATE inventory_items SET sku=$1, name=$2, description=$3, cost=$4, price=$5, quantity=$6, low_stock_threshold=$7, category=$8, brand=$9, weight=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [sku, name, description, cost, price, quantity, low_stock_threshold, category, brand, weight, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete item
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory_items WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Import from CSV
router.post('/import', async (req, res) => {
  try {
    const { items, source } = req.body;
    let imported = 0;
    for (const item of items) {
      await pool.query(
        `INSERT INTO inventory_items (sku, name, description, cost, price, quantity, category)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, cost=EXCLUDED.cost, quantity=EXCLUDED.quantity, updated_at=NOW()`,
        [item.sku, item.name, item.description||'', item.cost||0, item.price||0, item.quantity||0, item.category||'']
      );
      imported++;
    }
    res.json({ imported, message: `Successfully imported ${imported} items from ${source}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

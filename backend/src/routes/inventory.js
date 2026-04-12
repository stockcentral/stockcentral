const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

const sanitize = (val, type) => {
    if (val === undefined || val === null || val === '') return null;
    if (type === 'numeric') {
          const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
          return isNaN(n) ? 0 : n;
    }
    if (type === 'int') {
          const n = parseInt(String(val).replace(/[^0-9]/g, ''));
          return isNaN(n) ? 0 : n;
    }
    return String(val).trim();
};

const validateItem = (body) => {
    const errors = [];
    if (!body.sku || !String(body.sku).trim()) errors.push({ field: 'sku', message: 'SKU is required' });
    if (!body.name || !String(body.name).trim()) errors.push({ field: 'name', message: 'Name is required' });
    if (body.cost !== undefined && body.cost !== '' && isNaN(parseFloat(body.cost))) errors.push({ field: 'cost', message: 'Cost must be a valid number' });
    if (body.price !== undefined && body.price !== '' && isNaN(parseFloat(body.price))) errors.push({ field: 'price', message: 'Price must be a valid number' });
    if (body.quantity !== undefined && body.quantity !== '' && isNaN(parseInt(body.quantity))) errors.push({ field: 'quantity', message: 'Quantity must be a whole number' });
    if (body.low_stock_threshold !== undefined && body.low_stock_threshold !== '' && isNaN(parseInt(body.low_stock_threshold))) errors.push({ field: 'low_stock_threshold', message: 'Low stock alert must be a whole number' });
    return errors;
};

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

router.get('/:id', async (req, res) => {
    try {
          const result = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [req.params.id]);
          if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
    try {
          const errors = validateItem(req.body);
          if (errors.length) return res.status(400).json({ errors, error: errors[0].message });
          const { sku, name, description, cost, price, quantity, low_stock_threshold, category, brand, weight, shopify_product_id, shopify_variant_id, harmonized_code, length, width, height } = req.body;
          const result = await pool.query(
                  `INSERT INTO inventory_items (sku, name, description, cost, price, quantity, low_stock_threshold, category, brand, weight, shopify_product_id, shopify_variant_id, harmonized_code, length, width, height)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
                  [
                            String(sku).trim(),
                            String(name).trim(),
                            description || '',
                            sanitize(cost, 'numeric'),
                            sanitize(price, 'numeric'),
                            sanitize(quantity, 'int'),
                            sanitize(low_stock_threshold, 'int') || 5,
                            category || null,
                            brand || null,
                            sanitize(weight, 'numeric'),
                            shopify_product_id || null,
                            shopify_variant_id || null,
                            harmonized_code || null,
                            sanitize(length, 'numeric'),
                            sanitize(width, 'numeric'),
                            sanitize(height, 'numeric')
                          ]
                );
          res.json(result.rows[0]);
    } catch (err) {
          if (err.code === '23505') return res.status(400).json({ errors: [{ field: 'sku', message: 'A product with this SKU already exists' }], error: 'SKU already exists' });
          res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
          const errors = validateItem(req.body);
          if (errors.length) return res.status(400).json({ errors, error: errors[0].message });
          const { sku, name, description, cost, price, quantity, low_stock_threshold, category, brand, weight, harmonized_code, length, width, height } = req.body;
          const result = await pool.query(
                  `UPDATE inventory_items SET sku=$1, name=$2, description=$3, cost=$4, price=$5, quantity=$6, low_stock_threshold=$7, category=$8, brand=$9, weight=$10, harmonized_code=$11, length=$12, width=$13, height=$14, updated_at=NOW()
                         WHERE id=$15 RETURNING *`,
                  [
                            String(sku).trim(),
                            String(name).trim(),
                            description || '',
                            sanitize(cost, 'numeric'),
                            sanitize(price, 'numeric'),
                            sanitize(quantity, 'int'),
                            sanitize(low_stock_threshold, 'int') || 5,
                            category || null,
                            brand || null,
                            sanitize(weight, 'numeric'),
                            harmonized_code || null,
                            sanitize(length, 'numeric'),
                            sanitize(width, 'numeric'),
                            sanitize(height, 'numeric'),
                            req.params.id
                          ]
                );
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
          await pool.query('DELETE FROM inventory_items WHERE id = $1', [req.params.id]);
          res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/import', async (req, res) => {
    try {
          const { items, source } = req.body;
          let imported = 0;
          for (const item of items) {
                  await pool.query(
                            `INSERT INTO inventory_items (sku, name, description, cost, price, quantity, category)
                                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                                              ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, cost=EXCLUDED.cost, quantity=EXCLUDED.quantity, updated_at=NOW()`,
                            [String(item.sku||'').trim(), item.name||'', item.description||'', sanitize(item.cost,'numeric')||0, sanitize(item.price,'numeric')||0, sanitize(item.quantity,'int')||0, item.category||'']
                          );
                  imported++;
          }
          res.json({ imported, message: `Successfully imported ${imported} items from ${source}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

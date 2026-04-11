const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// Save Shopify settings
router.post('/settings', async (req, res) => {
  try {
    const { shopify_shop, shopify_access_token } = req.body;
    const existing = await pool.query('SELECT id FROM settings LIMIT 1');
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE settings SET shopify_shop=$1, shopify_access_token=$2, updated_at=NOW() WHERE id=$3',
        [shopify_shop, shopify_access_token, existing.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO settings (shopify_shop, shopify_access_token) VALUES ($1,$2)',
        [shopify_shop, shopify_access_token]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT shopify_shop, created_at FROM settings LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync products from Shopify
router.post('/sync-products', async (req, res) => {
  try {
    const settings = await pool.query('SELECT * FROM settings LIMIT 1');
    if (!settings.rows.length || !settings.rows[0].shopify_access_token) {
      return res.status(400).json({ error: 'Shopify not configured' });
    }
    const { shopify_shop, shopify_access_token } = settings.rows[0];
    const response = await fetch(
      `https://${shopify_shop}/admin/api/2024-01/products.json?limit=250`,
      { headers: { 'X-Shopify-Access-Token': shopify_access_token } }
    );
    const data = await response.json();
    let synced = 0;
    for (const product of data.products || []) {
      for (const variant of product.variants) {
        await pool.query(
          `INSERT INTO inventory_items (sku, name, price, quantity, shopify_product_id, shopify_variant_id)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, price=EXCLUDED.price, shopify_product_id=EXCLUDED.shopify_product_id, shopify_variant_id=EXCLUDED.shopify_variant_id, updated_at=NOW()`,
          [variant.sku || `SHOPIFY-${variant.id}`, product.title + (variant.title !== 'Default Title' ? ` - ${variant.title}` : ''), variant.price, variant.inventory_quantity || 0, product.id.toString(), variant.id.toString()]
        );
        synced++;
      }
    }
    res.json({ synced, message: `Synced ${synced} products from Shopify` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update Shopify inventory
router.post('/update-inventory', async (req, res) => {
  try {
    const { inventory_item_id, quantity } = req.body;
    const settings = await pool.query('SELECT * FROM settings LIMIT 1');
    if (!settings.rows.length) return res.status(400).json({ error: 'Shopify not configured' });
    const { shopify_shop, shopify_access_token } = settings.rows[0];
    const item = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [inventory_item_id]);
    if (!item.rows[0]?.shopify_variant_id) return res.status(400).json({ error: 'No Shopify variant linked' });
    // Get inventory item ID from Shopify
    const variantRes = await fetch(
      `https://${shopify_shop}/admin/api/2024-01/variants/${item.rows[0].shopify_variant_id}.json`,
      { headers: { 'X-Shopify-Access-Token': shopify_access_token } }
    );
    const variantData = await variantRes.json();
    const shopifyInventoryItemId = variantData.variant?.inventory_item_id;
    if (!shopifyInventoryItemId) return res.status(400).json({ error: 'Could not find Shopify inventory item' });
    // Get location
    const locRes = await fetch(`https://${shopify_shop}/admin/api/2024-01/locations.json`, { headers: { 'X-Shopify-Access-Token': shopify_access_token } });
    const locData = await locRes.json();
    const locationId = locData.locations?.[0]?.id;
    // Update inventory level
    await fetch(`https://${shopify_shop}/admin/api/2024-01/inventory_levels/set.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': shopify_access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, inventory_item_id: shopifyInventoryItemId, available: quantity })
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sync orders from Shopify
router.post('/sync-orders', async (req, res) => {
  try {
    const settings = await pool.query('SELECT * FROM settings LIMIT 1');
    if (!settings.rows.length) return res.status(400).json({ error: 'Shopify not configured' });
    const { shopify_shop, shopify_access_token } = settings.rows[0];
    const response = await fetch(
      `https://${shopify_shop}/admin/api/2024-01/orders.json?limit=250&status=any`,
      { headers: { 'X-Shopify-Access-Token': shopify_access_token } }
    );
    const data = await response.json();
    let synced = 0;
    for (const order of data.orders || []) {
      await pool.query(
        `INSERT INTO order_history (source, external_id, order_number, customer_name, customer_email, total, status, order_date, items, raw_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT DO NOTHING`,
        ['shopify', order.id.toString(), order.order_number?.toString(), `${order.customer?.first_name||''} ${order.customer?.last_name||''}`.trim(), order.customer?.email, order.total_price, order.financial_status, order.created_at, JSON.stringify(order.line_items), JSON.stringify(order)]
      );
      synced++;
    }
    res.json({ synced });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get order history
router.get('/orders', async (req, res) => {
  try {
    const { search, source } = req.query;
    let query = 'SELECT id, source, external_id, order_number, customer_name, customer_email, total, status, order_date FROM order_history WHERE 1=1';
    const params = [];
    if (search) { params.push(`%${search}%`); query += ` AND (order_number ILIKE $${params.length} OR customer_name ILIKE $${params.length} OR customer_email ILIKE $${params.length})`; }
    if (source) { params.push(source); query += ` AND source = $${params.length}`; }
    query += ' ORDER BY order_date DESC LIMIT 100';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Import WooCommerce/Odoo order history
router.post('/import-orders', async (req, res) => {
  try {
    const { orders, source } = req.body;
    let imported = 0;
    for (const order of orders) {
      await pool.query(
        `INSERT INTO order_history (source, external_id, order_number, customer_name, customer_email, total, status, order_date, items, raw_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
        [source, order.id?.toString(), order.order_number?.toString(), order.customer_name, order.customer_email, order.total, order.status, order.order_date, JSON.stringify(order.items||[]), JSON.stringify(order)]
      );
      imported++;
    }
    res.json({ imported, message: `Imported ${imported} orders from ${source}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

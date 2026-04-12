const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// Get all orders (paid/unfulfilled from Shopify or manually added)
router.get('/', async (req, res) => {
    try {
          const { sort, dir, status } = req.query;
          const validSorts = { order_number:'order_number', customer_name:'customer_name', created_at:'created_at', total_price:'total_price' };
          const sortCol = validSorts[sort] || 'created_at';
          const sortDir = dir === 'asc' ? 'ASC' : 'DESC';
          let query = `SELECT o.*, os.name as status_name, os.color as status_color
                FROM shopify_orders o
                      LEFT JOIN order_statuses os ON o.custom_status_id = os.id
                            WHERE 1=1`;
          const params = [];
          if (status) { params.push(status); query += ` AND (os.name=$${params.length} OR o.status=$${params.length})`; }
          query += ` ORDER BY o.${sortCol} ${sortDir}`;
          const result = await pool.query(query, params);
          res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Get single order with BOM details for line items
router.get('/:id', async (req, res) => {
    try {
          const order = await pool.query(`
                SELECT o.*, os.name as status_name, os.color as status_color
                      FROM shopify_orders o
                            LEFT JOIN order_statuses os ON o.custom_status_id = os.id
                                  WHERE o.id=$1`, [req.params.id]);
          if (!order.rows.length) return res.status(404).json({ error: 'Not found' });
          const o = order.rows[0];
          // For each line item, check if it's a manufactured product and get BOM + stock
      const lineItems = o.line_items || [];
          const enriched = [];
          for (const item of lineItems) {
                  const inv = await pool.query(
                            'SELECT * FROM inventory_items WHERE sku=$1 OR shopify_variant_id=$2',
                            [item.sku || '', item.variant_id || '']
                          );
                  const invItem = inv.rows[0] || null;
                  let bom = [];
                  if (invItem && invItem.is_manufactured) {
                            const bomResult = await pool.query(`
                                      SELECT b.*, ii.sku as component_sku, ii.name as component_name,
                                                       ii.quantity as on_hand, ii.low_stock_threshold
                                                                 FROM bom b JOIN inventory_items ii ON b.component_id = ii.id
                                                                           WHERE b.finished_product_id=$1`, [invItem.id]);
                            bom = bomResult.rows;
                  }
                  enriched.push({ ...item, inventory_item: invItem, bom });
          }
          res.json({ ...o, line_items_enriched: enriched });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Update order custom status + log it
router.put('/:id/status', async (req, res) => {
    try {
          const { status_id } = req.body;
          const old = await pool.query('SELECT custom_status_id FROM shopify_orders WHERE id=$1', [req.params.id]);
          const oldStatusId = old.rows[0]?.custom_status_id;
          await pool.query('UPDATE shopify_orders SET custom_status_id=$1, updated_at=NOW() WHERE id=$2', [status_id, req.params.id]);
          // Log the change
      const [oldS, newS] = await Promise.all([
              pool.query('SELECT name FROM order_statuses WHERE id=$1', [oldStatusId]),
              pool.query('SELECT name FROM order_statuses WHERE id=$1', [status_id])
            ]);
          await pool.query(
                  'INSERT INTO order_status_log (shopify_order_id, old_status, new_status, changed_by) VALUES ($1,$2,$3,$4)',
                  [req.params.id, oldS.rows[0]?.name || null, newS.rows[0]?.name || null, req.user.id]
                );
          const updated = await pool.query(`
                SELECT o.*, os.name as status_name, os.color as status_color
                      FROM shopify_orders o LEFT JOIN order_statuses os ON o.custom_status_id=os.id
                            WHERE o.id=$1`, [req.params.id]);
          res.json(updated.rows[0]);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Add order note (breadcrumb when items sent to quote)
router.post('/:id/notes', async (req, res) => {
    try {
          const { note, note_type, linked_id, linked_type } = req.body;
          const order = await pool.query('SELECT shopify_order_id FROM shopify_orders WHERE id=$1', [req.params.id]);
          const result = await pool.query(
                  'INSERT INTO order_notes (shopify_order_id, note, note_type, linked_id, linked_type, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
                  [order.rows[0]?.shopify_order_id || req.params.id, note, note_type || 'general', linked_id || null, linked_type || null, req.user.id]
                );
          res.json(result.rows[0]);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/notes', async (req, res) => {
    try {
          const order = await pool.query('SELECT shopify_order_id FROM shopify_orders WHERE id=$1', [req.params.id]);
          const result = await pool.query(`
                SELECT n.*, u.name as author_name
                      FROM order_notes n LEFT JOIN users u ON n.created_by=u.id
                            WHERE n.shopify_order_id=$1 ORDER BY n.created_at DESC`,
                                                [order.rows[0]?.shopify_order_id || req.params.id]
                                              );
          res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Manual order create (for testing without Shopify)
router.post('/', async (req, res) => {
    try {
          const { order_number, customer_name, customer_email, total_price, line_items, status } = req.body;
          const defaultStatus = await pool.query('SELECT id FROM order_statuses WHERE is_default=true LIMIT 1');
          const result = await pool.query(
                  'INSERT INTO shopify_orders (order_number, customer_name, customer_email, total_price, line_items, status, custom_status_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
                  [order_number, customer_name, customer_email, parseFloat(total_price)||0, JSON.stringify(line_items||[]), status||'paid_unfulfilled', defaultStatus.rows[0]?.id || null]
                );
          res.json(result.rows[0]);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Get order statuses
router.get('/meta/statuses', async (req, res) => {
    try {
          const result = await pool.query('SELECT * FROM order_statuses ORDER BY sort_order ASC');
          res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Get status change log
router.get('/meta/status-log', async (req, res) => {
    try {
          const result = await pool.query(`
                SELECT l.*, u.name as changed_by_name
                      FROM order_status_log l LEFT JOIN users u ON l.changed_by=u.id
                            ORDER BY l.created_at DESC LIMIT 200`);
          res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

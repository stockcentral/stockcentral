const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// These specific routes MUST come before /:id
router.get('/meta/statuses', async (req, res) => {
      try {
              const result = await pool.query('SELECT * FROM order_statuses ORDER BY sort_order ASC');
              res.json(result.rows);
      } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/meta/status-log', async (req, res) => {
      try {
              const result = await pool.query(`
                    SELECT l.*, u.name as changed_by_name
                          FROM order_status_log l LEFT JOIN users u ON l.changed_by=u.id
                                ORDER BY l.created_at DESC LIMIT 200`);
              res.json(result.rows);
      } catch(err) { res.status(500).json({ error: err.message }); }
});

// List all orders with sorting
router.get('/', async (req, res) => {
      try {
              const { sort, dir } = req.query;
              const validSorts = { order_number:'o.order_number', customer_name:'o.customer_name', created_at:'o.created_at', total_price:'o.total_price' };
              const sortCol = validSorts[sort] || 'o.created_at';
              const sortDir = dir === 'asc' ? 'ASC' : 'DESC';
              const result = await pool.query(`
                    SELECT o.*, os.name as status_name, os.color as status_color
                          FROM shopify_orders o
                                LEFT JOIN order_statuses os ON o.custom_status_id = os.id
                                      ORDER BY ${sortCol} ${sortDir}`);
              res.json(result.rows);
      } catch(err) { res.status(500).json({ error: err.message }); }
});

// Single order with enriched line items + BOM
router.get('/:id', async (req, res) => {
      try {
              const order = await pool.query(`
                    SELECT o.*, os.name as status_name, os.color as status_color
                          FROM shopify_orders o
                                LEFT JOIN order_statuses os ON o.custom_status_id = os.id
                                      WHERE o.id=$1`, [req.params.id]);
              if (!order.rows.length) return res.status(404).json({ error: 'Not found' });
              const o = order.rows[0];
              const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
              const enriched = [];
              for (const item of lineItems) {
                        // Match by SKU
                const inv = await pool.query(
                            'SELECT * FROM inventory_items WHERE sku=$1 LIMIT 1',
                            [item.sku || '']
                          );
                        const invItem = inv.rows[0] || null;
                        let bom = [];
                        if (invItem && invItem.is_manufactured) {
                                    const bomResult = await pool.query(`
                                              SELECT b.*, b.component_id,
                                                               ii.sku as component_sku, ii.name as component_name,
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

// Update order status — writes a dated note and status log entry
router.put('/:id/status', async (req, res) => {
      try {
              const { status_id } = req.body;

        // Get current status name
        const current = await pool.query(`
              SELECT so.shopify_order_id, so.order_number, os.name as status_name
                    FROM shopify_orders so
                          LEFT JOIN order_statuses os ON so.custom_status_id = os.id
                                WHERE so.id=$1`, [req.params.id]);
              const oldStatusName = current.rows[0]?.status_name || 'None';
              const orderShopifyId = current.rows[0]?.shopify_order_id || req.params.id;
              const orderNumber = current.rows[0]?.order_number || req.params.id;

        // Get new status name
        const newStatusRow = await pool.query('SELECT name FROM order_statuses WHERE id=$1', [status_id]);
              const newStatusName = newStatusRow.rows[0]?.name || status_id;

        // Get the user's name for the note
        const userRow = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
              const userName = userRow.rows[0]?.name || 'Unknown user';

        // Update the order
        await pool.query('UPDATE shopify_orders SET custom_status_id=$1, updated_at=NOW() WHERE id=$2', [status_id, req.params.id]);

        // Write a status change note (shows in Order Activity)
        const noteText = `Status changed from "${oldStatusName}" to "${newStatusName}" by ${userName}`;
              await pool.query(
                        'INSERT INTO order_notes (shopify_order_id, note, note_type, created_by) VALUES ($1,$2,$3,$4)',
                        [orderShopifyId, noteText, 'status_change', req.user.id]
                      );

        // Also write to the status log table (for Settings > Status Log)
        await pool.query(
                  'INSERT INTO order_status_log (shopify_order_id, old_status, new_status, changed_by) VALUES ($1,$2,$3,$4)',
                  [orderShopifyId, oldStatusName, newStatusName, req.user.id]
                );

        // Return updated order
        const updated = await pool.query(`
              SELECT o.*, os.name as status_name, os.color as status_color
                    FROM shopify_orders o LEFT JOIN order_statuses os ON o.custom_status_id=os.id
                          WHERE o.id=$1`, [req.params.id]);
              res.json(updated.rows[0]);
      } catch(err) { res.status(500).json({ error: err.message }); }
});

// Get order notes (activity log)
router.get('/:id/notes', async (req, res) => {
      try {
              const order = await pool.query('SELECT shopify_order_id FROM shopify_orders WHERE id=$1', [req.params.id]);
              const shopifyId = order.rows[0]?.shopify_order_id || req.params.id;
              const result = await pool.query(`
                    SELECT n.*, u.name as author_name
                          FROM order_notes n LEFT JOIN users u ON n.created_by=u.id
                                WHERE n.shopify_order_id=$1
                                      ORDER BY n.created_at DESC`, [shopifyId]);
              res.json(result.rows);
      } catch(err) { res.status(500).json({ error: err.message }); }
});

// Add a note to an order
router.post('/:id/notes', async (req, res) => {
      try {
              const { note, note_type, linked_id, linked_type } = req.body;
              const order = await pool.query('SELECT shopify_order_id FROM shopify_orders WHERE id=$1', [req.params.id]);
              const shopifyId = order.rows[0]?.shopify_order_id || req.params.id;
              const result = await pool.query(
                        'INSERT INTO order_notes (shopify_order_id, note, note_type, linked_id, linked_type, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
                        [shopifyId, note, note_type || 'general', linked_id || null, linked_type || null, req.user.id]
                      );
              res.json(result.rows[0]);
      } catch(err) { res.status(500).json({ error: err.message }); }
});

// Create a manual order (for testing)
router.post('/', async (req, res) => {
      try {
              const { order_number, customer_name, customer_email, total_price, line_items } = req.body;
              const defaultStatus = await pool.query('SELECT id FROM order_statuses WHERE is_default=true LIMIT 1');
              const result = await pool.query(
                        'INSERT INTO shopify_orders (order_number, customer_name, customer_email, total_price, line_items, status, custom_status_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
                        [order_number, customer_name, customer_email, parseFloat(total_price)||0, JSON.stringify(line_items||[]), 'paid_unfulfilled', defaultStatus.rows[0]?.id || null]
                      );
              res.json(result.rows[0]);
      } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

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
                      const inv = await pool.query('SELECT * FROM inventory_items WHERE sku=$1 LIMIT 1', [item.sku||'']);
                      const invItem = inv.rows[0] || null;
                      let bom = [];
                      let on_order = 0;
                      let open_pos = [];

                    if (invItem) {
                                  // BOM components if manufactured
                        if (invItem.is_manufactured) {
                                        const bomResult = await pool.query(`
                                                    SELECT b.*, ii.sku as component_sku, ii.name as component_name,
                                                                       ii.quantity as on_hand, ii.low_stock_threshold
                                                                                   FROM bom b JOIN inventory_items ii ON b.component_id = ii.id
                                                                                               WHERE b.finished_product_id=$1`, [invItem.id]);
                                        bom = bomResult.rows;
                        }

                        // On order: qty in sent/partial POs not yet received
                        const onOrderRes = await pool.query(`
                                  SELECT COALESCE(SUM(pi.quantity - pi.received_quantity), 0) as on_order
                                            FROM po_items pi
                                                      JOIN purchase_orders po ON pi.po_id = po.id
                                                                WHERE pi.inventory_item_id=$1
                                                                            AND po.status IN ('sent','partial','pending','ordered')
                                                                                        AND pi.quantity > pi.received_quantity`, [invItem.id]);
                                  on_order = parseInt(onOrderRes.rows[0]?.on_order || 0);

                        // Open POs list for hyperlink
                        const openPOsRes = await pool.query(`
                                  SELECT po.id, po.po_number, po.status, po.expected_date,
                                                   v.name as vendor_name,
                                                                    pi.quantity as ordered_qty, pi.received_quantity
                                                                              FROM po_items pi
                                                                                        JOIN purchase_orders po ON pi.po_id = po.id
                                                                                                  LEFT JOIN vendors v ON po.vendor_id = v.id
                                                                                                            WHERE pi.inventory_item_id=$1
                                                                                                                        AND po.status IN ('sent','partial','pending','ordered')
                                                                                                                                    AND pi.quantity > pi.received_quantity
                                                                                                                                              ORDER BY po.expected_date ASC NULLS LAST`, [invItem.id]);
                                  open_pos = openPOsRes.rows;

                        // Available = on_hand - qty committed to all open/unfulfilled orders (not just this one)
                        // For now: on_hand - (bom components needed for this order qty)
                        let bom_reserved = 0;
                                  if (invItem.is_manufactured && bom.length > 0) {
                                                  // The finished product itself needs qty units built
                                    bom_reserved = 0; // Components handled separately
                                  }
                                  // Simple available: on_hand - open order demand across all shopify orders
                        const demandRes = await pool.query(`
                                  SELECT COALESCE(SUM((li_item->>'quantity')::int), 0) as total_demand
                                            FROM shopify_orders so,
                                                           jsonb_array_elements(so.line_items) as li_item
                                                                     WHERE li_item->>'sku' = $1
                                                                                 AND so.status NOT IN ('cancelled','fulfilled')
                                                                                             AND so.custom_status_id IN (
                                                                                                           SELECT id FROM order_statuses WHERE name NOT IN ('Shipped','Cancelled')
                                                                                                                       )`, [invItem.sku]);
                                  const total_demand = parseInt(demandRes.rows[0]?.total_demand || 0);
                                  invItem.available = invItem.quantity - total_demand;
                                  invItem.on_order = on_order;
                                  invItem.open_pos = open_pos;
                    }

                    enriched.push({ ...item, inventory_item: invItem, bom, on_order, open_pos });
          }

          res.json({ ...o, line_items_enriched: enriched });
        } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/status', async (req, res) => {
        try {
                  const { status_id } = req.body;
                  const current = await pool.query(`
                        SELECT so.shopify_order_id, so.order_number, os.name as status_name
                              FROM shopify_orders so LEFT JOIN order_statuses os ON so.custom_status_id=os.id
                                    WHERE so.id=$1`, [req.params.id]);
                  const oldStatusName = current.rows[0]?.status_name || 'None';
                  const orderShopifyId = current.rows[0]?.shopify_order_id || req.params.id;
                  const newStatusRow = await pool.query('SELECT name FROM order_statuses WHERE id=$1', [status_id]);
                  const newStatusName = newStatusRow.rows[0]?.name || status_id;
                  const userRow = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
                  const userName = userRow.rows[0]?.name || 'Unknown user';
                  await pool.query('UPDATE shopify_orders SET custom_status_id=$1, updated_at=NOW() WHERE id=$2', [status_id, req.params.id]);
                  const noteText = `Status changed from "${oldStatusName}" to "${newStatusName}" by ${userName}`;
                  await pool.query('INSERT INTO order_notes (shopify_order_id, note, note_type, created_by) VALUES ($1,$2,$3,$4)',
                                         [orderShopifyId, noteText, 'status_change', req.user.id]);
                  await pool.query('INSERT INTO order_status_log (shopify_order_id, old_status, new_status, changed_by) VALUES ($1,$2,$3,$4)',
                                         [orderShopifyId, oldStatusName, newStatusName, req.user.id]);
                  const updated = await pool.query(`
                        SELECT o.*, os.name as status_name, os.color as status_color
                              FROM shopify_orders o LEFT JOIN order_statuses os ON o.custom_status_id=os.id
                                    WHERE o.id=$1`, [req.params.id]);
                  res.json(updated.rows[0]);
        } catch(err) { res.status(500).json({ error: err.message }); }
});

// Get notes
router.get('/:id/notes', async (req, res) => {
        try {
                  const order = await pool.query('SELECT shopify_order_id FROM shopify_orders WHERE id=$1', [req.params.id]);
                  const shopifyId = order.rows[0]?.shopify_order_id || req.params.id;
                  const result = await pool.query(`
                        SELECT n.*, u.name as author_name
                              FROM order_notes n LEFT JOIN users u ON n.created_by=u.id
                                    WHERE n.shopify_order_id=$1 ORDER BY n.created_at ASC`, [shopifyId]);
                  res.json(result.rows);
        } catch(err) { res.status(500).json({ error: err.message }); }
});

// Add note
router.post('/:id/notes', async (req, res) => {
        try {
                  const { note, note_type, linked_id, linked_type } = req.body;
                  const order = await pool.query('SELECT shopify_order_id FROM shopify_orders WHERE id=$1', [req.params.id]);
                  const shopifyId = order.rows[0]?.shopify_order_id || req.params.id;
                  const userRow = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
                  const authorName = userRow.rows[0]?.name || 'Unknown';
                  const result = await pool.query(
                              'INSERT INTO order_notes (shopify_order_id, note, note_type, linked_id, linked_type, created_by, author_name) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
                              [shopifyId, note, note_type||'general', linked_id||null, linked_type||null, req.user.id, authorName]
                            );
                  res.json(result.rows[0]);
        } catch(err) { res.status(500).json({ error: err.message }); }
});

// Edit note
router.put('/:id/notes/:noteId', async (req, res) => {
        try {
                  const { note } = req.body;
                  const result = await pool.query(
                              'UPDATE order_notes SET note=$1, updated_at=NOW() WHERE id=$2 AND created_by=$3 RETURNING *',
                              [note, req.params.noteId, req.user.id]
                            );
                  if (!result.rows.length) return res.status(403).json({ error: 'Not allowed' });
                  res.json(result.rows[0]);
        } catch(err) { res.status(500).json({ error: err.message }); }
});

// Delete note
router.delete('/:id/notes/:noteId', async (req, res) => {
        try {
                  await pool.query('DELETE FROM order_notes WHERE id=$1 AND created_by=$2', [req.params.noteId, req.user.id]);
                  res.json({ success: true });
        } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

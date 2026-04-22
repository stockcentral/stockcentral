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

router.get('/', async (req, res) => {
            try {
                          const { sort, dir } = req.query;
                          const validSorts = { order_number:'o.order_number', customer_name:'o.customer_name', created_at:'o.created_at', total_price:'o.total_price' };
                          const sortCol = validSorts[sort] || 'o.created_at';
                          const sortDir = dir === 'asc' ? 'ASC' : 'DESC';
                          const result = await pool.query(`SELECT o.*, os.name as status_name, os.color as status_color FROM shopify_orders o LEFT JOIN order_statuses os ON o.custom_status_id = os.id ORDER BY ${sortCol} ${sortDir}`);
                          res.json(result.rows);
            } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
            try {
                          const { customer_name, customer_email, line_items, total_price, subtotal_price, total_shipping_price, total_tax, status_id } = req.body;
                          const orderNumber = 'M' + Date.now().toString().slice(-6);
                          const items = Array.isArray(line_items) ? line_items : [];
                          const total = total_price || items.reduce((s, i) => s + ((parseFloat(i.price)||0) * (parseInt(i.quantity)||1)), 0);
                          const result = await pool.query(
                                          `INSERT INTO shopify_orders (order_number, customer_name, customer_email, line_items, total_price, subtotal_price, total_shipping_price, total_tax, custom_status_id, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',NOW(),NOW()) RETURNING *`,
                                          [orderNumber, customer_name||'Manual Order', customer_email||'', JSON.stringify(items), total, subtotal_price||total, total_shipping_price||0, total_tax||0, status_id||null]
                                        );
                          res.json(result.rows[0]);
            } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
            try {
                          const order = await pool.query(`SELECT o.*, os.name as status_name, os.color as status_color FROM shopify_orders o LEFT JOIN order_statuses os ON o.custom_status_id = os.id WHERE o.id=$1`, [req.params.id]);
                          if (!order.rows.length) return res.status(404).json({ error: 'Not found' });
                          const o = order.rows[0];
                          const lineItems = Array.isArray(o.line_items) ? o.line_items : [];
                          const enriched = await Promise.all(lineItems.map(async (item) => {
                                          if (!item.sku) return { ...item, inventory_item: null, bom: [], on_order: 0, open_pos: [] };
                                          const inv = await pool.query('SELECT * FROM inventory_items WHERE sku=$1 LIMIT 1', [item.sku]);
                                          const invItem = inv.rows[0] || null;
                                          if (!invItem) return { ...item, inventory_item: null, bom: [], on_order: 0, open_pos: [] };
                                          let bom = [];
                                          if (invItem.is_manufactured) {
                                                            const bomRes = await pool.query(`SELECT b.*, ii.sku as component_sku, ii.name as component_name, ii.quantity as on_hand FROM bom b JOIN inventory_items ii ON b.component_id=ii.id WHERE b.finished_product_id=$1`, [invItem.id]);
                                                            bom = bomRes.rows;
                                          }
                                          invItem.available = invItem.quantity;
                                          invItem.on_order = 0;
                                          return { ...item, inventory_item: invItem, bom, on_order: 0, open_pos: [] };
                          }));
                          res.json({ ...o, line_items_enriched: enriched });
            } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/status', async (req, res) => {
            try {
                          const { status_id } = req.body;
                          const current = await pool.query(`SELECT so.shopify_order_id, os.name as status_name FROM shopify_orders so LEFT JOIN order_statuses os ON so.custom_status_id=os.id WHERE so.id=$1`, [req.params.id]);
                          const oldStatusName = current.rows[0]?.status_name || 'None';
                          const orderShopifyId = current.rows[0]?.shopify_order_id || req.params.id;
                          const newStatusRow = await pool.query('SELECT name FROM order_statuses WHERE id=$1', [status_id]);
                          const newStatusName = newStatusRow.rows[0]?.name || status_id;
                          const userRow = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
                          const userName = userRow.rows[0]?.name || 'Unknown';
                          await pool.query('UPDATE shopify_orders SET custom_status_id=$1, updated_at=NOW() WHERE id=$2', [status_id, req.params.id]);
                          await pool.query('INSERT INTO order_notes (shopify_order_id, note, note_type, created_by) VALUES ($1,$2,$3,$4)', [orderShopifyId, `Status changed from "${oldStatusName}" to "${newStatusName}" by ${userName}`, 'status_change', req.user.id]);
                          const updated = await pool.query(`SELECT o.*, os.name as status_name, os.color as status_color FROM shopify_orders o LEFT JOIN order_statuses os ON o.custom_status_id=os.id WHERE o.id=$1`, [req.params.id]);
                          res.json(updated.rows[0]);
            } catch(err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/notes', async (req, res) => {
            try {
                          const order = await pool.query('SELECT shopify_order_id FROM shopify_orders WHERE id=$1', [req.params.id]);
                          const shopifyId = order.rows[0]?.shopify_order_id || req.params.id;
                          const result = await pool.query(`SELECT n.*, u.name as author_name FROM order_notes n LEFT JOIN users u ON n.created_by=u.id WHERE n.shopify_order_id=$1 ORDER BY n.created_at ASC`, [shopifyId]);
                          res.json(result.rows);
            } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/notes', async (req, res) => {
            try {
                          const { note, note_type, linked_id, linked_type } = req.body;
                          const order = await pool.query('SELECT shopify_order_id FROM shopify_orders WHERE id=$1', [req.params.id]);
                          const shopifyId = order.rows[0]?.shopify_order_id || req.params.id;
                          const userRow = await pool.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
                          const authorName = userRow.rows[0]?.name || 'Unknown';
                          const result = await pool.query('INSERT INTO order_notes (shopify_order_id, note, note_type, linked_id, linked_type, created_by, author_name) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [shopifyId, note, note_type||'general', linked_id||null, linked_type||null, req.user.id, authorName]);
                          res.json(result.rows[0]);
            } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/notes/:noteId', async (req, res) => {
            try {
                          const { note } = req.body;
                          const result = await pool.query('UPDATE order_notes SET note=$1, updated_at=NOW() WHERE id=$2 AND created_by=$3 RETURNING *', [note, req.params.noteId, req.user.id]);
                          if (!result.rows.length) return res.status(403).json({ error: 'Not allowed' });
                          res.json(result.rows[0]);
            } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/notes/:noteId', async (req, res) => {
            try {
                          await pool.query('DELETE FROM order_notes WHERE id=$1 AND created_by=$2', [req.params.noteId, req.user.id]);
                          res.json({ success: true });
            } catch(err) { res.status(500).json({ error: err.message }); }
});

// Update order tags
router.put('/:id/tags', async (req, res) => {
  try {
    const { tags } = req.body;
    await pool.query('UPDATE shopify_orders SET tags=$1 WHERE id=$2', [tags||'', req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});
module.exports = router;

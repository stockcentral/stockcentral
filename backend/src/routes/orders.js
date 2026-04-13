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

router.get('/:id', async (req, res) => {
          try {
                      const order = await pool.query(`SELECT o.*, os.name as status_name, os.color as status_color FROM shopify_orders o LEFT JOIN order_statuses os ON o.custom_status_id = os.id WHERE o.id=$1`, [req.params.id]);
                      if (!order.rows.length) return res.status(404).json({ error: 'Not found' });
                      const o = order.rows[0];
                      const lineItems = Array.isArray(o.line_items) ? o.line_items : [];

            // Get all SKUs at once
            const skus = lineItems.map(i => i.sku).filter(Boolean);
                      if (!skus.length) return res.json({ ...o, line_items_enriched: [] });

            // Run all inventory lookups in parallel
            const [invResults, onOrderResults, openPOResults, demandResults] = await Promise.all([
                          pool.query('SELECT * FROM inventory_items WHERE sku = ANY($1)', [skus]),
                          pool.query(`SELECT ii.sku, COALESCE(SUM(pi.quantity - pi.received_quantity),0) as on_order FROM po_items pi JOIN purchase_orders po ON pi.po_id=po.id JOIN inventory_items ii ON pi.inventory_item_id=ii.id WHERE ii.sku=ANY($1) AND po.status IN ('sent','partial','pending','ordered') AND pi.quantity > pi.received_quantity GROUP BY ii.sku`, [skus]),
                          pool.query(`SELECT ii.sku, po.id, po.po_number, po.status, po.expected_date, v.name as vendor_name, pi.quantity as ordered_qty, pi.received_quantity FROM po_items pi JOIN purchase_orders po ON pi.po_id=po.id LEFT JOIN vendors v ON po.vendor_id=v.id JOIN inventory_items ii ON pi.inventory_item_id=ii.id WHERE ii.sku=ANY($1) AND po.status IN ('sent','partial','pending','ordered') AND pi.quantity > pi.received_quantity ORDER BY po.expected_date ASC NULLS LAST`, [skus]),
AND (so.custom_status_id IS NULL OR so.custom_status_id NOT IN (SELECT id FROM order_statuses WHERE name IN ('Shipped','Cancelled'))) GROUP BY li_item->>'sku'
                        ]);

            const invMap = {};
                      invResults.rows.forEach(r => { invMap[r.sku] = r; });
                      const onOrderMap = {};
                      onOrderResults.rows.forEach(r => { onOrderMap[r.sku] = parseInt(r.on_order); });
                      const openPOMap = {};
                      openPOResults.rows.forEach(r => {
                                    if (!openPOMap[r.sku]) openPOMap[r.sku] = [];
                                    openPOMap[r.sku].push(r);
                      });
                      const demandMap = {};
                      demandResults.rows.forEach(r => { demandMap[r.sku] = parseInt(r.total_demand); });

            // Get BOMs for manufactured items in parallel
            const mfgItems = Object.values(invMap).filter(i => i.is_manufactured);
                      const bomMap = {};
                      if (mfgItems.length) {
                                    const bomResults = await Promise.all(mfgItems.map(inv =>
                                                    pool.query(`SELECT b.*, ii.sku as component_sku, ii.name as component_name, ii.quantity as on_hand FROM bom b JOIN inventory_items ii ON b.component_id=ii.id WHERE b.finished_product_id=$1`, [inv.id])
                                                                                                .then(r => ({ sku: inv.sku, rows: r.rows }))
                                                                                            ));
                                    bomResults.forEach(({ sku, rows }) => { bomMap[sku] = rows; });
                      }

            const enriched = lineItems.map(item => {
                          const inv = invMap[item.sku] || null;
                          if (!inv) return { ...item, inventory_item: null, bom: [], on_order: 0, open_pos: [] };
                          const on_order = onOrderMap[inv.sku] || 0;
                          const total_demand = demandMap[inv.sku] || 0;
                          inv.available = inv.quantity - total_demand;
                          inv.on_order = on_order;
                          return {
                                          ...item,
                                          inventory_item: inv,
                                          bom: bomMap[inv.sku] || [],
                                          on_order,
                                          open_pos: openPOMap[inv.sku] || []
                          };
            });

            res.json({ ...o, line_items_enriched: enriched });
          } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/status', async (req, res) => {
          try {
                      const { status_id } = req.body;
                      const current = await pool.query(`SELECT so.shopify_order_id, os.name as status_name FROM shopify_orders so LEFT JOIN order_statuses os ON so.custom_status_id=os.id WHERE so.id=$1`, [req.params.id]);
                      const oldStatusName = current.rows[0]?.status_name || 'None';
                      const orderShopifyId = current.rows[0]?.shopify_order_id || req.params.id;
                      const [newStatusRow, userRow] = await Promise.all([
                                    pool.query('SELECT name FROM order_statuses WHERE id=$1', [status_id]),
                                    pool.query('SELECT name FROM users WHERE id=$1', [req.user.id])
                                  ]);
                      const newStatusName = newStatusRow.rows[0]?.name || status_id;
                      const userName = userRow.rows[0]?.name || 'Unknown user';
                      await pool.query('UPDATE shopify_orders SET custom_status_id=$1, updated_at=NOW() WHERE id=$2', [status_id, req.params.id]);
                      await Promise.all([
                                    pool.query('INSERT INTO order_notes (shopify_order_id, note, note_type, created_by) VALUES ($1,$2,$3,$4)', [orderShopifyId, `Status changed from "${oldStatusName}" to "${newStatusName}" by ${userName}`, 'status_change', req.user.id]),
                                    pool.query('INSERT INTO order_status_log (shopify_order_id, old_status, new_status, changed_by) VALUES ($1,$2,$3,$4)', [orderShopifyId, oldStatusName, newStatusName, req.user.id])
                                  ]);
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

module.exports = router;

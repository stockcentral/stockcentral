const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

const genPONumber = () => `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

// List all POs
router.get('/', async (req, res) => {
    try {
          const result = await pool.query(`
                SELECT po.*, v.name as vendor_name,
                        (SELECT COALESCE(SUM(pi.received_quantity),0) FROM po_items pi WHERE pi.po_id=po.id) as total_received,
                                (SELECT COALESCE(SUM(pi.quantity),0) FROM po_items pi WHERE pi.po_id=po.id) as total_ordered
                                      FROM purchase_orders po
                                            LEFT JOIN vendors v ON po.vendor_id = v.id
                                                  ORDER BY po.created_at DESC`);
          res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Get single PO with items + notes
router.get('/:id', async (req, res) => {
    try {
          const po = await pool.query(`
                SELECT po.*, v.name as vendor_name, v.email as vendor_email,
                             v.sales_rep_name, v.sales_rep_email, v.company_name
                                   FROM purchase_orders po
                                         LEFT JOIN vendors v ON po.vendor_id = v.id
                                               WHERE po.id=$1`, [req.params.id]);
          if (!po.rows.length) return res.status(404).json({ error: 'Not found' });
          const items = await pool.query(`
                SELECT pi.*, ii.name as item_name, ii.sku, ii.quantity as current_stock
                      FROM po_items pi
                            LEFT JOIN inventory_items ii ON pi.inventory_item_id = ii.id
                                  WHERE pi.po_id=$1 ORDER BY pi.created_at ASC`, [req.params.id]);
          const notes = await pool.query(`
                SELECT pn.*, u.name as author_name
                      FROM po_notes pn LEFT JOIN users u ON pn.user_id=u.id
                            WHERE pn.po_id=$1 ORDER BY pn.created_at DESC`, [req.params.id]);
          res.json({ ...po.rows[0], items: items.rows, notes: notes.rows });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Create PO directly (skip quote)
router.post('/', async (req, res) => {
    try {
          const { vendor_id, items, notes, expected_date, status } = req.body;
          if (!vendor_id) return res.status(400).json({ error: 'Vendor required' });
          const total = (items||[]).reduce((s,i) => s + ((parseFloat(i.unit_cost)||0) * (parseInt(i.quantity)||0)), 0);
          const po = await pool.query(
                  `INSERT INTO purchase_orders (po_number, vendor_id, notes, expected_date, total_amount, status, order_date)
                         VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
                  [genPONumber(), vendor_id, notes||null, expected_date||null, total, status||'sent']
                );
          for (const item of (items||[])) {
                  if (!item.inventory_item_id) continue;
                  await pool.query(
                            `INSERT INTO po_items (po_id, inventory_item_id, quantity, unit_cost, received_quantity, rejected_quantity)
                                     VALUES ($1,$2,$3,$4,0,0)`,
                            [po.rows[0].id, item.inventory_item_id, parseInt(item.quantity)||1, parseFloat(item.unit_cost)||0]
                          );
          }
          res.json(po.rows[0]);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Update PO status/fields
router.put('/:id', async (req, res) => {
    try {
          const { status, notes, expected_date } = req.body;
          const result = await pool.query(
                  `UPDATE purchase_orders SET status=$1, notes=$2, expected_date=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
                  [status, notes, expected_date||null, req.params.id]
                );
          res.json(result.rows[0]);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Receive item — scan SKU or manual qty entry
router.put('/:id/receive-item', async (req, res) => {
    try {
          const { po_item_id, qty_received, sku } = req.body;
          let itemId = po_item_id;

      // If SKU provided instead of item ID, look it up
      if (!itemId && sku) {
              const found = await pool.query(`
                      SELECT pi.id FROM po_items pi
                              JOIN inventory_items ii ON pi.inventory_item_id = ii.id
                                      WHERE pi.po_id=$1 AND ii.sku=$2 LIMIT 1`, [req.params.id, sku]);
              if (!found.rows.length) return res.status(404).json({ error: `SKU ${sku} not found on this PO` });
              itemId = found.rows[0].id;
      }

      const qty = parseInt(qty_received) || 1;
          const item = await pool.query(
                  `UPDATE po_items SET received_quantity = received_quantity + $1 WHERE id=$2 RETURNING *`,
                  [qty, itemId]
                );
          if (!item.rows.length) return res.status(404).json({ error: 'Item not found' });

      // Update inventory stock
      await pool.query(
              `UPDATE inventory_items SET quantity = quantity + $1, updated_at=NOW() WHERE id=$2`,
              [qty, item.rows[0].inventory_item_id]
            );

      // Check if all items fully received — auto-update status
      const po = await pool.query('SELECT * FROM purchase_orders WHERE id=$1', [req.params.id]);
          const allItems = await pool.query('SELECT * FROM po_items WHERE po_id=$1', [req.params.id]);
          const allReceived = allItems.rows.every(i => i.received_quantity >= i.quantity);
          if (allReceived && po.rows[0].status !== 'received') {
                  await pool.query(`UPDATE purchase_orders SET status='received', updated_at=NOW() WHERE id=$1`, [req.params.id]);
          } else if (item.rows[0].received_quantity > 0 && po.rows[0].status === 'sent') {
                  await pool.query(`UPDATE purchase_orders SET status='partial', updated_at=NOW() WHERE id=$1`, [req.params.id]);
          }

      res.json({ success: true, item: item.rows[0] });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Reject item with note
router.post('/:id/reject-item', async (req, res) => {
    try {
          const { po_item_id, qty_rejected, note } = req.body;
          await pool.query(
                  `UPDATE po_items SET rejected_quantity = rejected_quantity + $1 WHERE id=$2`,
                  [parseInt(qty_rejected)||1, po_item_id]
                );
          // Add timestamped note
      if (note) {
              await pool.query(
                        `INSERT INTO po_notes (po_id, user_id, note, note_type) VALUES ($1,$2,$3,'rejection')`,
                        [req.params.id, req.user.id, note]
                      );
      }
          res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Add note to PO
router.post('/:id/notes', async (req, res) => {
    try {
          const { note, note_type } = req.body;
          const result = await pool.query(
                  `INSERT INTO po_notes (po_id, user_id, note, note_type) VALUES ($1,$2,$3,$4) RETURNING *`,
                  [req.params.id, req.user.id, note, note_type||'general']
                );
          res.json(result.rows[0]);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Delete PO
router.delete('/:id', async (req, res) => {
    try {
          await pool.query('DELETE FROM purchase_orders WHERE id=$1', [req.params.id]);
          res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

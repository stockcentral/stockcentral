const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');

const isValidUUID = (v) => v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const toUUID = (v) => isValidUUID(v) ? v : null;

const rmaRouter = express.Router();
rmaRouter.use(auth);

rmaRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query(`SELECT r.*, ii.name as item_name, ii.sku as item_sku, v.name as vendor_name FROM rmas r LEFT JOIN inventory_items ii ON r.inventory_item_id = ii.id LEFT JOIN purchase_orders po ON r.po_id = po.id LEFT JOIN vendors v ON po.vendor_id = v.id ORDER BY r.created_at DESC`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.get('/drafts', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM rmas WHERE status='draft' ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.delete('/drafts/cleanup', async (req, res) => {
    try {
        const result = await pool.query("DELETE FROM rmas WHERE status='draft' AND created_at < NOW() - INTERVAL '14 days' RETURNING id");
        res.json({ deleted: result.rowCount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/', async (req, res) => {
    try {
        const { po_id, inventory_item_id, shopify_order_id, shopify_order_number, customer_name, customer_email, quantity, reason, resolution, replacement_type, notes, status, is_draft, rma_type } = req.body;
        const rmaNumber = 'RMA-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        const finalStatus = is_draft ? 'draft' : (status || 'pending');
        const result = await pool.query(
            'INSERT INTO rmas (rma_number, po_id, inventory_item_id, shopify_order_id, shopify_order_number, customer_name, customer_email, quantity, reason, resolution, replacement_type, notes, status, rma_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
            [rmaNumber, toUUID(po_id), toUUID(inventory_item_id), shopify_order_id||null, shopify_order_number||null, customer_name||null, customer_email||null, parseInt(quantity)||1, reason||null, resolution||null, replacement_type||null, notes||null, finalStatus, rma_type||'client']
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.put('/:id', async (req, res) => {
    try {
        const { status, resolution, replacement_type, notes, customer_name, customer_email } = req.body;
        const result = await pool.query('UPDATE rmas SET status=$1, resolution=$2, replacement_type=$3, notes=$4, customer_name=$5, customer_email=$6, updated_at=NOW() WHERE id=$7 RETURNING *', [status, resolution, replacement_type, notes, customer_name, customer_email, req.params.id]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.get('/:id/notes', async (req, res) => {
    try {
        const result = await pool.query('SELECT n.*, u.name as author_name FROM rma_notes n JOIN users u ON n.user_id = u.id WHERE n.rma_id=$1 ORDER BY n.created_at ASC', [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/:id/notes', async (req, res) => {
    try {
        const result = await pool.query('INSERT INTO rma_notes (rma_id, user_id, note) VALUES ($1,$2,$3) RETURNING *', [req.params.id, req.user.id, req.body.note]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.put('/:rmaId/notes/:noteId', async (req, res) => {
    try {
        const result = await pool.query('UPDATE rma_notes SET note=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *', [req.body.note, req.params.noteId, req.user.id]);
        if (!result.rows.length) return res.status(403).json({ error: 'Not authorized' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.delete('/:rmaId/notes/:noteId', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM rma_notes WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.noteId, req.user.id]);
        if (!result.rows.length) return res.status(403).json({ error: 'Not authorized' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.get('/:id/troubleshooting', async (req, res) => {
    try {
        const result = await pool.query('SELECT t.*, u.name as author_name FROM rma_troubleshooting t JOIN users u ON t.user_id = u.id WHERE t.rma_id=$1 ORDER BY t.step_number ASC', [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/:id/troubleshooting', async (req, res) => {
    try {
        const { step_number, description, outcome } = req.body;
        const result = await pool.query('INSERT INTO rma_troubleshooting (rma_id, user_id, step_number, description, outcome) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.params.id, req.user.id, step_number, description, outcome||null]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.get('/:id/tracking', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM rma_tracking WHERE rma_id=$1 ORDER BY created_at ASC', [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/:id/tracking', async (req, res) => {
    try {
        const { carrier, tracking_number, direction, notes } = req.body;
        const result = await pool.query('INSERT INTO rma_tracking (rma_id, carrier, tracking_number, direction, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.params.id, carrier, tracking_number, direction||'inbound_from_client', notes||null]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// BOM Router
const bomRouter = express.Router();
bomRouter.use(auth);

// Get templates for a product
bomRouter.get('/templates/:productId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bom_templates WHERE finished_product_id=$1 ORDER BY is_default DESC, created_at ASC',
      [req.params.productId]
    );
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Create template
bomRouter.post('/templates', async (req, res) => {
  try {
    const { finished_product_id, name } = req.body;
    const result = await pool.query(
      'INSERT INTO bom_templates (finished_product_id, name) VALUES ($1,$2) RETURNING *',
      [toUUID(finished_product_id), name||'New BOM']
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Update template
bomRouter.put('/templates/:id', async (req, res) => {
  try {
    const { name, is_default } = req.body;
    if (is_default) {
      const tmpl = await pool.query('SELECT finished_product_id FROM bom_templates WHERE id=$1', [req.params.id]);
      await pool.query('UPDATE bom_templates SET is_default=false WHERE finished_product_id=$1', [tmpl.rows[0]?.finished_product_id]);
    }
    const result = await pool.query(
      'UPDATE bom_templates SET name=COALESCE($1,name), is_default=COALESCE($2,is_default), updated_at=NOW() WHERE id=$3 RETURNING *',
      [name||null, is_default||null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Delete template and its items
bomRouter.delete('/templates/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bom WHERE bom_template_id=$1', [req.params.id]);
    await pool.query('DELETE FROM bom_templates WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Get BOM items (optionally filtered by template)
bomRouter.get('/:productId', async (req, res) => {
  try {
    const { template_id } = req.query;
    let query = `SELECT b.*, ii.sku as component_sku, ii.name as component_name,
      ii.cost as component_cost, ii.price as component_price, ii.quantity as component_stock
      FROM bom b JOIN inventory_items ii ON b.component_id = ii.id
      WHERE b.finished_product_id=$1`;
    const params = [req.params.productId];
    if (template_id) { params.push(template_id); query += ` AND b.bom_template_id=$${params.length}`; }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Add component to BOM
bomRouter.post('/', async (req, res) => {
  try {
    const { finished_product_id, component_id, quantity, notes, bom_template_id } = req.body;
    const result = await pool.query(
      'INSERT INTO bom (finished_product_id, component_id, quantity, notes, bom_template_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [toUUID(finished_product_id), toUUID(component_id), quantity||1, notes||null, toUUID(bom_template_id)]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Update BOM item quantity/notes
bomRouter.put('/:id', async (req, res) => {
  try {
    const { quantity, notes } = req.body;
    const result = await pool.query(
      'UPDATE bom SET quantity=$1, notes=$2 WHERE id=$3 RETURNING *',
      [parseFloat(quantity)||1, notes||null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Delete BOM item
bomRouter.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bom WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

const mfgRouter = express.Router();
mfgRouter.use(auth);

mfgRouter.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT mo.*, ii.name as product_name, ii.sku as product_sku FROM manufacturing_orders mo LEFT JOIN inventory_items ii ON mo.finished_product_id = ii.id ORDER BY mo.created_at DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

mfgRouter.post('/', async (req, res) => {
    try {
        const { finished_product_id, quantity, start_date, completion_date, notes } = req.body;
        const moNumber = 'MO-' + Date.now() + '-' + Math.floor(Math.random()*1000);
        const result = await pool.query('INSERT INTO manufacturing_orders (mo_number, finished_product_id, quantity, start_date, completion_date, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [moNumber, toUUID(finished_product_id), parseInt(quantity)||1, start_date||null, completion_date||null, notes||null]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

mfgRouter.put('/:id/complete', async (req, res) => {
    try {
        const mo = await pool.query('SELECT * FROM manufacturing_orders WHERE id=$1', [req.params.id]);
        const m = mo.rows[0];
        const bom = await pool.query('SELECT * FROM bom WHERE finished_product_id=$1', [m.finished_product_id]);
        for (const c of bom.rows) {
            await pool.query('UPDATE inventory_items SET quantity=quantity-$1, updated_at=NOW() WHERE id=$2', [c.quantity * m.quantity, c.component_id]);
        }
        await pool.query('UPDATE inventory_items SET quantity=quantity+$1, updated_at=NOW() WHERE id=$2', [m.quantity, m.finished_product_id]);
        await pool.query("UPDATE manufacturing_orders SET status='completed', completion_date=NOW(), updated_at=NOW() WHERE id=$1", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const invoiceRouter = express.Router();
invoiceRouter.use(auth);

invoiceRouter.get('/po/:poId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM invoices WHERE po_id=$1 ORDER BY created_at DESC', [req.params.poId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

invoiceRouter.post('/', async (req, res) => {
    try {
        const { po_id, invoice_number, amount, due_date, notes } = req.body;
        const result = await pool.query('INSERT INTO invoices (po_id, invoice_number, amount, due_date, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *', [toUUID(po_id), invoice_number, parseFloat(amount)||0, due_date||null, notes||null]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

invoiceRouter.put('/:id', async (req, res) => {
    try {
        const { status, notes } = req.body;
        const result = await pool.query('UPDATE invoices SET status=$1, notes=$2, updated_at=NOW() WHERE id=$3 RETURNING *', [status, notes, req.params.id]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const paymentRouter = express.Router();
paymentRouter.use(auth);

paymentRouter.post('/', async (req, res) => {
    try {
        const { po_id, invoice_id, amount, payment_method, reference_number, payment_date, notes } = req.body;
        const result = await pool.query('INSERT INTO payments (po_id, invoice_id, amount, payment_method, reference_number, payment_date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [toUUID(po_id), toUUID(invoice_id), parseFloat(amount)||0, payment_method||null, reference_number||null, payment_date||new Date(), notes||null]);
        if (invoice_id && isValidUUID(invoice_id)) {
            const inv = await pool.query('SELECT amount FROM invoices WHERE id=$1', [invoice_id]);
            const paid = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE invoice_id=$1', [invoice_id]);
            if (parseFloat(paid.rows[0].total) >= parseFloat(inv.rows[0].amount)) {
                await pool.query("UPDATE invoices SET status='paid' WHERE id=$1", [invoice_id]);
            }
        }
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { rmaRouter, bomRouter, mfgRouter, invoiceRouter, paymentRouter };

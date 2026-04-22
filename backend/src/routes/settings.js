const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// Generic settings get/set
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings');
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { key, value } = req.body;
    const result = await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2 RETURNING *`,
      [key, JSON.stringify(value)]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Shopify settings
router.get('/shopify', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'shopify'");
    res.json(result.rows[0]?.value || {});
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Warranty settings
router.get('/warranty', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'warranty'");
    res.json(result.rows[0] || { value: { period_days: 365, period_label: '1 Year' } });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// General settings
router.get('/general', async (req, res) => {
  try {
    const keys = ['cost_update_mode','cost_calculation_method','cost_avg_days','cost_avg_type','archive_sync','shopify_push_mode','ticket_email','rma_status_colors'];
    const result = await pool.query(`SELECT key, value FROM settings WHERE key = ANY($1)`, [keys]);
    const map = {};
    result.rows.forEach(r => { map[r.key] = r.value; });
    res.json({
      cost_update_mode: map.cost_update_mode||'auto',
      cost_calculation_method: map.cost_calculation_method||'1',
      cost_avg_days: map.cost_avg_days||'30',
      cost_avg_type: map.cost_avg_type||'cost',
      archive_sync: map.archive_sync||'both',
      shopify_push_mode: map.shopify_push_mode||'manual',
      ticket_email: map.ticket_email||'',
      rma_status_colors: map.rma_status_colors||'{}'
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/general', async (req, res) => {
  try {
    const { cost_update_mode, cost_calculation_method, cost_avg_days, cost_avg_type, archive_sync, shopify_push_mode, ticket_email, rma_status_colors, bom_qty_mode } = req.body;
const updates = { cost_update_mode, cost_calculation_method, cost_avg_days, cost_avg_type, archive_sync, shopify_push_mode, ticket_email, rma_status_colors, bom_qty_mode };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, value]
      );
    }
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Email template
router.get('/email-template', async (req, res) => {
  try {
    const r = await pool.query("SELECT value FROM settings WHERE key='email_template'");
    res.json(r.rows[0] || { value: {} });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Order statuses
router.get('/order-statuses/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM order_statuses ORDER BY sort_order ASC, name ASC');
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/order-statuses', async (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const result = await pool.query(
      'INSERT INTO order_statuses (name, color, sort_order) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), color||'#10b981', sort_order||99]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.put('/order-statuses/:id', async (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    const result = await pool.query(
      'UPDATE order_statuses SET name=$1, color=$2, sort_order=$3 WHERE id=$4 RETURNING *',
      [name, color, sort_order||99, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/order-statuses/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM order_statuses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Status log
router.get('/status-log/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM order_status_log ORDER BY created_at DESC LIMIT 500');
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// Ticket types
router.get('/ticket-types/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ticket_types ORDER BY sort_order ASC, name ASC');
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/ticket-types', async (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const result = await pool.query(
      'INSERT INTO ticket_types (name, color, sort_order) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), color||'#6366f1', sort_order||99]
    );
    res.json(result.rows[0]);
  } catch(err) {
    if (err.code==='23505') return res.status(400).json({ error: 'Ticket type already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/ticket-types/:id', async (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    const result = await pool.query(
      'UPDATE ticket_types SET name=$1, color=$2, sort_order=$3 WHERE id=$4 RETURNING *',
      [name, color, sort_order||99, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/ticket-types/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM ticket_types WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// RMA Statuses
router.get('/rma-statuses/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rma_statuses ORDER BY sort_order ASC, name ASC');
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.post('/rma-statuses', async (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const result = await pool.query(
      'INSERT INTO rma_statuses (name, color, sort_order) VALUES ($1,$2,$3) RETURNING *',
      [name.trim(), color||'#6b7280', sort_order||99]
    );
    res.json(result.rows[0]);
  } catch(err) {
    if (err.code==='23505') return res.status(400).json({ error: 'Status name already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/rma-statuses/:id', async (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    const result = await pool.query(
      'UPDATE rma_statuses SET name=$1, color=$2, sort_order=$3 WHERE id=$4 RETURNING *',
      [name, color, sort_order||99, req.params.id]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

router.delete('/rma-statuses/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM rma_statuses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

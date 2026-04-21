const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');
const router = express.Router();
router.use(auth);

// Generate ticket number
async function generateTicketNumber() {
  const result = await pool.query("SELECT nextval('ticket_number_seq') as val");
  return `TKT-${result.rows[0].val}`;
}

// GET all tickets
router.get('/', async (req, res) => {
  try {
    const { status, priority, assigned_to, search, type } = req.query;
    let query = `
      SELECT t.*, 
        u.name as assigned_to_name,
        cb.name as created_by_name,
        (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id AND tm.is_internal = false) as message_count,
        (SELECT MAX(tm.created_at) FROM ticket_messages tm WHERE tm.ticket_id = t.id) as last_message_at,
        (SELECT tm.sender_type FROM ticket_messages tm WHERE tm.ticket_id = t.id ORDER BY tm.created_at DESC LIMIT 1) as last_sender_type
      FROM tickets t
      LEFT JOIN users u ON t.assigned_to_user_id = u.id
      LEFT JOIN users cb ON t.created_by_user_id = cb.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { params.push(status); query += ` AND t.status = $${params.length}`; }
    if (priority) { params.push(priority); query += ` AND t.priority = $${params.length}`; }
    if (assigned_to === 'unassigned') { query += ` AND t.assigned_to_user_id IS NULL`; }
    else if (assigned_to) { params.push(assigned_to); query += ` AND t.assigned_to_user_id = $${params.length}`; }
    if (type) { params.push(type); query += ` AND t.type = $${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (t.subject ILIKE $${params.length} OR t.customer_name ILIKE $${params.length} OR t.customer_email ILIKE $${params.length} OR t.ticket_number ILIKE $${params.length})`; }
    query += ' ORDER BY t.updated_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET single ticket
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, 
        u.name as assigned_to_name, u.email as assigned_to_email,
        cb.name as created_by_name
      FROM tickets t
      LEFT JOIN users u ON t.assigned_to_user_id = u.id
      LEFT JOIN users cb ON t.created_by_user_id = cb.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket not found' });
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST create ticket
router.post('/', async (req, res) => {
  try {
    const { subject, type, priority, customer_name, customer_email, shopify_order_id, shopify_order_number, body, tags } = req.body;
    if (!subject) return res.status(400).json({ error: 'Subject is required' });
    const ticket_number = await generateTicketNumber();
    const result = await pool.query(
      `INSERT INTO tickets (ticket_number, subject, type, priority, customer_name, customer_email, shopify_order_id, shopify_order_number, created_by_user_id, tags, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open') RETURNING *`,
      [ticket_number, subject, type||'general', priority||'normal', customer_name||null, customer_email||null, shopify_order_id||null, shopify_order_number||null, req.user.id, tags||null]
    );
    const ticket = result.rows[0];
    // Add initial message if provided
    if (body) {
      await pool.query(
        `INSERT INTO ticket_messages (ticket_id, body, sender_type, sender_name, sender_email, is_internal)
         VALUES ($1,$2,'staff',$3,$4,false)`,
        [ticket.id, body, req.user.name, req.user.email]
      );
    }
    res.json(ticket);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// PUT update ticket
router.put('/:id', async (req, res) => {
  try {
    const { status, priority, type, assigned_to_user_id, subject, tags, internal_note, rma_id } = req.body;
    const fields = []; const params = [];
    if (status !== undefined) { fields.push(`status=$${params.length+1}`); params.push(status); if (status === 'closed') { fields.push(`closed_at=NOW()`); } }
    if (priority !== undefined) { fields.push(`priority=$${params.length+1}`); params.push(priority); }
    if (type !== undefined) { fields.push(`type=$${params.length+1}`); params.push(type); }
    if (assigned_to_user_id !== undefined) { fields.push(`assigned_to_user_id=$${params.length+1}`); params.push(assigned_to_user_id||null); }
    if (subject !== undefined) { fields.push(`subject=$${params.length+1}`); params.push(subject); }
    if (tags !== undefined) { fields.push(`tags=$${params.length+1}`); params.push(tags); }
    if (internal_note !== undefined) { fields.push(`internal_note=$${params.length+1}`); params.push(internal_note); }
    if (rma_id !== undefined) { fields.push(`rma_id=$${params.length+1}`); params.push(rma_id||null); }
    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
    fields.push(`updated_at=NOW()`);
    params.push(req.params.id);
    const result = await pool.query(`UPDATE tickets SET ${fields.join(',')} WHERE id=$${params.length} RETURNING *`, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket not found' });
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET messages for ticket
router.get('/:id/messages', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ticket_messages WHERE ticket_id=$1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST add message to ticket
router.post('/:id/messages', async (req, res) => {
  try {
    const { body, is_internal, sender_type } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Message body is required' });
    const result = await pool.query(
      `INSERT INTO ticket_messages (ticket_id, body, sender_type, sender_name, sender_email, is_internal)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, body, sender_type||'staff', req.user.name, req.user.email, is_internal||false]
    );
    // Update ticket updated_at and status if replying to customer
    await pool.query(
      `UPDATE tickets SET updated_at=NOW(), status=CASE WHEN status='pending_customer' THEN 'open' ELSE status END WHERE id=$1`,
      [req.params.id]
    );
    // Send email to customer if not internal
    if (!is_internal) {
      try {
        const ticket = await pool.query('SELECT * FROM tickets WHERE id=$1', [req.params.id]);
        const t = ticket.rows[0];
        if (t?.customer_email) {
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(process.env.SENDGRID_API_KEY);
          await sgMail.send({
            to: t.customer_email,
            from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@stockcentralerp.com', name: 'StockCentral Support' },
            subject: `Re: [${t.ticket_number}] ${t.subject}`,
            html: `<p>${body.replace(/\n/g,'<br/>')}</p><hr/><p style="color:#888;font-size:12px;">Ticket: ${t.ticket_number} | Reply to this email to respond</p>`,
          });
        }
      } catch(emailErr) { console.error('Email send error:', emailErr.message); }
    }
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET quick replies
router.get('/quick-replies/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ticket_quick_replies ORDER BY title ASC');
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST create quick reply
router.post('/quick-replies', async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Title and body required' });
    const result = await pool.query(
      'INSERT INTO ticket_quick_replies (title, body, created_by_user_id) VALUES ($1,$2,$3) RETURNING *',
      [title, body, req.user.id]
    );
    res.json(result.rows[0]);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// DELETE quick reply
router.delete('/quick-replies/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM ticket_quick_replies WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET staff users for assignment
router.get('/meta/staff', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email FROM users ORDER BY name ASC');
    res.json(result.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// POST inbound from Shopify contact form (no auth)
router.post('/inbound/shopify', async (req, res) => {
  try {
    const { subject, body, customer_name, customer_email, order_id, order_number } = req.body;
    if (!subject && !body) return res.status(400).json({ error: 'Missing required fields' });
    const ticket_number = await generateTicketNumber();
    const result = await pool.query(
      `INSERT INTO tickets (ticket_number, subject, type, priority, customer_name, customer_email, shopify_order_id, shopify_order_number, status)
       VALUES ($1,$2,'general','normal',$3,$4,$5,$6,'open') RETURNING *`,
      [ticket_number, subject || `Support request from ${customer_name}`, customer_name||null, customer_email||null, order_id||null, order_number||null]
    );
    const ticket = result.rows[0];
    if (body) {
      await pool.query(
        `INSERT INTO ticket_messages (ticket_id, body, sender_type, sender_name, sender_email, is_internal)
         VALUES ($1,$2,'customer',$3,$4,false)`,
        [ticket.id, body, customer_name||'Customer', customer_email||'']
      );
    }
    res.json({ success: true, ticket_number });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

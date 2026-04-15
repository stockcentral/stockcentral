const express = require('express');
const router = express.Router();
const { pool } = require('../models/database');
const auth = require('../middleware/auth');

// Helper functions
function cleanReplyBody(text) {
  return text
    .split('\n')
    .filter(line => !line.trim().startsWith('>'))
    .join('\n')
    .replace(/On .* wrote:/gs, '')
    .trim()
    .substring(0, 5000);
}

function extractEmail(from) {
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from.trim();
}

function extractName(from) {
  const match = from.match(/^(.+?)\s*</);
  return match ? match[1].replace(/"/g, '').trim() : '';
}

function parseReplyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    return { tenantId: parts[0], recordType: parts[1], recordId: parts[2] };
  } catch {
    return null;
  }
}

// SendGrid Inbound Parse webhook — no auth (called by SendGrid)
router.post('/inbound', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { from, subject, text, html } = req.body;
    const toField = req.body.to || '';
    const tokenMatch = toField.match(/reply\+([A-Za-z0-9_-]+)@mail\.stockcentralerp\.com/);

    if (!tokenMatch) return res.sendStatus(200);

    const token = tokenMatch[1];
    const parsed = parseReplyToken(token);
    if (!parsed) return res.sendStatus(200);

    const { tenantId, recordType, recordId } = parsed;
    const replyBody = cleanReplyBody(text || html || '');
    const senderEmail = extractEmail(from);
    const senderName = extractName(from);

    if (recordType === 'quote') {
      await pool.query(
        `INSERT INTO quote_replies (quote_id, from_email, from_name, subject, body, is_read, sent_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, NOW())`,
        [recordId, senderEmail, senderName, subject || '', replyBody, tenantId]
      );
      await pool.query(
        `UPDATE quote_requests SET has_unread_replies = true, updated_at = NOW() WHERE id = $1`,
        [recordId]
      );
    } else if (recordType === 'po') {
      await pool.query(
        `INSERT INTO po_replies (po_id, from_email, from_name, subject, body, is_read, sent_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, $5, false, $6, NOW())`,
        [recordId, senderEmail, senderName, subject || '', replyBody, tenantId]
      );
      await pool.query(
        `UPDATE purchase_orders SET has_unread_replies = true, updated_at = NOW() WHERE id = $1`,
        [recordId]
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Inbound email error:', err.message);
    res.sendStatus(200);
  }
});

// Mark reply as read
router.post('/replies/:replyId/read', auth, async (req, res) => {
  try {
    const { type } = req.body;
    const table = type === 'quote' ? 'quote_replies' : 'po_replies';
    const parentCol = type === 'quote' ? 'quote_id' : 'po_id';

    const result = await pool.query(
      `UPDATE ${table} SET is_read = true, read_at = NOW(), read_by_user_id = $1 WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.replyId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Reply not found' });

    const reply = result.rows[0];
    await pool.query(
      `INSERT INTO reply_read_log (reply_id, reply_type, record_id, read_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [reply.id, type, reply[parentCol], req.user.id]
    );

    const unreadCount = await pool.query(
      `SELECT COUNT(*) FROM ${table} WHERE ${parentCol} = $1 AND is_read = false`,
      [reply[parentCol]]
    );
    if (parseInt(unreadCount.rows[0].count) === 0) {
      const parentTable = type === 'quote' ? 'quote_requests' : 'purchase_orders';
      await pool.query(
        `UPDATE ${parentTable} SET has_unread_replies = false, updated_at = NOW() WHERE id = $1`,
        [reply[parentCol]]
      );
    }

    res.json({ success: true, reply: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get replies for a quote or PO
router.get('/replies', auth, async (req, res) => {
  try {
    const { type, id } = req.query;
    if (!type || !id) return res.status(400).json({ error: 'type and id required' });
    const table = type === 'quote' ? 'quote_replies' : 'po_replies';
    const parentCol = type === 'quote' ? 'quote_id' : 'po_id';

    const result = await pool.query(
      `SELECT r.*, u.name as read_by_name FROM ${table} r
       LEFT JOIN users u ON r.read_by_user_id = u.id
       WHERE r.${parentCol} = $1 ORDER BY r.created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get unread counts for sidebar badge
router.get('/unread-counts', auth, async (req, res) => {
  try {
    const poCount = await pool.query(`SELECT COUNT(*) FROM po_replies WHERE is_read = false`);
    const quoteCount = await pool.query(`SELECT COUNT(*) FROM quote_replies WHERE is_read = false`);
    res.json({
      po: parseInt(poCount.rows[0].count),
      quote: parseInt(quoteCount.rows[0].count),
      total: parseInt(poCount.rows[0].count) + parseInt(quoteCount.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get accountability read log (for Settings)
router.get('/read-log', auth, async (req, res) => {
  try {
    const { type, record_id } = req.query;
    let query = `SELECT l.*, u.name as user_name, u.email as user_email
                 FROM reply_read_log l LEFT JOIN users u ON l.read_by_user_id = u.id WHERE 1=1`;
    const params = [];
    if (type) { params.push(type); query += ` AND l.reply_type = $${params.length}`; }
    if (record_id) { params.push(record_id); query += ` AND l.record_id = $${params.length}`; }
    query += ' ORDER BY l.created_at DESC LIMIT 500';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send quote email
router.post('/send-quote', auth, async (req, res) => {
  try {
    const { quote_id, template_layout } = req.body;
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const quoteRes = await pool.query(
      `SELECT qr.*, v.name as vendor_name, v.email as vendor_email, v.sales_rep_name,
              v.sales_rep_email, v.company_name, v.contact_name
       FROM quote_requests qr LEFT JOIN vendors v ON qr.vendor_id = v.id WHERE qr.id = $1`, [quote_id]
    );
    if (!quoteRes.rows.length) return res.status(404).json({ error: 'Quote not found' });
    const quote = quoteRes.rows[0];

    const itemsRes = await pool.query(
      `SELECT qi.*, ii.name as item_name, ii.sku FROM quote_items qi
       LEFT JOIN inventory_items ii ON qi.inventory_item_id = ii.id WHERE qi.quote_id = $1`, [quote_id]
    );

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const senderUser = userRes.rows[0];
    const settingsRes = await pool.query('SELECT * FROM settings LIMIT 1');
    const companySettings = settingsRes.rows[0] || {};

    const crypto = require('crypto');
    const raw = `${req.user.id}:quote:${quote_id}:${crypto.randomBytes(8).toString('hex')}`;
    const token = Buffer.from(raw).toString('base64url');
    const replyTo = `reply+${token}@mail.stockcentralerp.com`;
    const company = companySettings.company_name || 'StockCentral';

    await sgMail.send({
      to: quote.sales_rep_email || quote.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@stockcentralerp.com', name: 'StockCentral' },
      replyTo,
      cc: senderUser.email,
      subject: `Quote Request ${quote.quote_number} from ${company}`,
      html: `<p>Hi ${quote.sales_rep_name || quote.contact_name || quote.vendor_name},</p>
             <p>Please find attached Quote Request <strong>${quote.quote_number}</strong> from ${company}.</p>
             <p>Reply to this email to respond — your reply will be tracked automatically.</p>
             <p>Sent by ${senderUser.name}</p>`,
    });

    await pool.query(
      `UPDATE quote_requests SET status = 'sent', reply_token = $1, sent_at = NOW(), sent_by_user_id = $2, updated_at = NOW() WHERE id = $3`,
      [token, req.user.id, quote_id]
    );

    res.json({ success: true, replyTo });
  } catch (err) {
    console.error('Send quote error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send PO email
router.post('/send-po', auth, async (req, res) => {
  try {
    const { po_id, template_layout } = req.body;
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const poRes = await pool.query(
      `SELECT po.*, v.name as vendor_name, v.email as vendor_email, v.sales_rep_name,
              v.sales_rep_email, v.company_name, v.contact_name
       FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = $1`, [po_id]
    );
    if (!poRes.rows.length) return res.status(404).json({ error: 'PO not found' });
    const po = poRes.rows[0];

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const senderUser = userRes.rows[0];
    const settingsRes = await pool.query('SELECT * FROM settings LIMIT 1');
    const companySettings = settingsRes.rows[0] || {};

    const crypto = require('crypto');
    const raw = `${req.user.id}:po:${po_id}:${crypto.randomBytes(8).toString('hex')}`;
    const token = Buffer.from(raw).toString('base64url');
    const replyTo = `reply+${token}@mail.stockcentralerp.com`;
    const company = companySettings.company_name || 'StockCentral';

    await sgMail.send({
      to: po.sales_rep_email || po.email,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@stockcentralerp.com', name: 'StockCentral' },
      replyTo,
      cc: senderUser.email,
      subject: `Purchase Order ${po.po_number} from ${company}`,
      html: `<p>Hi ${po.sales_rep_name || po.contact_name || po.vendor_name},</p>
             <p>Please find attached Purchase Order <strong>${po.po_number}</strong> from ${company}.</p>
             <p>Reply to this email to respond — your reply will be tracked automatically.</p>
             <p>Sent by ${senderUser.name}</p>`,
    });

    await pool.query(
      `UPDATE purchase_orders SET reply_token = $1, sent_at = NOW(), sent_by_user_id = $2, updated_at = NOW() WHERE id = $3`,
      [token, req.user.id, po_id]
    );
    await pool.query(
      `INSERT INTO po_notes (po_id, user_id, note, note_type) VALUES ($1, $2, $3, 'email_sent')`,
      [po_id, req.user.id, `PO email sent to ${po.sales_rep_email || po.email}`]
    );

    res.json({ success: true, replyTo });
  } catch (err) {
    console.error('Send PO error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get email templates
router.get('/templates', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_templates ORDER BY layout_code ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

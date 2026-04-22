const express = require('express');
const router = express.Router();
const { pool } = require('../models/database');
const auth = require('../middleware/auth');

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

// SendGrid Inbound Parse webhook
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
        `INSERT INTO email_log (quote_id, direction, subject, body, from_email, to_email) VALUES ($1,'inbound',$2,$3,$4,$5)`,
        [recordId, subject||'', replyBody, senderEmail, '']
      ).catch(()=>{});
    } else if (recordType === 'po') {
      await pool.query(
        `INSERT INTO email_log (po_id, direction, subject, body, from_email, to_email) VALUES ($1,'inbound',$2,$3,$4,$5)`,
        [recordId, subject||'', replyBody, senderEmail, '']
      ).catch(()=>{});
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Inbound email error:', err.message);
    res.sendStatus(200);
  }
});

// Get unread counts
router.get('/unread-counts', auth, async (req, res) => {
  try {
    const quoteCount = await pool.query(`SELECT COUNT(*) FROM email_log WHERE direction='inbound' AND quote_id IS NOT NULL`);
    const poCount = await pool.query(`SELECT COUNT(*) FROM email_log WHERE direction='inbound' AND po_id IS NOT NULL`);
    res.json({
      po: parseInt(poCount.rows[0].count),
      quote: parseInt(quoteCount.rows[0].count),
      total: parseInt(poCount.rows[0].count) + parseInt(quoteCount.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send quote to vendor
router.post('/send-quote', auth, async (req, res) => {
  try {
    const { quote_id } = req.body;
    const quoteRes = await pool.query(
      `SELECT q.*, v.name as vendor_name, v.email as vendor_email, v.sales_rep_email, v.contact_name
       FROM quotes q LEFT JOIN vendors v ON q.vendor_id = v.id WHERE q.id = $1`, [quote_id]
    );
    if (!quoteRes.rows.length) return res.status(404).json({ error: 'Quote not found' });
    const quote = quoteRes.rows[0];
    const itemsRes = await pool.query('SELECT * FROM quote_items WHERE quote_id = $1', [quote_id]);
    const items = itemsRes.rows;
    const tmplRes = await pool.query("SELECT value FROM settings WHERE key='email_template'");
    let tmpl = {};
    try { tmpl = tmplRes.rows[0] ? (typeof tmplRes.rows[0].value === 'string' ? JSON.parse(tmplRes.rows[0].value) : tmplRes.rows[0].value) : {}; } catch(e) { tmpl = {}; }
    const vendorEmail = quote.sales_rep_email || quote.vendor_email;
    if (!vendorEmail) return res.status(400).json({ error: 'Vendor has no email address' });
    const itemsTable = `<table style="width:100%;border-collapse:collapse;margin:16px 0"><thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">SKU</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Product</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Vendor SKU</th><th style="padding:8px;text-align:center;border:1px solid #e5e7eb">Qty</th><th style="padding:8px;text-align:right;border:1px solid #e5e7eb">Unit Cost</th></tr></thead><tbody>${items.map(i=>`<tr><td style="padding:8px;border:1px solid #e5e7eb">${i.sku||''}</td><td style="padding:8px;border:1px solid #e5e7eb">${i.name||''}</td><td style="padding:8px;border:1px solid #e5e7eb">${i.vendor_sku||''}</td><td style="padding:8px;text-align:center;border:1px solid #e5e7eb">${i.quantity}</td><td style="padding:8px;text-align:right;border:1px solid #e5e7eb">${i.unit_cost?'$'+parseFloat(i.unit_cost).toFixed(2):'TBD'}</td></tr>`).join('')}</tbody></table>`;
    const logoHtml = tmpl.logo_url ? `<img src="${tmpl.logo_url}" style="max-height:60px;margin-bottom:16px" alt="Logo"/>` : '';
    const companyHtml = `<div style="margin-bottom:16px;font-size:13px;color:#6b7280">${tmpl.company_name?`<strong>${tmpl.company_name}</strong><br/>`:''}${tmpl.company_email?`${tmpl.company_email}<br/>`:''}${tmpl.company_phone?`${tmpl.company_phone}<br/>`:''}${tmpl.company_address||''}</div>`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:24px">${logoHtml}${companyHtml}<h2 style="color:#1f2937">Quote Request: ${quote.quote_number}</h2><p style="color:#6b7280">Date: ${new Date().toLocaleDateString()}</p>${tmpl.quote_intro?`<p>${tmpl.quote_intro}</p>`:''}${itemsTable}${tmpl.quote_footer?`<p>${tmpl.quote_footer}</p>`:''}<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/><p style="font-size:12px;color:#9ca3af">Reply to this email to respond. Reference: ${quote.quote_number}</p></div>`;
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({
      to: vendorEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL||'noreply@stockcentralerp.com', name: tmpl.company_name||'StockCentral' },
      subject: `Quote Request ${quote.quote_number}`,
      html,
      replyTo: tmpl.company_email||process.env.SENDGRID_FROM_EMAIL
    });
    await pool.query(`INSERT INTO email_log (quote_id,direction,subject,body,from_email,to_email) VALUES ($1,'outbound',$2,$3,$4,$5)`,
      [quote_id, `Quote Request ${quote.quote_number}`, tmpl.quote_intro||'', tmpl.company_email||'', vendorEmail]).catch(()=>{});
    await pool.query(`UPDATE quotes SET status='sent', updated_at=NOW() WHERE id=$1`, [quote_id]);
    res.json({ success: true });
  } catch(err) {
    console.error('Send quote error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Reply to vendor on a quote
router.post('/send-quote-reply', auth, async (req, res) => {
  try {
    const { quote_id, body } = req.body;
    const quoteRes = await pool.query(
      `SELECT q.*, v.email as vendor_email, v.sales_rep_email FROM quotes q LEFT JOIN vendors v ON q.vendor_id = v.id WHERE q.id = $1`, [quote_id]
    );
    if (!quoteRes.rows.length) return res.status(404).json({ error: 'Quote not found' });
    const quote = quoteRes.rows[0];
    const vendorEmail = quote.sales_rep_email || quote.vendor_email;
    if (!vendorEmail) return res.status(400).json({ error: 'Vendor has no email' });
    const tmplRes = await pool.query("SELECT value FROM settings WHERE key='email_template'");
    let tmpl = {};
    try { tmpl = tmplRes.rows[0] ? (typeof tmplRes.rows[0].value === 'string' ? JSON.parse(tmplRes.rows[0].value) : tmplRes.rows[0].value) : {}; } catch(e) { tmpl = {}; }
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({
      to: vendorEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL||'noreply@stockcentralerp.com', name: tmpl.company_name||'StockCentral' },
      subject: `Re: Quote ${quote.quote_number}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:700px;padding:24px"><p>${body.replace(/\n/g,'<br/>')}</p><hr/><p style="font-size:12px;color:#9ca3af">Reference: ${quote.quote_number}</p></div>`
    });
    await pool.query(`INSERT INTO email_log (quote_id,direction,subject,body,from_email,to_email) VALUES ($1,'outbound',$2,$3,$4,$5)`,
      [quote_id, `Re: Quote ${quote.quote_number}`, body, tmpl.company_email||'', vendorEmail]).catch(()=>{});
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Send PO email
router.post('/send-po', auth, async (req, res) => {
  try {
    const { po_id } = req.body;
    const poRes = await pool.query(
      `SELECT po.*, v.name as vendor_name, v.email as vendor_email, v.sales_rep_email, v.contact_name
       FROM purchase_orders po LEFT JOIN vendors v ON po.vendor_id = v.id WHERE po.id = $1`, [po_id]
    );
    if (!poRes.rows.length) return res.status(404).json({ error: 'PO not found' });
    const po = poRes.rows[0];
    const vendorEmail = po.sales_rep_email || po.vendor_email;
    if (!vendorEmail) return res.status(400).json({ error: 'Vendor has no email address' });
    const tmplRes = await pool.query("SELECT value FROM settings WHERE key='email_template'");
    let tmpl = {};
    try { tmpl = tmplRes.rows[0] ? (typeof tmplRes.rows[0].value === 'string' ? JSON.parse(tmplRes.rows[0].value) : tmplRes.rows[0].value) : {}; } catch(e) { tmpl = {}; }
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({
      to: vendorEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL||'noreply@stockcentralerp.com', name: tmpl.company_name||'StockCentral' },
      subject: `Purchase Order ${po.po_number}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:700px;padding:24px"><h2>Purchase Order: ${po.po_number}</h2><p>${tmpl.po_intro||''}</p><p>${tmpl.po_footer||''}</p></div>`
    });
    await pool.query(`INSERT INTO email_log (po_id,direction,subject,body,from_email,to_email) VALUES ($1,'outbound',$2,$3,$4,$5)`,
      [po_id, `Purchase Order ${po.po_number}`, tmpl.po_intro||'', tmpl.company_email||'', vendorEmail]).catch(()=>{});
    res.json({ success: true });
  } catch(err) {
    console.error('Send PO error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get email log
router.get('/log', auth, async (req, res) => {
  try {
    const { quote_id, po_id } = req.query;
    let query = 'SELECT * FROM email_log WHERE 1=1';
    const params = [];
    if (quote_id) { params.push(quote_id); query += ` AND quote_id=$${params.length}`; }
    if (po_id) { params.push(po_id); query += ` AND po_id=$${params.length}`; }
    query += ' ORDER BY created_at ASC';
    const r = await pool.query(query, params);
    res.json(r.rows);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

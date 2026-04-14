const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@stockcentralerp.com';
const FROM_NAME = 'StockCentral';
const BASE_URL = process.env.BACKEND_URL || 'https://stockcentral-production.up.railway.app';

// Generate a secure reply token scoped to tenant + record
function generateReplyToken(tenantId, recordType, recordId) {
  const raw = `${tenantId}:${recordType}:${recordId}:${crypto.randomBytes(8).toString('hex')}`;
  return Buffer.from(raw).toString('base64url');
}

// Parse reply token back into parts
function parseReplyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [tenantId, recordType, recordId] = decoded.split(':');
    return { tenantId, recordType, recordId };
  } catch {
    return null;
  }
}

// Send quote request email to vendor
async function sendQuoteEmail({ quote, vendor, items, senderUser, templateLayout, companySettings }) {
  const token = generateReplyToken(senderUser.id, 'quote', quote.id);
  const replyTo = `reply+${token}@mail.stockcentralerp.com`;

  const pdfBuffer = await generatePDF({ type: 'quote', record: quote, items, vendor, senderUser, templateLayout, companySettings });

  const html = buildEmailHTML({
    type: 'Quote Request',
    number: quote.quote_number,
    vendor,
    senderUser,
    companySettings,
    message: quote.notes || '',
  });

  const msg = {
    to: vendor.sales_rep_email || vendor.email,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    replyTo: replyTo,
    cc: senderUser.email,
    subject: `Quote Request ${quote.quote_number} from ${companySettings.company_name || 'StockCentral'}`,
    html,
    attachments: [{
      content: pdfBuffer.toString('base64'),
      filename: `Quote-${quote.quote_number}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }],
  };

  await sgMail.send(msg);
  return { token, replyTo };
}

// Send purchase order email to vendor
async function sendPOEmail({ po, vendor, items, senderUser, templateLayout, companySettings }) {
  const token = generateReplyToken(senderUser.id, 'po', po.id);
  const replyTo = `reply+${token}@mail.stockcentralerp.com`;

  const pdfBuffer = await generatePDF({ type: 'po', record: po, items, vendor, senderUser, templateLayout, companySettings });

  const html = buildEmailHTML({
    type: 'Purchase Order',
    number: po.po_number,
    vendor,
    senderUser,
    companySettings,
    message: po.notes || '',
  });

  const msg = {
    to: vendor.sales_rep_email || vendor.email,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    replyTo: replyTo,
    cc: senderUser.email,
    subject: `Purchase Order ${po.po_number} from ${companySettings.company_name || 'StockCentral'}`,
    html,
    attachments: [{
      content: pdfBuffer.toString('base64'),
      filename: `PO-${po.po_number}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
    }],
  };

  await sgMail.send(msg);
  return { token, replyTo };
}

// Build clean HTML email body
function buildEmailHTML({ type, number, vendor, senderUser, companySettings, message }) {
  const contactName = vendor.sales_rep_name || vendor.contact_name || vendor.name;
  const company = companySettings.company_name || 'StockCentral';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { color: #6366f1; margin: 0; font-size: 22px; }
  .badge { display: inline-block; background: #6366f1; color: white; padding: 4px 12px; border-radius: 4px; font-size: 13px; margin-top: 6px; }
  .body { margin-bottom: 24px; }
  .footer { border-top: 1px solid #eee; padding-top: 16px; font-size: 12px; color: #888; }
  .reply-note { background: #f0f0ff; border-left: 3px solid #6366f1; padding: 12px 16px; border-radius: 4px; margin: 20px 0; font-size: 13px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>${company}</h1>
    <span class="badge">${type} · ${number}</span>
  </div>
  <div class="body">
    <p>Hi ${contactName},</p>
    <p>Please find the attached <strong>${type} ${number}</strong> from ${company}.</p>
    ${message ? `<p>${message}</p>` : ''}
    <p>Please review the attached PDF and reply to this email with your response. Your reply will be automatically tracked in our system.</p>
    <div class="reply-note">
      💬 <strong>To respond:</strong> Simply reply to this email. Your response will be logged directly to this ${type.toLowerCase()} in StockCentral and the sender will be notified.
    </div>
  </div>
  <div class="footer">
    <p>Sent by ${senderUser.name} via StockCentral ERP<br>
    ${company}</p>
  </div>
</div>
</body>
</html>`;
}

// Generate PDF using PDFKit
async function generatePDF({ type, record, items, vendor, senderUser, templateLayout, companySettings }) {
  const PDFDocument = require('pdfkit');
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const company = companySettings.company_name || 'StockCentral';
    const accentColor = '#6366f1';
    const recordNumber = type === 'quote' ? record.quote_number : record.po_number;
    const title = type === 'quote' ? 'QUOTE REQUEST' : 'PURCHASE ORDER';

    // ── Header ──
    doc.fontSize(22).fillColor(accentColor).text(company, 50, 50);
    doc.fontSize(11).fillColor('#555').text(companySettings.address || '', 50, 78);
    doc.fontSize(18).fillColor('#222').text(title, 400, 50, { align: 'right' });
    doc.fontSize(11).fillColor('#555').text(recordNumber, 400, 74, { align: 'right' });
    doc.moveTo(50, 105).lineTo(545, 105).strokeColor(accentColor).lineWidth(2).stroke();

    // ── Vendor + Sender block ──
    doc.fontSize(10).fillColor('#888').text('VENDOR', 50, 120);
    doc.fontSize(11).fillColor('#222')
      .text(vendor.company_name || vendor.name, 50, 134)
      .text(vendor.sales_rep_name || vendor.contact_name || '', 50, 148)
      .text(vendor.email || '', 50, 162);

    doc.fontSize(10).fillColor('#888').text('REQUESTED BY', 320, 120);
    doc.fontSize(11).fillColor('#222')
      .text(senderUser.name, 320, 134)
      .text(senderUser.email, 320, 148)
      .text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 320, 162);

    // ── Items table ──
    const tableTop = 210;
    const showVendorSku = templateLayout !== 'B'; // Layout B hides vendor SKUs
    const showLogo = templateLayout === 'C';

    // Table headers
    doc.rect(50, tableTop, 495, 22).fill('#6366f1');
    doc.fontSize(10).fillColor('white');
    doc.text('ITEM NAME', 58, tableTop + 6);
    doc.text('ITEM SKU', 220, tableTop + 6);
    if (showVendorSku) doc.text('VENDOR SKU', 310, tableTop + 6);
    doc.text('QTY', showVendorSku ? 410 : 370, tableTop + 6);
    doc.text('UNIT COST', showVendorSku ? 455 : 420, tableTop + 6);

    // Table rows
    let y = tableTop + 28;
    items.forEach((item, i) => {
      if (i % 2 === 0) doc.rect(50, y - 4, 495, 20).fill('#f8f8ff');
      doc.fontSize(10).fillColor('#222');
      doc.text(item.item_name || item.name || '', 58, y, { width: 155 });
      doc.text(item.sku || '', 220, y);
      if (showVendorSku) doc.text(item.vendor_sku || '—', 310, y);
      doc.text(String(item.quantity), showVendorSku ? 415 : 375, y);
      doc.text(item.unit_cost ? `$${parseFloat(item.unit_cost).toFixed(2)}` : 'TBD', showVendorSku ? 455 : 420, y);
      y += 22;
    });

    // ── Notes ──
    if (record.notes) {
      doc.moveTo(50, y + 10).lineTo(545, y + 10).strokeColor('#ddd').lineWidth(1).stroke();
      doc.fontSize(10).fillColor('#888').text('NOTES', 50, y + 20);
      doc.fontSize(10).fillColor('#444').text(record.notes, 50, y + 34, { width: 495 });
    }

    // ── Layout C: add delivery address + terms ──
    if (templateLayout === 'C' && companySettings.address) {
      const footerY = y + (record.notes ? 80 : 20);
      doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#ddd').lineWidth(1).stroke();
      doc.fontSize(10).fillColor('#888').text('DELIVERY ADDRESS', 50, footerY + 12);
      doc.fontSize(10).fillColor('#444').text(companySettings.address, 50, footerY + 26);
      if (companySettings.payment_terms) {
        doc.fontSize(10).fillColor('#888').text('PAYMENT TERMS', 320, footerY + 12);
        doc.fontSize(10).fillColor('#444').text(companySettings.payment_terms, 320, footerY + 26);
      }
    }

    // ── Footer ──
    doc.fontSize(9).fillColor('#aaa').text(
      `Generated by StockCentral ERP · ${new Date().toISOString()}`,
      50, 780, { align: 'center', width: 495 }
    );

    doc.end();
  });
}

module.exports = { sendQuoteEmail, sendPOEmail, parseReplyToken, generatePDF };

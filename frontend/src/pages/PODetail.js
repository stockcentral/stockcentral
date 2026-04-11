import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, CheckCircle, DollarSign, FileText, Printer } from 'lucide-react';

export default function PODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPO] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [newItem, setNewItem] = useState({ sku: '', name: '', vendor_sku: '', quantity_ordered: 1, unit_cost: 0, inventory_item_id: null });
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: '', amount: '', due_date: '', notes: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'ACH', reference_number: '', payment_date: new Date().toISOString().split('T')[0], notes: '', invoice_id: '' });

  const load = () => api.get(`/purchase-orders/${id}`).then(r => setPO(r.data));

  useEffect(() => { load(); api.get('/inventory').then(r => setInventory(r.data)); }, [id]);

  const markReceived = async () => {
    if (!window.confirm('Mark as received? This will update inventory.')) return;
    try { await api.put(`/purchase-orders/${id}`, { ...po, status: 'received' }); load(); toast.success('PO received — inventory updated!'); }
    catch { toast.error('Error'); }
  };

  const addInvoice = async (e) => {
    e.preventDefault();
    try { await api.post('/invoices', { po_id: id, ...invoiceForm }); toast.success('Invoice added'); setInvoiceModal(false); setInvoiceForm({ invoice_number: '', amount: '', due_date: '', notes: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const addPayment = async (e) => {
    e.preventDefault();
    try { await api.post('/payments', { po_id: id, ...paymentForm }); toast.success('Payment recorded'); setPaymentModal(false); setPaymentForm({ amount: '', payment_method: 'ACH', reference_number: '', payment_date: new Date().toISOString().split('T')[0], notes: '', invoice_id: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const printPO = () => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>PO ${po.po_number}</title>
    <style>body{font-family:sans-serif;padding:40px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.total{font-size:16px;font-weight:bold;text-align:right;margin-top:16px}.header{display:flex;justify-content:space-between}</style>
    </head><body>
    <div class="header"><h1>Purchase Order: ${po.po_number}</h1><div><strong>Date:</strong> ${new Date(po.created_at).toLocaleDateString()}<br/><strong>Status:</strong> ${po.status}</div></div>
    <p><strong>Vendor:</strong> ${po.vendor_name || '—'}<br/>${po.vendor_address ? po.vendor_address + '<br/>' : ''}${[po.vendor_city, po.vendor_state, po.vendor_zip].filter(Boolean).join(', ')}</p>
    ${po.expected_date ? `<p><strong>Expected:</strong> ${new Date(po.expected_date).toLocaleDateString()}</p>` : ''}
    <table><tr><th>SKU</th><th>Vendor SKU</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr>
    ${(po.items||[]).map(i => `<tr><td>${i.sku||''}</td><td>${i.vendor_sku||''}</td><td>${i.name}</td><td>${i.quantity_ordered}</td><td>$${parseFloat(i.unit_cost||0).toFixed(2)}</td><td>$${parseFloat(i.total_cost||0).toFixed(2)}</td></tr>`).join('')}
    </table>
    ${po.shipping_cost > 0 ? `<div style="text-align:right;margin-top:10px">Shipping: $${parseFloat(po.shipping_cost).toFixed(2)}</div>` : ''}
    ${po.vendor_credit > 0 ? `<div style="text-align:right">Vendor Credit: -$${parseFloat(po.vendor_credit).toFixed(2)}</div>` : ''}
    <div class="total">Total: $${parseFloat(po.total||0).toFixed(2)}</div>
    ${po.notes ? `<p><strong>Notes:</strong> ${po.notes}</p>` : ''}
    </body></html>`);
    w.document.close(); w.print();
  };

  if (!po) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Loading...</div>;

  const totalPaid = (po.payments||[]).reduce((sum, p) => sum + parseFloat(p.amount||0), 0);
  const balance = parseFloat(po.total||0) - totalPaid;
  const filteredInventory = inventory.filter(i => i.sku.toLowerCase().includes(itemSearch.toLowerCase()) || i.name.toLowerCase().includes(itemSearch.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => navigate('/purchase-orders')}><ArrowLeft size={14} /></button>
          <div>
            <h1 className="page-title">{po.po_number}</h1>
            <p className="page-subtitle">Vendor: {po.vendor_name || 'Not selected'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={printPO}><Printer size={13} />Print PO</button>
          {po.status !== 'received' && po.status !== 'cancelled' && (
            <button className="btn btn-success btn-sm" onClick={markReceived}><CheckCircle size={13} />Mark Received</button>
          )}
          <span className={`badge ${po.status === 'received' ? 'badge-success' : po.status === 'pending' ? 'badge-warning' : 'badge-neutral'}`}>{po.status}</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">PO Total</div><div className="stat-value" style={{ fontSize: 20 }}>${parseFloat(po.total||0).toFixed(2)}</div></div>
        <div className="stat-card"><div className="stat-label">Amount Paid</div><div className="stat-value" style={{ fontSize: 20, color: 'var(--success)' }}>${totalPaid.toFixed(2)}</div></div>
        <div className="stat-card"><div className="stat-label">Balance Due</div><div className="stat-value" style={{ fontSize: 20, color: balance > 0.01 ? 'var(--danger)' : 'var(--success)' }}>${balance.toFixed(2)}</div></div>
        <div className="stat-card"><div className="stat-label">Invoices</div><div className="stat-value" style={{ fontSize: 20 }}>{(po.invoices||[]).length}</div></div>
      </div>

      {/* Items */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">Line Items</span></div>
        <div className="table-container">
          <table>
            <thead><tr><th>SKU</th><th>Vendor SKU</th><th>Description</th><th>Qty Ordered</th><th>Qty Received</th><th>Unit Cost</th><th>Total</th></tr></thead>
            <tbody>
              {(po.items||[]).length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state" style={{ padding: 24 }}>No items</div></td></tr>
              ) : (po.items||[]).map(item => (
                <tr key={item.id}>
                  <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{item.sku||'—'}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>{item.vendor_sku||'—'}</td>
                  <td>{item.name}</td>
                  <td style={{ fontWeight: 600 }}>{item.quantity_ordered}</td>
                  <td style={{ color: item.quantity_received >= item.quantity_ordered ? 'var(--success)' : 'var(--text-secondary)' }}>{item.quantity_received}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(item.unit_cost||0).toFixed(2)}</td>
                  <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>${parseFloat(item.total_cost||0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <div style={{ width: 260 }}>
            {[['Subtotal', po.subtotal], ['Shipping', po.shipping_cost], po.vendor_credit > 0 ? ['Vendor Credit', `-${po.vendor_credit}`] : null].filter(Boolean).map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
                <span style={{ color: l === 'Vendor Credit' ? 'var(--success)' : 'var(--text-secondary)' }}>{l}</span>
                <span className="font-mono">${parseFloat(v||0).toFixed(2).replace('-', '')}{l === 'Vendor Credit' && ' (credit)'}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid var(--border-light)', fontWeight: 700, fontSize: 15 }}>
              <span>Total</span><span className="font-mono" style={{ color: 'var(--accent-light)' }}>${parseFloat(po.total||0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Invoices */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Invoices</span>
            <button className="btn btn-primary btn-sm" onClick={() => setInvoiceModal(true)}><Plus size={13} />Add Invoice</button>
          </div>
          {(po.invoices||[]).length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}><FileText size={24} /><p>No invoices attached</p></div>
          ) : (po.invoices||[]).map(inv => (
            <div key={inv.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.invoice_number}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.due_date ? `Due: ${new Date(inv.due_date).toLocaleDateString()}` : 'No due date'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="font-mono" style={{ fontWeight: 600 }}>${parseFloat(inv.amount||0).toFixed(2)}</div>
                <span className={`badge ${inv.status === 'paid' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 10 }}>{inv.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Payments */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Payments</span>
            <button className="btn btn-success btn-sm" onClick={() => setPaymentModal(true)}><DollarSign size={13} />Record Payment</button>
          </div>
          {(po.payments||[]).length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}><DollarSign size={24} /><p>No payments recorded</p></div>
          ) : (po.payments||[]).map(pay => (
            <div key={pay.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{pay.payment_method}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pay.reference_number && `Ref: ${pay.reference_number} · `}{new Date(pay.payment_date).toLocaleDateString()}</div>
              </div>
              <div className="font-mono" style={{ fontWeight: 700, color: 'var(--success)' }}>${parseFloat(pay.amount||0).toFixed(2)}</div>
            </div>
          ))}
          {(po.payments||[]).length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 700 }}>
              <span>Total Paid</span><span className="font-mono" style={{ color: 'var(--success)' }}>${totalPaid.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Modal */}
      {invoiceModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setInvoiceModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Add Invoice</h3><button className="btn btn-secondary btn-sm" onClick={() => setInvoiceModal(false)}>✕</button></div>
            <form onSubmit={addInvoice}>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Invoice Number *</label><input className="form-input" value={invoiceForm.invoice_number} onChange={e => setInvoiceForm({...invoiceForm, invoice_number: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Amount *</label><input className="form-input" type="number" step="0.01" value={invoiceForm.amount} onChange={e => setInvoiceForm({...invoiceForm, amount: e.target.value})} required /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Due Date</label><input className="form-input" type="date" value={invoiceForm.due_date} onChange={e => setInvoiceForm({...invoiceForm, due_date: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Notes</label><textarea className="form-textarea" value={invoiceForm.notes} onChange={e => setInvoiceForm({...invoiceForm, notes: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setInvoiceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPaymentModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">Record Payment</h3><button className="btn btn-secondary btn-sm" onClick={() => setPaymentModal(false)}>✕</button></div>
            <form onSubmit={addPayment}>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Amount *</label><input className="form-input" type="number" step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required /></div>
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select className="form-select" value={paymentForm.payment_method} onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})}>
                    {['ACH', 'Check', 'Credit Card', 'Wire Transfer', 'PayPal', 'Other'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Reference #</label><input className="form-input" value={paymentForm.reference_number} onChange={e => setPaymentForm({...paymentForm, reference_number: e.target.value})} placeholder="Check #, transaction ID..." /></div>
                <div className="form-group"><label className="form-label">Payment Date</label><input className="form-input" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})} /></div>
                {(po.invoices||[]).length > 0 && (
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Apply to Invoice (optional)</label>
                    <select className="form-select" value={paymentForm.invoice_id} onChange={e => setPaymentForm({...paymentForm, invoice_id: e.target.value})}>
                      <option value="">No specific invoice</option>
                      {(po.invoices||[]).map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — ${parseFloat(inv.amount).toFixed(2)}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Notes</label><textarea className="form-textarea" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

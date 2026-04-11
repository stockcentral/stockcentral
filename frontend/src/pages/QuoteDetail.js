import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowLeft, ArrowRight, Send, Printer } from 'lucide-react';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [newItem, setNewItem] = useState({ sku: '', name: '', vendor_sku: '', quantity: 1, unit_cost: 0, inventory_item_id: null });

  const load = () => api.get(`/quotes/${id}`).then(r => setQuote(r.data));

  useEffect(() => {
    load();
    api.get('/vendors').then(r => setVendors(r.data));
    api.get('/inventory').then(r => setInventory(r.data));
  }, [id]);

  const selectInventoryItem = (item) => {
    // Find vendor SKU if vendor is set
    const vendorSku = item.vendor_skus?.find(vs => vs.vendor_id === quote?.vendor_id);
    setNewItem({ ...newItem, inventory_item_id: item.id, sku: item.sku, name: item.name, vendor_sku: vendorSku?.vendor_sku || '', unit_cost: vendorSku?.vendor_cost || item.cost || 0 });
    setItemSearch('');
  };

  const addItem = async () => {
    if (!newItem.name) { toast.error('Please select or enter an item'); return; }
    const updatedItems = [...(quote.items || []), newItem];
    try {
      await api.put(`/quotes/${id}`, { ...quote, items: updatedItems });
      load();
      setNewItem({ sku: '', name: '', vendor_sku: '', quantity: 1, unit_cost: 0, inventory_item_id: null });
      toast.success('Item added');
    } catch (err) { toast.error('Error adding item'); }
  };

  const removeItem = async (idx) => {
    const updatedItems = quote.items.filter((_, i) => i !== idx);
    try { await api.put(`/quotes/${id}`, { ...quote, items: updatedItems }); load(); }
    catch { toast.error('Error'); }
  };

  const updateStatus = async (status) => {
    try { await api.put(`/quotes/${id}`, { ...quote, status }); load(); toast.success(`Status updated to ${status}`); }
    catch { toast.error('Error'); }
  };

  const convert = async () => {
    if (!window.confirm('Convert to Purchase Order?')) return;
    try {
      const r = await api.post(`/quotes/${id}/convert`);
      toast.success('Converted to Purchase Order!');
      navigate(`/purchase-orders/${r.data.id}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const printQuote = () => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Quote ${quote.quote_number}</title>
      <style>body{font-family:sans-serif;padding:40px;color:#111}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.total{font-size:18px;font-weight:bold;text-align:right;margin-top:20px}</style>
      </head><body>
      <h1>Quote Request: ${quote.quote_number}</h1>
      <p><strong>Vendor:</strong> ${quote.vendor_name || 'TBD'}</p>
      <p><strong>Date:</strong> ${new Date(quote.created_at).toLocaleDateString()}</p>
      <p><strong>Requested By:</strong> ${quote.requested_by || '—'}</p>
      ${quote.notes ? `<p><strong>Notes:</strong> ${quote.notes}</p>` : ''}
      <table><tr><th>SKU</th><th>Vendor SKU</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr>
      ${(quote.items||[]).map(i => `<tr><td>${i.sku||''}</td><td>${i.vendor_sku||''}</td><td>${i.name}</td><td>${i.quantity}</td><td>$${parseFloat(i.unit_cost||0).toFixed(2)}</td><td>$${(i.quantity*(i.unit_cost||0)).toFixed(2)}</td></tr>`).join('')}
      </table>
      ${quote.shipping_cost > 0 ? `<div style="text-align:right;margin-top:10px">Shipping: $${parseFloat(quote.shipping_cost).toFixed(2)}</div>` : ''}
      ${quote.vendor_credit > 0 ? `<div style="text-align:right">Vendor Credit: -$${parseFloat(quote.vendor_credit).toFixed(2)}</div>` : ''}
      <div class="total">Total: $${parseFloat(quote.total||0).toFixed(2)}</div>
      </body></html>`);
    w.document.close(); w.print();
  };

  if (!quote) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Loading...</div>;

  const filteredInventory = inventory.filter(i => i.sku.toLowerCase().includes(itemSearch.toLowerCase()) || i.name.toLowerCase().includes(itemSearch.toLowerCase()));
  const subtotal = (quote.items||[]).reduce((sum, i) => sum + (parseFloat(i.unit_cost||0) * parseInt(i.quantity||0)), 0);
  const total = subtotal + parseFloat(quote.shipping_cost||0) - parseFloat(quote.vendor_credit||0);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => navigate('/quotes')}><ArrowLeft size={14} /></button>
          <div>
            <h1 className="page-title">{quote.quote_number}</h1>
            <p className="page-subtitle">Vendor: {quote.vendor_name || 'Not selected'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={printQuote}><Printer size={13} />Print/Email</button>
          {quote.status === 'draft' && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus('sent')}><Send size={13} />Mark Sent</button>}
          {quote.status === 'sent' && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus('received')}><Send size={13} />Mark Received</button>}
          {quote.status !== 'converted' && quote.status !== 'cancelled' && (
            <button className="btn btn-primary btn-sm" onClick={convert}><ArrowRight size={13} />Convert to PO</button>
          )}
          <span className={`badge ${quote.status === 'converted' ? 'badge-success' : quote.status === 'sent' ? 'badge-info' : quote.status === 'received' ? 'badge-warning' : 'badge-neutral'}`} style={{ alignSelf: 'center' }}>{quote.status}</span>
        </div>
      </div>

      {/* Info */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Vendor</div>
          <div style={{ fontWeight: 600 }}>{quote.vendor_name || '—'}</div>
          {quote.contact_name && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{quote.contact_name}</div>}
          {quote.vendor_email && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{quote.vendor_email}</div>}
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Details</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Requested by: <span style={{ color: 'var(--text-primary)' }}>{quote.requested_by || '—'}</span></div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Created: <span style={{ color: 'var(--text-primary)' }}>{new Date(quote.created_at).toLocaleDateString()}</span></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-light)' }}>${total.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{(quote.items||[]).length} items</div>
        </div>
      </div>

      {/* Items */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Line Items</span></div>

        {/* Add item row */}
        {quote.status !== 'converted' && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add Item</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
              <div>
                <label className="form-label">Search Inventory</label>
                <input className="form-input" placeholder="SKU or name..." value={itemSearch} onChange={e => { setItemSearch(e.target.value); if (!e.target.value) setNewItem({...newItem, inventory_item_id: null, sku: '', name: '', vendor_sku: ''}); }} />
                {itemSearch && (
                  <div style={{ position: 'absolute', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 10, maxHeight: 180, overflow: 'auto', width: 320 }}>
                    {filteredInventory.slice(0, 8).map(item => (
                      <div key={item.id} onClick={() => selectInventoryItem(item)}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="font-mono" style={{ color: 'var(--accent-light)', fontSize: 11 }}>{item.sku}</span> — {item.name}
                      </div>
                    ))}
                    {filteredInventory.length === 0 && <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>No items found</div>}
                  </div>
                )}
              </div>
              <div><label className="form-label">Vendor SKU</label><input className="form-input" value={newItem.vendor_sku} onChange={e => setNewItem({...newItem, vendor_sku: e.target.value})} placeholder="Vendor SKU" /></div>
              <div><label className="form-label">Name</label><input className="form-input" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} placeholder="Item name" /></div>
              <div><label className="form-label">Qty</label><input className="form-input" type="number" min="1" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value)||1})} /></div>
              <div><label className="form-label">Unit Cost</label><input className="form-input" type="number" step="0.01" value={newItem.unit_cost} onChange={e => setNewItem({...newItem, unit_cost: parseFloat(e.target.value)||0})} /></div>
              <button className="btn btn-primary btn-sm" style={{ marginBottom: 0 }} onClick={addItem}><Plus size={14} /></button>
            </div>
          </div>
        )}

        <div className="table-container">
          <table>
            <thead><tr><th>SKU</th><th>Vendor SKU</th><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {(quote.items||[]).length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state" style={{ padding: 24 }}>No items added yet</div></td></tr>
              ) : (quote.items||[]).map((item, idx) => (
                <tr key={idx}>
                  <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{item.sku||'—'}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>{item.vendor_sku||'—'}</td>
                  <td>{item.name}</td>
                  <td style={{ fontWeight: 600 }}>{item.quantity}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(item.unit_cost||0).toFixed(2)}</td>
                  <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>${(item.quantity * parseFloat(item.unit_cost||0)).toFixed(2)}</td>
                  <td>{quote.status !== 'converted' && <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(idx)}><Trash2 size={13} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <div style={{ width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span className="font-mono">${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Shipping</span>
              <span className="font-mono">${parseFloat(quote.shipping_cost||0).toFixed(2)}</span>
            </div>
            {parseFloat(quote.vendor_credit||0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--success)' }}>Vendor Credit</span>
                <span className="font-mono" style={{ color: 'var(--success)' }}>-${parseFloat(quote.vendor_credit).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', borderTop: '2px solid var(--border-light)', fontSize: 16, fontWeight: 700 }}>
              <span>Total</span>
              <span className="font-mono" style={{ color: 'var(--accent-light)' }}>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

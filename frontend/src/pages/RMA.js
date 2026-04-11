import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, RotateCcw } from 'lucide-react';

const statusColors = { pending: 'badge-warning', approved: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger' };

export default function RMA() {
  const [rmas, setRMAs] = useState([]);
  const [modal, setModal] = useState(false);
  const [pos, setPOs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState({ po_id: '', inventory_item_id: '', shopify_order_id: '', shopify_order_number: '', customer_name: '', customer_email: '', quantity: 1, reason: '', resolution: 'refund', replacement_type: '', notes: '' });
  const [poSearch, setPoSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  const load = () => {
    api.get('/rma').then(r => setRMAs(r.data));
    api.get('/purchase-orders').then(r => setPOs(r.data));
    api.get('/shopify/orders').then(r => setOrders(r.data)).catch(() => {});
    api.get('/inventory').then(r => setInventory(r.data));
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try { await api.post('/rma', form); toast.success('RMA created'); setModal(false); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const updateStatus = async (id, status) => {
    try { await api.put(`/rma/${id}`, { status }); load(); toast.success('Status updated'); }
    catch { toast.error('Error'); }
  };

  const filteredPOs = pos.filter(p => p.po_number?.toLowerCase().includes(poSearch.toLowerCase()) || p.vendor_name?.toLowerCase().includes(poSearch.toLowerCase()));
  const filteredOrders = orders.filter(o => o.order_number?.toString().includes(orderSearch) || o.customer_name?.toLowerCase().includes(orderSearch.toLowerCase()) || o.customer_email?.toLowerCase().includes(orderSearch.toLowerCase()));
  const filteredInventory = inventory.filter(i => i.sku.toLowerCase().includes(itemSearch.toLowerCase()) || i.name.toLowerCase().includes(itemSearch.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">RMA</h1>
          <p className="page-subtitle">Return Merchandise Authorization</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={14} />New RMA</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead><tr><th>RMA #</th><th>Item</th><th>Customer</th><th>Order #</th><th>Qty</th><th>Reason</th><th>Resolution</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rmas.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state" style={{ padding: 32 }}><RotateCcw size={32} /><p>No RMAs found</p></div></td></tr>
              ) : rmas.map(rma => (
                <tr key={rma.id}>
                  <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{rma.rma_number}</td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{rma.item_name || '—'}</div>
                    {rma.item_sku && <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rma.item_sku}</div>}
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{rma.customer_name || '—'}</div>
                    {rma.customer_email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rma.customer_email}</div>}
                  </td>
                  <td className="font-mono" style={{ fontSize: 12 }}>{rma.shopify_order_number || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{rma.quantity}</td>
                  <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-secondary)' }}>{rma.reason || '—'}</td>
                  <td><span className="badge badge-info">{rma.resolution || '—'}</span></td>
                  <td><span className={`badge ${statusColors[rma.status] || 'badge-neutral'}`}>{rma.status}</span></td>
                  <td>
                    <select className="form-select" style={{ padding: '4px 8px', fontSize: 11, width: 120 }} value={rma.status} onChange={e => updateStatus(rma.id, e.target.value)}>
                      {['pending', 'approved', 'completed', 'cancelled'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header"><h3 className="modal-title">Create RMA</h3><button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={save}>
              {/* Search PO */}
              <div className="form-group">
                <label className="form-label">Search Purchase Order (optional)</label>
                <input className="form-input" placeholder="PO number or vendor..." value={poSearch} onChange={e => setPoSearch(e.target.value)} />
                {poSearch && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, maxHeight: 140, overflow: 'auto' }}>
                    {filteredPOs.slice(0, 5).map(p => (
                      <div key={p.id} onClick={() => { setForm({...form, po_id: p.id}); setPoSearch(`${p.po_number} — ${p.vendor_name||''}`); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="font-mono" style={{ color: 'var(--accent-light)' }}>{p.po_number}</span> — {p.vendor_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Shopify Order */}
              <div className="form-group">
                <label className="form-label">Search Shopify Order (optional)</label>
                <input className="form-input" placeholder="Order # or customer name/email..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
                {orderSearch && filteredOrders.length > 0 && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, maxHeight: 140, overflow: 'auto' }}>
                    {filteredOrders.slice(0, 5).map(o => (
                      <div key={o.id} onClick={() => { setForm({...form, shopify_order_id: o.external_id, shopify_order_number: o.order_number, customer_name: o.customer_name, customer_email: o.customer_email}); setOrderSearch(`#${o.order_number} — ${o.customer_name}`); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="font-mono" style={{ color: 'var(--accent-light)' }}>#{o.order_number}</span> — {o.customer_name} ({o.customer_email})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Inventory Item */}
              <div className="form-group">
                <label className="form-label">Item Being Returned *</label>
                <input className="form-input" placeholder="Search SKU or name..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
                {itemSearch && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, maxHeight: 140, overflow: 'auto' }}>
                    {filteredInventory.slice(0, 5).map(item => (
                      <div key={item.id} onClick={() => { setForm({...form, inventory_item_id: item.id}); setItemSearch(`${item.sku} — ${item.name}`); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="font-mono" style={{ color: 'var(--accent-light)', fontSize: 11 }}>{item.sku}</span> — {item.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid-2">
                <div className="form-group"><label className="form-label">Customer Name</label><input className="form-input" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Customer Email</label><input className="form-input" type="email" value={form.customer_email} onChange={e => setForm({...form, customer_email: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Quantity</label><input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} /></div>
                <div className="form-group">
                  <label className="form-label">Resolution *</label>
                  <select className="form-select" value={form.resolution} onChange={e => setForm({...form, resolution: e.target.value})}>
                    <option value="refund">Refund</option>
                    <option value="replace">Replace</option>
                    <option value="credit">Store Credit</option>
                    <option value="repair">Repair</option>
                  </select>
                </div>
                {form.resolution === 'replace' && (
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Replacement Type</label>
                    <select className="form-select" value={form.replacement_type} onChange={e => setForm({...form, replacement_type: e.target.value})}>
                      <option value="">Select...</option>
                      <option value="new">New Unit</option>
                      <option value="refurbished">Refurbished Unit</option>
                    </select>
                  </div>
                )}
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Reason for Return</label><textarea className="form-textarea" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Describe the issue..." /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create RMA</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Factory, CheckCircle } from 'lucide-react';

const statusColors = { planned: 'badge-neutral', in_progress: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger' };

export default function Manufacturing() {
  const [orders, setOrders] = useState([]);
  const [modal, setModal] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState({ finished_product_id: '', quantity: 1, start_date: '', completion_date: '', notes: '' });
  const [productSearch, setProductSearch] = useState('');

  const load = () => api.get('/manufacturing').then(r => setOrders(r.data));
  useEffect(() => { load(); api.get('/inventory').then(r => setInventory(r.data)); }, []);

  const create = async (e) => {
    e.preventDefault();
    try { await api.post('/manufacturing', form); toast.success('Manufacturing order created'); setModal(false); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const complete = async (id) => {
    if (!window.confirm('Complete this manufacturing order? Components will be deducted and finished goods added.')) return;
    try { await api.put(`/manufacturing/${id}/complete`); toast.success('Order completed — inventory updated!'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const filteredProducts = inventory.filter(i => i.sku.toLowerCase().includes(productSearch.toLowerCase()) || i.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Manufacturing</h1><p className="page-subtitle">Build orders using Bill of Materials</p></div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={14} />New Build Order</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead><tr><th>MO #</th><th>Product</th><th>SKU</th><th>Qty</th><th>Start Date</th><th>Completion</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state" style={{ padding: 32 }}><Factory size={32} /><p>No manufacturing orders</p></div></td></tr>
              ) : orders.map(mo => (
                <tr key={mo.id}>
                  <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{mo.mo_number}</td>
                  <td style={{ fontWeight: 500 }}>{mo.product_name}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>{mo.product_sku}</td>
                  <td style={{ fontWeight: 600 }}>{mo.quantity}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{mo.start_date ? new Date(mo.start_date).toLocaleDateString() : '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{mo.completion_date ? new Date(mo.completion_date).toLocaleDateString() : '—'}</td>
                  <td><span className={`badge ${statusColors[mo.status] || 'badge-neutral'}`}>{mo.status}</span></td>
                  <td>
                    {mo.status !== 'completed' && mo.status !== 'cancelled' && (
                      <button className="btn btn-success btn-sm" onClick={() => complete(mo.id)}><CheckCircle size={13} />Complete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">New Manufacturing Order</h3><button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button></div>
            <form onSubmit={create}>
              <div className="form-group">
                <label className="form-label">Finished Product *</label>
                <input className="form-input" placeholder="Search product..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                {productSearch && !form.finished_product_id && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, maxHeight: 160, overflow: 'auto' }}>
                    {filteredProducts.slice(0, 6).map(p => (
                      <div key={p.id} onClick={() => { setForm({...form, finished_product_id: p.id}); setProductSearch(`${p.sku} — ${p.name}`); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="font-mono" style={{ color: 'var(--accent-light)', fontSize: 11 }}>{p.sku}</span> — {p.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Quantity *</label><input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required /></div>
                <div className="form-group"></div>
                <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Target Completion</label><input className="form-input" type="date" value={form.completion_date} onChange={e => setForm({...form, completion_date: e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Eye, CheckCircle } from 'lucide-react';

const statusColors = { pending: 'badge-warning', approved: 'badge-info', ordered: 'badge-info', received: 'badge-success', cancelled: 'badge-danger', partial: 'badge-warning' };

export default function PurchaseOrders() {
  const [pos, setPOs] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ vendor_id: '', notes: '', shipping_cost: 0, vendor_credit: 0, expected_date: '' });
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/purchase-orders').then(r => setPOs(r.data));
    api.get('/vendors').then(r => setVendors(r.data));
  }, []);

  const filtered = pos.filter(p => p.po_number?.toLowerCase().includes(search.toLowerCase()) || p.vendor_name?.toLowerCase().includes(search.toLowerCase()));

  const create = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/purchase-orders', { ...form, items: [] });
      toast.success('Purchase order created');
      setModal(false);
      navigate(`/purchase-orders/${r.data.id}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const markReceived = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Mark this PO as received? This will update inventory quantities.')) return;
    try {
      await api.put(`/purchase-orders/${id}`, { status: 'received' });
      api.get('/purchase-orders').then(r => setPOs(r.data));
      toast.success('PO marked as received — inventory updated!');
    } catch (err) { toast.error('Error'); }
  };

  const totalPending = pos.filter(p => p.status === 'pending' || p.status === 'ordered').reduce((sum, p) => sum + parseFloat(p.total||0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">Pending value: <span className="font-mono text-warning">${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={14} />New Purchase Order</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div className="search-bar" style={{ maxWidth: 320 }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input placeholder="Search POs..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead><tr><th>PO #</th><th>Vendor</th><th>Subtotal</th><th>Shipping</th><th>Total</th><th>Invoices</th><th>Paid</th><th>Expected</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state" style={{ padding: 32 }}>No purchase orders found</div></td></tr>
              ) : filtered.map(po => {
                const balance = parseFloat(po.total||0) - parseFloat(po.amount_paid||0);
                return (
                  <tr key={po.id} onClick={() => navigate(`/purchase-orders/${po.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{po.po_number}</td>
                    <td style={{ fontWeight: 500 }}>{po.vendor_name || '—'}</td>
                    <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(po.subtotal||0).toFixed(2)}</td>
                    <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(po.shipping_cost||0).toFixed(2)}</td>
                    <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>${parseFloat(po.total||0).toFixed(2)}</td>
                    <td>
                      {parseInt(po.invoice_count||0) > 0 ? (
                        <span className="badge badge-info">{po.invoice_count} invoice{po.invoice_count > 1 ? 's' : ''}</span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>None</span>}
                    </td>
                    <td>
                      <div className="font-mono" style={{ fontSize: 12, color: parseFloat(po.amount_paid||0) >= parseFloat(po.total||0) ? 'var(--success)' : 'var(--warning)' }}>
                        ${parseFloat(po.amount_paid||0).toFixed(2)}
                        {balance > 0.01 && <div style={{ fontSize: 10, color: 'var(--danger)' }}>-${balance.toFixed(2)}</div>}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</td>
                    <td><span className={`badge ${statusColors[po.status] || 'badge-neutral'}`}>{po.status}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => navigate(`/purchase-orders/${po.id}`)}><Eye size={13} /></button>
                        {po.status !== 'received' && po.status !== 'cancelled' && (
                          <button className="btn btn-sm" style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)', fontSize: 11, padding: '4px 8px' }} onClick={e => markReceived(po.id, e)}>
                            <CheckCircle size={12} />Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">New Purchase Order</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={create}>
              <div className="form-group">
                <label className="form-label">Vendor *</label>
                <select className="form-select" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})} required>
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Shipping Cost ($)</label><input className="form-input" type="number" step="0.01" value={form.shipping_cost} onChange={e => setForm({...form, shipping_cost: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Vendor Credit ($)</label><input className="form-input" type="number" step="0.01" value={form.vendor_credit} onChange={e => setForm({...form, vendor_credit: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Expected Date</label><input className="form-input" type="date" value={form.expected_date} onChange={e => setForm({...form, expected_date: e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create PO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

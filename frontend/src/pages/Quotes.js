import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Eye, ArrowRight } from 'lucide-react';

const statusColors = { draft: 'badge-neutral', sent: 'badge-info', received: 'badge-warning', converted: 'badge-success', cancelled: 'badge-danger' };

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({ vendor_id: '', notes: '', shipping_cost: 0, vendor_credit: 0, requested_by: '' });
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/quotes').then(r => setQuotes(r.data));
    api.get('/vendors').then(r => setVendors(r.data));
  }, []);

  const filtered = quotes.filter(q => q.quote_number?.toLowerCase().includes(search.toLowerCase()) || q.vendor_name?.toLowerCase().includes(search.toLowerCase()));

  const create = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/quotes', { ...form, items: [] });
      toast.success('Quote request created');
      setModal(false);
      navigate(`/quotes/${r.data.id}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const convert = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Convert this quote to a Purchase Order?')) return;
    try {
      const r = await api.post(`/quotes/${id}/convert`);
      toast.success('Converted to Purchase Order!');
      navigate(`/purchase-orders/${r.data.id}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quote Requests</h1>
          <p className="page-subtitle">Create quote requests → convert to purchase orders</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}><Plus size={14} />New Quote Request</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div className="search-bar" style={{ maxWidth: 320 }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead><tr><th>Quote #</th><th>Vendor</th><th>Items</th><th>Total</th><th>Requested By</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state" style={{ padding: 32 }}>No quote requests found</div></td></tr>
              ) : filtered.map(q => (
                <tr key={q.id} onClick={() => navigate(`/quotes/${q.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{q.quote_number}</td>
                  <td style={{ fontWeight: 500 }}>{q.vendor_name || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>—</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(q.total||0).toFixed(2)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{q.requested_by || '—'}</td>
                  <td><span className={`badge ${statusColors[q.status] || 'badge-neutral'}`}>{q.status}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{new Date(q.created_at).toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => navigate(`/quotes/${q.id}`)}><Eye size={13} /></button>
                      {q.status !== 'converted' && q.status !== 'cancelled' && (
                        <button className="btn btn-sm" style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)', fontSize: 11 }} onClick={e => convert(q.id, e)}>
                          <ArrowRight size={12} />Convert to PO
                        </button>
                      )}
                    </div>
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
            <div className="modal-header">
              <h3 className="modal-title">New Quote Request</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={create}>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <select className="form-select" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})}>
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Requested By</label><input className="form-input" value={form.requested_by} onChange={e => setForm({...form, requested_by: e.target.value})} placeholder="Your name" /></div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Special instructions, requirements..." /></div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>You can add items after creating the quote request.</p>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Quote Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, RefreshCw, Upload, Download } from 'lucide-react';

const EMPTY = { sku: '', name: '', description: '', cost: '', price: '', quantity: '', low_stock_threshold: 5, category: '', brand: '', weight: '', shopify_product_id: '', shopify_variant_id: '' };

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => api.get(`/inventory?search=${search}&${filter === 'low' ? 'low_stock=true' : ''}`).then(r => setItems(r.data)).catch(() => {});

  useEffect(() => { load(); }, [search, filter]);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/inventory/${editing}`, form); toast.success('Item updated'); }
      else { await api.post('/inventory', form); toast.success('Item created'); }
      setModal(false); setForm(EMPTY); setEditing(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error saving item'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try { await api.delete(`/inventory/${id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Error deleting'); }
  };

  const edit = (item) => { setForm({ ...item }); setEditing(item.id); setModal(true); };

  const syncShopify = async () => {
    setSyncing(true);
    try { const r = await api.post('/shopify/sync-products'); toast.success(r.data.message); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Sync failed'); }
    setSyncing(false);
  };

  const syncInventoryToShopify = async (item) => {
    try {
      await api.post('/shopify/update-inventory', { inventory_item_id: item.id, quantity: item.quantity });
      toast.success('Synced to Shopify');
    } catch (err) { toast.error(err.response?.data?.error || 'Sync failed'); }
  };

  const totalValue = items.reduce((sum, i) => sum + (parseFloat(i.cost || 0) * parseInt(i.quantity || 0)), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{items.length} items · Total value: <span className="font-mono text-success">${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={syncShopify} disabled={syncing}><RefreshCw size={14} />{syncing ? 'Syncing...' : 'Sync Shopify'}</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setForm(EMPTY); setEditing(null); setModal(true); }}><Plus size={14} />Add Item</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input placeholder="Search SKU or name..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all', 'low'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className="btn btn-sm" style={{
            background: filter === f ? 'var(--accent-dim)' : 'var(--bg-card)',
            color: filter === f ? 'var(--accent-light)' : 'var(--text-secondary)',
            border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`
          }}>{f === 'all' ? 'All Items' : '⚠ Low Stock'}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Cost</th><th>Price</th><th>Qty</th><th>Shopify</th><th>Actions</th></tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state" style={{ padding: 32 }}>No items found</div></td></tr>
              ) : items.map(item => (
                <tr key={item.id}>
                  <td><span className="font-mono" style={{ color: 'var(--accent-light)', fontSize: 12 }}>{item.sku}</span></td>
                  <td style={{ maxWidth: 200 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    {item.brand && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.brand}</div>}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{item.category || '—'}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(item.cost||0).toFixed(2)}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(item.price||0).toFixed(2)}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: item.quantity <= item.low_stock_threshold ? 'var(--danger)' : item.quantity <= item.low_stock_threshold * 2 ? 'var(--warning)' : 'var(--success)' }}>
                      {item.quantity}
                    </span>
                  </td>
                  <td>
                    {item.shopify_variant_id ? (
                      <button className="btn btn-sm" style={{ background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)', padding: '3px 8px', fontSize: 11 }} onClick={() => syncInventoryToShopify(item)}>
                        <RefreshCw size={10} />Sync
                      </button>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Not linked</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => edit(item)}><Edit size={13} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(item.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Edit Item' : 'Add Inventory Item'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={save}>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">SKU *</label><input className="form-input" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Brand</label><input className="form-input" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Cost ($)</label><input className="form-input" type="number" step="0.01" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Price ($)</label><input className="form-input" type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Quantity</label><input className="form-input" type="number" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Low Stock Alert</label><input className="form-input" type="number" value={form.low_stock_threshold} onChange={e => setForm({...form, low_stock_threshold: e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

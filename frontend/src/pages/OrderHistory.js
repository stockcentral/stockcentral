import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Search, RefreshCw, Upload, History } from 'lucide-react';

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importSource, setImportSource] = useState('woocommerce');
  const [importData, setImportData] = useState('');

  const load = () => api.get(`/shopify/orders?search=${search}&source=${source}`).then(r => setOrders(r.data)).catch(() => {});

  useEffect(() => { load(); }, [search, source]);

  const syncShopify = async () => {
    setSyncing(true);
    try { const r = await api.post('/shopify/sync-orders'); toast.success(`Synced ${r.data.synced} orders from Shopify`); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Sync failed'); }
    setSyncing(false);
  };

  const importOrders = async () => {
    try {
      const orders = JSON.parse(importData);
      const r = await api.post('/shopify/import-orders', { orders, source: importSource });
      toast.success(r.data.message);
      setImportModal(false); setImportData('');
      load();
    } catch (err) { toast.error('Invalid JSON or import error: ' + (err.response?.data?.error || err.message)); }
  };

  const sourceColors = { shopify: 'badge-success', woocommerce: 'badge-info', odoo: 'badge-warning' };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Order History</h1><p className="page-subtitle">{orders.length} orders loaded</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setImportModal(true)}><Upload size={14} />Import CSV/JSON</button>
          <button className="btn btn-secondary btn-sm" onClick={syncShopify} disabled={syncing}><RefreshCw size={14} />{syncing ? 'Syncing...' : 'Sync Shopify'}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div className="search-bar" style={{ maxWidth: 320 }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input placeholder="Order # or customer..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 160 }} value={source} onChange={e => setSource(e.target.value)}>
          <option value="">All sources</option>
          <option value="shopify">Shopify</option>
          <option value="woocommerce">WooCommerce</option>
          <option value="odoo">Odoo</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table>
            <thead><tr><th>Order #</th><th>Source</th><th>Customer</th><th>Email</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state" style={{ padding: 32 }}><History size={32} /><p>No orders found. Sync Shopify or import data to get started.</p></div></td></tr>
              ) : orders.map(o => (
                <tr key={o.id}>
                  <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>#{o.order_number}</td>
                  <td><span className={`badge ${sourceColors[o.source] || 'badge-neutral'}`}>{o.source}</span></td>
                  <td style={{ fontWeight: 500 }}>{o.customer_name || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.customer_email || '—'}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(o.total||0).toFixed(2)}</td>
                  <td><span className="badge badge-neutral">{o.status || '—'}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {importModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setImportModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header"><h3 className="modal-title">Import Order History</h3><button className="btn btn-secondary btn-sm" onClick={() => setImportModal(false)}>✕</button></div>
            <div className="form-group">
              <label className="form-label">Source System</label>
              <select className="form-select" value={importSource} onChange={e => setImportSource(e.target.value)}>
                <option value="woocommerce">WooCommerce</option>
                <option value="odoo">Odoo</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Paste JSON Data</label>
              <textarea className="form-textarea" style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12 }} value={importData} onChange={e => setImportData(e.target.value)}
                placeholder={`[\n  {\n    "id": "123",\n    "order_number": "1001",\n    "customer_name": "John Doe",\n    "customer_email": "john@example.com",\n    "total": "1299.99",\n    "status": "completed",\n    "order_date": "2024-01-15"\n  }\n]`} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Paste a JSON array of orders. Each order should have: id, order_number, customer_name, customer_email, total, status, order_date.</p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setImportModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={importOrders}>Import Orders</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { Package, ShoppingCart, AlertTriangle, TrendingUp, RotateCcw, FileText, DollarSign, Factory } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ inventory: 0, lowStock: 0, openPOs: 0, openRMAs: 0, quotes: 0, manufacturing: 0 });
  const [recentPOs, setRecentPOs] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/inventory'),
      api.get('/inventory?low_stock=true'),
      api.get('/purchase-orders'),
      api.get('/rma'),
      api.get('/quotes'),
      api.get('/manufacturing'),
    ]).then(([inv, low, pos, rmas, quotes, mfg]) => {
      setStats({
        inventory: inv.data.length,
        lowStock: low.data.length,
        openPOs: pos.data.filter(p => p.status !== 'received' && p.status !== 'cancelled').length,
        openRMAs: rmas.data.filter(r => r.status === 'pending').length,
        quotes: quotes.data.filter(q => q.status === 'draft' || q.status === 'sent').length,
        manufacturing: mfg.data.filter(m => m.status === 'in_progress').length,
      });
      setRecentPOs(pos.data.slice(0, 5));
      setLowStockItems(low.data.slice(0, 5));
    }).catch(() => {});
  }, []);

  const statCards = [
    { label: 'Total SKUs', value: stats.inventory, icon: Package, color: 'var(--accent)' },
    { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'var(--warning)' },
    { label: 'Open POs', value: stats.openPOs, icon: ShoppingCart, color: 'var(--success)' },
    { label: 'Pending RMAs', value: stats.openRMAs, icon: RotateCcw, color: 'var(--danger)' },
    { label: 'Active Quotes', value: stats.quotes, icon: FileText, color: '#a78bfa' },
    { label: 'In Production', value: stats.manufacturing, icon: Factory, color: '#38bdf8' },
  ];

  const statusBadge = (status) => {
    const map = { pending: 'badge-warning', received: 'badge-success', cancelled: 'badge-danger', approved: 'badge-info', draft: 'badge-neutral' };
    return <span className={`badge ${map[status] || 'badge-neutral'}`}>{status}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's your operations overview.</p>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card" style={{ borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="stat-label">{label}</span>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="stat-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Recent POs */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Purchase Orders</span>
          </div>
          {recentPOs.length === 0 ? (
            <div className="empty-state"><ShoppingCart size={32} /><p>No purchase orders yet</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>PO #</th><th>Vendor</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {recentPOs.map(po => (
                    <tr key={po.id}>
                      <td className="font-mono" style={{ fontSize: 12 }}>{po.po_number}</td>
                      <td>{po.vendor_name || '—'}</td>
                      <td className="font-mono">${parseFloat(po.total||0).toFixed(2)}</td>
                      <td>{statusBadge(po.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Low Stock Alerts</span>
            {stats.lowStock > 0 && <span className="badge badge-warning">{stats.lowStock} items</span>}
          </div>
          {lowStockItems.length === 0 ? (
            <div className="empty-state"><Package size={32} /><p>All stock levels are healthy!</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th>Min</th></tr></thead>
                <tbody>
                  {lowStockItems.map(item => (
                    <tr key={item.id}>
                      <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{item.sku}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                      <td><span style={{ color: 'var(--danger)', fontWeight: 600 }}>{item.quantity}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{item.low_stock_threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

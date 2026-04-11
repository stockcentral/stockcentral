import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Settings as SettingsIcon, RefreshCw, CheckCircle } from 'lucide-react';

export default function Settings() {
  const [shopifyForm, setShopifyForm] = useState({ shopify_shop: '', shopify_access_token: '' });
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => { api.get('/shopify/settings').then(r => { if (r.data.shopify_shop) setShopifyForm({ ...shopifyForm, shopify_shop: r.data.shopify_shop }); }).catch(() => {}); }, []);

  const saveShopify = async (e) => {
    e.preventDefault();
    try { await api.post('/shopify/settings', shopifyForm); toast.success('Shopify settings saved!'); setSaved(true); setTimeout(() => setSaved(false), 3000); }
    catch (err) { toast.error(err.response?.data?.error || 'Error saving'); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const r = await api.post('/shopify/sync-products');
      toast.success(`✅ Connected! Synced ${r.data.synced} products.`);
    } catch (err) { toast.error('Connection failed: ' + (err.response?.data?.error || err.message)); }
    setTesting(false);
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Configure StockCentral</p></div>
      </div>

      <div style={{ maxWidth: 640 }}>
        {/* Shopify Connection */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Shopify Connection</span>
            <span className="badge badge-info">Required</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Connect your Shopify store to sync inventory, products and orders. You'll need to create a custom app in your Shopify Admin to get an access token.
          </p>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>How to get your Access Token:</strong><br />
            1. Go to Shopify Admin → Settings → Apps and sales channels<br />
            2. Click "Develop apps" → Create app<br />
            3. Configure API scopes: read/write products, inventory, orders<br />
            4. Install the app and copy the Admin API access token
          </div>
          <form onSubmit={saveShopify}>
            <div className="form-group">
              <label className="form-label">Shop Domain</label>
              <input className="form-input" value={shopifyForm.shopify_shop} onChange={e => setShopifyForm({...shopifyForm, shopify_shop: e.target.value})} placeholder="your-store.myshopify.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Admin API Access Token</label>
              <input className="form-input" type="password" value={shopifyForm.shopify_access_token} onChange={e => setShopifyForm({...shopifyForm, shopify_access_token: e.target.value})} placeholder="shpat_••••••••••••••••" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">{saved ? <><CheckCircle size={14} />Saved!</> : 'Save Settings'}</button>
              <button type="button" className="btn btn-secondary" onClick={testConnection} disabled={testing}><RefreshCw size={14} />{testing ? 'Testing...' : 'Test & Sync Products'}</button>
            </div>
          </form>
        </div>

        {/* App Info */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>About StockCentral</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['App', 'StockCentral ERP'], ['Version', '1.0.0'], ['Developer', 'Apex Property Ventures'], ['Modules', 'Inventory, Vendors, Quotes, POs, RMA, BOM, Manufacturing']].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{l}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

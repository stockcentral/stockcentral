// Settings Page
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Save, RefreshCw, Shield, Tag, Link, Clock } from 'lucide-react';

const SYNC_FIELDS = [
  { section: 'Inventory', fields: [
    { key: 'inventory.sku', label: 'SKU', direction: 'bidirectional' },
    { key: 'inventory.name', label: 'Product Name', direction: 'bidirectional' },
    { key: 'inventory.price', label: 'Price', direction: 'bidirectional' },
    { key: 'inventory.quantity', label: 'Stock Quantity', direction: 'bidirectional' },
    { key: 'inventory.description', label: 'Description', direction: 'to_shopify' },
    { key: 'inventory.images', label: 'Product Images', direction: 'to_shopify' },
    { key: 'inventory.tags', label: 'Tags', direction: 'bidirectional' },
    { key: 'inventory.collection', label: 'Collection', direction: 'to_shopify' },
      ]},
  { section: 'Orders', fields: [
    { key: 'orders.sync', label: 'Sync Orders from Shopify', direction: 'from_shopify' },
    { key: 'orders.status', label: 'Order Status Updates', direction: 'from_shopify' },
      ]},
  { section: 'Vendors', fields: [
    { key: 'vendors.sync', label: 'Sync Vendors from Shopify', direction: 'from_shopify' },
      ]},
  ];

const DIR_LABELS = {
    bidirectional: { label: 'Two-Way Sync', color: '#6366f1' },
    to_shopify: { label: 'Upload to Shopify', color: '#10b981' },
    from_shopify: { label: 'Pull from Shopify', color: '#f59e0b' },
};

const PRESET_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#f97316','#06b6d4','#84cc16','#ec4899'];

export default function Settings() {
    const [tab, setTab] = useState('shopify');
    const [shopify, setShopify] = useState({ shopify_shop:'', shopify_access_token:'', shopify_client_id:'', shopify_client_secret:'' });
    const [warranty, setWarranty] = useState({ period_days: 365, period_label: '1 Year' });
    const [ticketTypes, setTicketTypes] = useState([]);
    const [newType, setNewType] = useState({ name:'', color:'#6366f1' });
    const [syncSettings, setSyncSettings] = useState({});
    const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
        try {
                const [sRes, wRes, tRes] = await Promise.all([
                          api.get('/settings/shopify').catch(() => ({ data: {} })),
                          api.get('/settings/warranty').catch(() => ({ data: { value: { period_days: 365, period_label: '1 Year' } } })),
                          api.get('/settings/ticket-types/all').catch(() => ({ data: [] })),
                        ]);
                if (sRes.data?.shopify_shop) setShopify(sRes.data);
                if (wRes.data?.value) setWarranty(wRes.data.value);
                setTicketTypes(tRes.data || []);
        } catch(e) {}
  };

  const saveShopify = async () => {
        try {
                setSaving(true);
                await api.post('/settings', { key: 'shopify', value: shopify });
                toast.success('Shopify settings saved');
        } catch(e) { toast.error('Failed to save'); }
        finally { setSaving(false); }
  };

  const saveWarranty = async () => {
        try {
                setSaving(true);
                await api.post('/settings', { key: 'warranty', value: warranty });
                toast.success('Warranty settings saved');
        } catch(e) { toast.error('Failed to save'); }
        finally { setSaving(false); }
  };

  const addTicketType = async () => {
        if (!newType.name.trim()) return toast.error('Type name is required');
        try {
                const r = await api.post('/settings/ticket-types', newType);
                setTicketTypes(t => [...t, r.data]);
                setNewType({ name:'', color:'#6366f1' });
                toast.success('Ticket type added');
        } catch(e) { toast.error('Failed to add ticket type'); }
  };

  const deleteTicketType = async (id) => {
        if (!window.confirm('Delete this ticket type?')) return;
        try {
                await api.delete(`/settings/ticket-types/${id}`);
                setTicketTypes(t => t.filter(x => x.id !== id));
                toast.success('Deleted');
        } catch(e) { toast.error('Failed to delete'); }
  };

  const TABS = [
    { id:'shopify', label:'Shopify', icon:Link },
    { id:'warranty', label:'Warranty', icon:Shield },
    { id:'tickets', label:'Ticket Types', icon:Tag },
    { id:'sync', label:'Sync', icon:RefreshCw },
      ];

  return (
        <div className="page-container">
          <div className="page-header">
            <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Configure your StockCentral workspace</p></div>
    </div>

      <div style={{display:'flex',gap:4,marginBottom:24,borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:0}}>
{TABS.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:'10px 18px',background:'none',border:'none',cursor:'pointer',borderBottom:tab===id?'2px solid #6366f1':'2px solid transparent',color:tab===id?'#6366f1':'inherit',display:'flex',alignItems:'center',gap:6,fontSize:14,fontWeight:tab===id?600:400}}>
            <Icon size={14}/>{label}
  </button>
        ))}
          </div>

{tab==='shopify'&&(
          <div style={{maxWidth:600}}>
          <h2 style={{fontSize:16,marginBottom:4}}>Shopify Connection</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Connect your Shopify store to sync products, orders, and vendors.</p>
{[['shopify_shop','Store URL','yourstore.myshopify.com'],['shopify_client_id','API Client ID',''],['shopify_client_secret','API Client Secret',''],['shopify_access_token','Access Token','shpat_...']].map(([k,l,p])=>(
              <div className="form-group" key={k}>
                <label className="form-label">{l}</label>
               <input value={shopify[k]||''} onChange={e=>setShopify(s=>({...s,[k]:e.target.value}))} className="form-input" placeholder={p} type={k.includes('secret')||k.includes('token')?'password':'text'}/>
  </div>
          ))}
          <button className="btn btn-primary" onClick={saveShopify} disabled={saving}><Save size={14}/> {saving?'Saving...':'Save Shopify Settings'}</button>
            </div>
      )}

{tab==='warranty'&&(
          <div style={{maxWidth:500}}>
          <h2 style={{fontSize:16,marginBottom:4}}>Warranty Period</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Set the default warranty period. This will appear in RMA and ticket views alongside purchase date and days remaining.</p>
          <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Warranty Period (Days)</label>
              <input type="number" value={warranty.period_days||365} onChange={e=>setWarranty(w=>({...w,period_days:parseInt(e.target.value)||365}))} className="form-input" min="1"/>
  </div>
            <div className="form-group">
                <label className="form-label">Display Label</label>
              <input value={warranty.period_label||''} onChange={e=>setWarranty(w=>({...w,period_label:e.target.value}))} className="form-input" placeholder="e.g. 1 Year, 90 Days"/>
  </div>
  </div>
          <div style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:8,padding:12,marginBottom:20,fontSize:13}}>
            <strong>How it works:</strong> When a ticket or RMA is created and linked to a Shopify order, the system will display the original purchase date and calculate days remaining in warranty based on this setting.
  </div>
          <button className="btn btn-primary" onClick={saveWarranty} disabled={saving}><Save size={14}/> {saving?'Saving...':'Save Warranty Settings'}</button>
  </div>
      )}

{tab==='tickets'&&(
          <div style={{maxWidth:600}}>
          <h2 style={{fontSize:16,marginBottom:4}}>Ticket Types</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Create ticket types with color codes for quick visual reference in your support dashboard.</p>

          <div style={{marginBottom:24}}>
{ticketTypes.map(t=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'rgba(255,255,255,0.04)',borderRadius:8,marginBottom:8}}>
                <div style={{width:16,height:16,borderRadius:4,background:t.color,flexShrink:0}}/>
                <span style={{flex:1,fontWeight:500}}>{t.name}</span>
                <span style={{fontSize:11,opacity:.5,fontFamily:'monospace'}}>{t.color}</span>
                <button onClick={()=>deleteTicketType(t.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',opacity:.6,padding:4}}><Trash2 size={14}/></button>
  </div>
            ))}
{ticketTypes.length===0&&<p style={{opacity:.5,textAlign:'center',padding:24}}>No ticket types yet. Add some below.</p>}
  </div>

          <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:16}}>
            <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Add New Type</div>
            <div style={{display:'flex',gap:12,alignItems:'flex-end'}}>
              <div className="form-group" style={{flex:1,margin:0}}>
                <label className="form-label">Type Name</label>
                <input value={newType.name} onChange={e=>setNewType(n=>({...n,name:e.target.value}))} className="form-input" placeholder="e.g. Tech Support, Lost Package"/>
  </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Color</label>
                <input type="color" value={newType.color} onChange={e=>setNewType(n=>({...n,color:e.target.value}))} style={{width:48,height:36,padding:2,borderRadius:6,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',cursor:'pointer'}}/>
  </div>
              <button className="btn btn-primary" onClick={addTicketType} style={{marginBottom:0}}><Plus size={14}/> Add</button>
  </div>
            <div style={{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}}>
{PRESET_COLORS.map(c=>(
                  <button key={c} onClick={()=>setNewType(n=>({...n,color:c}))} style={{width:24,height:24,borderRadius:4,background:c,border:newType.color===c?'2px solid white':'2px solid transparent',cursor:'pointer',padding:0}}/>
              ))}
                </div>
                </div>
                </div>
      )}

{tab==='sync'&&(
          <div style={{maxWidth:700}}>
          <h2 style={{fontSize:16,marginBottom:4}}>Shopify Sync Settings</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Choose which fields sync with Shopify and the sync direction for each.</p>

{SYNC_FIELDS.map(section=>(
              <div key={section.section} style={{marginBottom:24}}>
              <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:12,borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:8}}>{section.section}</div>
{section.fields.map(field=>{
                  const dir = DIR_LABELS[field.direction];
                  return (
                                      <div key={field.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(255,255,255,0.03)',borderRadius:8,marginBottom:6}}>
                    <div>
                        <div style={{fontWeight:500,fontSize:14}}>{field.label}</div>
                      <div style={{fontSize:11,opacity:.5,marginTop:2}}>{field.key}</div>
  </div>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <span style={{fontSize:11,padding:'3px 10px',borderRadius:10,background:`${dir.color}22`,color:dir.color,fontWeight:500}}>{dir.label}</span>
                      <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                        <input type="checkbox" defaultChecked style={{width:16,height:16,cursor:'pointer'}}/>
                        <span style={{fontSize:12,opacity:.6}}>Enabled</span>
  </label>
  </div>
  </div>
                );
})}
</div>
          ))}

          <div style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:8,padding:12,fontSize:13}}>
            <Clock size={14} style={{display:'inline',marginRight:6,verticalAlign:'middle'}}/>
            <strong>Note:</strong> Sync runs automatically every 15 minutes when your Shopify connection is active. You can also trigger a manual sync from each module.
            </div>
            </div>
      )}

      <style>{`.form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:600px){.form-grid-2{grid-template-columns:1fr}}`}</style>
        </div>
  );
}

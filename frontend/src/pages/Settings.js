// Settings Page
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, RefreshCw, Shield, Tag, Link, Clock, ShoppingBag, Activity } from 'lucide-react';

const SYNC_FIELDS = [
  { section:'Inventory', fields:[
    { key:'inventory.sku', label:'SKU', direction:'bidirectional' },
    { key:'inventory.name', label:'Product Name', direction:'bidirectional' },
    { key:'inventory.price', label:'Price', direction:'bidirectional' },
    { key:'inventory.quantity', label:'Stock Quantity', direction:'bidirectional' },
    { key:'inventory.description', label:'Description', direction:'to_shopify' },
    { key:'inventory.images', label:'Product Images', direction:'to_shopify' },
    { key:'inventory.tags', label:'Tags', direction:'bidirectional' },
      ]},
  { section:'Orders', fields:[
    { key:'orders.sync', label:'Sync Orders from Shopify', direction:'from_shopify' },
    { key:'orders.status', label:'Order Status Updates', direction:'from_shopify' },
      ]},
  ];

const DIR_LABELS = {
    bidirectional:{ label:'Two-Way Sync', color:'#6366f1' },
    to_shopify:{ label:'Upload to Shopify', color:'#10b981' },
    from_shopify:{ label:'Pull from Shopify', color:'#f59e0b' },
};

const PRESET_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#f97316','#06b6d4','#84cc16','#ec4899'];

const GENERAL_DEFAULTS = { cost_update_mode:'auto', cost_calculation_method:'1', cost_avg_days:'30', cost_avg_type:'cost', archive_sync:'both' };  export default function Settings() {
    const [general, setGeneral] = useState({ cost_update_mode:'auto', cost_calculation_method:'1', cost_avg_days:'30', cost_avg_type:'cost', archive_sync:'both' });   const [savingGeneral, setSavingGeneral] = useState(false);   const [tab, setTab] = useState('shopify');
    const [shopify, setShopify] = useState({ shopify_shop:'', shopify_access_token:'', shopify_client_id:'', shopify_client_secret:'' });
    const [warranty, setWarranty] = useState({ period_days:365, period_label:'1 Year' });
    const [ticketTypes, setTicketTypes] = useState([]);
    const [newTicket, setNewTicket] = useState({ name:'', color:'#6366f1' });
    const [orderStatuses, setOrderStatuses] = useState([]);
    const [newStatus, setNewStatus] = useState({ name:'', color:'#10b981', sort_order:99 });
    const [statusLog, setStatusLog] = useState([]);
    const [logLoading, setLogLoading] = useState(false);
    const [saving, setSaving] = useState(false);

  useEffect(() => {     api.get('/settings/general').then(r => setGeneral(r.data)).catch(() => {});     api.get('/settings/general').then(r => setGeneral(r.data)).catch(()=>{}); fetchAll(); }, []);

  const fetchAll = async () => {
        try {
                const [sRes, wRes, tRes, osRes] = await Promise.all([
                          api.get('/settings/shopify').catch(() => ({ data:{} })),
                          api.get('/settings/warranty').catch(() => ({ data:{ value:{ period_days:365, period_label:'1 Year' } } })),
                          api.get('/settings/ticket-types/all').catch(() => ({ data:[] })),
                          api.get('/settings/order-statuses/all').catch(() => ({ data:[] })),
                        ]);
                if (sRes.data?.shopify_shop) setShopify(sRes.data);
                if (wRes.data?.value) setWarranty(wRes.data.value);
                setTicketTypes(tRes.data || []);
                setOrderStatuses(osRes.data || []);
        } catch(e) {}
  };

  const fetchStatusLog = async () => {
        setLogLoading(true);
        try { const r = await api.get('/settings/status-log/all'); setStatusLog(r.data); }
        catch(e) { toast.error('Failed to load log'); }
        finally { setLogLoading(false); }
  };

  const saveShopify = async () => {
        try { setSaving(true); await api.post('/settings', { key:'shopify', value:shopify }); toast.success('Shopify settings saved'); }
        catch(e) { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const saveWarranty = async () => {
        try { setSaving(true); await api.post('/settings', { key:'warranty', value:warranty }); toast.success('Warranty settings saved'); }
        catch(e) { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const addTicketType = async () => {
        if (!newTicket.name.trim()) return toast.error('Name required');
        try {
                const r = await api.post('/settings/ticket-types', newTicket);
                setTicketTypes(t => [...t, r.data]); setNewTicket({ name:'', color:'#6366f1' }); toast.success('Added');
        } catch(e) { toast.error('Failed'); }
  };

  const deleteTicketType = async (id) => {
        if (!window.confirm('Delete?')) return;
        try { await api.delete(`/settings/ticket-types/${id}`); setTicketTypes(t => t.filter(x => x.id!==id)); }
        catch(e) { toast.error('Failed'); }
  };

  const addOrderStatus = async () => {
        if (!newStatus.name.trim()) return toast.error('Name required');
        try {
                const r = await api.post('/settings/order-statuses', newStatus);
                setOrderStatuses(s => [...s, r.data]); setNewStatus({ name:'', color:'#10b981', sort_order:99 }); toast.success('Added');
        } catch(e) { toast.error('Failed'); }
  };

  const deleteOrderStatus = async (id) => {
        if (!window.confirm('Delete this status?')) return;
        try { await api.delete(`/settings/order-statuses/${id}`); setOrderStatuses(s => s.filter(x => x.id!==id)); }
        catch(e) { toast.error('Failed'); }
  };

  const TABS = [
    { id:'shopify', label:'Shopify', icon:Link },
    { id:'warranty', label:'Warranty', icon:Shield },
    { id:'tickets', label:'Ticket Types', icon:Tag },
    { id:'general', label:'General', icon:Tag },       { id:'general', label:'General', icon:ShoppingBag },     { id:'general', label:'General', icon:ShoppingBag },     { id:'order-statuses', label:'Order Statuses', icon:ShoppingBag },
    { id:'status-log', label:'Status Log', icon:Activity },
    { id:'sync', label:'Sync', icon:RefreshCw },
      ];

  return (
        <div className="page-container">
          <div className="page-header">
            <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Configure your StockCentral workspace</p></div>
    </div>

      <div style={{display:'flex',gap:2,marginBottom:24,borderBottom:'1px solid rgba(255,255,255,0.1)',flexWrap:'wrap'}}>
{TABS.map(({ id, label, icon:Icon }) => (
            <button key={id} onClick={() => { setTab(id); if(id==='status-log') fetchStatusLog(); }}
            style={{padding:'10px 16px',background:'none',border:'none',cursor:'pointer',borderBottom:tab===id?'2px solid #6366f1':'2px solid transparent',color:tab===id?'#6366f1':'inherit',display:'flex',alignItems:'center',gap:6,fontSize:13,fontWeight:tab===id?600:400,whiteSpace:'nowrap'}}>
            <Icon size={14}/>{label}
              </button>
        ))}
          </div>

{tab==='general'&&(         <div className="settings-section">           <h2 className="settings-section-title">General Settings</h2>           <div className="settings-group">             <label className="settings-label">Cost Update Mode</label>             <select value={general.cost_update_mode} onChange={e=>setGeneral(g=>({...g,cost_update_mode:e.target.value}))} className="settings-input">               <option value="auto">Auto — update cost when PO items are received</option>               <option value="manual">Manual — update cost manually</option>             </select>           </div>           <div className="settings-group">             <label className="settings-label">Cost Calculation Method</label>             <select value={general.cost_calculation_method} onChange={e=>setGeneral(g=>({...g,cost_calculation_method:e.target.value}))} className="settings-input">               <option value="1">Most recent received PO cost</option>               <option value="2">Most recent received PO cost + shipping (landed cost)</option>               <option value="3">Average cost over time</option>             </select>           </div>           {general.cost_calculation_method==='3'&&<React.Fragment>            <div className="settings-group">               <label className="settings-label">Average Cost Period</label>               <select value={general.cost_avg_days} onChange={e=>setGeneral(g=>({...g,cost_avg_days:e.target.value}))} className="settings-input">                 <option value="30">30 days</option>                 <option value="60">60 days</option>                 <option value="90">90 days</option>               </select>             </div>             <div className="settings-group">               <label className="settings-label">Average Cost Type</label>               <select value={general.cost_avg_type} onChange={e=>setGeneral(g=>({...g,cost_avg_type:e.target.value}))} className="settings-input">                 <option value="cost">Average cost only</option>                 <option value="landed">Average landed cost (includes shipping)</option>               </select>             </div></React.Fragment>}<div className="settings-group">             <label className="settings-label">Archive Sync with Shopify</label>             <select value={general.archive_sync} onChange={e=>setGeneral(g=>({...g,archive_sync:e.target.value}))} className="settings-input">               <option value="both">Two-way — archive in StockCentral also archives in Shopify</option>               <option value="one-way">One-way — only archive in StockCentral</option>               <option value="none">No sync — never archive in Shopify</option>             </select>           </div>           <button className="btn btn-primary" disabled={savingGeneral} onClick={async()=>{setSavingGeneral(true);try{await api.put('/settings/general',general);toast.success('General settings saved');}catch(e){toast.error('Failed to save');}finally{setSavingGeneral(false);}}}>{savingGeneral?'Saving...':'Save General Settings'}</button>         </div>       )}       {tab==='general'&&(<div className="settings-section"><h2 className="settings-section-title">General Settings</h2><div className="settings-group"><label className="settings-label">Cost Update Mode</label><select value={general.cost_update_mode} onChange={e=>setGeneral(g=>({...g,cost_update_mode:e.target.value}))} className="settings-input"><option value="auto">Auto — update on PO receive</option><option value="manual">Manual only</option></select></div><div className="settings-group"><label className="settings-label">Cost Calculation Method</label><select value={general.cost_calculation_method} onChange={e=>setGeneral(g=>({...g,cost_calculation_method:e.target.value}))} className="settings-input"><option value="1">Most recent PO cost</option><option value="2">Most recent PO cost + shipping (landed)</option><option value="3">Average cost over time</option></select></div>{general.cost_calculation_method==='3'&&<React.Fragment><div className="settings-group"><label className="settings-label">Average Period</label><select value={general.cost_avg_days} onChange={e=>setGeneral(g=>({...g,cost_avg_days:e.target.value}))} className="settings-input"><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></div><div className="settings-group"><label className="settings-label">Average Type</label><select value={general.cost_avg_type} onChange={e=>setGeneral(g=>({...g,cost_avg_type:e.target.value}))} className="settings-input"><option value="cost">Average cost</option><option value="landed">Average landed cost</option></select></div></React.Fragment>}<div className="settings-group"><label className="settings-label">Archive Sync</label><select value={general.archive_sync} onChange={e=>setGeneral(g=>({...g,archive_sync:e.target.value}))} className="settings-input"><option value="both">Two-way sync with Shopify</option><option value="one-way">One-way — StockCentral only</option><option value="none">No sync</option></select></div><button className="btn btn-primary" disabled={savingGeneral} onClick={async()=>{setSavingGeneral(true);try{await api.put('/settings/general',general);toast.success('Saved!');}catch(e){toast.error('Failed');}finally{setSavingGeneral(false);}}}>{savingGeneral?'Saving...':'Save General Settings'}</button></div>)}       {tab==='shopify'&&(
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
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Default warranty shown in RMA and ticket views alongside purchase date and days remaining.</p>
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
            <strong>How it works:</strong> When a ticket or RMA is linked to a Shopify order, the system displays purchase date and calculates days remaining in warranty.
  </div>
          <button className="btn btn-primary" onClick={saveWarranty} disabled={saving}><Save size={14}/> {saving?'Saving...':'Save Warranty Settings'}</button>
  </div>
      )}

{tab==='tickets'&&(
          <div style={{maxWidth:600}}>
          <h2 style={{fontSize:16,marginBottom:4}}>Ticket Types</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Color-coded types for quick visual reference in your support dashboard.</p>
          <div style={{marginBottom:24}}>
{ticketTypes.map(t=>(
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'rgba(255,255,255,0.04)',borderRadius:8,marginBottom:6}}>
                <div style={{width:14,height:14,borderRadius:3,background:t.color,flexShrink:0}}/>
                <span style={{flex:1,fontWeight:500}}>{t.name}</span>
                <span style={{fontSize:11,opacity:.4,fontFamily:'monospace'}}>{t.color}</span>
                <button onClick={()=>deleteTicketType(t.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',opacity:.5,padding:4}}><Trash2 size={13}/></button>
  </div>
            ))}
{ticketTypes.length===0&&<p style={{opacity:.5,textAlign:'center',padding:20}}>No ticket types yet.</p>}
  </div>
          <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:16}}>
            <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Add New Type</div>
            <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
              <div className="form-group" style={{flex:1,margin:0}}>
                <label className="form-label">Name</label>
                <input value={newTicket.name} onChange={e=>setNewTicket(n=>({...n,name:e.target.value}))} className="form-input" placeholder="e.g. Tech Support"/>
  </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Color</label>
                <input type="color" value={newTicket.color} onChange={e=>setNewTicket(n=>({...n,color:e.target.value}))} style={{width:44,height:36,padding:2,borderRadius:6,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',cursor:'pointer'}}/>
  </div>
              <button className="btn btn-primary" onClick={addTicketType}><Plus size={14}/> Add</button>
  </div>
            <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
{PRESET_COLORS.map(c=>(
                  <button key={c} onClick={()=>setNewTicket(n=>({...n,color:c}))} style={{width:22,height:22,borderRadius:4,background:c,border:newTicket.color===c?'2px solid white':'2px solid transparent',cursor:'pointer',padding:0}}/>
              ))}
                </div>
                </div>
                </div>
      )}

{tab==='order-statuses'&&(
          <div style={{maxWidth:640}}>
          <h2 style={{fontSize:16,marginBottom:4}}>General</button><button onClick={()=>setTab('order-statuses')} className={`settings-tab${tab==='order-statuses'?' active':''}`}>Order Statuses</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Customize order workflow statuses. These appear as the clickable status button on each order. The <strong>Paid</strong> status is the default when orders arrive from Shopify.</p>
            <div style={{marginBottom:24}}>
{orderStatuses.map((s,idx)=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'rgba(255,255,255,0.04)',borderRadius:8,marginBottom:6}}>
                <div style={{width:14,height:14,borderRadius:3,background:s.color,flexShrink:0}}/>
                <span style={{flex:1,fontWeight:500}}>{s.name}</span>
{s.is_default&&<span style={{fontSize:10,padding:'2px 6px',borderRadius:8,background:'rgba(16,185,129,0.2)',color:'#10b981',fontWeight:600}}>DEFAULT</span>}
                <span style={{fontSize:11,opacity:.4,fontFamily:'monospace'}}>{s.color}</span>
                <span style={{fontSize:11,opacity:.4}}>#{s.sort_order}</span>
{!s.is_default&&<button onClick={()=>deleteOrderStatus(s.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',opacity:.5,padding:4}}><Trash2 size={13}/></button>}
  </div>
            ))}
{orderStatuses.length===0&&<p style={{opacity:.5,textAlign:'center',padding:20}}>No statuses found.</p>}
  </div>
          <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:16}}>
            <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Add New Status</div>
            <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
              <div className="form-group" style={{flex:1,margin:0}}>
                <label className="form-label">Status Name</label>
                <input value={newStatus.name} onChange={e=>setNewStatus(n=>({...n,name:e.target.value}))} className="form-input" placeholder="e.g. QC Review, Packed"/>
  </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Color</label>
                <input type="color" value={newStatus.color} onChange={e=>setNewStatus(n=>({...n,color:e.target.value}))} style={{width:44,height:36,padding:2,borderRadius:6,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',cursor:'pointer'}}/>
  </div>
              <div className="form-group" style={{width:70,margin:0}}>
                <label className="form-label">Order</label>
                <input type="number" value={newStatus.sort_order} onChange={e=>setNewStatus(n=>({...n,sort_order:parseInt(e.target.value)||99}))} className="form-input" min="1"/>
  </div>
              <button className="btn btn-primary" onClick={addOrderStatus}><Plus size={14}/> Add</button>
  </div>
            <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
{PRESET_COLORS.map(c=>(
                  <button key={c} onClick={()=>setNewStatus(n=>({...n,color:c}))} style={{width:22,height:22,borderRadius:4,background:c,border:newStatus.color===c?'2px solid white':'2px solid transparent',cursor:'pointer',padding:0}}/>
              ))}
                </div>
                </div>
                </div>
      )}

{tab==='status-log'&&(
          <div style={{maxWidth:900}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div>
                <h2 style={{fontSize:16,marginBottom:2}}>Order Status Log</h2>
              <p style={{opacity:.6,fontSize:13,margin:0}}>Every status change is recorded here with timestamp and user name.</p>
  </div>
            <button className="btn btn-secondary" onClick={fetchStatusLog} style={{fontSize:12}}><RefreshCw size={13}/> Refresh</button>
  </div>
{logLoading ? <div style={{textAlign:'center',padding:32,opacity:.5}}>Loading...</div> : (
            <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Time</th><th>Order</th><th>From</th><th>To</th><th>Changed By</th></tr></thead>
                <tbody>
{statusLog.map(l=>(
                      <tr key={l.id}>
                        <td style={{fontSize:12,opacity:.7}}>{new Date(l.created_at).toLocaleString()}</td>
                      <td style={{fontSize:12}}><code>{l.shopify_order_id}</code></td>
                        <td><span style={{opacity:.5,fontSize:12}}>{l.old_status||'—'}</span></td>
                        <td><span style={{fontWeight:600,fontSize:12,color:'#6366f1'}}>{l.new_status||'—'}</span></td>
                        <td style={{fontSize:12}}>{l.changed_by_name||'System'}</td>
  </tr>
                  ))}
{statusLog.length===0&&<tr><td colSpan={5} style={{textAlign:'center',padding:32,opacity:.5}}>No status changes recorded yet.</td></tr>}
  </tbody>
  </table>
  </div>
          )}
</div>
      )}

{tab==='sync'&&(
          <div style={{maxWidth:700}}>
          <h2 style={{fontSize:16,marginBottom:4}}>Shopify Sync Settings</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Choose which fields sync with Shopify and the direction.</p>
{SYNC_FIELDS.map(section=>(
              <div key={section.section} style={{marginBottom:24}}>
              <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:10,borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:6}}>{section.section}</div>
{section.fields.map(field=>{
                  const dir = DIR_LABELS[field.direction];
                  return (
                                      <div key={field.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(255,255,255,0.03)',borderRadius:8,marginBottom:6}}>
                    <div>
                        <div style={{fontWeight:500,fontSize:14}}>{field.label}</div>
                      <div style={{fontSize:11,opacity:.4,marginTop:2}}>{field.key}</div>
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
            <strong>Note:</strong> Sync runs every 15 minutes when your Shopify connection is active. Manual sync can also be triggered from each module.
            </div>
            </div>
      )}

      <style>{`.form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:600px){.form-grid-2{grid-template-columns:1fr}}`}</style>
        </div>
  );
}
 

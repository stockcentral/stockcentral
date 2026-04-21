// Settings Page
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, RefreshCw, Shield, Tag, Link, Clock, ShoppingBag, Activity, RotateCcw } from 'lucide-react';

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

export default function Settings() {
  const [general, setGeneral] = useState({ cost_update_mode:'auto', cost_calculation_method:'1', cost_avg_days:'30', cost_avg_type:'cost', archive_sync:'both', shopify_push_mode:'manual', ticket_email:'', rma_status_colors:'{}' });
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [tab, setTab] = useState('shopify');
  const [shopify, setShopify] = useState({ shopify_shop:'', shopify_access_token:'', shopify_client_id:'', shopify_client_secret:'' });
  const [warranty, setWarranty] = useState({ period_days:365, period_label:'1 Year' });
  const [ticketTypes, setTicketTypes] = useState([]);
  const [newTicket, setNewTicket] = useState({ name:'', color:'#6366f1' });
  const [orderStatuses, setOrderStatuses] = useState([]);
  const [newStatus, setNewStatus] = useState({ name:'', color:'#10b981', sort_order:99 });
  const [rmaStatuses, setRmaStatuses] = useState([]);
  const [newRmaStatus, setNewRmaStatus] = useState({ name:'', color:'#6366f1', sort_order:99 });
  const [editingRmaStatus, setEditingRmaStatus] = useState(null);
  const [editRmaForm, setEditRmaForm] = useState({});
  const [statusLog, setStatusLog] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings/general').then(r => setGeneral(g => ({...g, ...r.data}))).catch(()=>{});
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [sRes, wRes, tRes, osRes, rmaRes] = await Promise.all([
        api.get('/settings/shopify').catch(() => ({ data:{} })),
        api.get('/settings/warranty').catch(() => ({ data:{ value:{ period_days:365, period_label:'1 Year' } } })),
        api.get('/settings/ticket-types/all').catch(() => ({ data:[] })),
        api.get('/settings/order-statuses/all').catch(() => ({ data:[] })),
        api.get('/settings/rma-statuses/all').catch(() => ({ data:[] })),
      ]);
      if (sRes.data?.shopify_shop) setShopify(sRes.data);
      if (wRes.data?.value) setWarranty(wRes.data.value);
      setTicketTypes(tRes.data || []);
      setOrderStatuses(osRes.data || []);
      setRmaStatuses(rmaRes.data || []);
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

  const reorderList = async (list, setList, dragId, overId, endpoint) => {
    const items = [...list];
    const fromIdx = items.findIndex(x => x.id === dragId);
    const toIdx = items.findIndex(x => x.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    // Update sort_order
    const updated = items.map((item, idx) => ({...item, sort_order: idx + 1}));
    setList(updated);
    setDraggingId(null); setDragOverId(null);
    try {
      await Promise.all(updated.map(item => api.put(`${endpoint}/${item.id}`, item)));
    } catch(e) { toast.error('Failed to save order'); }
  };

  const TABS = [
    { id:'shopify', label:'Shopify', icon:Link },
    { id:'general', label:'General', icon:ShoppingBag },
    { id:'order-statuses', label:'Order Statuses', icon:ShoppingBag },
    { id:'rma', label:'RMA', icon:RotateCcw },
    { id:'tickets', label:'Ticket Types', icon:Tag },
    { id:'warranty', label:'Warranty', icon:Shield },
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

      {tab==='general'&&(
        <div style={{maxWidth:580}}>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>General Settings</h2>
          <p style={{opacity:.5,fontSize:13,marginBottom:32}}>Configure cost calculation and Shopify sync behavior.</p>

          {/* Shopify Push Mode — NEW */}
          <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Shopify Product Update Mode</label>
            <p style={{fontSize:12,opacity:.5,marginBottom:10}}>Should product changes in StockCentral automatically push to Shopify, or would you prefer to push manually?</p>
            <select value={general.shopify_push_mode||'manual'} onChange={e=>setGeneral(g=>({...g,shopify_push_mode:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14}}>
              <option value="manual">Manual — push to Shopify using the button in the product screen</option>
              <option value="auto">Automatic — push to Shopify every time a product is saved</option>
            </select>
            {general.shopify_push_mode==='auto' && (
              <div style={{marginTop:10,padding:'8px 12px',background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:6,fontSize:12,color:'#10b981'}}>
                ✓ The "Push to Shopify" button will be hidden from the product screen. Changes save automatically.
              </div>
            )}
            {(general.shopify_push_mode==='manual'||!general.shopify_push_mode) && (
              <div style={{marginTop:10,padding:'8px 12px',background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.2)',borderRadius:6,fontSize:12,color:'#6366f1'}}>
                ✓ The "Push to Shopify" button will appear at the top of each product page.
              </div>
            )}
          </div>

          <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Cost Update Mode</label>
            <p style={{fontSize:12,opacity:.5,marginBottom:10}}>Should StockCentral update product cost automatically when purchase orders are received?</p>
            <select value={general.cost_update_mode} onChange={e=>setGeneral(g=>({...g,cost_update_mode:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14}}>
              <option value="auto">Auto — update cost when PO items are received</option>
              <option value="manual">Manual — update cost manually only</option>
            </select>
          </div>

          <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Cost Calculation Method</label>
            <p style={{fontSize:12,opacity:.5,marginBottom:10}}>How should StockCentral calculate the cost of each item?</p>
            <select value={general.cost_calculation_method} onChange={e=>setGeneral(g=>({...g,cost_calculation_method:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14}}>
              <option value="1">Most recent received PO cost</option>
              <option value="2">Most recent received PO cost + shipping (landed cost)</option>
              <option value="3">Average cost over time</option>
            </select>
          </div>

          {general.cost_calculation_method==='3'&&<React.Fragment>
            <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
              <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Average Cost Period</label>
              <p style={{fontSize:12,opacity:.5,marginBottom:10}}>How many days of purchase order data should be used to calculate the average?</p>
              <select value={general.cost_avg_days} onChange={e=>setGeneral(g=>({...g,cost_avg_days:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14}}>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
            <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
              <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Average Cost Type</label>
              <p style={{fontSize:12,opacity:.5,marginBottom:10}}>Should the average include shipping costs (landed cost)?</p>
              <select value={general.cost_avg_type} onChange={e=>setGeneral(g=>({...g,cost_avg_type:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14}}>
                <option value="cost">Average cost only</option>
                <option value="landed">Average landed cost (includes shipping)</option>
              </select>
            </div>
          </React.Fragment>}

          <div style={{marginBottom:32,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Archive Sync with Shopify</label>
            <p style={{fontSize:12,opacity:.5,marginBottom:10}}>When you archive an item in StockCentral, should it also be archived in Shopify?</p>
            <select value={general.archive_sync} onChange={e=>setGeneral(g=>({...g,archive_sync:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14}}>
              <option value="both">Two-way — archive in StockCentral also archives in Shopify</option>
              <option value="one-way">One-way — only archive in StockCentral</option>
              <option value="none">No sync — never archive in Shopify</option>
            </select>
          </div>

          {/* Ticket Email */}
          <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Support Ticket Email</label>
            <p style={{fontSize:12,opacity:.5,marginBottom:10}}>The email address customers use to submit support tickets. Set up an inbound email forwarder to: <code style={{background:'rgba(255,255,255,.08)',padding:'2px 6px',borderRadius:4}}>https://stockcentral-production.up.railway.app/api/tickets/inbound/shopify</code></p>
            <input value={general.ticket_email||''} onChange={e=>setGeneral(g=>({...g,ticket_email:e.target.value}))} placeholder="support@yourdomain.com" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14,boxSizing:'border-box'}}/>
          </div>

          <button className="btn btn-primary" style={{padding:'12px 28px',fontSize:15}} disabled={savingGeneral} onClick={async()=>{setSavingGeneral(true);try{await api.put('/settings/general',general);toast.success('General settings saved');}catch(e){toast.error('Failed to save');}finally{setSavingGeneral(false);}}}>
            {savingGeneral?'Saving...':'Save General Settings'}
          </button>
        </div>
      )}

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
          <h2 style={{fontSize:16,marginBottom:4}}>Order Statuses</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Customize order workflow statuses. These appear as the clickable status button on each order. The <strong>Paid</strong> status is the default when orders arrive from Shopify.</p>
          <div style={{marginBottom:24}}>
            {orderStatuses.map((s,idx)=>(
              <div key={s.id}
                draggable
                onDragStart={()=>setDraggingId(s.id)}
                onDragOver={e=>{e.preventDefault();setDragOverId(s.id);}}
                onDrop={()=>reorderList(orderStatuses,setOrderStatuses,draggingId,s.id,'/settings/order-statuses')}
                onDragEnd={()=>{setDraggingId(null);setDragOverId(null);}}
                style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:dragOverId===s.id?'rgba(99,102,241,.1)':'rgba(255,255,255,0.04)',borderRadius:8,marginBottom:6,cursor:'grab',border:`1px solid ${dragOverId===s.id?'rgba(99,102,241,.4)':'transparent'}`,transition:'all .15s'}}>
                <div style={{opacity:.3,cursor:'grab',padding:'0 2px',display:'flex',flexDirection:'column',gap:2}}>
                  {[0,1,2].map(i=><div key={i} style={{width:14,height:2,background:'currentColor',borderRadius:1}}/>)}
                </div>
                <div style={{width:14,height:14,borderRadius:3,background:s.color,flexShrink:0}}/>
                <span style={{flex:1,fontWeight:500}}>{s.name}</span>
                {s.is_default&&<span style={{fontSize:10,padding:'2px 6px',borderRadius:8,background:'rgba(16,185,129,0.2)',color:'#10b981',fontWeight:600}}>DEFAULT</span>}
                <span style={{fontSize:11,opacity:.4,fontFamily:'monospace'}}>{s.color}</span>
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

      {tab==='rma'&&(
        <div style={{maxWidth:600}}>
          <h2 style={{fontSize:16,marginBottom:4}}>RMA Statuses</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Create, edit and color-code RMA statuses. These appear as badges on the RMA list and can be used to filter RMAs.</p>

          {/* Existing statuses */}
          <div style={{marginBottom:24}}>
            {rmaStatuses.map(s=>(
              <div key={s.id}
                draggable={editingRmaStatus!==s.id}
                onDragStart={()=>setDraggingId(s.id)}
                onDragOver={e=>{e.preventDefault();setDragOverId(s.id);}}
                onDrop={()=>reorderList(rmaStatuses,setRmaStatuses,draggingId,s.id,'/settings/rma-statuses')}
                onDragEnd={()=>{setDraggingId(null);setDragOverId(null);}}
                style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:dragOverId===s.id?'rgba(99,102,241,.1)':'rgba(255,255,255,0.04)',borderRadius:8,marginBottom:6,border:`1px solid ${dragOverId===s.id?'rgba(99,102,241,.4)':'transparent'}`,transition:'all .15s'}}>
                {editingRmaStatus===s.id ? (
                  <>
                    <input type="color" value={editRmaForm.color||s.color} onChange={e=>setEditRmaForm(f=>({...f,color:e.target.value}))} style={{width:36,height:36,padding:2,borderRadius:6,border:'1px solid rgba(255,255,255,.2)',background:'transparent',cursor:'pointer',flexShrink:0}}/>
                    <input value={editRmaForm.name||''} onChange={e=>setEditRmaForm(f=>({...f,name:e.target.value}))} className="form-input" style={{flex:1,padding:'6px 10px',fontSize:13}}/>
                    <button onClick={async()=>{ try{ await api.put(`/settings/rma-statuses/${s.id}`,editRmaForm); setEditingRmaStatus(null); fetchAll(); toast.success('Updated'); }catch(e){toast.error('Failed');}}} className="btn btn-primary" style={{fontSize:12,padding:'4px 10px'}}>Save</button>
                    <button onClick={()=>setEditingRmaStatus(null)} className="btn btn-ghost" style={{fontSize:12,padding:'4px 10px'}}>Cancel</button>
                  </>
                ) : (
                  <>
                    <div style={{opacity:.3,cursor:'grab',padding:'0 2px',display:'flex',flexDirection:'column',gap:2}}>
                      {[0,1,2].map(i=><div key={i} style={{width:14,height:2,background:'currentColor',borderRadius:1}}/>)}
                    </div>
                    <div style={{width:14,height:14,borderRadius:3,background:s.color,flexShrink:0}}/>
                    <span style={{flex:1,fontWeight:500}}>{s.name}</span>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:`${s.color}22`,color:s.color,fontWeight:600}}>{s.name}</span>
                    <button onClick={()=>{setEditingRmaStatus(s.id);setEditRmaForm({name:s.name,color:s.color,sort_order:s.sort_order});}} style={{background:'none',border:'none',cursor:'pointer',opacity:.5,padding:4,color:'inherit',fontSize:11}}>Edit</button>
                    <button onClick={async()=>{ if(!window.confirm('Delete this status?'))return; try{ await api.delete(`/settings/rma-statuses/${s.id}`); fetchAll(); toast.success('Deleted'); }catch(e){toast.error('Failed');}}} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',opacity:.5,padding:4}}><Trash2 size={13}/></button>
                  </>
                )}
              </div>
            ))}
            {rmaStatuses.length===0&&<p style={{opacity:.5,textAlign:'center',padding:20}}>No statuses yet.</p>}
          </div>

          {/* Add new */}
          <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:16}}>
            <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Add New Status</div>
            <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
              <div className="form-group" style={{flex:1,margin:0}}>
                <label className="form-label">Name</label>
                <input value={newRmaStatus.name} onChange={e=>setNewRmaStatus(n=>({...n,name:e.target.value}))} className="form-input" placeholder="e.g. On Hold"/>
              </div>
              <div className="form-group" style={{margin:0}}>
                <label className="form-label">Color</label>
                <input type="color" value={newRmaStatus.color} onChange={e=>setNewRmaStatus(n=>({...n,color:e.target.value}))} style={{width:44,height:36,padding:2,borderRadius:6,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',cursor:'pointer'}}/>
              </div>
              <button className="btn btn-primary" onClick={async()=>{
                if(!newRmaStatus.name.trim())return toast.error('Name required');
                try{ const r=await api.post('/settings/rma-statuses',newRmaStatus); setRmaStatuses(s=>[...s,r.data]); setNewRmaStatus({name:'',color:'#6366f1',sort_order:99}); toast.success('Added'); }
                catch(e){toast.error(e.response?.data?.error||'Failed');}
              }}><Plus size={14}/> Add</button>
            </div>
            <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
              {PRESET_COLORS.map(c=>(
                <button key={c} onClick={()=>setNewRmaStatus(n=>({...n,color:c}))} style={{width:22,height:22,borderRadius:4,background:c,border:newRmaStatus.color===c?'2px solid white':'2px solid transparent',cursor:'pointer',padding:0}}/>
              ))}
            </div>
          </div>
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

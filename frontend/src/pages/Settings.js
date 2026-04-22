// Settings Page
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Save, RefreshCw, Shield, Tag, Link, Clock, ShoppingBag, Activity, RotateCcw, Mail } from 'lucide-react';

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
  const [general, setGeneral] = useState({ cost_update_mode:'auto', cost_calculation_method:'1', cost_avg_days:'30', cost_avg_type:'cost', archive_sync:'both', shopify_push_mode:'manual', ticket_email:'', rma_status_colors:'{}', bom_qty_mode:'whole' });
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState({ company_name:'', company_email:'', company_phone:'', company_address:'', logo_url:'', quote_intro:'', quote_footer:'', po_intro:'', po_footer:'', show_sku:true, show_name:true, show_vendor_sku:true, show_quantity:true, show_unit_cost:true, show_barcode:false, show_net_terms:false, show_notes:false, po_show_sku:true, po_show_name:true, po_show_vendor_sku:true, po_show_quantity:true, po_show_unit_cost:true, po_show_barcode:false, po_show_net_terms:false, po_show_notes:false });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewType, setPreviewType] = useState('quote');
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
      const [sRes, wRes, tRes, osRes, rmaRes, etRes] = await Promise.all([
        api.get('/settings/shopify').catch(() => ({ data:{} })),
        api.get('/settings/warranty').catch(() => ({ data:{ value:{ period_days:365, period_label:'1 Year' } } })),
        api.get('/settings/ticket-types/all').catch(() => ({ data:[] })),
        api.get('/settings/order-statuses/all').catch(() => ({ data:[] })),
        api.get('/settings/rma-statuses/all').catch(() => ({ data:[] })),
        api.get('/settings/email-template').catch(() => ({ data:{} })),
      ]);
      if (sRes.data?.shopify_shop) setShopify(sRes.data);
      if (wRes.data?.value) setWarranty(wRes.data.value);
      setTicketTypes(tRes.data || []);
      setOrderStatuses(osRes.data || []);
      setRmaStatuses(rmaRes.data || []);
      if (etRes.data?.value) setEmailTemplate(et => ({...et, ...etRes.data.value}));
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
    { id:'email-templates', label:'Email Templates', icon:Mail },
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

          <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Shopify Product Update Mode</label>
            <p style={{fontSize:12,opacity:.5,marginBottom:10}}>Should product changes in StockCentral automatically push to Shopify, or would you prefer to push manually?</p>
            <select value={general.shopify_push_mode||'manual'} onChange={e=>setGeneral(g=>({...g,shopify_push_mode:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14}}>
              <option value="manual">Manual — push to Shopify using the button in the product screen</option>
              <option value="auto">Automatic — push to Shopify every time a product is saved</option>
            </select>
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

          <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Support Ticket Email</label>
            <p style={{fontSize:12,opacity:.5,marginBottom:10}}>The email address customers use to submit support tickets. Set up an inbound email forwarder to: <code style={{background:'rgba(255,255,255,.08)',padding:'2px 6px',borderRadius:4}}>https://stockcentral-production.up.railway.app/api/tickets/inbound/shopify</code></p>
            <input value={general.ticket_email||''} onChange={e=>setGeneral(g=>({...g,ticket_email:e.target.value}))} placeholder="support@yourdomain.com" style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14,boxSizing:'border-box'}}/>
          </div>

          <div style={{marginBottom:24,padding:'20px 24px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
            <label style={{display:'block',fontSize:14,fontWeight:600,marginBottom:6}}>Bill of Materials — Quantity Mode</label>
            <p style={{fontSize:12,opacity:.5,marginBottom:10}}>Should component quantities in the Bill of Materials support whole numbers only, or allow decimal quantities (e.g. 0.5 meters of wire)?</p>
            <select value={general.bom_qty_mode||'whole'} onChange={e=>setGeneral(g=>({...g,bom_qty_mode:e.target.value}))} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.06)',color:'inherit',fontSize:14}}>
              <option value="whole">Whole numbers only (e.g. 1, 2, 5)</option>
              <option value="decimal">Decimal quantities allowed (e.g. 0.5, 1.25, 2.75)</option>
            </select>
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
          <button className="btn btn-primary" onClick={saveWarranty} disabled={saving}><Save size={14}/> {saving?'Saving...':'Save Warranty Settings'}</button>
        </div>
      )}

      {tab==='tickets'&&(
        <div style={{maxWidth:600}}>
          <h2 style={{fontSize:16,marginBottom:4}}>Ticket Types</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Color-coded types for quick visual reference in your support dashboard.</p>
          <div style={{marginBottom:24}}>
            {ticketTypes.map(t=>(
              <div key={t.id} draggable onDragStart={()=>setDraggingId(t.id)} onDragOver={e=>{e.preventDefault();setDragOverId(t.id);}} onDrop={()=>reorderList(ticketTypes,setTicketTypes,draggingId,t.id,'/settings/ticket-types')} onDragEnd={()=>{setDraggingId(null);setDragOverId(null);}}
                style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:dragOverId===t.id?'rgba(99,102,241,.1)':'rgba(255,255,255,0.04)',borderRadius:8,marginBottom:6,cursor:'grab',border:`1px solid ${dragOverId===t.id?'rgba(99,102,241,.4)':'transparent'}`,transition:'all .15s'}}>
                <div style={{opacity:.3,cursor:'grab',padding:'0 2px',display:'flex',flexDirection:'column',gap:2}}>{[0,1,2].map(i=><div key={i} style={{width:14,height:2,background:'currentColor',borderRadius:1}}/>)}</div>
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
              {PRESET_COLORS.map(c=>(<button key={c} onClick={()=>setNewTicket(n=>({...n,color:c}))} style={{width:22,height:22,borderRadius:4,background:c,border:newTicket.color===c?'2px solid white':'2px solid transparent',cursor:'pointer',padding:0}}/>))}
            </div>
          </div>
        </div>
      )}

      {tab==='order-statuses'&&(
        <div style={{maxWidth:640}}>
          <h2 style={{fontSize:16,marginBottom:4}}>Order Statuses</h2>
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Customize order workflow statuses. The <strong>Paid</strong> status is the default when orders arrive from Shopify.</p>
          <div style={{marginBottom:24}}>
            {orderStatuses.map((s,idx)=>(
              <div key={s.id} draggable onDragStart={()=>setDraggingId(s.id)} onDragOver={e=>{e.preventDefault();setDragOverId(s.id);}} onDrop={()=>reorderList(orderStatuses,setOrderStatuses,draggingId,s.id,'/settings/order-statuses')} onDragEnd={()=>{setDraggingId(null);setDragOverId(null);}}
                style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:dragOverId===s.id?'rgba(99,102,241,.1)':'rgba(255,255,255,0.04)',borderRadius:8,marginBottom:6,cursor:'grab',border:`1px solid ${dragOverId===s.id?'rgba(99,102,241,.4)':'transparent'}`,transition:'all .15s'}}>
                <div style={{opacity:.3,cursor:'grab',padding:'0 2px',display:'flex',flexDirection:'column',gap:2}}>{[0,1,2].map(i=><div key={i} style={{width:14,height:2,background:'currentColor',borderRadius:1}}/>)}</div>
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
              {PRESET_COLORS.map(c=>(<button key={c} onClick={()=>setNewStatus(n=>({...n,color:c}))} style={{width:22,height:22,borderRadius:4,background:c,border:newStatus.color===c?'2px solid white':'2px solid transparent',cursor:'pointer',padding:0}}/>))}
            </div>
          </div>
        </div>
      )}

      {tab==='status-log'&&(
        <div style={{maxWidth:900}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div><h2 style={{fontSize:16,marginBottom:2}}>Order Status Log</h2><p style={{opacity:.6,fontSize:13,margin:0}}>Every status change is recorded here.</p></div>
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
          <p style={{opacity:.6,fontSize:13,marginBottom:20}}>Create, edit and color-code RMA statuses.</p>
          <div style={{marginBottom:24}}>
            {rmaStatuses.map(s=>(
              <div key={s.id} draggable={editingRmaStatus!==s.id} onDragStart={()=>setDraggingId(s.id)} onDragOver={e=>{e.preventDefault();setDragOverId(s.id);}} onDrop={()=>reorderList(rmaStatuses,setRmaStatuses,draggingId,s.id,'/settings/rma-statuses')} onDragEnd={()=>{setDraggingId(null);setDragOverId(null);}}
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
                    <div style={{opacity:.3,cursor:'grab',padding:'0 2px',display:'flex',flexDirection:'column',gap:2}}>{[0,1,2].map(i=><div key={i} style={{width:14,height:2,background:'currentColor',borderRadius:1}}/>)}</div>
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
              {PRESET_COLORS.map(c=>(<button key={c} onClick={()=>setNewRmaStatus(n=>({...n,color:c}))} style={{width:22,height:22,borderRadius:4,background:c,border:newRmaStatus.color===c?'2px solid white':'2px solid transparent',cursor:'pointer',padding:0}}/>))}
            </div>
          </div>
        </div>
      )}

      {tab==='email-templates'&&(
        <div style={{maxWidth:860}}>
          <h2 style={{fontSize:22,fontWeight:700,marginBottom:8}}>Email Templates</h2>
          <p style={{opacity:.5,fontSize:13,marginBottom:24}}>Configure your company info and email templates for quotes and purchase orders sent to vendors.</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
            <div>
              <div style={{marginBottom:20,padding:'18px 20px',background:'rgba(255,255,255,.04)',borderRadius:12,border:'1px solid rgba(255,255,255,.08)'}}>
                <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:14}}>Company Information</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  {[['company_name','Company Name'],['company_email','Company Email'],['company_phone','Phone'],['company_address','Address']].map(([key,label])=>(
                    <div key={key} className="form-group" style={{margin:0}}>
                      <label className="form-label">{label}</label>
                      <input value={emailTemplate[key]||''} onChange={e=>setEmailTemplate(t=>({...t,[key]:e.target.value}))} className="form-input" placeholder={label}/>
                    </div>
                  ))}
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label">Company Logo</label>
                  <input value={emailTemplate.logo_url||''} onChange={e=>setEmailTemplate(t=>({...t,logo_url:e.target.value}))} className="form-input" placeholder="https://yoursite.com/logo.png or upload below" style={{marginBottom:8}}/>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <label style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:7,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.05)',cursor:'pointer',fontSize:12,fontWeight:500}}>
                      📁 Upload JPG/PNG
                      <input type="file" accept="image/jpeg,image/png" style={{display:'none'}} onChange={async e=>{
                        const file = e.target.files[0]; if (!file) return;
                        if (file.size > 2*1024*1024) return toast.error('File must be under 2MB');
                        const reader = new FileReader();
                        reader.onload = ev => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxW=400,maxH=120; let w=img.width,h=img.height;
                            if(w>maxW){h=Math.round(h*maxW/w);w=maxW;} if(h>maxH){w=Math.round(w*maxH/h);h=maxH;}
                            canvas.width=w; canvas.height=h;
                            canvas.getContext('2d').drawImage(img,0,0,w,h);
                            setEmailTemplate(t=>({...t,logo_url:canvas.toDataURL('image/png')}));
                            toast.success(`Logo resized to ${w}×${h}px`);
                          };
                          img.src = ev.target.result;
                        };
                        reader.readAsDataURL(file);
                      }}/>
                    </label>
                    <span style={{fontSize:11,opacity:.4}}>Auto-resized to 400×120px max</span>
                  </div>
                  {emailTemplate.logo_url && <div style={{marginTop:10,padding:10,background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)',display:'inline-block'}}><img src={emailTemplate.logo_url} alt="Logo" style={{maxHeight:60,maxWidth:200,display:'block'}} onError={e=>e.target.style.display='none'}/></div>}
                </div>
              </div>

              <div style={{marginBottom:20,padding:'18px 20px',background:'rgba(99,102,241,.05)',borderRadius:12,border:'1px solid rgba(99,102,241,.2)'}}>
                <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',color:'#818cf8',marginBottom:14}}>📋 Quote Request Email</div>
                <div className="form-group">
                  <label className="form-label">Opening Message</label>
                  <textarea value={emailTemplate.quote_intro||''} onChange={e=>setEmailTemplate(t=>({...t,quote_intro:e.target.value}))} className="form-input" rows={3} placeholder="e.g. Hi, please provide pricing for the following items..."/>
                </div>
                <div className="form-group">
                  <label className="form-label">Closing / Footer</label>
                  <textarea value={emailTemplate.quote_footer||''} onChange={e=>setEmailTemplate(t=>({...t,quote_footer:e.target.value}))} className="form-input" rows={2} placeholder="e.g. Please reply with your best pricing..."/>
                </div>
                <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:10}}>Quote Columns</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {[['show_sku','SKU'],['show_name','Product Name'],['show_vendor_sku','Vendor SKU'],['show_barcode','Barcode'],['show_quantity','Quantity'],['show_unit_cost','Unit Cost'],['show_net_terms','Net Terms'],['show_notes','Line Notes']].map(([key,label])=>(
                    <label key={key} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'rgba(255,255,255,.03)',borderRadius:6,cursor:'pointer',fontSize:12}}>
                      <input type="checkbox" checked={emailTemplate[key]!==false} onChange={e=>setEmailTemplate(t=>({...t,[key]:e.target.checked}))} style={{accentColor:'#6366f1',cursor:'pointer'}}/>
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{marginBottom:20,padding:'18px 20px',background:'rgba(16,185,129,.05)',borderRadius:12,border:'1px solid rgba(16,185,129,.2)'}}>
                <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',color:'#10b981',marginBottom:14}}>🧾 Purchase Order Email</div>
                <div className="form-group">
                  <label className="form-label">Opening Message</label>
                  <textarea value={emailTemplate.po_intro||''} onChange={e=>setEmailTemplate(t=>({...t,po_intro:e.target.value}))} className="form-input" rows={3} placeholder="e.g. Please find our purchase order below..."/>
                </div>
                <div className="form-group">
                  <label className="form-label">Closing / Footer</label>
                  <textarea value={emailTemplate.po_footer||''} onChange={e=>setEmailTemplate(t=>({...t,po_footer:e.target.value}))} className="form-input" rows={2} placeholder="e.g. Please confirm receipt and expected delivery date..."/>
                </div>
                <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:10}}>PO Columns</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                  {[['po_show_sku','SKU'],['po_show_name','Product Name'],['po_show_vendor_sku','Vendor SKU'],['po_show_barcode','Barcode'],['po_show_quantity','Quantity'],['po_show_unit_cost','Unit Cost'],['po_show_net_terms','Net Terms'],['po_show_notes','Line Notes']].map(([key,label])=>(
                    <label key={key} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'rgba(255,255,255,.03)',borderRadius:6,cursor:'pointer',fontSize:12}}>
                      <input type="checkbox" checked={emailTemplate[key]!==false} onChange={e=>setEmailTemplate(t=>({...t,[key]:e.target.checked}))} style={{accentColor:'#10b981',cursor:'pointer'}}/>
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <button className="btn btn-primary" style={{padding:'12px 28px',fontSize:15,width:'100%'}} disabled={savingTemplate} onClick={async()=>{
                setSavingTemplate(true);
                try { await api.post('/settings', { key:'email_template', value: emailTemplate }); toast.success('Email templates saved'); }
                catch(e) { toast.error('Failed to save'); } finally { setSavingTemplate(false); }
              }}>{savingTemplate?'Saving...':'Save Email Templates'}</button>
            </div>

            <div style={{position:'sticky',top:20}}>
              <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                Preview
                <div style={{display:'flex',gap:4}}>
                  {['quote','po'].map(t=>(
                    <button key={t} onClick={()=>setPreviewType(t)}
                      style={{padding:'3px 10px',borderRadius:5,border:`1px solid ${previewType===t?'#6366f1':'rgba(255,255,255,.15)'}`,background:previewType===t?'rgba(99,102,241,.15)':'none',cursor:'pointer',fontSize:11,color:previewType===t?'#818cf8':'inherit',fontWeight:previewType===t?600:400}}>
                      {t==='quote'?'Quote':'PO'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{background:'#fff',borderRadius:10,overflow:'hidden',border:'1px solid rgba(255,255,255,.1)',maxHeight:600,overflowY:'auto'}}>
                <div style={{fontFamily:'Arial,sans-serif',padding:24,color:'#1f2937',fontSize:13}}>
                  {emailTemplate.logo_url && <img src={emailTemplate.logo_url} alt="Logo" style={{maxHeight:60,maxWidth:200,marginBottom:16,display:'block'}} onError={e=>e.target.style.display='none'}/>}
                  <div style={{marginBottom:16,fontSize:12,color:'#6b7280'}}>
                    {emailTemplate.company_name&&<div style={{fontWeight:700,color:'#1f2937'}}>{emailTemplate.company_name}</div>}
                    {emailTemplate.company_email&&<div>{emailTemplate.company_email}</div>}
                    {emailTemplate.company_phone&&<div>{emailTemplate.company_phone}</div>}
                    {emailTemplate.company_address&&<div>{emailTemplate.company_address}</div>}
                  </div>
                  <h2 style={{color:'#1f2937',fontSize:18,marginBottom:4}}>{previewType==='quote'?'Quote Request: QR-1234567890':'Purchase Order: PO-1234567890'}</h2>
                  <p style={{color:'#6b7280',fontSize:12,marginBottom:12}}>Date: {new Date().toLocaleDateString()}</p>
                  {previewType==='quote'&&emailTemplate.quote_intro&&<p style={{marginBottom:12}}>{emailTemplate.quote_intro}</p>}
                  {previewType==='po'&&emailTemplate.po_intro&&<p style={{marginBottom:12}}>{emailTemplate.po_intro}</p>}
                  <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16,fontSize:12}}>
                    <thead>
                      <tr style={{background:'#f3f4f6'}}>
                        {(previewType==='quote'?[['show_sku','SKU'],['show_name','Product Name'],['show_vendor_sku','Vendor SKU'],['show_barcode','Barcode'],['show_quantity','Qty'],['show_unit_cost','Unit Cost'],['show_net_terms','Net Terms'],['show_notes','Notes']]:[['po_show_sku','SKU'],['po_show_name','Product Name'],['po_show_vendor_sku','Vendor SKU'],['po_show_barcode','Barcode'],['po_show_quantity','Qty'],['po_show_unit_cost','Unit Cost'],['po_show_net_terms','Net Terms'],['po_show_notes','Notes']]).filter(([key])=>emailTemplate[key]!==false).map(([,label])=>(
                          <th key={label} style={{padding:'6px 8px',textAlign:'left',border:'1px solid #e5e7eb',fontWeight:600}}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {(previewType==='quote'?[['show_sku','SKU-001'],['show_name','Sample Product'],['show_vendor_sku','V-001'],['show_barcode','123456789'],['show_quantity','5'],['show_unit_cost','$24.99'],['show_net_terms','Net 30'],['show_notes','']]:[['po_show_sku','SKU-001'],['po_show_name','Sample Product'],['po_show_vendor_sku','V-001'],['po_show_barcode','123456789'],['po_show_quantity','5'],['po_show_unit_cost','$24.99'],['po_show_net_terms','Net 30'],['po_show_notes','']]).filter(([key])=>emailTemplate[key]!==false).map(([,val],j)=>(
                          <td key={j} style={{padding:'6px 8px',border:'1px solid #e5e7eb'}}>{val}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  {previewType==='quote'&&emailTemplate.quote_footer&&<p style={{fontSize:12,color:'#6b7280'}}>{emailTemplate.quote_footer}</p>}
                  {previewType==='po'&&emailTemplate.po_footer&&<p style={{fontSize:12,color:'#6b7280'}}>{emailTemplate.po_footer}</p>}
                  <hr style={{border:'none',borderTop:'1px solid #e5e7eb',margin:'16px 0'}}/>
                  <p style={{fontSize:11,color:'#9ca3af'}}>Reply to this email to respond. Reference: {previewType==='quote'?'QR-1234567890':'PO-1234567890'}</p>
                </div>
              </div>
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
            <strong>Note:</strong> Sync runs every 15 minutes when your Shopify connection is active.
          </div>
        </div>
      )}

      <style>{`.form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:600px){.form-grid-2{grid-template-columns:1fr}}`}</style>
    </div>
  );
}

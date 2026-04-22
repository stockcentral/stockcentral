import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Search, ChevronUp, ChevronDown, X, Plus, Clock, User, Edit2, Trash2, Package, AlertTriangle, Factory, Copy, Check, Tag } from 'lucide-react';

const fmt = (n) => `$${parseFloat(n||0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';

const TAG_PRESETS = [
  { label:'VIP', color:'#f59e0b' },
  { label:'Rush', color:'#ef4444' },
  { label:'Hold', color:'#6366f1' },
  { label:'Wholesale', color:'#10b981' },
  { label:'Warranty', color:'#3b82f6' },
  { label:'Repeat', color:'#8b5cf6' },
];

function TagBadge({ tag, onRemove }) {
  const preset = TAG_PRESETS.find(t => t.label.toLowerCase() === tag.toLowerCase());
  const color = preset?.color || '#6b7280';
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:10,background:`${color}22`,color,fontSize:11,fontWeight:600,border:`1px solid ${color}44`}}>
      {tag}
      {onRemove && <button onClick={e=>{e.stopPropagation();onRemove(tag);}} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',padding:0,lineHeight:1,opacity:.7,fontSize:13}}>×</button>}
    </span>
  );
}

function SortTh({ label, field, sort, dir, onSort }) {
  const active = sort === field;
  return (
    <th onClick={() => onSort(field)} style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}}>
      <span style={{display:'flex',alignItems:'center',gap:4}}>
        {label}
        {active ? (dir==='asc'?<ChevronUp size={11}/>:<ChevronDown size={11}/>) : <ChevronDown size={11} style={{opacity:.25}}/>}
      </span>
    </th>
  );
}

function StockPill({ label, value, color, onClick, isLink }) {
  return (
    <div style={{textAlign:'center',minWidth:64}}>
      <div style={{fontSize:10,opacity:.5,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:2}}>{label}</div>
      {isLink && onClick
        ? <button onClick={onClick} style={{fontSize:14,fontWeight:700,color:color||'inherit',background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline',textDecorationStyle:'dotted'}}>{value}</button>
        : <div style={{fontSize:14,fontWeight:700,color:color||'inherit'}}>{value}</div>}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <button onClick={copy} title="Copy SKU" style={{background:'none',border:'none',cursor:'pointer',padding:'1px 3px',borderRadius:4,color:copied?'#10b981':'rgba(255,255,255,.35)',display:'inline-flex',alignItems:'center',transition:'color .15s',verticalAlign:'middle'}}>
      {copied ? <Check size={11}/> : <Copy size={11}/>}
    </button>
  );
}

const COMPLETED_STATUSES = ['shipped','delivered','completed','fulfilled','closed'];
const isCompleted = (order) => COMPLETED_STATUSES.some(s => order.status_name?.toLowerCase().includes(s));

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [dir, setDir] = useState('desc');
  const [statuses, setStatuses] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [sel, setSel] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [editText, setEditText] = useState('');
  const [onOrderModal, setOnOrderModal] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quotes, setQuotes] = useState([]);
  const [quoteMode, setQuoteMode] = useState('new');
  const [existingQuoteId, setExistingQuoteId] = useState('');
  const [activityOpen, setActivityOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [orderTags, setOrderTags] = useState([]);

  useEffect(() => { fetchOrders(); fetchStatuses(); }, [sort, dir]);

  const fetchOrders = async () => {
    try { setLoading(true); const r = await api.get(`/orders?sort=${sort}&dir=${dir}`); setOrders(r.data); }
    catch(e) { toast.error('Failed to load orders'); } finally { setLoading(false); }
  };

  const fetchStatuses = async () => {
    try { const r = await api.get('/orders/meta/statuses'); setStatuses(r.data); } catch(e) {}
  };

  const handleSort = (field) => {
    if (sort===field) setDir(d=>d==='asc'?'desc':'asc'); else { setSort(field); setDir('desc'); }
  };

  const openOrder = async (order) => {
    setSel(order); setDetail(null); setNotes([]); setSelectedItems([]);
    setSelectedNote(null); setEditingNote(null); setNoteText('');
    setActivityOpen(false); setNotesOpen(true); setShowTagInput(false); setTagInput('');
    setOrderTags(order.tags ? order.tags.split(',').map(t=>t.trim()).filter(Boolean) : []);
    setLoadingDetail(true);
    try {
      const [dR, nR] = await Promise.all([api.get(`/orders/${order.id}`), api.get(`/orders/${order.id}/notes`)]);
      setDetail(dR.data); setNotes(nR.data);
    } catch(e) { toast.error('Failed to load order'); } finally { setLoadingDetail(false); }
  };

  const closeOrder = () => { setSel(null); setDetail(null); setSelectedItems([]); setShowTagInput(false); };

  const updateStatus = async (orderId, statusId, statusName) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status_id: statusId });
      const sc = statuses.find(s=>s.id===statusId)?.color;
      setOrders(prev=>prev.map(o=>o.id===orderId?{...o,custom_status_id:statusId,status_name:statusName,status_color:sc}:o));
      if (sel?.id===orderId) {
        setSel(prev=>({...prev,custom_status_id:statusId,status_name:statusName,status_color:sc}));
        const nR = await api.get(`/orders/${orderId}/notes`); setNotes(nR.data);
      }
      toast.success(`Status: ${statusName}`);
    } catch(e) { toast.error('Failed'); }
  };

  const saveTags = async (tags) => {
    try {
      await api.put(`/orders/${sel.id}/tags`, { tags: tags.join(',') });
      setOrders(prev=>prev.map(o=>o.id===sel.id?{...o,tags:tags.join(',')}:o));
      setSel(prev=>({...prev,tags:tags.join(',')}));
      toast.success('Tags updated');
    } catch(e) { toast.error('Failed to save tags'); }
  };

  const addTag = (tag) => {
    const t = tag.trim();
    if (!t || orderTags.includes(t)) return;
    const newTags = [...orderTags, t];
    setOrderTags(newTags);
    setTagInput('');
    saveTags(newTags);
  };

  const removeTag = (tag) => {
    const newTags = orderTags.filter(t => t !== tag);
    setOrderTags(newTags);
    saveTags(newTags);
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      const r = await api.post(`/orders/${sel.id}/notes`, { note: noteText });
      setNotes(prev=>[...prev, r.data]); setNoteText(''); toast.success('Note added');
    } catch(e) { toast.error('Failed'); }
  };

  const saveEdit = async (noteId) => {
    if (!editText.trim()) return;
    try {
      const r = await api.put(`/orders/${sel.id}/notes/${noteId}`, { note: editText });
      setNotes(prev=>prev.map(n=>n.id===noteId?{...n,...r.data}:n));
      setEditingNote(null); setSelectedNote(null); toast.success('Updated');
    } catch(e) { toast.error('Failed'); }
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api.delete(`/orders/${sel.id}/notes/${noteId}`);
      setNotes(prev=>prev.filter(n=>n.id!==noteId)); setSelectedNote(null); toast.success('Deleted');
    } catch(e) { toast.error('Failed'); }
  };

  const toggleItem = (inv, qty) => {
    if (!inv) return;
    setSelectedItems(s=>s.find(x=>x.inventory_item_id===inv.id)?s.filter(x=>x.inventory_item_id!==inv.id):[...s,{inventory_item_id:inv.id,sku:inv.sku,name:inv.name,quantity:qty,unit_cost:''}]);
  };

  const openQuoteModal = async () => {
    if (!selectedItems.length) return toast.error('Select at least one item');
    try { const r = await api.get('/quotes'); setQuotes(r.data.filter(q=>q.status!=='ordered')); } catch(e) {}
    setQuoteMode('new'); setExistingQuoteId(''); setShowQuoteModal(true);
  };

  const submitToQuote = async () => {
    try {
      const orderNum = sel.order_number;
      if (quoteMode==='new') {
        const r = await api.post('/quotes',{vendor_id:null,status:'draft',notes:`Items from order #${orderNum}`,shopify_order_ids:`#${orderNum}`,items:selectedItems});
        await api.post(`/orders/${sel.id}/notes`,{note:`Items sent to quote ${r.data.quote_number}`,note_type:'quote_link',linked_id:r.data.id,linked_type:'quote'});
        toast.success(`Created quote ${r.data.quote_number}`);
      } else {
        const q = quotes.find(x=>x.id===existingQuoteId);
        await api.put(`/quotes/${existingQuoteId}/add-items`,{items:selectedItems,shopify_order_ids:`#${orderNum}`});
        await api.post(`/orders/${sel.id}/notes`,{note:`Items added to quote ${q?.quote_number}`,note_type:'quote_link',linked_id:existingQuoteId,linked_type:'quote'});
        toast.success(`Added to quote ${q?.quote_number}`);
      }
      setShowQuoteModal(false); setSelectedItems([]);
      const nR = await api.get(`/orders/${sel.id}/notes`); setNotes(nR.data);
    } catch(e) { toast.error(e.response?.data?.error||'Failed'); }
  };

  const getStatus = (o) => ({
    name: o.status_name||statuses.find(s=>s.is_default)?.name||'Paid',
    color: o.status_color||statuses.find(s=>s.is_default)?.color||'#10b981'
  });

  // All unique tags across orders
  const allTags = [...new Set(orders.flatMap(o => o.tags ? o.tags.split(',').map(t=>t.trim()).filter(Boolean) : []))];

  const filtered = orders.filter(o => {
    const completed = isCompleted(o);
    if (activeTab === 'active' && completed) return false;
    if (activeTab === 'completed' && !completed) return false;
    if (filterStatus && o.custom_status_id !== filterStatus) return false;
    if (filterTag) {
      const tags = o.tags ? o.tags.split(',').map(t=>t.trim()) : [];
      if (!tags.includes(filterTag)) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return o.order_number?.toLowerCase().includes(s) || o.customer_name?.toLowerCase().includes(s) || o.customer_email?.toLowerCase().includes(s);
    }
    return true;
  });

  const activeCount = orders.filter(o => !isCompleted(o)).length;
  const completedCount = orders.filter(o => isCompleted(o)).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Orders</h1><p className="page-subtitle">{activeCount} active · {completedCount} completed</p></div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:2,marginBottom:16,borderBottom:'1px solid rgba(255,255,255,.08)'}}>
        {[['active',`Active (${activeCount})`],['completed',`Completed (${completedCount})`],['all',`All (${orders.length})`]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            style={{padding:'8px 18px',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:activeTab===id?600:400,
              borderBottom:activeTab===id?'2px solid #6366f1':'2px solid transparent',color:activeTab===id?'#6366f1':'inherit'}}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:1,minWidth:200}}>
          <Search size={14} style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',opacity:.4}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search orders..." className="search-input" style={{paddingLeft:32}}/>
        </div>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{padding:'8px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:13}}>
          <option value="">All Statuses</option>
          {statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterTag} onChange={e=>setFilterTag(e.target.value)}
          style={{padding:'8px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:13}}>
          <option value="">All Tags</option>
          {allTags.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        {(filterStatus||filterTag||search) && (
          <button onClick={()=>{setFilterStatus('');setFilterTag('');setSearch('');}}
            style={{padding:'7px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'none',cursor:'pointer',color:'inherit',fontSize:12,opacity:.7}}>
            Clear
          </button>
        )}
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr>
              <SortTh label="Order #" field="order_number" sort={sort} dir={dir} onSort={handleSort}/>
              <SortTh label="Date" field="created_at" sort={sort} dir={dir} onSort={handleSort}/>
              <SortTh label="Customer" field="customer_name" sort={sort} dir={dir} onSort={handleSort}/>
              <SortTh label="Total" field="total_price" sort={sort} dir={dir} onSort={handleSort}/>
              <th>Items</th><th>Tags</th><th>Status</th>
            </tr></thead>
            <tbody>
              {filtered.map(order => {
                const li = Array.isArray(order.line_items)?order.line_items:[];
                const {name:sName,color:sColor} = getStatus(order);
                const tags = order.tags ? order.tags.split(',').map(t=>t.trim()).filter(Boolean) : [];
                return (
                  <tr key={order.id} onClick={()=>openOrder(order)} style={{cursor:'pointer'}} className="hover-row">
                    <td><span style={{color:'#6366f1',fontWeight:600}}>#{order.order_number}</span></td>
                    <td style={{fontSize:12}}>{fmtDate(order.created_at)}</td>
                    <td>
                      <div style={{fontWeight:500}}>{order.customer_name||'—'}</div>
                      <div style={{fontSize:11,opacity:.5}}>{order.customer_email||''}</div>
                    </td>
                    <td style={{fontWeight:600}}>{fmt(order.total_price)}</td>
                    <td style={{fontSize:12}}><span style={{fontWeight:600}}>{li.length}</span>{li.length>0&&<span style={{opacity:.5}}> — {li.slice(0,2).map(i=>i.name||'Item').join(', ')}{li.length>2?'...':''}</span>}</td>
                    <td onClick={e=>e.stopPropagation()} style={{maxWidth:160}}>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        {tags.map(t=><TagBadge key={t} tag={t}/>)}
                      </div>
                    </td>
                    <td onClick={e=>e.stopPropagation()}>
                      <select value={order.custom_status_id||''} onChange={e=>{const s=statuses.find(x=>x.id===e.target.value);if(s)updateStatus(order.id,s.id,s.name);}}
                        style={{padding:'4px 8px',borderRadius:12,border:'none',cursor:'pointer',fontWeight:600,fontSize:12,background:`${sColor}22`,color:sColor,outline:'none'}}>
                        {statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:32,opacity:.5}}>No orders found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')closeOrder();}}>
          <div style={{background:'var(--bg-secondary,#12121f)',borderRadius:14,width:'95vw',maxWidth:1040,maxHeight:'92vh',display:'flex',flexDirection:'column',boxShadow:'0 25px 80px rgba(0,0,0,.7)',overflow:'hidden'}}>

            <div style={{padding:'16px 24px',borderBottom:'1px solid rgba(255,255,255,.08)',display:'flex',alignItems:'center',gap:12,flexShrink:0,flexWrap:'wrap',background:'rgba(255,255,255,.02)'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <span style={{fontSize:18,fontWeight:700}}>Order #{sel.order_number}</span>
                  <select value={sel.custom_status_id||''} onChange={e=>{const s=statuses.find(x=>x.id===e.target.value);if(s)updateStatus(sel.id,s.id,s.name);}}
                    style={{padding:'4px 12px',borderRadius:20,border:'none',cursor:'pointer',fontWeight:600,fontSize:12,background:`${getStatus(sel).color}22`,color:getStatus(sel).color,outline:'none'}}>
                    {statuses.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {/* Tags in header */}
                  <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    {orderTags.map(t=><TagBadge key={t} tag={t} onRemove={removeTag}/>)}
                    {showTagInput ? (
                      <div style={{display:'flex',gap:4,alignItems:'center'}}>
                        <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                          onKeyDown={e=>{if(e.key==='Enter'){addTag(tagInput);}if(e.key==='Escape')setShowTagInput(false);}}
                          placeholder="Tag name..." autoFocus
                          style={{padding:'2px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'inherit',fontSize:12,width:100}}/>
                        <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                          {TAG_PRESETS.filter(p=>!orderTags.includes(p.label)).map(p=>(
                            <button key={p.label} onClick={()=>addTag(p.label)}
                              style={{padding:'2px 8px',borderRadius:8,border:`1px solid ${p.color}44`,background:`${p.color}22`,color:p.color,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={()=>setShowTagInput(false)} style={{background:'none',border:'none',cursor:'pointer',opacity:.5,color:'inherit',fontSize:13}}>×</button>
                      </div>
                    ) : (
                      <button onClick={()=>setShowTagInput(true)}
                        style={{display:'flex',alignItems:'center',gap:3,padding:'2px 8px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'none',cursor:'pointer',color:'inherit',fontSize:11,opacity:.6}}>
                        <Tag size={10}/> Add tag
                      </button>
                    )}
                  </div>
                </div>
                <div style={{fontSize:12,opacity:.4,marginTop:2}}>{fmtDate(sel.created_at)}</div>
              </div>
              <button onClick={closeOrder} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',opacity:.5,padding:4}}><X size={18}/></button>
            </div>

            <div style={{flex:1,overflowY:'auto',display:'grid',gridTemplateColumns:'1fr 270px',minHeight:0}}>
              <div style={{padding:'20px 24px',borderRight:'1px solid rgba(255,255,255,.06)',display:'flex',flexDirection:'column',gap:18,overflowY:'auto'}}>
                {loadingDetail ? <div style={{textAlign:'center',padding:48,opacity:.5}}>Loading...</div> : detail && (<>

                  <div style={{background:'rgba(255,255,255,.03)',borderRadius:10,border:'1px solid rgba(255,255,255,.07)',overflow:'hidden'}}>
                    <div style={{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(255,255,255,.02)'}}>
                      <span style={{fontWeight:600,fontSize:13}}>Line Items</span>
                      {selectedItems.length>0 && (
                        <button className="btn btn-secondary" style={{fontSize:11,padding:'3px 10px'}} onClick={openQuoteModal}>
                          <Plus size={11}/> {selectedItems.length} to Quote
                        </button>
                      )}
                    </div>
                    {(detail.line_items_enriched||[]).map((item,idx)=>{
                      const inv = item.inventory_item;
                      const isSel = inv && selectedItems.find(x=>x.inventory_item_id===inv.id);
                      const onHand = typeof inv?.quantity === 'number' ? inv.quantity : '—';
                      const available = typeof inv?.available === 'number' ? inv.available : '—';
                      const onOrder = inv?.on_order||0;
                      const openPOs = item.open_pos||[];
                      const availColor = typeof available==='number'?(available<=0?'#ef4444':available<=3?'#f59e0b':'#10b981'):'#6b7280';
                      const handColor = typeof onHand==='number'?(onHand<=5?'#f59e0b':'inherit'):'#6b7280';
                      return (
                        <div key={idx} style={{padding:'14px 16px',borderBottom:idx<(detail.line_items_enriched||[]).length-1?'1px solid rgba(255,255,255,.05)':'none',background:isSel?'rgba(99,102,241,.05)':'transparent',transition:'background .15s'}}>
                          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                            {inv && <input type="checkbox" checked={!!isSel} onChange={()=>toggleItem(inv,item.quantity||1)} style={{marginTop:3,cursor:'pointer',flexShrink:0,width:15,height:15}}/>}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:3}}>
                                <span style={{fontWeight:600,fontSize:14}}>{item.name||item.title||'Unknown Item'}</span>
                                {inv?.is_manufactured && <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'rgba(139,92,246,.2)',color:'#a78bfa',fontWeight:600,display:'inline-flex',alignItems:'center',gap:3}}><Factory size={9}/>Mfg</span>}
                                {!inv && <span style={{fontSize:11,color:'#f59e0b',fontStyle:'italic'}}>Not in inventory</span>}
                              </div>
                              <div style={{fontSize:12,opacity:.5,display:'flex',alignItems:'center',gap:0,flexWrap:'wrap'}}>
                                {inv?.sku && (<span style={{display:'inline-flex',alignItems:'center',gap:1}}>SKU: <span style={{fontFamily:'monospace'}}>{inv.sku}</span><CopyButton text={inv.sku}/><span style={{margin:'0 4px'}}>&middot;</span></span>)}
                                Qty ordered: <strong style={{marginLeft:3}}>{item.quantity}</strong>
                                {item.price&&<span>&nbsp;&middot;&nbsp;{fmt(item.price)}/ea</span>}
                              </div>
                            </div>
                            {inv && (
                              <div style={{display:'flex',gap:12,flexShrink:0,background:'rgba(255,255,255,.03)',padding:'8px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.06)'}}>
                                <StockPill label="On Hand" value={onHand} color={handColor}/>
                                <div style={{width:1,background:'rgba(255,255,255,.08)'}}/>
                                <StockPill label="Available" value={available} color={availColor}/>
                                <div style={{width:1,background:'rgba(255,255,255,.08)'}}/>
                                <StockPill label="On Order" value={onOrder} color={onOrder>0?'#3b82f6':'inherit'} isLink={onOrder>0} onClick={onOrder>0?()=>setOnOrderModal({itemName:item.name,open_pos:openPOs}):null}/>
                              </div>
                            )}
                          </div>
                          {item.bom&&item.bom.length>0&&(
                            <div style={{marginTop:12,marginLeft:25,padding:'10px 12px',background:'rgba(139,92,246,.05)',borderRadius:8,border:'1px solid rgba(139,92,246,.12)'}}>
                              <div style={{fontSize:11,fontWeight:600,opacity:.45,textTransform:'uppercase',marginBottom:8,display:'flex',alignItems:'center',gap:4}}><Factory size={10}/>Components (BOM)</div>
                              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                                <thead><tr style={{borderBottom:'1px solid rgba(255,255,255,.07)'}}>
                                  {['Component','SKU','Need','On Hand','Avail'].map(h=>(
                                    <th key={h} style={{textAlign:h==='Component'||h==='SKU'?'left':'right',padding:'3px 6px',opacity:.45,fontWeight:500,fontSize:11}}>{h}</th>
                                  ))}
                                </tr></thead>
                                <tbody>
                                  {item.bom.map((comp,ci)=>{
                                    const needed=(comp.quantity||1)*(item.quantity||1);
                                    const avail=comp.on_hand-needed;
                                    return (
                                      <tr key={ci} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                                        <td style={{padding:'5px 6px',fontWeight:500}}>{comp.component_name}</td>
                                        <td style={{padding:'5px 6px',opacity:.45,fontFamily:'monospace',fontSize:11}}>{comp.component_sku}</td>
                                        <td style={{padding:'5px 6px',textAlign:'right',fontWeight:600}}>{needed}</td>
                                        <td style={{padding:'5px 6px',textAlign:'right'}}>{comp.on_hand}</td>
                                        <td style={{padding:'5px 6px',textAlign:'right',fontWeight:700,color:avail<0?'#ef4444':avail===0?'#f59e0b':'#10b981'}}>
                                          {avail}{avail<0&&<AlertTriangle size={10} style={{display:'inline',marginLeft:3,verticalAlign:'middle'}}/>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes */}
                  <div style={{background:'rgba(255,255,255,.03)',borderRadius:10,border:'1px solid rgba(255,255,255,.07)'}}>
                    <div onClick={()=>setNotesOpen(o=>!o)} style={{padding:'10px 16px',borderBottom:notesOpen?'1px solid rgba(255,255,255,.07)':'none',background:'rgba(255,255,255,.02)',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none',borderRadius:notesOpen?'10px 10px 0 0':'10px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontWeight:600,fontSize:13}}>Notes</span>
                        {!notesOpen && notes.filter(n=>n.note_type==='general'||n.note_type==='quote_link').length>0 &&
                          <span style={{fontSize:11,opacity:.4}}>({notes.filter(n=>n.note_type==='general'||n.note_type==='quote_link').length})</span>}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {notesOpen && <span style={{fontSize:11,opacity:.35}}>Click a note to edit or delete</span>}
                        {notesOpen ? <ChevronUp size={14} style={{opacity:.5}}/> : <ChevronDown size={14} style={{opacity:.5}}/>}
                      </div>
                    </div>
                    {notesOpen && (
                      <div style={{padding:'14px 16px'}}>
                        <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'flex-end'}}>
                          <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} className="form-input" rows={2} style={{flex:1,resize:'vertical',fontSize:13}} placeholder="Add a note... (Cmd+Enter to submit)" onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();addNote();}}}/>
                          <button className="btn btn-primary" style={{fontSize:12,padding:'7px 16px',alignSelf:'stretch'}} onClick={addNote}>Submit</button>
                        </div>
                        {notes.filter(n=>n.note_type==='general'||n.note_type==='quote_link').length===0
                          ? <div style={{fontSize:12,opacity:.3,fontStyle:'italic',padding:'4px 0'}}>No notes yet.</div>
                          : notes.filter(n=>n.note_type==='general'||n.note_type==='quote_link').map(n=>(
                            <div key={n.id} onClick={()=>{if(editingNote!==n.id){setSelectedNote(selectedNote===n.id?null:n.id);}}}
                              style={{padding:'10px 12px',borderRadius:8,marginBottom:6,cursor:'pointer',background:selectedNote===n.id?'rgba(99,102,241,.1)':'rgba(255,255,255,.03)',border:`1px solid ${selectedNote===n.id?'rgba(99,102,241,.35)':'rgba(255,255,255,.06)'}`,transition:'all .15s'}}>
                              {editingNote===n.id ? (
                                <div onClick={e=>e.stopPropagation()}>
                                  <textarea value={editText} onChange={e=>setEditText(e.target.value)} className="form-input" rows={2} style={{width:'100%',fontSize:13,marginBottom:8,resize:'vertical'}} autoFocus/>
                                  <div style={{display:'flex',gap:6}}>
                                    <button className="btn btn-primary" style={{fontSize:12,padding:'4px 12px'}} onClick={()=>saveEdit(n.id)}>Save</button>
                                    <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} onClick={()=>{setEditingNote(null);setSelectedNote(null);}}>Cancel</button>
                                  </div>
                                </div>
                              ) : (<>
                                <div style={{fontSize:13,lineHeight:1.5}}>{n.note}</div>
                                <div style={{fontSize:11,opacity:.4,marginTop:5,display:'flex',alignItems:'center',gap:5}}>
                                  <User size={10}/>{n.author_name||'System'} · {fmtTime(n.created_at)}
                                  {n.updated_at&&n.updated_at!==n.created_at&&<span style={{opacity:.7}}>(edited)</span>}
                                </div>
                                {selectedNote===n.id&&(
                                  <div style={{display:'flex',gap:6,marginTop:8}} onClick={e=>e.stopPropagation()}>
                                    <button onClick={()=>{setEditingNote(n.id);setEditText(n.note);setSelectedNote(null);}} style={{fontSize:11,padding:'3px 10px',borderRadius:5,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.05)',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4,color:'inherit'}}><Edit2 size={10}/>Edit</button>
                                    <button onClick={()=>deleteNote(n.id)} style={{fontSize:11,padding:'3px 10px',borderRadius:5,border:'1px solid rgba(239,68,68,.35)',background:'rgba(239,68,68,.06)',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:4,color:'#ef4444'}}><Trash2 size={10}/>Delete</button>
                                  </div>
                                )}
                              </>)}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>

                  {/* Order Activity */}
                  <div style={{background:'rgba(255,255,255,.03)',borderRadius:10,border:'1px solid rgba(255,255,255,.07)'}}>
                    <div onClick={()=>setActivityOpen(o=>!o)} style={{padding:'10px 16px',borderBottom:activityOpen?'1px solid rgba(255,255,255,.07)':'none',background:'rgba(255,255,255,.02)',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',userSelect:'none',borderRadius:activityOpen?'10px 10px 0 0':'10px'}}>
                      <span style={{fontWeight:600,fontSize:13,display:'inline-flex',alignItems:'center',gap:6}}>
                        <Clock size={12}/>Order Activity
                        {!activityOpen && notes.filter(n=>n.note_type==='status_change').length>0 &&
                          <span style={{fontSize:11,opacity:.4,fontWeight:400}}>({notes.filter(n=>n.note_type==='status_change').length})</span>}
                      </span>
                      {activityOpen ? <ChevronUp size={14} style={{opacity:.5}}/> : <ChevronDown size={14} style={{opacity:.5}}/>}
                    </div>
                    {activityOpen && (
                      <div style={{padding:'14px 16px'}}>
                        {notes.filter(n=>n.note_type==='status_change').length===0
                          ? <div style={{fontSize:12,opacity:.3,fontStyle:'italic'}}>No activity yet.</div>
                          : [...notes.filter(n=>n.note_type==='status_change')].reverse().map((n,i,arr)=>(
                            <div key={n.id} style={{display:'flex',gap:12,paddingBottom:i<arr.length-1?12:0,marginBottom:i<arr.length-1?12:0,borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,.05)':'none'}}>
                              <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:4}}>
                                <div style={{width:8,height:8,borderRadius:'50%',background:'#6366f1',flexShrink:0}}/>
                                {i<arr.length-1&&<div style={{width:1,flex:1,background:'rgba(99,102,241,.3)',marginTop:4}}/>}
                              </div>
                              <div style={{flex:1,paddingBottom:4}}>
                                <div style={{fontSize:13}}>{n.note}</div>
                                <div style={{fontSize:11,opacity:.4,marginTop:3}}>{fmtTime(n.created_at)}</div>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </>)}
              </div>

              <div style={{padding:'20px 18px',display:'flex',flexDirection:'column',gap:14,overflowY:'auto',background:'rgba(0,0,0,.1)'}}>
                <div style={{background:'rgba(255,255,255,.04)',borderRadius:10,border:'1px solid rgba(255,255,255,.08)',padding:'14px 16px'}}>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Customer</div>
                  <div style={{fontSize:17,fontWeight:700,lineHeight:1.3}}>{sel.customer_name||'Unknown'}</div>
                  {sel.customer_email&&<div style={{fontSize:12,opacity:.45,marginTop:4,wordBreak:'break-all'}}>{sel.customer_email}</div>}
                </div>
                <div style={{background:'rgba(255,255,255,.04)',borderRadius:10,border:'1px solid rgba(255,255,255,.08)',padding:'14px 16px'}}>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:12}}>Payment Summary</div>
                  {[['Subtotal',sel.subtotal_price],['Shipping',sel.total_shipping_price],['Tax',sel.total_tax]].map(([label,val])=>(
                    <div key={label} style={{display:'flex',justifyContent:'space-between',marginBottom:7,fontSize:13}}>
                      <span style={{opacity:.55}}>{label}</span><span>{fmt(val)}</span>
                    </div>
                  ))}
                  <div style={{height:1,background:'rgba(255,255,255,.1)',margin:'10px 0'}}/>
                  <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:15}}>
                    <span>Total</span><span>{fmt(sel.total_price)}</span>
                  </div>
                </div>
                <div style={{background:'rgba(255,255,255,.04)',borderRadius:10,border:'1px solid rgba(255,255,255,.08)',padding:'14px 16px'}}>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:8}}>Order Date</div>
                  <div style={{fontSize:13}}>{fmtDate(sel.created_at)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {onOrderModal&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setOnOrderModal(null);}}>
          <div className="modal" style={{maxWidth:520}}>
            <div className="modal-header">
              <h2 style={{display:'flex',alignItems:'center',gap:8,fontSize:15}}><Package size={15}/>On Order — {onOrderModal.itemName}</h2>
              <button className="modal-close" onClick={()=>setOnOrderModal(null)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:12,opacity:.5,marginBottom:12}}>Unreceived purchase orders containing this item:</p>
              {onOrderModal.open_pos.length===0
                ? <div style={{opacity:.5,fontSize:13}}>No open purchase orders for this item.</div>
                : onOrderModal.open_pos.map((po,i)=>(
                  <div key={i} style={{padding:'12px',borderRadius:8,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <span style={{fontWeight:700,color:'#6366f1',fontSize:14}}>{po.po_number}</span>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'rgba(59,130,246,.15)',color:'#3b82f6',fontWeight:600,textTransform:'capitalize'}}>{po.status}</span>
                    </div>
                    <div style={{fontSize:12,opacity:.5}}>
                      {po.vendor_name&&<span>Vendor: {po.vendor_name} · </span>}
                      Ordered: {po.ordered_qty} · Received: {po.received_quantity}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {showQuoteModal&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setShowQuoteModal(false);}}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header"><h2>Add to Quote</h2><button className="modal-close" onClick={()=>setShowQuoteModal(false)}><X size={18}/></button></div>
            <div className="modal-body">
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                {['new','existing'].map(m=>(
                  <button key={m} onClick={()=>setQuoteMode(m)} style={{flex:1,padding:'7px 0',borderRadius:6,border:'1px solid',cursor:'pointer',fontWeight:500,fontSize:13,background:quoteMode===m?'#6366f1':'transparent',borderColor:quoteMode===m?'#6366f1':'rgba(255,255,255,.2)',color:'inherit'}}>
                    {m==='new'?'New Quote':'Existing'}
                  </button>
                ))}
              </div>
              {quoteMode==='existing'&&(
                <div className="form-group">
                  <label className="form-label">Select Quote</label>
                  <select value={existingQuoteId} onChange={e=>setExistingQuoteId(e.target.value)} className="form-input">
                    <option value="">— Select —</option>
                    {quotes.map(q=><option key={q.id} value={q.id}>{q.quote_number} ({q.status})</option>)}
                  </select>
                </div>
              )}
              <div style={{background:'rgba(255,255,255,.04)',borderRadius:8,padding:10,fontSize:12}}>
                {selectedItems.map((i,idx)=><div key={idx} style={{padding:'2px 0',opacity:.8}}>• {i.name} × {i.quantity}</div>)}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowQuoteModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitToQuote} disabled={quoteMode==='existing'&&!existingQuoteId}>
                {quoteMode==='new'?'Create Quote':'Add to Quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.hover-row:hover{background:rgba(255,255,255,.04)}`}</style>
    </div>
  );
}

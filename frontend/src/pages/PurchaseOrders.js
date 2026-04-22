import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, X, Search, Package, CheckCircle, AlertTriangle, Clock, Scan, Trash2, Edit2, Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { VendorSelect } from './Vendors';

const STATUS_COLORS = {
  sent: '#3b82f6', partial: '#f59e0b', received: '#10b981',
  cancelled: '#ef4444', pending: '#6b7280', draft: '#8b5cf6'
};
const STATUS_LABELS = {
  sent: 'Sent', partial: 'Partially Received', received: 'Fully Received',
  cancelled: 'Cancelled', pending: 'Pending', draft: 'Draft'
};

const EMPTY_FORM = { vendor_id:'', expected_date:'', notes:'', status:'pending' };

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),1500);}}
      style={{background:'none',border:'none',cursor:'pointer',padding:'1px 3px',color:copied?'#10b981':'rgba(255,255,255,.35)',display:'inline-flex',alignItems:'center',verticalAlign:'middle'}}>
      {copied?<Check size={11}/>:<Copy size={11}/>}
    </button>
  );
}

export default function PurchaseOrders() {
  const [pos, setPOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  // Scanning & receiving state
  const [scanSku, setScanSku] = useState('');
  const [pendingReceive, setPendingReceive] = useState({}); // { itemId: qty } — staged before finalizing
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectQty, setRejectQty] = useState(1);
  const [noteText, setNoteText] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  // Edit unit cost
  const [editingCost, setEditingCost] = useState(null);
  const [editCostVal, setEditCostVal] = useState('');
  // Edit received qty
  const [editingReceived, setEditingReceived] = useState(null);
  const [editReceivedVal, setEditReceivedVal] = useState('');
  const scanRef = useRef();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [pRes, iRes] = await Promise.all([api.get('/purchase-orders'), api.get('/inventory')]);
      setPOs(pRes.data); setInventory(iRes.data);
    } catch(e) { toast.error('Failed to load purchase orders'); }
    finally { setLoading(false); }
  };

  const openPO = async (po) => {
    setSelectedPO(po); setDetail(null); setLoadingDetail(true);
    setPendingReceive({}); setScanSku(''); setNotesOpen(false);
    try { const r = await api.get(`/purchase-orders/${po.id}`); setDetail(r.data); }
    catch(e) { toast.error('Failed to load PO details'); }
    finally { setLoadingDetail(false); }
  };

  const closePO = () => { setSelectedPO(null); setDetail(null); setPendingReceive({}); setScanSku(''); };

  const refreshDetail = async () => {
    if (!selectedPO) return;
    const r = await api.get(`/purchase-orders/${selectedPO.id}`);
    setDetail(r.data);
    setPOs(prev => prev.map(p => p.id === selectedPO.id ? { ...p, ...r.data } : p));
  };

  // Scan adds to pending (not yet committed)
  const handleScan = async (e) => {
    e.preventDefault();
    if (!scanSku.trim()) return;
    const sku = scanSku.trim().toUpperCase();
    const item = (detail?.items||[]).find(i => i.sku?.toUpperCase() === sku);
    if (!item) return toast.error(`SKU ${sku} not found on this PO`);
    const ordered = item.quantity_ordered || item.quantity || 0;
    const received = item.quantity_received || 0;
    const alreadyPending = pendingReceive[item.id] || 0;
    if (received + alreadyPending >= ordered) return toast.error(`${item.item_name||sku} already fully received`);
    setPendingReceive(p => ({ ...p, [item.id]: (p[item.id]||0) + 1 }));
    toast.success(`+1 ${item.item_name||sku} staged`);
    setScanSku('');
  };

  // Update pending qty manually
  const updatePending = (itemId, qty) => {
    const q = parseInt(qty);
    if (isNaN(q) || q < 0) return;
    if (q === 0) {
      const np = {...pendingReceive}; delete np[itemId]; setPendingReceive(np);
    } else {
      setPendingReceive(p => ({...p, [itemId]: q}));
    }
  };

  // Finalize all pending receives in one batch
  const finalizeReceive = async () => {
    const entries = Object.entries(pendingReceive).filter(([,q]) => q > 0);
    if (!entries.length) return toast.error('No items staged to receive');
    try {
      const receivedItems = [];
      for (const [itemId, qty] of entries) {
        await api.put(`/purchase-orders/${selectedPO.id}/receive-item`, { po_item_id: itemId, qty_received: qty });
        const item = detail.items.find(i => i.id === itemId);
        if (item) receivedItems.push({ name: item.item_name||item.name||item.sku, sku: item.sku, qty });
      }
      // Auto-log note
      const noteLines = receivedItems.map(i => `• ${i.sku} — ${i.name}: ${i.qty} unit${i.qty!==1?'s':''}`).join('\n');
      const noteText = `Received:\n${noteLines}`;
      await api.post(`/purchase-orders/${selectedPO.id}/notes`, { note: noteText, note_type: 'receive' });
      toast.success(`Received ${entries.length} item${entries.length!==1?'s':''}`);
      setPendingReceive({});
      await refreshDetail();
    } catch(e) { toast.error('Failed to receive items'); }
  };

  const submitReject = async () => {
    try {
      await api.post(`/purchase-orders/${selectedPO.id}/reject-item`, {
        po_item_id: rejectModal.id, qty_rejected: rejectQty, note: rejectNote
      });
      const noteText = `Rejected: • ${rejectModal.sku} — ${rejectModal.name}: ${rejectQty} unit${rejectQty!==1?'s':''}\nReason: ${rejectNote}`;
      await api.post(`/purchase-orders/${selectedPO.id}/notes`, { note: noteText, note_type: 'rejection' });
      toast.success('Item rejected and logged');
      setRejectModal(null); setRejectNote(''); setRejectQty(1);
      await refreshDetail();
    } catch(e) { toast.error('Failed'); }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.post(`/purchase-orders/${selectedPO.id}/notes`, { note: noteText });
      toast.success('Note added'); setNoteText('');
      await refreshDetail();
    } catch(e) { toast.error('Failed to add note'); }
  };

  const saveEditCost = async (itemId) => {
    if (!editCostVal) return;
    try {
      await api.put(`/purchase-orders/${selectedPO.id}/item/${itemId}`, { unit_cost: parseFloat(editCostVal) });
      toast.success('Cost updated'); setEditingCost(null);
      await refreshDetail();
    } catch(e) { toast.error('Failed'); }
  };

  const saveEditReceived = async (itemId) => {
    const newQty = parseInt(editReceivedVal);
    if (isNaN(newQty) || newQty < 0) return toast.error('Invalid quantity');
    try {
      await api.put(`/purchase-orders/${selectedPO.id}/item/${itemId}`, { quantity_received: newQty });
      toast.success('Quantity updated'); setEditingReceived(null);
      await refreshDetail();
    } catch(e) { toast.error('Failed'); }
  };

  const createPO = async () => {
    if (!form.vendor_id) return toast.error('Please select a vendor');
    try {
      await api.post('/purchase-orders', { ...form, items });
      toast.success('Purchase order created');
      setShowCreate(false); setForm(EMPTY_FORM); setItems([]);
      fetchAll();
    } catch(e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const deletePO = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this PO?')) return;
    try { await api.delete(`/purchase-orders/${id}`); toast.success('Deleted'); fetchAll(); }
    catch(e) { toast.error('Failed'); }
  };

  const addItem = () => setItems(i => [...i, { inventory_item_id:'', quantity:1, unit_cost:'' }]);
  const updateItem = (idx, f, v) => setItems(i => i.map((x,j) => j===idx ? {...x,[f]:v} : x));
  const removeItem = (idx) => setItems(i => i.filter((_,j) => j!==idx));

  const filtered = pos.filter(p => !search ||
    p.po_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.vendor_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getProgress = (po) => {
    const ordered = parseInt(po.total_ordered) || 0;
    const received = parseInt(po.total_received) || 0;
    if (!ordered) return 0;
    return Math.min(100, Math.round((received / ordered) * 100));
  };

  const pendingCount = Object.values(pendingReceive).reduce((s,q)=>s+q,0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Purchase Orders</h1><p className="page-subtitle">{pos.length} orders</p></div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setItems([]); setShowCreate(true); }}>
          <Plus size={16}/> New PO
        </button>
      </div>

      <div className="search-bar">
        <Search size={16} className="search-icon"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search POs..." className="search-input"/>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>PO #</th><th>Vendor</th><th>Status</th><th>Progress</th><th>Expected</th><th>Total</th><th>Created</th><th></th></tr></thead>
            <tbody>
              {filtered.map(po => {
                const prog = getProgress(po);
                const sc = STATUS_COLORS[po.status] || '#6b7280';
                return (
                  <tr key={po.id} onClick={() => openPO(po)} style={{ cursor:'pointer' }} className="hover-row">
                    <td><span style={{ color:'#6366f1', fontWeight:600 }}>{po.po_number}</span></td>
                    <td>{po.vendor_name || '—'}</td>
                    <td><span style={{ color:sc, fontWeight:600, fontSize:12, padding:'2px 8px', borderRadius:10, background:`${sc}22` }}>
                      {STATUS_LABELS[po.status] || po.status}
                    </span></td>
                    <td style={{ minWidth:120 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.1)', borderRadius:3 }}>
                          <div style={{ width:`${prog}%`, height:'100%', background: prog===100?'#10b981':'#3b82f6', borderRadius:3, transition:'width 0.3s' }}/>
                        </div>
                        <span style={{ fontSize:11, opacity:.6, whiteSpace:'nowrap' }}>{po.total_received||0}/{po.total_ordered||0}</span>
                      </div>
                    </td>
                    <td style={{ fontSize:12 }}>{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</td>
                    <td style={{ fontWeight:600 }}>${parseFloat(po.total||po.subtotal||0).toFixed(2)}</td>
                    <td style={{ fontSize:12 }}>{new Date(po.created_at).toLocaleDateString()}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn-icon danger" onClick={e => deletePO(po.id, e)}><Trash2 size={13}/></button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign:'center', padding:32, opacity:.5 }}>No purchase orders yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* PO DETAIL MODAL */}
      {selectedPO && (
        <div className="modal-overlay" onClick={e => { if (e.target.className === 'modal-overlay') closePO(); }}>
          <div className="modal" style={{ maxWidth:960, width:'95vw', maxHeight:'92vh', display:'flex', flexDirection:'column' }}>
            {/* Header */}
            <div className="modal-header" style={{ flexShrink:0 }}>
              <div style={{flex:1}}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <h2 style={{ margin:0 }}>{selectedPO.po_number}</h2>
                  <span style={{ fontSize:12, padding:'3px 10px', borderRadius:10, fontWeight:600,
                    color: STATUS_COLORS[selectedPO.status]||'#6b7280',
                    background: `${STATUS_COLORS[selectedPO.status]||'#6b7280'}22` }}>
                    {STATUS_LABELS[selectedPO.status] || selectedPO.status}
                  </span>
                </div>
                <div style={{ fontSize:12, opacity:.5, marginTop:3 }}>
                  {selectedPO.vendor_name} · Created {new Date(selectedPO.created_at).toLocaleDateString()}
                  {selectedPO.expected_date && ` · Expected ${new Date(selectedPO.expected_date).toLocaleDateString()}`}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {/* Source quote — bottom left of header */}
                {(detail?.source_quote_number || selectedPO.source_quote_number) && (
                  <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:6,background:'rgba(99,102,241,.12)',border:'1px solid rgba(99,102,241,.25)',fontSize:12}}>
                    <span style={{opacity:.6}}>From quote</span>
                    <span style={{color:'#818cf8',fontWeight:700}}>{detail?.source_quote_number || selectedPO.source_quote_number}</span>
                  </div>
                )}
                <button className="modal-close" onClick={closePO}><X size={18}/></button>
              </div>
            </div>

            <div className="modal-body" style={{ flex:1, overflowY:'auto' }}>
              {loadingDetail ? <div style={{ textAlign:'center', padding:40, opacity:.5 }}>Loading...</div> : detail && (<>

                {/* Scan to Receive */}
                {detail.status !== 'received' && detail.status !== 'cancelled' && (
                  <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:10, padding:14, marginBottom:16 }}>
                    <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', opacity:.5, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      <Scan size={12}/> Scan to Stage Items
                    </div>
                    <div style={{ fontSize:11, opacity:.5, marginBottom:8 }}>
                      Scan barcodes to stage items. Each scan adds 1 unit. Hit <strong>Receive All</strong> to finalize and log.
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <form onSubmit={handleScan} style={{ display:'flex', gap:8, flex:1 }}>
                        <input ref={scanRef} value={scanSku} onChange={e => setScanSku(e.target.value)}
                          className="form-input" placeholder="Scan barcode or type SKU..."
                          style={{ flex:1 }} autoFocus/>
                        <button type="submit" className="btn btn-secondary" style={{ fontSize:13 }}>Stage</button>
                      </form>
                      {pendingCount > 0 && (
                        <button onClick={finalizeReceive} className="btn btn-primary" style={{fontSize:13,whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
                          <CheckCircle size={14}/> Receive All ({pendingCount} unit{pendingCount!==1?'s':''})
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Line Items */}
                <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', opacity:.5, marginBottom:10 }}>
                  Line Items — {(detail.items||[]).length} products
                </div>
                {(detail.items||[]).map(item => {
                  const ordered = item.quantity_ordered || item.quantity || 0;
                  const received = item.quantity_received || item.received_quantity || 0;
                  const pending = pendingReceive[item.id] || 0;
                  const remaining = Math.max(0, ordered - received);
                  const pct = ordered > 0 ? Math.min(100, Math.round(((received+pending) / ordered) * 100)) : 0;
                  const fullyReceived = received >= ordered;
                  return (
                    <div key={item.id} style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:14, marginBottom:8,
                      border: `1px solid ${pending>0?'rgba(99,102,241,.4)':fullyReceived ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`,
                      transition:'border-color .2s' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>
                        <div style={{ flex:1, minWidth:180 }}>
                          <div style={{ fontWeight:600, fontSize:14 }}>{item.item_name || item.name || item.sku}</div>
                          <div style={{ fontSize:12, opacity:.5, marginTop:2, display:'flex', alignItems:'center', gap:4 }}>
                            <span style={{fontFamily:'monospace'}}>{item.sku}</span>
                            <CopyBtn text={item.sku}/>
                            {item.rejected_quantity > 0 && <span style={{ color:'#ef4444', marginLeft:4 }}>⚠ {item.rejected_quantity} rejected</span>}
                          </div>
                        </div>

                        {/* Qty summary */}
                        <div style={{ display:'flex', gap:12, alignItems:'center', flexShrink:0 }}>
                          <div style={{ textAlign:'right', fontSize:12 }}>
                            <div style={{ fontWeight:700, fontSize:18 }}>
                              <span style={{ color: fullyReceived ? '#10b981' : received > 0 ? '#f59e0b' : 'inherit' }}>{received}</span>
                              <span style={{ opacity:.4 }}> / {ordered}</span>
                            </div>
                            <div style={{ opacity:.4, fontSize:11 }}>received</div>
                          </div>
                          {/* Unit Cost — editable */}
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:10, opacity:.4, textTransform:'uppercase', marginBottom:2 }}>Unit Cost</div>
                            {editingCost === item.id ? (
                              <div style={{display:'flex',gap:3,alignItems:'center'}}>
                                <span style={{opacity:.5,fontSize:12}}>$</span>
                                <input type="number" step="0.01" min="0" value={editCostVal} onChange={e=>setEditCostVal(e.target.value)}
                                  style={{width:60,padding:'2px 4px',borderRadius:4,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'inherit',fontSize:13,textAlign:'center'}}
                                  autoFocus onKeyDown={e=>{if(e.key==='Enter')saveEditCost(item.id);if(e.key==='Escape')setEditingCost(null);}}/>
                                <button onClick={()=>saveEditCost(item.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#10b981',padding:1}}><Check size={12}/></button>
                                <button onClick={()=>setEditingCost(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:1}}><X size={12}/></button>
                              </div>
                            ) : (
                              <div style={{display:'flex',alignItems:'center',gap:4}}>
                                <span style={{fontWeight:600,fontSize:14}}>${parseFloat(item.unit_cost||0).toFixed(2)}</span>
                                <button onClick={()=>{setEditingCost(item.id);setEditCostVal(item.unit_cost||0);}} style={{background:'none',border:'none',cursor:'pointer',opacity:.3,padding:1,color:'inherit'}}><Edit2 size={10}/></button>
                              </div>
                            )}
                          </div>
                          {fullyReceived ? <CheckCircle size={20} style={{ color:'#10b981' }}/> : <Package size={20} style={{ opacity:.2 }}/>}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ margin:'10px 0 8px', height:4, background:'rgba(255,255,255,0.1)', borderRadius:2 }}>
                        <div style={{ width:`${pct}%`, height:'100%', background: fullyReceived?'#10b981':pending>0?'#6366f1':'#3b82f6', borderRadius:2, transition:'width .3s' }}/>
                      </div>

                      {/* Receive controls */}
                      {!fullyReceived && detail.status !== 'cancelled' && (
                        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
                          {pending > 0 && (
                            <span style={{fontSize:12,padding:'2px 8px',borderRadius:6,background:'rgba(99,102,241,.15)',color:'#818cf8',fontWeight:600}}>
                              +{pending} staged
                            </span>
                          )}
                          <input type="number" min="1" max={remaining}
                            value={pending||''} onChange={e => updatePending(item.id, e.target.value)}
                            className="form-input" style={{ width:70, padding:'4px 8px', fontSize:12 }} placeholder="Qty"/>
                          <button className="btn btn-secondary" style={{ fontSize:12, padding:'4px 12px' }}
                            onClick={() => { if (!pendingReceive[item.id]) return toast.error('Enter a quantity'); finalizeReceive(); }}>
                            Receive
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm('Unreceive 1 unit?')) return;
                            if (received <= 0) return toast.error('Nothing to unreceive');
                            try {
                              await api.put(`/purchase-orders/${selectedPO.id}/item/${item.id}`, { quantity_received: Math.max(0, received - 1) });
                              await api.post(`/purchase-orders/${selectedPO.id}/notes`, { note: `Unreceived 1x ${item.sku} — ${item.item_name||item.name}`, note_type: 'receive' });
                              toast.success('Unreceived 1 unit'); await refreshDetail();
                            } catch(e) { toast.error('Failed'); }
                          }} style={{ fontSize:12, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(245,158,11,.4)', background:'none', cursor:'pointer', color:'#f59e0b' }}
                            title="Remove 1 received unit">
                            Unreceive
                          </button>
                          <button onClick={() => { setRejectModal(item); setRejectQty(1); setRejectNote(''); }}
                            style={{ fontSize:12, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.4)', background:'none', cursor:'pointer', color:'#ef4444' }}>
                            Reject
                          </button>
                          <span style={{fontSize:11,opacity:.4}}>{remaining} remaining</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Notes & Activity — collapsible */}
                <div style={{ marginTop:20, background:'rgba(255,255,255,.03)', borderRadius:10, border:'1px solid rgba(255,255,255,.07)' }}>
                  <div onClick={()=>setNotesOpen(o=>!o)} style={{ padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', userSelect:'none', borderBottom: notesOpen?'1px solid rgba(255,255,255,.07)':'none', borderRadius: notesOpen?'10px 10px 0 0':'10px' }}>
                    <span style={{ fontWeight:600, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                      <Clock size={13}/> Notes & Activity
                      {!notesOpen && (detail.notes||[]).length > 0 && <span style={{fontSize:11,opacity:.4,fontWeight:400}}>({(detail.notes||[]).length})</span>}
                    </span>
                    {notesOpen ? <ChevronUp size={14} style={{opacity:.5}}/> : <ChevronDown size={14} style={{opacity:.5}}/>}
                  </div>
                  {notesOpen && (
                    <div style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                        <input value={noteText} onChange={e => setNoteText(e.target.value)}
                          className="form-input" style={{ flex:1 }} placeholder="Add a note... (Enter to submit)"
                          onKeyDown={e => e.key==='Enter' && addNote()}/>
                        <button className="btn btn-secondary" onClick={addNote} style={{ fontSize:12 }}>Add</button>
                      </div>
                      {(detail.notes||[]).length === 0
                        ? <div style={{ opacity:.4, fontSize:12, fontStyle:'italic' }}>No notes yet.</div>
                        : [...(detail.notes||[])].reverse().map(n => (
                          <div key={n.id} style={{ fontSize:12, padding:'10px 12px',
                            background: n.note_type==='rejection'?'rgba(239,68,68,0.08)':n.note_type==='receive'?'rgba(16,185,129,.08)':'rgba(99,102,241,0.07)',
                            borderRadius:8, marginBottom:6,
                            borderLeft:`3px solid ${n.note_type==='rejection'?'#ef4444':n.note_type==='receive'?'#10b981':'#6366f1'}` }}>
                            <div style={{whiteSpace:'pre-wrap'}}>{n.note}</div>
                            <div style={{ opacity:.4, marginTop:4, display:'flex', gap:6 }}>
                              <span>{n.author_name||'System'}</span>
                              <span>·</span>
                              <span>{new Date(n.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModal && (
        <div className="modal-overlay" onClick={e => { if (e.target.className==='modal-overlay') setRejectModal(null); }}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-header"><h2>Reject Item</h2><button className="modal-close" onClick={() => setRejectModal(null)}><X size={18}/></button></div>
            <div className="modal-body">
              <div style={{marginBottom:12,fontWeight:500}}>{rejectModal.item_name||rejectModal.name||rejectModal.sku}</div>
              <div className="form-group">
                <label className="form-label">Quantity to Reject</label>
                <input type="number" min="1" value={rejectQty} onChange={e => setRejectQty(parseInt(e.target.value)||1)} className="form-input"/>
              </div>
              <div className="form-group">
                <label className="form-label">Reason / Note <span style={{ color:'#ef4444' }}>*</span></label>
                <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} className="form-input" rows={3} placeholder="Describe the issue (damage, wrong item, etc.)"/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRejectModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background:'#ef4444' }} onClick={submitReject} disabled={!rejectNote.trim()}>
                <AlertTriangle size={14}/> Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PO MODAL */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => { if (e.target.className==='modal-overlay') setShowCreate(false); }}>
          <div className="modal large-modal">
            <div className="modal-header"><h2>New Purchase Order</h2><button className="modal-close" onClick={() => setShowCreate(false)}><X size={18}/></button></div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Vendor <span style={{ color:'#ef4444' }}>*</span></label>
                  <VendorSelect name="vendor_id" value={form.vendor_id} onChange={e => setForm(f => ({...f, vendor_id:e.target.value}))} className="form-input"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Delivery Date</label>
                  <input type="date" value={form.expected_date||''} onChange={e => setForm(f => ({...f, expected_date:e.target.value}))} className="form-input"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea value={form.notes||''} onChange={e => setForm(f => ({...f, notes:e.target.value}))} className="form-input" rows={2}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', margin:'16px 0 8px' }}>
                <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', opacity:.5 }}>Line Items</div>
                <button className="btn btn-secondary" style={{ fontSize:12 }} onClick={addItem}><Plus size={12}/> Add Item</button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginBottom:8, alignItems:'end' }}>
                  <div className="form-group" style={{ margin:0 }}>
                    {idx===0 && <label className="form-label">Product</label>}
                    <select value={item.inventory_item_id} onChange={e => updateItem(idx,'inventory_item_id',e.target.value)} className="form-input">
                      <option value="">— Select —</option>
                      {inventory.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin:0 }}>
                    {idx===0 && <label className="form-label">Qty</label>}
                    <input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx,'quantity',e.target.value)} className="form-input"/>
                  </div>
                  <div className="form-group" style={{ margin:0 }}>
                    {idx===0 && <label className="form-label">Unit Cost</label>}
                    <input type="number" step="0.01" value={item.unit_cost} onChange={e => updateItem(idx,'unit_cost',e.target.value)} className="form-input" placeholder="0.00"/>
                  </div>
                  <button onClick={() => removeItem(idx)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', marginBottom:2 }}><X size={16}/></button>
                </div>
              ))}
              {items.length === 0 && <p style={{ opacity:.5, fontSize:13, textAlign:'center', padding:'12px 0' }}>No items added yet</p>}
              {items.length > 0 && (
                <div style={{ textAlign:'right', fontSize:14, fontWeight:600, marginTop:8 }}>
                  Total: ${items.reduce((s,i) => s + ((parseFloat(i.unit_cost)||0) * (parseInt(i.quantity)||0)), 0).toFixed(2)}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createPO}>Create PO</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-row:hover { background: rgba(255,255,255,0.04); }
        .large-modal { max-width:750px!important; }
        .form-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .btn-icon { background:none; border:none; cursor:pointer; padding:4px; border-radius:4px; opacity:.5; }
        .btn-icon:hover { opacity:1; }
        .btn-icon.danger:hover { color:#ef4444; opacity:1; }
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        input[type=number]{-moz-appearance:textfield}
        @media(max-width:600px) { .form-grid-2 { grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, X, Search, Package, CheckCircle, AlertTriangle, Clock, Scan, Trash2 } from 'lucide-react';
import { VendorSelect } from './Vendors';

const STATUS_COLORS = {
      sent: '#3b82f6', partial: '#f59e0b', received: '#10b981',
      cancelled: '#ef4444', pending: '#6b7280', draft: '#8b5cf6'
};
const STATUS_LABELS = {
      sent: 'Sent', partial: 'Partially Received', received: 'Fully Received',
      cancelled: 'Cancelled', pending: 'Pending', draft: 'Draft'
};

const EMPTY_FORM = { vendor_id:'', expected_date:'', notes:'', status:'sent' };

export default function PurchaseOrders() {
      const [pos, setPOs] = useState([]);
      const [loading, setLoading] = useState(true);
      const [search, setSearch] = useState('');
      // Create modal
  const [showCreate, setShowCreate] = useState(false);
      const [form, setForm] = useState(EMPTY_FORM);
      const [items, setItems] = useState([]);
      const [inventory, setInventory] = useState([]);
      // Detail modal
  const [selectedPO, setSelectedPO] = useState(null);
      const [detail, setDetail] = useState(null);
      const [loadingDetail, setLoadingDetail] = useState(false);
      // Receiving
  const [scanSku, setScanSku] = useState('');
      const [receiving, setReceiving] = useState({});
      const [rejectModal, setRejectModal] = useState(null);
      const [rejectNote, setRejectNote] = useState('');
      const [rejectQty, setRejectQty] = useState(1);
      const [noteText, setNoteText] = useState('');
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
          try { const r = await api.get(`/purchase-orders/${po.id}`); setDetail(r.data); }
          catch(e) { toast.error('Failed to load PO details'); }
          finally { setLoadingDetail(false); }
  };

  const closePO = () => { setSelectedPO(null); setDetail(null); setScanSku(''); setReceiving({}); };

  const refreshDetail = async () => {
          if (!selectedPO) return;
          const r = await api.get(`/purchase-orders/${selectedPO.id}`);
          setDetail(r.data);
          setPOs(prev => prev.map(p => p.id === selectedPO.id ? { ...p, ...r.data } : p));
  };

  // Receive by scanning SKU
  const handleScan = async (e) => {
          e.preventDefault();
          if (!scanSku.trim()) return;
          try {
                    await api.put(`/purchase-orders/${selectedPO.id}/receive-item`, { sku: scanSku.trim(), qty_received: 1 });
                    toast.success(`Received: ${scanSku}`);
                    setScanSku('');
                    await refreshDetail();
          } catch(err) { toast.error(err.response?.data?.error || 'SKU not found on this PO'); }
  };

  // Receive manually by item
  const receiveItem = async (itemId, qty) => {
          if (!qty || qty <= 0) return toast.error('Enter a valid quantity');
          try {
                    await api.put(`/purchase-orders/${selectedPO.id}/receive-item`, { po_item_id: itemId, qty_received: parseInt(qty) });
                    toast.success('Received!');
                    setReceiving(r => ({ ...r, [itemId]: '' }));
                    await refreshDetail();
          } catch(e) { toast.error('Failed to receive'); }
  };

  const submitReject = async () => {
          try {
                    await api.post(`/purchase-orders/${selectedPO.id}/reject-item`, {
                                po_item_id: rejectModal, qty_rejected: rejectQty, note: rejectNote
                    });
                    toast.success('Item rejected and noted');
                    setRejectModal(null); setRejectNote(''); setRejectQty(1);
                    await refreshDetail();
          } catch(e) { toast.error('Failed'); }
  };

  const addNote = async () => {
          if (!noteText.trim()) return;
          try {
                    await api.post(`/purchase-orders/${selectedPO.id}/notes`, { note: noteText });
                    toast.success('Note added');
                    setNoteText('');
                    await refreshDetail();
          } catch(e) { toast.error('Failed to add note'); }
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
                        <td style={{ minWidth:100 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.1)', borderRadius:3 }}>
                          <div style={{ width:`${prog}%`, height:'100%', background: prog===100?'#10b981':'#3b82f6', borderRadius:3, transition:'width 0.3s' }}/>
    </div>
                        <span style={{ fontSize:11, opacity:.6, whiteSpace:'nowrap' }}>{prog}%</span>
    </div>
    </td>
                    <td style={{ fontSize:12 }}>{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '—'}</td>
                    <td style={{ fontWeight:600 }}>${parseFloat(po.total_amount||0).toFixed(2)}</td>
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
          <div className="modal" style={{ maxWidth:900, width:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div className="modal-header" style={{ flexShrink:0 }}>
              <div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
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
              <button className="modal-close" onClick={closePO}><X size={18}/></button>
    </div>

            <div className="modal-body" style={{ flex:1, overflowY:'auto' }}>
{loadingDetail ? <div style={{ textAlign:'center', padding:40, opacity:.5 }}>Loading...</div> : detail && (
                <>
{/* SKU Scanner */}
{detail.status !== 'received' && detail.status !== 'cancelled' && (
                        <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:10, padding:14, marginBottom:16 }}>
                      <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', opacity:.5, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                        <Scan size={12}/> Scan to Receive
    </div>
                      <form onSubmit={handleScan} style={{ display:'flex', gap:8 }}>
                        <input ref={scanRef} value={scanSku} onChange={e => setScanSku(e.target.value)}
                              className="form-input" placeholder="Scan or type SKU and press Enter..."
                          style={{ flex:1 }} autoFocus/>
                                                      <button type="submit" className="btn btn-primary" style={{ fontSize:13 }}>Receive</button>
                              </form>
                              </div>
                  )}

{/* Line items */}
                  <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', opacity:.5, marginBottom:10 }}>Line Items</div>
{(detail.items||[]).map(item => {
                        const pct = item.quantity > 0 ? Math.min(100, Math.round((item.received_quantity/item.quantity)*100)) : 0;
                        const fullyReceived = item.received_quantity >= item.quantity;
                        return (
                                                  <div key={item.id} style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:14, marginBottom:8,
                                                                                                    border: `1px solid ${fullyReceived ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600 }}>{item.item_name || item.sku}</div>
                            <div style={{ fontSize:12, opacity:.5, marginTop:2 }}>
                              SKU: {item.sku} · ${parseFloat(item.unit_cost||0).toFixed(2)}/unit
{item.rejected_quantity > 0 && <span style={{ color:'#ef4444', marginLeft:8 }}>⚠ {item.rejected_quantity} rejected</span>}
    </div>
    </div>
                          <div style={{ textAlign:'right', fontSize:12 }}>
                            <div style={{ fontWeight:700, fontSize:16 }}>
                              <span style={{ color: fullyReceived ? '#10b981' : item.received_quantity > 0 ? '#f59e0b' : 'inherit' }}>
{item.received_quantity}
</span>
                              <span style={{ opacity:.4 }}> / {item.quantity}</span>
    </div>
                            <div style={{ opacity:.4 }}>received</div>
    </div>
{fullyReceived
                             ? <CheckCircle size={22} style={{ color:'#10b981', flexShrink:0 }}/>
                            : <Package size={22} style={{ opacity:.3, flexShrink:0 }}/>}
                                </div>
{/* Progress bar */}
                        <div style={{ margin:'10px 0 8px', height:4, background:'rgba(255,255,255,0.1)', borderRadius:2 }}>
                          <div style={{ width:`${pct}%`, height:'100%', background: fullyReceived?'#10b981':'#3b82f6', borderRadius:2 }}/>
                            </div>
{/* Receive + Reject controls */}
{!fullyReceived && detail.status !== 'cancelled' && (
                              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <input type="number" min="1" max={item.quantity - item.received_quantity}
                              value={receiving[item.id]||''} onChange={e => setReceiving(r => ({...r,[item.id]:e.target.value}))}
                                                                className="form-input" style={{ width:70, padding:'4px 8px', fontSize:12 }} placeholder="Qty"/>
                                                              <button className="btn btn-secondary" style={{ fontSize:12, padding:'4px 12px' }}
                              onClick={() => receiveItem(item.id, receiving[item.id]||1)}>
                              Receive
                                  </button>
                            <button onClick={() => { setRejectModal(item.id); setRejectQty(1); setRejectNote(''); }}
                              style={{ fontSize:12, padding:'4px 10px', borderRadius:6, border:'1px solid rgba(239,68,68,0.4)', background:'none', cursor:'pointer', color:'#ef4444' }}>
                              Reject
                                  </button>
                                  </div>
                        )}
</div>
                    );
})}

{/* Notes */}
                  <div style={{ marginTop:20 }}>
                    <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', opacity:.5, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                      <Clock size={12}/> Notes & Activity
                      </div>
                    <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                      <input value={noteText} onChange={e => setNoteText(e.target.value)}
                                              className="form-input" style={{ flex:1 }} placeholder="Add a note..."
                        onKeyDown={e => e.key==='Enter' && addNote()}/>
                      <button className="btn btn-secondary" onClick={addNote} style={{ fontSize:12 }}>Add</button>
                            </div>
{(detail.notes||[]).length === 0
                       ? <div style={{ opacity:.4, fontSize:12, fontStyle:'italic' }}>No notes yet.</div>
                      : (detail.notes||[]).map(n => (
                                                    <div key={n.id} style={{ fontSize:12, padding:'7px 12px', background: n.note_type==='rejection'?'rgba(239,68,68,0.08)':'rgba(99,102,241,0.07)',
                                                                                                       borderRadius:8, marginBottom:5, borderLeft:`3px solid ${n.note_type==='rejection'?'#ef4444':'#6366f1'}` }}>
                                                                           <div>{n.note}</div>
                                                                           <div style={{ opacity:.4, marginTop:3 }}>{n.author_name} · {new Date(n.created_at).toLocaleString()}</div>
                          </div>
                        ))
}
                            </div>
                            </>
              )}
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
                                                              @media(max-width:600px) { .form-grid-2 { grid-template-columns:1fr; } }
                                                                    `}</style>
          </div>
  );
}

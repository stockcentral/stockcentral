import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Search, ChevronUp, ChevronDown, X, Plus, AlertTriangle, Factory, Clock, User } from 'lucide-react';

function SortHeader({ label, field, sort, dir, onSort }) {
      const active = sort === field;
      return (
              <th onClick={() => onSort(field)} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
      <span style={{ display:'flex', alignItems:'center', gap:4 }}>
{label}
{active
           ? (dir === 'asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>)
              : <ChevronDown size={12} style={{ opacity:.3 }}/>}
    </span>
    </th>
  );
}

export default function Orders() {
      const [orders, setOrders] = useState([]);
      const [loading, setLoading] = useState(true);
      const [search, setSearch] = useState('');
      const [sort, setSort] = useState('created_at');
      const [dir, setDir] = useState('desc');
      const [statuses, setStatuses] = useState([]);
      const [selectedOrder, setSelectedOrder] = useState(null);
      const [detail, setDetail] = useState(null);
      const [notes, setNotes] = useState([]);
      const [loadingDetail, setLoadingDetail] = useState(false);
      const [selectedItems, setSelectedItems] = useState([]);
      const [showQuoteModal, setShowQuoteModal] = useState(false);
      const [quotes, setQuotes] = useState([]);
      const [quoteMode, setQuoteMode] = useState('new');
      const [existingQuoteId, setExistingQuoteId] = useState('');

  useEffect(() => { fetchOrders(); fetchStatuses(); }, [sort, dir]);

  const fetchOrders = async () => {
          try {
                    setLoading(true);
                    const res = await api.get(`/orders?sort=${sort}&dir=${dir}`);
                    setOrders(res.data);
          } catch(e) { toast.error('Failed to load orders'); }
          finally { setLoading(false); }
  };

  const fetchStatuses = async () => {
          try { const res = await api.get('/orders/meta/statuses'); setStatuses(res.data); }
          catch(e) {}
  };

  const handleSort = (field) => {
          if (sort === field) setDir(d => d === 'asc' ? 'desc' : 'asc');
          else { setSort(field); setDir('desc'); }
  };

  const openOrder = async (order) => {
          setSelectedOrder(order);
          setDetail(null);
          setNotes([]);
          setSelectedItems([]);
          setLoadingDetail(true);
          try {
                    const [dRes, nRes] = await Promise.all([
                                api.get(`/orders/${order.id}`),
                                api.get(`/orders/${order.id}/notes`)
                              ]);
                    setDetail(dRes.data);
                    setNotes(nRes.data);
          } catch(e) { toast.error('Failed to load order details'); }
          finally { setLoadingDetail(false); }
  };

  const closeOrder = () => { setSelectedOrder(null); setDetail(null); setSelectedItems([]); };

  const updateStatus = async (orderId, statusId, statusName) => {
          const currentStatus = orders.find(o => o.id === orderId);
          try {
                    await api.put(`/orders/${orderId}/status`, { status_id: statusId });
                    setOrders(prev => prev.map(o => o.id === orderId
                                                       ? { ...o, custom_status_id: statusId, status_name: statusName, status_color: statuses.find(s => s.id === statusId)?.color }
                                : o
                                                     ));
                    if (selectedOrder?.id === orderId) {
                                setSelectedOrder(prev => ({ ...prev, custom_status_id: statusId, status_name: statusName, status_color: statuses.find(s => s.id === statusId)?.color }));
                                // Reload notes to show the status change log entry
                      const nRes = await api.get(`/orders/${orderId}/notes`);
                                setNotes(nRes.data);
                    }
                    toast.success(`Status updated to ${statusName}`);
          } catch(e) { toast.error('Failed to update status'); }
  };

  const toggleItem = (invItem, quantity) => {
          if (!invItem) return;
          setSelectedItems(s => s.find(x => x.inventory_item_id === invItem.id)
                                 ? s.filter(x => x.inventory_item_id !== invItem.id)
                    : [...s, { inventory_item_id: invItem.id, sku: invItem.sku, name: invItem.name, quantity, unit_cost: '' }]
                               );
  };

  const toggleBOMItem = (comp, needed) => {
          setSelectedItems(s => s.find(x => x.inventory_item_id === comp.component_id)
                                 ? s.filter(x => x.inventory_item_id !== comp.component_id)
                    : [...s, { inventory_item_id: comp.component_id, sku: comp.component_sku, name: comp.component_name, quantity: needed, unit_cost: '' }]
                               );
  };

  const openQuoteModal = async () => {
          if (!selectedItems.length) return toast.error('Select at least one item first');
          try { const r = await api.get('/quotes'); setQuotes(r.data.filter(q => q.status !== 'ordered')); }
          catch(e) {}
          setQuoteMode('new'); setExistingQuoteId(''); setShowQuoteModal(true);
  };

  const submitToQuote = async () => {
          try {
                    const orderNum = selectedOrder.order_number;
                    let quoteNumber;
                    if (quoteMode === 'new') {
                                const r = await api.post('/quotes', {
                                              vendor_id: null, status: 'draft',
                                              notes: `Items from order #${orderNum}`,
                                              shopify_order_ids: `#${orderNum}`,
                                              items: selectedItems
                                });
                                quoteNumber = r.data.quote_number;
                                await api.post(`/orders/${selectedOrder.id}/notes`, {
                                              note: `Items sent to new quote ${quoteNumber}`,
                                              note_type: 'quote_link', linked_id: r.data.id, linked_type: 'quote'
                                });
                                toast.success(`Created quote ${quoteNumber}`);
                    } else {
                                await api.put(`/quotes/${existingQuoteId}/add-items`, { items: selectedItems, shopify_order_ids: `#${orderNum}` });
                                const q = quotes.find(x => x.id === existingQuoteId);
                                quoteNumber = q?.quote_number;
                                await api.post(`/orders/${selectedOrder.id}/notes`, {
                                              note: `Items added to existing quote ${quoteNumber}`,
                                              note_type: 'quote_link', linked_id: existingQuoteId, linked_type: 'quote'
                                });
                                toast.success(`Added to quote ${quoteNumber}`);
                    }
                    setShowQuoteModal(false);
                    setSelectedItems([]);
                    const nRes = await api.get(`/orders/${selectedOrder.id}/notes`);
                    setNotes(nRes.data);
          } catch(e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const filtered = orders.filter(o => !search ||
          o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
          o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
          o.customer_email?.toLowerCase().includes(search.toLowerCase())
                                   );

  const getStatusInfo = (order) => {
          const name = order.status_name || statuses.find(s => s.is_default)?.name || 'Paid';
          const color = order.status_color || statuses.find(s => s.is_default)?.color || '#10b981';
          return { name, color };
  };

  return (
          <div className="page-container">
            <div className="page-header">
              <div><h1 className="page-title">Orders</h1><p className="page-subtitle">Paid &amp; unfulfilled — {orders.length} orders</p></div>
      </div>

      <div className="search-bar">
              <Search size={16} className="search-icon"/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order #, customer name, or email..." className="search-input"/>
      </div>

    {loading ? <div className="loading">Loading orders...</div> : (
             <div className="table-container">
                  <table className="data-table">
                    <thead><tr>
                      <SortHeader label="Order #" field="order_number" sort={sort} dir={dir} onSort={handleSort}/>
                      <SortHeader label="Date" field="created_at" sort={sort} dir={dir} onSort={handleSort}/>
                      <SortHeader label="Customer" field="customer_name" sort={sort} dir={dir} onSort={handleSort}/>
                      <SortHeader label="Total" field="total_price" sort={sort} dir={dir} onSort={handleSort}/>
                      <th>Items</th>
                   <th>Status</th>
        </tr></thead>
                    <tbody>
    {filtered.map(order => {
                        const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
                        const preview = lineItems.slice(0,2).map(i => i.name || 'Item').join(', ');
                        const { name: sName, color: sColor } = getStatusInfo(order);
                        return (
                                              <tr key={order.id} onClick={() => openOrder(order)} style={{ cursor:'pointer' }} className="hover-row">
                            <td><span style={{ color:'#6366f1', fontWeight:600 }}>#{order.order_number}</span></td>
                        <td style={{ fontSize:12 }}>{new Date(order.created_at).toLocaleDateString()}</td>
                    <td>
                          <div style={{ fontWeight:500 }}>{order.customer_name || '—'}</div>
                      <div style={{ fontSize:11, opacity:.5 }}>{order.customer_email || ''}</div>
    </td>
                    <td style={{ fontWeight:600 }}>${parseFloat(order.total_price || 0).toFixed(2)}</td>
                    <td style={{ fontSize:12 }}>
                      <span style={{ fontWeight:600 }}>{lineItems.length}</span>
{lineItems.length > 0 && <span style={{ opacity:.5 }}> — {preview}{lineItems.length > 2 ? '...' : ''}</span>}
    </td>
                    <td onClick={e => e.stopPropagation()}>
                          <select
                        value={order.custom_status_id || ''}
                        onChange={e => {
                                                            const s = statuses.find(x => x.id === e.target.value);
                                                      if (s) updateStatus(order.id, s.id, s.name);
                        }}
                        style={{ padding:'4px 8px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:600, fontSize:12, background:`${sColor}22`, color:sColor, outline:'none', appearance:'auto' }}>
                        <option value="" disabled>{sName}</option>
{statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
    </td>
    </tr>
                );
})}
{filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign:'center', padding:32, opacity:.5 }}>No orders found.</td></tr>}
    </tbody>
    </table>
    </div>
      )}

{/* ORDER DETAIL MODAL */}
{selectedOrder && (
            <div className="modal-overlay" onClick={e => { if (e.target.className === 'modal-overlay') closeOrder(); }}>
          <div className="modal" style={{ maxWidth:860, width:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

{/* Header */}
            <div className="modal-header" style={{ flexShrink:0 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <h2 style={{ margin:0 }}>Order #{selectedOrder.order_number}</h2>
{/* Status selector inside modal */}
                  <select
                    value={selectedOrder.custom_status_id || ''}
                    onChange={e => {
                                                    const s = statuses.find(x => x.id === e.target.value);
                                              if (s) updateStatus(selectedOrder.id, s.id, s.name);
                    }}
                    style={{ padding:'5px 10px', borderRadius:12, border:'none', cursor:'pointer', fontWeight:600, fontSize:13, background:`${getStatusInfo(selectedOrder).color}22`, color:getStatusInfo(selectedOrder).color, outline:'none', appearance:'auto' }}>
                    <option value="" disabled>{getStatusInfo(selectedOrder).name}</option>
{statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
    </div>
                <div style={{ fontSize:12, opacity:.5, marginTop:4 }}>
{selectedOrder.customer_name} · {selectedOrder.customer_email} · ${parseFloat(selectedOrder.total_price || 0).toFixed(2)}
</div>
    </div>
              <button className="modal-close" onClick={closeOrder}><X size={18}/></button>
    </div>

{/* Body — scrollable */}
            <div className="modal-body" style={{ flex:1, overflowY:'auto' }}>
{loadingDetail ? (
                    <div style={{ textAlign:'center', padding:48, opacity:.5 }}>Loading order details...</div>
                  ) : detail ? (
                    <>
{/* Add to quote button */}
{selectedItems.length > 0 && (
                        <div style={{ marginBottom:16, display:'flex', justifyContent:'flex-end' }}>
                      <button className="btn btn-primary" onClick={openQuoteModal} style={{ fontSize:13 }}>
                        <Plus size={13}/> Add {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} to Quote
    </button>
    </div>
                  )}

                  <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', opacity:.5, marginBottom:10 }}>Order Items</div>

{(detail.line_items_enriched || []).length === 0 && (
                        <div style={{ opacity:.5, fontSize:13, padding:16 }}>No line items found for this order.</div>
                  )}

{(detail.line_items_enriched || []).map((item, idx) => {
                        const inv = item.inventory_item;
                        const isSelected = inv && selectedItems.find(x => x.inventory_item_id === inv.id);
                        return (
                                                  <div key={idx} style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:14, marginBottom:10, border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.07)' }}>
                                        {/* Line item row */}
                                                                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <input type="checkbox" checked={!!isSelected} onChange={() => inv && toggleItem(inv, item.quantity || 1)}
                            disabled={!inv} style={{ width:16, height:16, cursor: inv ? 'pointer' : 'not-allowed', flexShrink:0 }}/>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, fontSize:14 }}>{item.name || item.title || 'Unknown Item'}</div>
                            <div style={{ fontSize:12, opacity:.5, marginTop:2 }}>
                              SKU: {inv?.sku || item.sku || 'N/A'} &nbsp;·&nbsp; Qty ordered: <strong>{item.quantity}</strong>
{!inv && <span style={{ marginLeft:8, fontStyle:'italic', color:'#f59e0b' }}>⚠ Not matched to inventory</span>}
    </div>
    </div>
{inv && (
                                <div style={{ textAlign:'right', fontSize:12 }}>
                              <div style={{ color: inv.quantity <= inv.low_stock_threshold ? '#ef4444' : '#10b981', fontWeight:700, fontSize:14 }}>
{inv.quantity} in stock
    </div>
                              <div style={{ opacity:.5 }}>Min: {inv.low_stock_threshold}</div>
    </div>
                          )}
{inv?.is_manufactured && (
                                <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'rgba(139,92,246,0.2)', color:'#8b5cf6', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                              <Factory size={11}/> Manufactured
    </span>
                          )}
</div>

{/* BOM section for manufactured products */}
{item.bom && item.bom.length > 0 && (
                              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)', paddingLeft:28 }}>
                            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', opacity:.4, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                              <Factory size={11}/> Bill of Materials — components needed to build this item
    </div>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                              <thead>
                                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
                                  <th style={{ textAlign:'left', padding:'4px 8px 6px 0', opacity:.5, fontWeight:500 }}></th>
                                  <th style={{ textAlign:'left', padding:'4px 8px 6px 0', opacity:.5, fontWeight:500 }}>Component</th>
                                  <th style={{ textAlign:'left', padding:'4px 8px 6px 0', opacity:.5, fontWeight:500 }}>SKU</th>
                                  <th style={{ textAlign:'right', padding:'4px 8px 6px', opacity:.5, fontWeight:500 }}>Needed</th>
                                  <th style={{ textAlign:'right', padding:'4px 8px 6px', opacity:.5, fontWeight:500 }}>On Hand</th>
                                  <th style={{ textAlign:'right', padding:'4px 0 6px', opacity:.5, fontWeight:500 }}>Available</th>
    </tr>
    </thead>
                              <tbody>
{item.bom.map((comp, cidx) => {
                                      const needed = (comp.quantity || 1) * (item.quantity || 1);
                                      const available = comp.on_hand - needed;
                                      const isBOMSel = selectedItems.find(x => x.inventory_item_id === comp.component_id);
                                      return (
                                                                              <tr key={cidx} style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding:'6px 8px 6px 0' }}>
                                                      <input type="checkbox" checked={!!isBOMSel} onChange={() => toggleBOMItem(comp, needed)} style={{ width:14, height:14, cursor:'pointer' }}/>
    </td>
                                      <td style={{ padding:'6px 8px 6px 0', fontWeight:500 }}>{comp.component_name}</td>
                                      <td style={{ padding:'6px 8px 6px 0', opacity:.6, fontFamily:'monospace' }}>{comp.component_sku}</td>
                                      <td style={{ padding:'6px 8px', textAlign:'right', fontWeight:600 }}>{needed}</td>
                                      <td style={{ padding:'6px 8px', textAlign:'right' }}>{comp.on_hand}</td>
                                      <td style={{ padding:'6px 0', textAlign:'right', fontWeight:700, color: available < 0 ? '#ef4444' : available === 0 ? '#f59e0b' : '#10b981' }}>
{available}
{available < 0 && <AlertTriangle size={11} style={{ marginLeft:3, display:'inline', verticalAlign:'middle' }}/>}
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

{/* Order Activity / Notes */}
                  <div style={{ marginTop:20 }}>
                    <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', opacity:.5, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                      <Clock size={12}/> Order Activity
                      </div>
{notes.length === 0 ? (
                          <div style={{ opacity:.4, fontSize:12, fontStyle:'italic' }}>No activity yet. Status changes and quote links will appear here.</div>
                     ) : (
                                               notes.map(n => (
                                                 <div key={n.id} style={{ display:'flex', gap:10, padding:'8px 12px', background:'rgba(99,102,241,0.07)', borderRadius:8, marginBottom:6, borderLeft:'3px solid #6366f1' }}>
                          <div style={{ flex:1, fontSize:13 }}>{n.note}</div>
                          <div style={{ fontSize:11, opacity:.45, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
                            <User size={10}/> {n.author_name || 'System'} &nbsp;·&nbsp; {new Date(n.created_at).toLocaleString()}
</div>
    </div>
                      ))
                    )}
</div>
    </>
              ) : (
                                  <div style={{ opacity:.5, textAlign:'center', padding:32 }}>Failed to load details.</div>
              )}
</div>
                  </div>
                  </div>
      )}

{/* ADD TO QUOTE MODAL */}
{showQuoteModal && (
            <div className="modal-overlay" onClick={e => { if (e.target.className === 'modal-overlay') setShowQuoteModal(false); }}>
          <div className="modal" style={{ maxWidth:480 }}>
            <div className="modal-header">
                  <h2>Add Items to Quote</h2>
              <button className="modal-close" onClick={() => setShowQuoteModal(false)}><X size={18}/></button>
    </div>
            <div className="modal-body">
                  <p style={{ fontSize:13, opacity:.7, marginBottom:16 }}>{selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} from Order #{selectedOrder?.order_number}</p>
              <div style={{ display:'flex', gap:8, marginBottom:16 }}>
{['new','existing'].map(m => (
                      <button key={m} onClick={() => setQuoteMode(m)}
                    style={{ flex:1, padding:'8px 0', borderRadius:6, border:'1px solid', cursor:'pointer', fontWeight:500, fontSize:13,
                                                 background: quoteMode === m ? '#6366f1' : 'transparent',
                                                 borderColor: quoteMode === m ? '#6366f1' : 'rgba(255,255,255,0.2)', color:'inherit' }}>
{m === 'new' ? 'Create New Quote' : 'Add to Existing'}
</button>
                ))}
                    </div>
{quoteMode === 'existing' && (
                    <div className="form-group">
                      <label className="form-label">Select Quote</label>
                   <select value={existingQuoteId} onChange={e => setExistingQuoteId(e.target.value)} className="form-input">
                        <option value="">— Select a quote —</option>
 {quotes.map(q => <option key={q.id} value={q.id}>{q.quote_number} — {q.vendor_name || 'No vendor'} ({q.status})</option>)}
    </select>
    </div>
              )}
              <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:10, fontSize:12 }}>
                <div style={{ fontWeight:600, marginBottom:6, opacity:.6 }}>Items being added:</div>
{selectedItems.map((item, i) => (
                      <div key={i} style={{ padding:'3px 0', opacity:.8 }}>• {item.name} (Qty: {item.quantity})</div>
                 ))}
</div>
    </div>
            <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setShowQuoteModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitToQuote} disabled={quoteMode === 'existing' && !existingQuoteId}>
{quoteMode === 'new' ? 'Create Quote' : 'Add to Quote'}
</button>
    </div>
    </div>
    </div>
      )}

      <style>{`
              .hover-row:hover { background: rgba(255,255,255,0.04); }
                    `}</style>
          </div>
  );
}

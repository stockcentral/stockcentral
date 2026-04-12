// Orders Page - Shopify paid/unfulfilled orders with status management and quote workflow
import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Search, ChevronUp, ChevronDown, X, Plus, ShoppingBag, Package, AlertTriangle } from 'lucide-react';

function SortHeader({ label, field, sort, dir, onSort }) {
    const active = sort === field;
    return (
          <th onClick={() => onSort(field)} style={{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'}}>
      <span style={{display:'flex',alignItems:'center',gap:4}}>
{label}
{active ? (dir==='asc' ? <ChevronUp size={12}/> : <ChevronDown size={12}/>) : <ChevronDown size={12} style={{opacity:.3}}/>}
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
    const [orderDetail, setOrderDetail] = useState(null);
    const [orderNotes, setOrderNotes] = useState([]);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [quotes, setQuotes] = useState([]);
    const [quoteMode, setQuoteMode] = useState('new');
    const [existingQuoteId, setExistingQuoteId] = useState('');
    const [statusDropdown, setStatusDropdown] = useState(null);

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
        if (sort === field) setDir(d => d==='asc'?'desc':'asc');
        else { setSort(field); setDir('desc'); }
  };

  const openOrder = async (order) => {
        setSelectedOrder(order);
        setSelectedItems([]);
        setLoadingDetail(true);
        try {
                const [detail, notes] = await Promise.all([
                          api.get(`/orders/${order.id}`),
                          api.get(`/orders/${order.id}/notes`)
                        ]);
                setOrderDetail(detail.data);
                setOrderNotes(notes.data);
        } catch(e) { toast.error('Failed to load order details'); }
        finally { setLoadingDetail(false); }
  };

  const closeOrder = () => { setSelectedOrder(null); setOrderDetail(null); setSelectedItems([]); };

  const updateStatus = async (orderId, statusId) => {
        try {
                const updated = await api.put(`/orders/${orderId}/status`, { status_id: statusId });
                setOrders(o => o.map(x => x.id===orderId ? {...x, ...updated.data} : x));
                if (selectedOrder?.id === orderId) setSelectedOrder(s => ({...s, ...updated.data}));
                setStatusDropdown(null);
                toast.success('Status updated');
        } catch(e) { toast.error('Failed to update status'); }
  };

  const toggleItem = (item) => {
        setSelectedItems(s => s.find(x => x.inventory_item_id===item.inventory_item?.id)
                               ? s.filter(x => x.inventory_item_id!==item.inventory_item?.id)
                : [...s, { inventory_item_id: item.inventory_item?.id, sku: item.inventory_item?.sku, name: item.inventory_item?.name||item.name, quantity: item.quantity||1, unit_cost: '' }]
                             );
  };

  const toggleBOMItem = (comp, qty) => {
        setSelectedItems(s => s.find(x => x.inventory_item_id===comp.component_id)
                               ? s.filter(x => x.inventory_item_id!==comp.component_id)
                : [...s, { inventory_item_id: comp.component_id, sku: comp.component_sku, name: comp.component_name, quantity: qty||1, unit_cost: '' }]
                             );
  };

  const openAddToQuote = async () => {
        if (!selectedItems.length) return toast.error('Select items first');
        try { const res = await api.get('/quotes'); setQuotes(res.data.filter(q => q.status !== 'ordered')); }
        catch(e) {}
        setQuoteMode('new'); setExistingQuoteId(''); setShowQuoteModal(true);
  };

  const submitToQuote = async () => {
        try {
                const orderNumbers = selectedOrder.order_number;
                if (quoteMode === 'new') {
                          const res = await api.post('/quotes', {
                                      vendor_id: null, status: 'draft', notes: `Items from order ${orderNumbers}`,
                                      shopify_order_ids: orderNumbers, items: selectedItems
                          });
                          await api.post(`/orders/${selectedOrder.id}/notes`, {
                                      note: `Items added to quote ${res.data.quote_number} by user`,
                                      note_type: 'quote_link', linked_id: res.data.id, linked_type: 'quote'
                          });
                          toast.success(`Created quote ${res.data.quote_number}`);
                } else {
                          await api.put(`/quotes/${existingQuoteId}/add-items`, { items: selectedItems, shopify_order_ids: orderNumbers });
                          const q = quotes.find(x => x.id===existingQuoteId);
                          await api.post(`/orders/${selectedOrder.id}/notes`, {
                                      note: `Items added to quote ${q?.quote_number} by user`,
                                      note_type: 'quote_link', linked_id: existingQuoteId, linked_type: 'quote'
                          });
                          toast.success('Items added to quote');
                }
                setShowQuoteModal(false);
                setSelectedItems([]);
                const notes = await api.get(`/orders/${selectedOrder.id}/notes`);
                setOrderNotes(notes.data);
        } catch(e) { toast.error(e.response?.data?.error || 'Failed to add to quote'); }
  };

  const filtered = orders.filter(o => !search ||
        o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_email?.toLowerCase().includes(search.toLowerCase())
                                   );

  const defaultStatus = statuses.find(s => s.is_default);

  return (
        <div className="page-container">
          <div className="page-header">
            <div><h1 className="page-title">Orders</h1><p className="page-subtitle">Paid & unfulfilled — {orders.length} orders</p></div>
    </div>

      <div className="search-bar">
            <Search size={16} className="search-icon"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by order #, customer name, or email..." className="search-input"/>
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
                    const lineItems = order.line_items || [];
                    const itemCount = lineItems.length;
                    const preview = lineItems.slice(0,2).map(i=>i.name||i.title||'Item').join(', ');
                    const status = order.status_name || defaultStatus?.name || 'Paid';
                    const statusColor = order.status_color || defaultStatus?.color || '#10b981';
                    return (
                                        <tr key={order.id} onClick={()=>openOrder(order)} style={{cursor:'pointer'}} className="hover-row">
                        <td><span style={{color:'#6366f1',fontWeight:600}}>#{order.order_number}</span></td>
                      <td style={{fontSize:12}}>{new Date(order.created_at).toLocaleDateString()}</td>
                    <td>
                        <div style={{fontWeight:500}}>{order.customer_name||'—'}</div>
                      <div style={{fontSize:11,opacity:.5}}>{order.customer_email||''}</div>
  </td>
                    <td style={{fontWeight:600}}>${parseFloat(order.total_price||0).toFixed(2)}</td>
                    <td style={{fontSize:12}}>
                      <span style={{fontWeight:600}}>{itemCount}</span>
{itemCount>0&&<span style={{opacity:.5}}> — {preview}{itemCount>2?'...':''}</span>}
  </td>
                    <td onClick={e=>e.stopPropagation()}>
                        <div style={{position:'relative'}}>
                        <button onClick={()=>setStatusDropdown(statusDropdown===order.id?null:order.id)}
                          style={{padding:'4px 10px',borderRadius:12,border:'none',cursor:'pointer',fontWeight:600,fontSize:12,background:`${statusColor}22`,color:statusColor}}>
{status} ▾
  </button>
{statusDropdown===order.id&&(
                            <div style={{position:'absolute',top:'100%',left:0,zIndex:100,background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,minWidth:140,boxShadow:'0 8px 24px rgba(0,0,0,0.4)',marginTop:4}}>
{statuses.map(s=>(
                                <button key={s.id} onClick={()=>updateStatus(order.id,s.id)}
                                style={{display:'block',width:'100%',padding:'8px 12px',background:'none',border:'none',cursor:'pointer',textAlign:'left',color:'inherit',fontSize:13}}>
                                <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',background:s.color,marginRight:8}}/>
{s.name}
</button>
                            ))}
                              </div>
                        )}
</div>
                          </td>
                          </tr>
                );
})}
{filtered.length===0&&<tr><td colSpan={6} style={{textAlign:'center',padding:32,opacity:.5}}>No orders found. Sync with Shopify to import orders.</td></tr>}
  </tbody>
  </table>
  </div>
      )}

{/* Order Detail Modal */}
{selectedOrder&&(
          <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')closeOrder();}}>
          <div className="modal" style={{maxWidth:900,width:'95vw'}}>
            <div className="modal-header">
                <div>
                  <h2>Order #{selectedOrder.order_number}</h2>
                <span style={{fontSize:12,opacity:.5}}>{selectedOrder.customer_name} · {selectedOrder.customer_email} · ${parseFloat(selectedOrder.total_price||0).toFixed(2)}</span>
  </div>
              <button className="modal-close" onClick={closeOrder}><X size={18}/></button>
  </div>
            <div className="modal-body">
{loadingDetail ? <div style={{textAlign:'center',padding:32,opacity:.5}}>Loading...</div> : orderDetail && (
                <>
                    <div style={{marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontSize:13,fontWeight:600,textTransform:'uppercase',opacity:.5}}>Order Items</div>
{selectedItems.length>0&&(
                        <button className="btn btn-primary" onClick={openAddToQuote} style={{fontSize:13}}>
                        <Plus size={13}/> Add {selectedItems.length} item{selectedItems.length>1?'s':''} to Quote
  </button>
                    )}
</div>

{(orderDetail.line_items_enriched||[]).map((item,idx)=>{
                      const inv = item.inventory_item;
                      const isSelected = inv && selectedItems.find(x=>x.inventory_item_id===inv.id);
                      return (
                                              <div key={idx} style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:12,marginBottom:8,border:isSelected?'1px solid #6366f1':'1px solid transparent'}}>
                                                                   <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <input type="checkbox" checked={!!isSelected} onChange={()=>inv&&toggleItem(item)} disabled={!inv} style={{width:16,height:16}}/>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:600}}>{item.name||item.title||'Unknown Item'}</div>
                            <div style={{fontSize:12,opacity:.5}}>SKU: {inv?.sku||item.sku||'N/A'} · Qty ordered: {item.quantity}</div>
  </div>
{inv ? (
                              <div style={{textAlign:'right',fontSize:12}}>
                              <div style={{color:inv.quantity<=inv.low_stock_threshold?'#ef4444':'#10b981',fontWeight:600}}>
{inv.quantity} in stock
  </div>
                              <div style={{opacity:.5}}>Threshold: {inv.low_stock_threshold}</div>
  </div>
                          ) : (
                                                        <span style={{fontSize:11,opacity:.4,fontStyle:'italic'}}>Not in inventory</span>
                          )}
{inv?.is_manufactured&&<span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:'rgba(99,102,241,0.2)',color:'#6366f1'}}>Manufactured</span>}
  </div>

{item.bom&&item.bom.length>0&&(
                            <div style={{marginTop:10,paddingLeft:26}}>
                            <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',opacity:.4,marginBottom:6}}>Bill of Materials</div>
                            <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                              <thead><tr>
                                  <th style={{textAlign:'left',opacity:.5,fontWeight:500,paddingBottom:4}}>Select</th>
                                <th style={{textAlign:'left',opacity:.5,fontWeight:500}}>Component</th>
                                <th style={{textAlign:'left',opacity:.5,fontWeight:500}}>SKU</th>
                                <th style={{textAlign:'right',opacity:.5,fontWeight:500}}>Needed</th>
                                <th style={{textAlign:'right',opacity:.5,fontWeight:500}}>On Hand</th>
                                <th style={{textAlign:'right',opacity:.5,fontWeight:500}}>Available</th>
  </tr></thead>
                                <tbody>
{item.bom.map((comp,cidx)=>{
                                    const needed = (comp.quantity||1) * (item.quantity||1);
                                    const available = comp.on_hand - needed;
                                    const isBOMSelected = selectedItems.find(x=>x.inventory_item_id===comp.component_id);
                                    return (
                                                                          <tr key={cidx} style={{borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                                                    <td style={{padding:'4px 8px 4px 0'}}>
                                                      <input type="checkbox" checked={!!isBOMSelected} onChange={()=>toggleBOMItem(comp,needed)} style={{width:14,height:14}}/>
  </td>
                                      <td style={{padding:'4px 8px 4px 0'}}>{comp.component_name}</td>
                                      <td style={{padding:'4px 8px 4px 0',opacity:.6}}>{comp.component_sku}</td>
                                      <td style={{padding:'4px 0',textAlign:'right'}}>{needed}</td>
                                      <td style={{padding:'4px 0 4px 8px',textAlign:'right'}}>{comp.on_hand}</td>
                                      <td style={{padding:'4px 0 4px 8px',textAlign:'right',color:available<0?'#ef4444':available===0?'#f59e0b':'#10b981',fontWeight:600}}>
{available<0?`${available}`:available}
{available<0&&<AlertTriangle size={11} style={{marginLeft:4,display:'inline'}}/>}
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

{orderNotes.length>0&&(
                      <div style={{marginTop:16}}>
                      <div style={{fontSize:13,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:8}}>Order Activity</div>
{orderNotes.map(n=>(
                          <div key={n.id} style={{fontSize:12,padding:'6px 10px',background:'rgba(99,102,241,0.08)',borderRadius:6,marginBottom:4,borderLeft:'2px solid #6366f1'}}>
                          <span style={{opacity:.5}}>{new Date(n.created_at).toLocaleString()} · {n.author_name||'System'}</span>
                          <span style={{marginLeft:8}}>{n.note}</span>
  </div>
                      ))}
                        </div>
                  )}
</>
              )}
</div>
                </div>
                </div>
      )}

{/* Add to Quote Modal */}
{showQuoteModal&&(
          <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setShowQuoteModal(false);}}>
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-header"><h2>Add Items to Quote</h2><button className="modal-close" onClick={()=>setShowQuoteModal(false)}><X size={18}/></button></div>
              <div className="modal-body">
                <p style={{fontSize:13,opacity:.7,marginBottom:16}}>{selectedItems.length} item{selectedItems.length>1?'s':''} from Order #{selectedOrder?.order_number}</p>
              <div style={{display:'flex',gap:8,marginBottom:16}}>
                <button onClick={()=>setQuoteMode('new')} style={{flex:1,padding:8,borderRadius:6,border:'1px solid',cursor:'pointer',background:quoteMode==='new'?'#6366f1':'transparent',borderColor:quoteMode==='new'?'#6366f1':'rgba(255,255,255,0.2)',color:'inherit'}}>Create New Quote</button>
                <button onClick={()=>setQuoteMode('existing')} style={{flex:1,padding:8,borderRadius:6,border:'1px solid',cursor:'pointer',background:quoteMode==='existing'?'#6366f1':'transparent',borderColor:quoteMode==='existing'?'#6366f1':'rgba(255,255,255,0.2)',color:'inherit'}}>Add to Existing</button>
  </div>
{quoteMode==='existing'&&(
                  <div className="form-group">
                    <label className="form-label">Select Quote</label>
                   <select value={existingQuoteId} onChange={e=>setExistingQuoteId(e.target.value)} className="form-input">
                      <option value="">— Select a quote —</option>
 {quotes.map(q=><option key={q.id} value={q.id}>{q.quote_number} — {q.vendor_name||'No vendor'} ({q.status})</option>)}
  </select>
  </div>
              )}
              <div style={{background:'rgba(255,255,255,0.04)',borderRadius:8,padding:10,fontSize:12}}>
                <div style={{fontWeight:600,marginBottom:6,opacity:.6}}>Items being added:</div>
{selectedItems.map((item,i)=><div key={i} style={{padding:'3px 0',opacity:.8}}>• {item.name} (Qty: {item.quantity})</div>)}
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

      <style>{`
              .hover-row:hover{background:rgba(255,255,255,0.04)}
                      .btn-icon{background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;opacity:.6}
                            `}</style>
        </div>
  );
}

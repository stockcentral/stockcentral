// Quotes Page
import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, X, Search, Send, Save, MessageSquare, ChevronDown, RefreshCw } from 'lucide-react';
import { VendorSelect } from './Vendors';

const EMPTY = { vendor_id:'', notes:'', shopify_order_ids:'', status:'draft' };
const STATUS_COLORS = { draft:'#6b7280', sent:'#3b82f6', approved:'#10b981', rejected:'#ef4444', ordered:'#8b5cf6', converted:'#8b5cf6' };
const EMPTY_ITEM = { inventory_item_id:'', sku:'', name:'', quantity:1, unit_cost:'', vendor_sku:'', search:'' };

function ItemRow({ item, idx, inventory, onChange, onRemove, onConfirm, isLast }) {
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef();

  const handleSearch = (val) => {
    onChange(idx, 'search', val);
    if (!val.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const q = val.toLowerCase();
    const results = inventory.filter(i =>
      i.sku?.toLowerCase().includes(q) ||
      i.name?.toLowerCase().includes(q) ||
      i.barcode?.toLowerCase().includes(q)
    ).slice(0, 8);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  };

  const selectItem = (inv) => {
    onChange(idx, 'inventory_item_id', inv.id);
    onChange(idx, 'sku', inv.sku);
    onChange(idx, 'name', inv.name);
    onChange(idx, 'unit_cost', inv.cost || '');
    onChange(idx, 'search', `${inv.sku} — ${inv.name}`);
    setShowDropdown(false);
    onConfirm(idx);
  };

  const isConfirmed = !!item.inventory_item_id;

  return (
    <div style={{display:'grid', gridTemplateColumns:'3fr 80px 110px 90px auto', gap:8, marginBottom:6, alignItems:'start', position:'relative'}}>
      <div style={{position:'relative'}}>
        {idx === 0 && <label className="form-label" style={{marginBottom:4}}>Product (SKU, Name or Barcode)</label>}
        <input
          ref={inputRef}
          value={item.search || (isConfirmed ? `${item.sku} — ${item.name}` : '')}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => { if (searchResults.length) setShowDropdown(true); }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          className="form-input"
          placeholder="Type SKU, name or barcode..."
          style={{background: isConfirmed ? 'rgba(16,185,129,.06)' : undefined, borderColor: isConfirmed ? 'rgba(16,185,129,.3)' : undefined}}
        />
        {showDropdown && (
          <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#1e1e2e',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,zIndex:100,boxShadow:'0 8px 24px rgba(0,0,0,.5)',maxHeight:240,overflowY:'auto'}}>
            {searchResults.map(inv => (
              <div key={inv.id} onMouseDown={() => selectItem(inv)}
                style={{padding:'8px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid rgba(255,255,255,.05)'}}
                onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'}
                onMouseOut={e=>e.currentTarget.style.background=''}>
                <div style={{fontWeight:600}}>{inv.sku}</div>
                <div style={{opacity:.6,fontSize:12}}>{inv.name}{inv.barcode ? ` · ${inv.barcode}` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        {idx === 0 && <label className="form-label" style={{marginBottom:4}}>Qty</label>}
        <input type="number" min="1" value={item.quantity} onChange={e => onChange(idx, 'quantity', e.target.value)} className="form-input"/>
      </div>
      <div>
        {idx === 0 && <label className="form-label" style={{marginBottom:4}}>Unit Cost</label>}
        <input type="number" step="0.01" value={item.unit_cost} onChange={e => onChange(idx, 'unit_cost', e.target.value)} className="form-input" placeholder="0.00"/>
      </div>
      <div>
        {idx === 0 && <label className="form-label" style={{marginBottom:4}}>Vendor SKU</label>}
        <input value={item.vendor_sku||''} onChange={e => onChange(idx, 'vendor_sku', e.target.value)} className="form-input" placeholder="Optional"/>
      </div>
      <button onClick={() => onRemove(idx)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',marginTop: idx===0 ? 22 : 2, opacity:.6}}><X size={16}/></button>
    </div>
  );
}

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [isDirty, setIsDirty] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([{...EMPTY_ITEM}]);
  const [emails, setEmails] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [activeTab, setActiveTab] = useState('items');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [qRes, iRes] = await Promise.all([api.get('/quotes'), api.get('/inventory')]);
      setQuotes(qRes.data); setInventory(iRes.data);
    } catch(e) { toast.error('Failed to load quotes'); }
    finally { setLoading(false); }
  };

  const fetchEmails = async (quoteId) => {
    try { const r = await api.get(`/email/log?quote_id=${quoteId}`); setEmails(r.data || []); } catch(e) { setEmails([]); }
  };

  const openNew = () => {
    setForm(EMPTY); setSelected(null);
    setItems([{...EMPTY_ITEM}, {...EMPTY_ITEM}]);
    setEmails([]); setIsDirty(false); setActiveTab('items'); setShowModal(true);
  };

  const openQuote = async (q) => {
    setSelected(q);
    setForm({ vendor_id: q.vendor_id||'', notes: q.notes||'', shopify_order_ids: q.shopify_order_ids||'', status: q.status||'draft' });
    const confirmedItems = (q.items || []).map(i => ({...EMPTY_ITEM, ...i, search: `${i.sku} — ${i.name}`}));
    setItems([...confirmedItems, {...EMPTY_ITEM}]);
    setEmails([]); setIsDirty(false); setActiveTab('items'); setShowModal(true);
    fetchEmails(q.id);
  };

  const handleChange = (e) => { setForm(f => ({...f, [e.target.name]: e.target.value})); setIsDirty(true); };

  const closeModal = () => { setShowModal(false); setSelected(null); setIsDirty(false); setEmails([]); };

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((x, j) => j === idx ? {...x, [field]: val} : x));
    setIsDirty(true);
  };

  const confirmItem = (idx) => {
    // After confirming an item, ensure there's always a blank row at the end
    setItems(prev => {
      const updated = [...prev];
      const lastItem = updated[updated.length - 1];
      if (lastItem.inventory_item_id) updated.push({...EMPTY_ITEM});
      return updated;
    });
  };

  const removeItem = (idx) => {
    setItems(prev => {
      const updated = prev.filter((_, j) => j !== idx);
      if (updated.length === 0 || updated[updated.length-1].inventory_item_id) {
        updated.push({...EMPTY_ITEM});
      }
      return updated;
    });
    setIsDirty(true);
  };

  const handleSave = async (asSent = false) => {
    if (!form.vendor_id) return toast.error('Please select a vendor');
    setSaving(true);
    try {
      const confirmedItems = items.filter(i => i.inventory_item_id);
      const payload = { ...form, items: confirmedItems, status: asSent ? 'sent' : 'draft' };
      let quoteId;
      if (selected) {
        await api.put(`/quotes/${selected.id}`, payload);
        quoteId = selected.id;
        toast.success(asSent ? 'Quote sent to vendor!' : 'Quote saved as draft');
      } else {
        const r = await api.post('/quotes', payload);
        quoteId = r.data.id;
        toast.success(asSent ? 'Quote created and sent!' : 'Quote saved as draft');
      }
      // If sending, trigger email
      if (asSent) {
        try {
          await api.post('/email/send-quote', { quote_id: quoteId });
        } catch(e) { toast.error('Quote saved but email failed: ' + (e.response?.data?.error || e.message)); }
      }
      closeModal(); fetchAll();
    } catch(e) { toast.error(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSendingReply(true);
    try {
      await api.post('/email/send-quote-reply', { quote_id: selected.id, body: replyText });
      setReplyText('');
      fetchEmails(selected.id);
      toast.success('Reply sent');
    } catch(e) { toast.error('Failed to send reply'); }
    finally { setSendingReply(false); }
  };

  const convertToPO = async () => {
    if (!window.confirm('Convert this quote to a Purchase Order?')) return;
    try {
      await api.post(`/quotes/${selected.id}/convert`);
      toast.success('Converted to Purchase Order!');
      closeModal(); fetchAll();
    } catch(e) { toast.error(e.response?.data?.error || 'Failed to convert'); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this quote?')) return;
    try { await api.delete(`/quotes/${id}`); toast.success('Deleted'); fetchAll(); }
    catch(e) { toast.error('Failed to delete'); }
  };

  const confirmedItems = items.filter(i => i.inventory_item_id);
  const subtotal = confirmedItems.reduce((s, i) => s + ((parseFloat(i.unit_cost)||0) * (parseInt(i.quantity)||0)), 0);
  const filtered = quotes.filter(q => !search || q.quote_number?.toLowerCase().includes(search.toLowerCase()) || q.vendor_name?.toLowerCase().includes(search.toLowerCase()));

  const tabStyle = (id) => ({
    padding:'8px 16px', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:activeTab===id?600:400,
    borderBottom:activeTab===id?'2px solid #6366f1':'2px solid transparent', color:activeTab===id?'#6366f1':'inherit'
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Quote Requests</h1><p className="page-subtitle">{quotes.length} quotes · {quotes.filter(q=>q.status==='draft').length} drafts</p></div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={16}/> New Quote</button>
      </div>

      <div className="search-bar">
        <Search size={16} className="search-icon"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search quotes..." className="search-input"/>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Quote #</th><th>Vendor</th><th>Status</th><th>Items</th><th>Total</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {filtered.map(q => (
                <tr key={q.id} onClick={()=>openQuote(q)} style={{cursor:'pointer'}}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                  onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td><span style={{color:'#6366f1',fontWeight:600}}>{q.quote_number}</span></td>
                  <td>{q.vendor_name||'—'}</td>
                  <td><span style={{color:STATUS_COLORS[q.status]||'#6b7280',fontWeight:600,fontSize:12,padding:'2px 8px',borderRadius:10,background:`${STATUS_COLORS[q.status]||'#6b7280'}22`}}>{q.status}</span></td>
                  <td style={{fontSize:12,opacity:.7}}>{q.item_count||0} items</td>
                  <td>${parseFloat(q.total_amount||0).toFixed(2)}</td>
                  <td style={{fontSize:12}}>{new Date(q.created_at).toLocaleDateString()}</td>
                  <td onClick={e=>e.stopPropagation()}>
                    <button onClick={e=>handleDelete(q.id,e)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:16,padding:'4px 8px',borderRadius:4,opacity:.7}} title="Delete quote">✕</button>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:32,opacity:.5}}>No quotes found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')closeModal();}}>
          <div className="modal large-modal" style={{maxWidth:860}}>
            <div className="modal-header">
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div>
                  <h2 style={{margin:0}}>{selected ? selected.quote_number : 'New Quote Request'}</h2>
                  {selected && <span style={{fontSize:12,opacity:.5}}>Created {new Date(selected.created_at).toLocaleDateString()}</span>}
                </div>
                <span style={{color:STATUS_COLORS[form.status],fontWeight:600,fontSize:12,padding:'3px 10px',borderRadius:10,background:`${STATUS_COLORS[form.status]||'#6b7280'}22`}}>{form.status}</span>
              </div>
              <button className="modal-close" onClick={closeModal}><X size={18}/></button>
            </div>

            {/* Tabs */}
            <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,.08)',padding:'0 20px'}}>
              <button style={tabStyle('items')} onClick={()=>setActiveTab('items')}>Line Items</button>
              <button style={tabStyle('correspondence')} onClick={()=>setActiveTab('correspondence')}>
                Correspondence {emails.length > 0 && <span style={{marginLeft:4,background:'#6366f1',borderRadius:10,padding:'1px 6px',fontSize:10,color:'white'}}>{emails.length}</span>}
              </button>
            </div>

            <div className="modal-body">
              {/* Header fields — always visible */}
              <div className="form-grid-2" style={{marginBottom:16}}>
                <div className="form-group">
                  <label className="form-label">Vendor <span style={{color:'#ef4444'}}>*</span></label>
                  <VendorSelect name="vendor_id" value={form.vendor_id} onChange={handleChange} className="form-input"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Linked Order Numbers</label>
                  <input name="shopify_order_ids" value={form.shopify_order_ids||''} onChange={handleChange} className="form-input" placeholder="e.g. #1001, #1002"/>
                </div>
              </div>

              {activeTab === 'items' && (
                <>
                  <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Line Items</div>
                  {items.map((item, idx) => (
                    <ItemRow key={idx} item={item} idx={idx} inventory={inventory}
                      onChange={updateItem} onRemove={removeItem} onConfirm={confirmItem} isLast={idx===items.length-1}/>
                  ))}

                  {/* Subtotal */}
                  {confirmedItems.length > 0 && (
                    <div style={{display:'flex',justifyContent:'flex-end',padding:'12px 0',borderTop:'1px solid rgba(255,255,255,.08)',marginTop:8}}>
                      <div style={{fontSize:14,fontWeight:600}}>
                        Subtotal: <span style={{color:'#10b981',marginLeft:8}}>${subtotal.toFixed(2)}</span>
                        <span style={{opacity:.4,fontSize:12,marginLeft:8}}>({confirmedItems.length} item{confirmedItems.length!==1?'s':''})</span>
                      </div>
                    </div>
                  )}

                  {/* Notes — below line items */}
                  <div className="form-group" style={{marginTop:16}}>
                    <label className="form-label">Notes</label>
                    <textarea name="notes" value={form.notes||''} onChange={handleChange} className="form-input" rows={3} placeholder="Internal notes, special instructions..."/>
                  </div>

                  {/* Convert to PO */}
                  {selected && form.status === 'approved' && (
                    <div style={{marginTop:16,padding:12,background:'rgba(99,102,241,0.1)',borderRadius:8,border:'1px solid rgba(99,102,241,0.3)'}}>
                      <p style={{margin:'0 0 8px',fontSize:13}}>Quote approved — ready to create a Purchase Order?</p>
                      <button className="btn btn-secondary" onClick={convertToPO} style={{fontSize:13}}>Convert to Purchase Order →</button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'correspondence' && (
                <div>
                  <div style={{fontSize:12,opacity:.5,marginBottom:16}}>Email thread with vendor for this quote. Replies from the vendor appear here automatically.</div>
                  <div style={{maxHeight:320,overflowY:'auto',marginBottom:16,display:'flex',flexDirection:'column',gap:10}}>
                    {emails.length === 0 && (
                      <div style={{textAlign:'center',padding:32,opacity:.4,fontSize:13}}>
                        No correspondence yet. Send the quote to start the thread.
                      </div>
                    )}
                    {emails.map((email, idx) => (
                      <div key={idx} style={{padding:'12px 14px',borderRadius:10,
                        background:email.direction==='inbound'?'rgba(255,255,255,.05)':'rgba(99,102,241,.1)',
                        border:email.direction==='inbound'?'1px solid rgba(255,255,255,.08)':'1px solid rgba(99,102,241,.2)',
                        alignSelf:email.direction==='inbound'?'flex-start':'flex-end',maxWidth:'85%'}}>
                        <div style={{fontSize:11,opacity:.5,marginBottom:6,display:'flex',gap:8}}>
                          <span style={{fontWeight:600,color:email.direction==='inbound'?'#f59e0b':'#6366f1'}}>{email.direction==='inbound'?'Vendor':'You'}</span>
                          <span>{new Date(email.created_at||email.timestamp).toLocaleString()}</span>
                        </div>
                        <div style={{fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{email.body||email.subject}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                    <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} rows={3} className="form-input" style={{flex:1}} placeholder="Reply to vendor..."/>
                    <button onClick={sendReply} disabled={sendingReply||!replyText.trim()} className="btn btn-primary" style={{alignSelf:'stretch',padding:'10px 16px',display:'flex',alignItems:'center',gap:6}}>
                      {sendingReply?<RefreshCw size={13} style={{animation:'spin 1s linear infinite'}}/>:<Send size={13}/>} Send
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <div style={{display:'flex',gap:8,flex:1}}>
                {selected && (
                  <button className="btn btn-ghost" style={{color:'#ef4444'}} onClick={async()=>{
                    if(!window.confirm('Delete this quote?'))return;
                    try{ await api.delete(`/quotes/${selected.id}`); toast.success('Quote deleted'); closeModal(); fetchAll(); }
                    catch(e){ toast.error('Failed to delete'); }
                  }}>Delete</button>
                )}
              </div>
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-secondary" onClick={()=>handleSave(false)} disabled={saving}>
                <Save size={14}/> {saving?'Saving...':'Save Draft'}
              </button>
              <button className="btn btn-primary" onClick={()=>handleSave(true)} disabled={saving} style={{background:'#6366f1'}}>
                <Send size={14}/> Send to Vendor
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-row:hover{background:rgba(255,255,255,0.04)}
        .large-modal{max-width:860px!important}
        .form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .btn-icon{background:none;border:none;cursor:pointer;padding:4px;border-radius:4px}
        .btn-icon.danger:hover{color:#ef4444}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:600px){.form-grid-2{grid-template-columns:1fr}}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        input[type=number]{-moz-appearance:textfield}
      `}</style>
    </div>
  );
}

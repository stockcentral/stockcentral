// Quotes Page
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, X, Search, Edit, Trash2, FileText } from 'lucide-react';
import { VendorSelect } from './Vendors';

const EMPTY = { vendor_id:'', notes:'', shopify_order_id:'', shopify_order_number:'', status:'draft' };

export default function Quotes() {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [isDirty, setIsDirty] = useState(false);
    const [inventory, setInventory] = useState([]);
    const [items, setItems] = useState([]);

  useEffect(()=>{ fetchAll(); },[]);

  const fetchAll = async () => {
        try {
                setLoading(true);
                const [qRes, iRes] = await Promise.all([api.get('/quotes'), api.get('/inventory')]);
                setQuotes(qRes.data); setInventory(iRes.data);
        } catch(e) { toast.error('Failed to load quotes'); }
        finally { setLoading(false); }
  };

  const openAdd = () => { setForm(EMPTY); setEditing(null); setItems([]); setIsDirty(false); setShowModal(true); };
    const openEdit = (q) => { setForm({...EMPTY,...q}); setEditing(q.id); setItems(q.items||[]); setIsDirty(false); setShowModal(true); };

  const handleChange = (e) => { setForm(f=>({...f,[e.target.name]:e.target.value})); setIsDirty(true); };

  const attemptClose = () => {
        if (isDirty && !window.confirm('Discard changes?')) return;
        setShowModal(false); setIsDirty(false);
  };

  const addItem = () => setItems(i=>[...i,{inventory_item_id:'',quantity:1,unit_cost:''}]);
    const updateItem = (idx,field,val) => setItems(i=>i.map((x,j)=>j===idx?{...x,[field]:val}:x));
    const removeItem = (idx) => setItems(i=>i.filter((_,j)=>j!==idx));

  const handleSave = async () => {
        if (!form.vendor_id) return toast.error('Please select a vendor');
        try {
                const payload = { ...form, items };
                if (editing) { await api.put(`/quotes/${editing}`, payload); toast.success('Quote updated'); }
                else { await api.post('/quotes', payload); toast.success('Quote created'); }
                setShowModal(false); setIsDirty(false); fetchAll();
        } catch(e) { toast.error(e.response?.data?.error || 'Failed to save quote'); }
  };

  const handleDelete = async (id) => {
        if (!window.confirm('Delete this quote?')) return;
        try { await api.delete(`/quotes/${id}`); toast.success('Deleted'); fetchAll(); }
        catch(e) { toast.error('Failed to delete'); }
  };

  const filtered = quotes.filter(q => !search || q.quote_number?.toLowerCase().includes(search.toLowerCase()) || q.vendor_name?.toLowerCase().includes(search.toLowerCase()));

  const statusColor = (s) => ({draft:'#6b7280',sent:'#3b82f6',approved:'#10b981',rejected:'#ef4444'}[s]||'#6b7280');

  return (
        <div className="page-container">
          <div className="page-header">
            <div><h1 className="page-title">Quote Requests</h1><p className="page-subtitle">{quotes.length} quotes</p></div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> New Quote</button>
    </div>

      <div className="search-bar">
            <Search size={16} className="search-icon"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search quotes..." className="search-input"/>
    </div>

  {loading ? <div className="loading">Loading...</div> : (
           <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Quote #</th><th>Vendor</th><th>Status</th><th>Items</th><th>Total</th><th>Date</th><th>Actions</th></tr></thead>
               <tbody>
  {filtered.map(q=>(
                    <tr key={q.id}>
                      <td><code style={{fontSize:12}}>{q.quote_number}</code></td>
                      <td>{q.vendor_name||'—'}</td>
                  <td><span style={{color:statusColor(q.status),fontWeight:600,fontSize:12}}>{q.status}</span></td>
                    <td>{q.item_count||0}</td>
                  <td>${parseFloat(q.total_amount||0).toFixed(2)}</td>
                  <td style={{fontSize:12}}>{new Date(q.created_at).toLocaleDateString()}</td>
                  <td style={{display:'flex',gap:4}}>
                    <button className="btn btn-secondary" style={{fontSize:12,padding:'4px 10px'}} onClick={()=>openEdit(q)}><Edit size={12}/></button>
                    <button className="btn-icon danger" onClick={()=>handleDelete(q.id)}><Trash2 size={14}/></button>
  </td>
  </tr>
              ))}
{filtered.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:32,opacity:.5}}>No quotes found</td></tr>}
  </tbody>
  </table>
  </div>
      )}

{showModal&&(
          <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')attemptClose();}}>
          <div className="modal large-modal">
              <div className="modal-header"><h2>{editing?'Edit Quote':'New Quote Request'}</h2><button className="modal-close" onClick={attemptClose}><X size={18}/></button></div>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Vendor <span style={{color:'#ef4444'}}>*</span></label>
                    <VendorSelect name="vendor_id" value={form.vendor_id} onChange={handleChange} className="form-input"/>
  </div>
                <div className="form-group">
                    <label className="form-label">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="form-input">
                      <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
  </select>
  </div>
                <div className="form-group">
                    <label className="form-label">Linked Shopify Order ID</label>
                  <input name="shopify_order_id" value={form.shopify_order_id||''} onChange={handleChange} className="form-input" placeholder="Optional"/>
  </div>
                <div className="form-group">
                    <label className="form-label">Order Number</label>
                  <input name="shopify_order_number" value={form.shopify_order_number||''} onChange={handleChange} className="form-input" placeholder="Optional"/>
  </div>
  </div>
              <div className="form-group">
                  <label className="form-label">Notes</label>
                <textarea name="notes" value={form.notes||''} onChange={handleChange} className="form-input" rows={2}/>
  </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'16px 0 8px'}}>
                <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5}}>Line Items</div>
                <button className="btn btn-secondary" style={{fontSize:12}} onClick={addItem}><Plus size={12}/> Add Item</button>
  </div>
{items.map((item,idx)=>(
                  <div key={idx} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:8,marginBottom:8,alignItems:'end'}}>
                  <div className="form-group" style={{margin:0}}>
{idx===0&&<label className="form-label">Product</label>}
                     <select value={item.inventory_item_id} onChange={e=>updateItem(idx,'inventory_item_id',e.target.value)} className="form-input">
                        <option value="">— Select —</option>
 {inventory.map(i=><option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
  </select>
  </div>
                  <div className="form-group" style={{margin:0}}>
{idx===0&&<label className="form-label">Qty</label>}
                     <input type="number" min="1" value={item.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} className="form-input"/>
  </div>
                   <div className="form-group" style={{margin:0}}>
{idx===0&&<label className="form-label">Unit Cost</label>}
                     <input type="number" step="0.01" value={item.unit_cost} onChange={e=>updateItem(idx,'unit_cost',e.target.value)} className="form-input" placeholder="0.00"/>
  </div>
                   <button onClick={()=>removeItem(idx)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',marginBottom:2}}><X size={16}/></button>
  </div>
              ))}
{items.length===0&&<p style={{opacity:.5,fontSize:13,textAlign:'center',padding:'12px 0'}}>No items added yet</p>}
  </div>
            <div className="modal-footer">
                <button className="btn btn-ghost" onClick={attemptClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing?'Save Changes':'Create Quote'}</button>
  </div>
  </div>
  </div>
      )}

      <style>{`.large-modal{max-width:750px!important}.form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.btn-icon{background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;opacity:.6}.btn-icon:hover{opacity:1}.btn-icon.danger:hover{color:#ef4444}@media(max-width:600px){.form-grid-2{grid-template-columns:1fr}}`}</style>
        </div>
  );
}

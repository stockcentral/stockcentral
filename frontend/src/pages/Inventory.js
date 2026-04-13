import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Upload, Download, Package, AlertTriangle, X, Factory, Image, RefreshCw, ArrowUpRight } from 'lucide-react';

const EMPTY_ITEM = { sku:'', name:'', description:'', cost:'', price:'', quantity:'', low_stock_threshold:'5', category:'', brand:'', weight:'', length:'', width:'', height:'', harmonized_code:'', photo_url:'', country_of_origin:'', product_type:'', tags:'', collection:'', is_manufactured:false };

const FIELD_RULES = { sku:{ label:'SKU', required:true }, name:{ label:'Item Name', required:true }, cost:{ label:'Cost', hint:'e.g. 9.99' }, price:{ label:'Price', hint:'e.g. 19.99' }, quantity:{ label:'Quantity' }, low_stock_threshold:{ label:'Low Stock Alert' }, category:{ label:'Category' }, brand:{ label:'Brand' }, weight:{ label:'Weight (lbs)' }, length:{ label:'Length (in)' }, width:{ label:'Width (in)' }, height:{ label:'Height (in)' }, harmonized_code:{ label:'Harmonized Code' }, country_of_origin:{ label:'Country of Origin' }, product_type:{ label:'Product Type' }, tags:{ label:'Tags' }, collection:{ label:'Collection' }, description:{ label:'Description' } };

function InputField({ field, form, errors, onChange }) {
              const rule = FIELD_RULES[field] || { label: field };
              const hasError = errors[field];
              return (
                              <div className="form-group">
                                <label className="form-label">{rule.label}{rule.required && <span style={{color:'#ef4444'}}> *</span>}</label>
{field === 'description' ? <textarea name={field} value={form[field]||''} onChange={onChange} className={`form-input${hasError?' error-field':''}`} rows={3}/> : <input name={field} value={form[field]||''} onChange={onChange} className={`form-input${hasError?' error-field':''}`} placeholder={rule.hint||''}/>}
{hasError && <div className="field-error">{hasError}</div>}
            </div>
   );
}

export default function Inventory() {
              const [items, setItems] = useState([]);
              const [loading, setLoading] = useState(true);
              const [search, setSearch] = useState('');
              const [filterCategory, setFilterCategory] = useState('');
              const [filterPriceMin, setFilterPriceMin] = useState('');
              const [filterPriceMax, setFilterPriceMax] = useState('');
              const [showModal, setShowModal] = useState(false);
              const [editing, setEditing] = useState(null);
              const [form, setForm] = useState(EMPTY_ITEM);
              const [errors, setErrors] = useState({});
              const [photoFile, setPhotoFile] = useState(null);
              const [photoPreview, setPhotoPreview] = useState(null);
              const [pushingShopify, setPushingShopify] = useState(false);
              const [selectedIds, setSelectedIds] = useState([]);
              const [showBulkModal, setShowBulkModal] = useState(false);
              const [bulkForm, setBulkForm] = useState({ weight:'', length:'', width:'', height:'', harmonized_code:'', is_manufactured:'' });
              const [showImport, setShowImport] = useState(false);
              const [stockSummary, setStockSummary] = useState({});
              const [poModal, setPoModal] = useState(null);
              const fileRef = useRef();
              const photoRef = useRef();

  useEffect(() => { fetchItems(); fetchStockSummary(); }, []);

  const fetchStockSummary = async () => {
                  try { const r = await api.get('/inventory/stock-summary'); setStockSummary(r.data); } catch(e) {}
  };

  const fetchItems = async () => {
                  try { setLoading(true); const r = await api.get('/inventory'); setItems(r.data); } catch(e) { toast.error('Failed to load inventory'); } finally { setLoading(false); }
  };

  const openAdd = () => { setForm(EMPTY_ITEM); setEditing(null); setErrors({}); setPhotoFile(null); setPhotoPreview(null); setShowModal(true); };

  const openEdit = (item, e) => { if (e) e.stopPropagation(); setForm({...EMPTY_ITEM, ...item, is_manufactured: item.is_manufactured||false}); setEditing(item.id); setErrors({}); setPhotoFile(null); setPhotoPreview(item.photo_url||null); setShowModal(true); };

  const closeModal = () => { setShowModal(false); setErrors({}); setPhotoFile(null); setPhotoPreview(null); };

  const handleChange = (e) => { const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm(f => ({...f, [e.target.name]: val})); if (errors[e.target.name]) setErrors(er => ({...er, [e.target.name]: null})); };

  const handlePhotoChange = (e) => { const file = e.target.files[0]; if (!file) return; if (!['image/png','image/jpeg'].includes(file.type)) { toast.error('Only PNG or JPEG allowed'); return; } setPhotoFile(file); const reader = new FileReader(); reader.onload = ev => setPhotoPreview(ev.target.result); reader.readAsDataURL(file); };

  const handleSave = async () => {
                  try {
                                    let photoUrl = form.photo_url;
                                    if (photoFile) { const fd = new FormData(); fd.append('photo', photoFile); const uploadRes = await api.post('/inventory/upload-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); photoUrl = uploadRes.data.url; }
                                    const payload = { ...form, photo_url: photoUrl };
                                    if (editing) { await api.put(`/inventory/${editing}`, payload); toast.success('Item updated'); } else { await api.post('/inventory', payload); toast.success('Item added'); }
                                    closeModal(); fetchItems();
                  } catch(err) {
                                    const errs = err.response?.data?.errors;
                                    if (errs?.length) { const errMap = {}; errs.forEach(e => { errMap[e.field] = e.message; }); setErrors(errMap); toast.error(errs[0].message); setTimeout(() => { document.querySelector('.field-error')?.scrollIntoView({ behavior:'smooth', block:'center' }); }, 100); }
                                    else { toast.error(err.response?.data?.error || 'Failed to save item'); }
                  }
  };

  const handlePushToShopify = async () => { if (!editing) return; setPushingShopify(true); try { await api.post(`/inventory/${editing}/push-to-shopify`, form); toast.success('Pushed to Shopify successfully'); } catch(e) { toast.error(e.response?.data?.error || 'Push to Shopify failed'); } finally { setPushingShopify(false); } };

  const handleDelete = async (id, e) => { if (e) e.stopPropagation(); if (!window.confirm('Delete this item?')) return; try { await api.delete(`/inventory/${id}`); toast.success('Deleted'); fetchItems(); } catch(e) { toast.error('Failed to delete'); } };

  const toggleManufactured = async (item, e) => { e.stopPropagation(); try { await api.put(`/inventory/${item.id}`, { ...item, is_manufactured: !item.is_manufactured }); setItems(prev => prev.map(x => x.id===item.id ? {...x, is_manufactured: !item.is_manufactured} : x)); } catch(e) { toast.error('Failed to update'); } };

  const handleBulkUpdate = async () => {
                  if (!selectedIds.length) return toast.error('No items selected');
                  const payload = { ids: selectedIds };
                  if (bulkForm.weight !== '') payload.weight = bulkForm.weight;
                  if (bulkForm.harmonized_code !== '') payload.harmonized_code = bulkForm.harmonized_code;
                  if (bulkForm.length !== '') payload.length = bulkForm.length;
                  if (bulkForm.width !== '') payload.width = bulkForm.width;
                  if (bulkForm.height !== '') payload.height = bulkForm.height;
                  if (bulkForm.is_manufactured !== '') payload.is_manufactured = bulkForm.is_manufactured === 'true';
    try { await api.put('/inventory/bulk/update', payload); toast.success(`Updated ${selectedIds.length} items`); setShowBulkModal(false); setSelectedIds([]); fetchItems(); } catch(e) { toast.error('Bulk update failed'); }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(Boolean);
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g,'_'));
    const parsed = lines.slice(1).map(line => { const vals = line.split(','); const obj = {}; headers.forEach((h,i) => { obj[h] = vals[i]?.trim()||''; }); return obj; });
    try { const r = await api.post('/inventory/import', { items: parsed, source: 'csv' }); toast.success(r.data.message); fetchItems(); setShowImport(false); } catch(e) { toast.error('Import failed'); }
  };

  const downloadSampleCSV = () => { const csv = 'sku,name,description,cost,price,quantity,category,brand,weight,harmonized_code\nSKU001,Sample Product,Description,10.00,19.99,50,Electronics,BrandName,1.5,8471.30'; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'inventory_template.csv'; a.click(); };

  const toggleSelect = (id, e) => { e.stopPropagation(); setSelectedIds(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]); };
  const toggleSelectAll = () => setSelectedIds(s => s.length===filtered.length ? [] : filtered.map(i=>i.id));

  const categories = [...new Set(items.map(i=>i.category).filter(Boolean))].sort();

  const filtered = items.filter(i => {
    const matchSearch = !search || i.sku?.toLowerCase().includes(search.toLowerCase()) || i.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || i.category === filterCategory;
    const matchPriceMin = !filterPriceMin || parseFloat(i.price||0) >= parseFloat(filterPriceMin);
    const matchPriceMax = !filterPriceMax || parseFloat(i.price||0) <= parseFloat(filterPriceMax);
    return matchSearch && matchCat && matchPriceMin && matchPriceMax;
  });

  const iProps = { form, errors, onChange: handleChange };
  const hasFilters = search || filterCategory || filterPriceMin || filterPriceMax;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Inventory</h1><p className="page-subtitle">{items.length} items total</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {selectedIds.length > 0 && <button className="btn btn-secondary" onClick={()=>setShowBulkModal(true)}>Bulk Edit ({selectedIds.length})</button>}
          <button className="btn btn-secondary" onClick={()=>setShowImport(true)}><Upload size={16}/> Import CSV</button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Item</button>
        </div>
      </div>

      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div className="search-bar" style={{flex:1,minWidth:200,margin:0}}>
          <Search size={16} className="search-icon"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by SKU or name..." className="search-input"/>
        </div>
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} style={{padding:'8px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.12)',background:'var(--bg-secondary,#1a1a2e)',color:'inherit',fontSize:13,minWidth:130}}>
          <option value="">All Categories</option>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:12,opacity:.5,whiteSpace:'nowrap'}}>Price</span>
          <input value={filterPriceMin} onChange={e=>setFilterPriceMin(e.target.value)} placeholder="Min" type="number" style={{width:70,padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.12)',background:'var(--bg-secondary,#1a1a2e)',color:'inherit',fontSize:13}}/>
          <span style={{opacity:.4}}>-</span>
          <input value={filterPriceMax} onChange={e=>setFilterPriceMax(e.target.value)} placeholder="Max" type="number" style={{width:70,padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.12)',background:'var(--bg-secondary,#1a1a2e)',color:'inherit',fontSize:13}}/>
        </div>
        {hasFilters && <button onClick={()=>{setSearch('');setFilterCategory('');setFilterPriceMin('');setFilterPriceMax('');}} style={{padding:'7px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'none',cursor:'pointer',color:'inherit',fontSize:12,opacity:.7}}>Clear filters</button>}
        <span style={{fontSize:12,opacity:.45}}>{filtered.length} shown</span>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr>
              <th><input type="checkbox" checked={selectedIds.length===filtered.length&&filtered.length>0} onChange={toggleSelectAll}/></th>
              <th>Photo</th><th>SKU</th><th>Name</th><th>Category</th><th>Mfg?</th><th>Stock</th><th>Available</th><th>On Order</th><th>Cost</th><th>Price</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(item=>(
                <tr key={item.id} className={`hover-row${item.quantity<=item.low_stock_threshold?' low-stock-row':''}`} onClick={()=>openEdit(item)} style={{cursor:'pointer'}}>
                  <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={e=>toggleSelect(item.id,e)}/></td>
                  <td>{item.photo_url ? <img src={item.photo_url} alt="" style={{width:36,height:36,borderRadius:6,objectFit:'cover'}}/> : <div style={{width:36,height:36,borderRadius:6,background:'rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'center'}}><Package size={18} style={{opacity:.3}}/></div>}</td>
                  <td><code style={{fontSize:12}}>{item.sku}</code></td>
                  <td><div style={{display:'flex',alignItems:'center',gap:6}}>{item.name}{item.is_manufactured && <span title="Manufactured"><Factory size={13} style={{color:'#8b5cf6'}}/></span>}{item.shopify_product_id && <span title="Synced with Shopify" style={{fontSize:10,padding:'1px 5px',borderRadius:4,background:'rgba(16,185,129,.15)',color:'#10b981',fontWeight:600}}>SHF</span>}</div></td>
                  <td>{item.category||'—'}</td>
                  <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={!!item.is_manufactured} onChange={e=>toggleManufactured(item,e)} title="Toggle manufactured" style={{width:16,height:16,cursor:'pointer'}}/></td>
                  <td><span style={{color:item.quantity<=item.low_stock_threshold?'#ef4444':'inherit',fontWeight:item.quantity<=item.low_stock_threshold?600:400}}>{item.quantity}{item.quantity<=item.low_stock_threshold&&<AlertTriangle size={12} style={{marginLeft:4,display:'inline'}}/>}</span></td>
                  <td><span style={{color:item.quantity<=item.low_stock_threshold?'#ef4444':'inherit'}}>{item.quantity}</span></td>
                  <td>{stockSummary[item.id]?.on_order > 0 ? <button onClick={e=>{e.stopPropagation();setPoModal({item,pos:stockSummary[item.id].open_pos});}} style={{color:'#3b82f6',background:'none',border:'none',cursor:'pointer',fontWeight:700,fontSize:13,textDecoration:'underline'}}>{stockSummary[item.id].on_order}</button> : <span style={{opacity:.3}}>0</span>}</td>
                  <td>${parseFloat(item.cost||0).toFixed(2)}</td>
                  <td>${parseFloat(item.price||0).toFixed(2)}</td>
                  <td onClick={e=>e.stopPropagation()}>
                    <button className="btn-icon" onClick={e=>openEdit(item,e)}><Edit size={14}/></button>
                    <button className="btn-icon danger" onClick={e=>handleDelete(item.id,e)}><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={12} style={{textAlign:'center',padding:32,opacity:.5}}>No items found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {poModal&&(
        <div className="modal-overlay" onClick={()=>setPoModal(null)}>
          <div className="modal" style={{maxWidth:520}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h2>On Order — {poModal.item.name}</h2><button className="modal-close" onClick={()=>setPoModal(null)}><X size={18}/></button></div>
            <div className="modal-body">
              {(!poModal.pos||poModal.pos.length===0) ? <div style={{opacity:.5,padding:'8px 0'}}>No open purchase orders.</div> :
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead><tr style={{borderBottom:'1px solid rgba(255,255,255,.1)'}}>
                    <th style={{textAlign:'left',padding:'6px 8px',opacity:.5,fontWeight:500}}>Vendor</th>
                    <th style={{textAlign:'left',padding:'6px 8px',opacity:.5,fontWeight:500}}>PO #</th>
                    <th style={{textAlign:'right',padding:'6px 8px',opacity:.5,fontWeight:500}}>Ordered</th>
                    <th style={{textAlign:'right',padding:'6px 8px',opacity:.5,fontWeight:500}}>Received</th>
                  </tr></thead>
                  <tbody>{poModal.pos.map((po,i)=>(
                    <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,.06)'}}>
                      <td style={{padding:'8px'}}>{po.vendor_name||'—'}</td>
                      <td style={{padding:'8px'}}><a href="/purchase-orders" onClick={()=>setPoModal(null)} style={{color:'#6366f1',fontWeight:600,textDecoration:'none'}}>{po.po_number}</a></td>
                      <td style={{padding:'8px',textAlign:'right',fontWeight:600}}>{po.ordered_qty}</td>
                      <td style={{padding:'8px',textAlign:'right',opacity:.6}}>{po.received_qty}</td>
                    </tr>
                  ))}</tbody>
                </table>}
            </div>
          </div>
        </div>
      )}

      {showModal&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')closeModal();}}>
          <div className="modal large-modal">
            <div className="modal-header">
              <h2>{editing?'Edit Item':'Add New Item'}</h2>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {editing && <button className="btn btn-secondary" style={{fontSize:12,padding:'5px 12px',display:'flex',alignItems:'center',gap:5}} onClick={handlePushToShopify} disabled={pushingShopify}>{pushingShopify ? <RefreshCw size={13} style={{animation:'spin 1s linear infinite'}}/> : <ArrowUpRight size={13}/>}{pushingShopify ? 'Pushing...' : 'Push to Shopify'}</button>}
                <button className="modal-close" onClick={closeModal}><X size={18}/></button>
              </div>
            </div>
            <div className="modal-body">
              <div className="form-section-title">Product Photo</div>
              <div style={{display:'flex',gap:16,alignItems:'flex-start',marginBottom:16}}>
                <div style={{width:100,height:100,borderRadius:10,border:'2px dashed rgba(255,255,255,.15)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,background:'rgba(255,255,255,.03)'}}>
                  {photoPreview ? <img src={photoPreview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <Image size={32} style={{opacity:.2}}/>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <input ref={photoRef} type="file" accept=".png,.jpg,.jpeg" style={{display:'none'}} onChange={handlePhotoChange}/>
                  <button className="btn btn-secondary" style={{fontSize:12}} onClick={()=>photoRef.current.click()}><Upload size={13}/> {photoPreview ? 'Change Photo' : 'Upload Photo'}</button>
                  {photoPreview && <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>{setPhotoPreview(null);setPhotoFile(null);setForm(f=>({...f,photo_url:''}));}}>Remove Photo</button>}
                  <div style={{fontSize:11,opacity:.4}}>PNG or JPEG, max 5MB</div>
                  <div style={{fontSize:11,opacity:.4}}>Or enter a URL directly:</div>
                  <input name="photo_url" value={form.photo_url||''} onChange={handleChange} className="form-input" placeholder="https://..." style={{fontSize:12}}/>
                </div>
              </div>
              <div className="form-section-title">Basic Info</div>
              <div className="form-grid-2"><InputField field="sku" {...iProps}/><InputField field="name" {...iProps}/></div>
              <InputField field="description" {...iProps}/>
              <div style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0',padding:'10px 12px',background:'rgba(139,92,246,0.1)',borderRadius:8,border:'1px solid rgba(139,92,246,0.3)'}}>
                <input type="checkbox" name="is_manufactured" id="is_manufactured" checked={!!form.is_manufactured} onChange={handleChange} style={{width:18,height:18,cursor:'pointer'}}/>
                <label htmlFor="is_manufactured" style={{cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontWeight:500}}><Factory size={16} style={{color:'#8b5cf6'}}/> Manufactured Product <span style={{fontSize:12,opacity:.6,fontWeight:400}}>— has a Bill of Materials</span></label>
              </div>
              <div className="form-section-title">Pricing & Stock</div>
              <div className="form-grid-4"><InputField field="cost" {...iProps}/><InputField field="price" {...iProps}/><InputField field="quantity" {...iProps}/><InputField field="low_stock_threshold" {...iProps}/></div>
              <div className="form-section-title">Shopify Classification</div>
              <div className="form-grid-2">
                <InputField field="category" {...iProps}/><InputField field="brand" {...iProps}/>
                <InputField field="product_type" {...iProps}/><InputField field="collection" {...iProps}/>
                <InputField field="tags" {...iProps}/><InputField field="country_of_origin" {...iProps}/>
              </div>
              <div className="form-section-title">Shipping & Dimensions</div>
              <div className="form-grid-4"><InputField field="weight" {...iProps}/><InputField field="length" {...iProps}/><InputField field="width" {...iProps}/><InputField field="height" {...iProps}/></div>
              <div className="form-grid-2"><InputField field="harmonized_code" {...iProps}/></div>
              {editing && form.shopify_product_id && <div style={{marginTop:16,padding:'10px 12px',background:'rgba(16,185,129,.08)',borderRadius:8,border:'1px solid rgba(16,185,129,.2)',fontSize:12}}><span style={{color:'#10b981',fontWeight:600}}>Shopify linked</span><span style={{opacity:.5,marginLeft:8}}>Product ID: {form.shopify_product_id}</span></div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing?'Save Changes':'Add Item'}</button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setShowBulkModal(false);}}>
          <div className="modal">
            <div className="modal-header"><h2>Bulk Edit {selectedIds.length} Items</h2><button className="modal-close" onClick={()=>setShowBulkModal(false)}><X size={18}/></button></div>
            <div className="modal-body">
              <p style={{opacity:.6,marginBottom:16,fontSize:13}}>Only filled fields will be updated.</p>
              {['weight','length','width','height','harmonized_code'].map(f=>(
                <div className="form-group" key={f}><label className="form-label">{FIELD_RULES[f]?.label||f}</label><input value={bulkForm[f]||''} onChange={e=>setBulkForm(b=>({...b,[f]:e.target.value}))} className="form-input" placeholder="Leave blank to skip"/></div>
              ))}
              <div className="form-group"><label className="form-label">Manufactured</label><select value={bulkForm.is_manufactured} onChange={e=>setBulkForm(b=>({...b,is_manufactured:e.target.value}))} className="form-input"><option value="">No change</option><option value="true">Mark as Manufactured</option><option value="false">Mark as Not Manufactured</option></select></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setShowBulkModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleBulkUpdate}>Apply to {selectedIds.length} Items</button></div>
          </div>
        </div>
      )}

      {showImport&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setShowImport(false);}}>
          <div className="modal">
            <div className="modal-header"><h2>Import Inventory</h2><button className="modal-close" onClick={()=>setShowImport(false)}><X size={18}/></button></div>
            <div className="modal-body">
              <p style={{marginBottom:16}}>Upload a CSV file to bulk import inventory items.</p>
              <button className="btn btn-secondary" style={{marginBottom:16}} onClick={downloadSampleCSV}><Download size={14}/> Download Sample CSV</button>
              <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleCSVImport}/>
              <button className="btn btn-primary" onClick={()=>fileRef.current.click()}><Upload size={14}/> Choose CSV File</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .hover-row:hover{background:rgba(255,255,255,.04)}
        .error-field{border-color:#ef4444!important;box-shadow:0 0 0 2px rgba(239,68,68,0.2)!important}
        .field-error{color:#ef4444;font-size:12px;margin-top:4px}
        .low-stock-row{background:rgba(239,68,68,0.05)}
        .form-section-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin:20px 0 12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:6px}
        .form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}
        .large-modal{max-width:800

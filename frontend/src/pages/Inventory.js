import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Upload, Download, Package, AlertTriangle, X, Factory } from 'lucide-react';

const EMPTY_ITEM = { sku:'', name:'', description:'', cost:'', price:'', quantity:'', low_stock_threshold:'5', category:'', brand:'', weight:'', length:'', width:'', height:'', harmonized_code:'', photo_url:'', country_of_origin:'', product_type:'', tags:'', collection:'', is_manufactured:false };

const FIELD_RULES = {
          sku:{ label:'SKU', required:true, hint:'Letters, numbers, spaces allowed' },
          name:{ label:'Item Name', required:true },
          cost:{ label:'Cost', hint:'e.g. 9.99' }, price:{ label:'Price', hint:'e.g. 19.99' },
          quantity:{ label:'Quantity' }, low_stock_threshold:{ label:'Low Stock Alert' },
          category:{ label:'Category' }, brand:{ label:'Brand' },
          weight:{ label:'Weight (lbs)' }, length:{ label:'Length (in)' },
          width:{ label:'Width (in)' }, height:{ label:'Height (in)' },
          harmonized_code:{ label:'Harmonized Code' }, country_of_origin:{ label:'Country of Origin' },
          product_type:{ label:'Product Type' }, tags:{ label:'Tags' },
          collection:{ label:'Collection' }, photo_url:{ label:'Photo URL' }, description:{ label:'Description' },
};

// Defined OUTSIDE component to prevent remount/focus-loss on every keystroke
function InputField({ field, form, errors, onChange }) {
          const rule = FIELD_RULES[field] || { label: field };
          const hasError = errors[field];
          return (
                      <div className="form-group">
                        <label className="form-label">{rule.label}{rule.required && <span style={{color:'#ef4444'}}> *</span>}</label>
{field === 'description'
         ? <textarea name={field} value={form[field]||''} onChange={onChange} className={`form-input${hasError?' error-field':''}`} rows={3}/>
                : <input name={field} value={form[field]||''} onChange={onChange} className={`form-input${hasError?' error-field':''}`} placeholder={rule.hint||''}/>
}
{hasError && <div className="field-error">{hasError}</div>}
        </div>
   );
}

export default function Inventory() {
          const [items, setItems] = useState([]);
          const [loading, setLoading] = useState(true);
          const [search, setSearch] = useState('');
          const [showModal, setShowModal] = useState(false);
          const [editing, setEditing] = useState(null);
          const [form, setForm] = useState(EMPTY_ITEM);
          const [errors, setErrors] = useState({});
          const [selectedIds, setSelectedIds] = useState([]);
          const [showBulkModal, setShowBulkModal] = useState(false);
          const [bulkForm, setBulkForm] = useState({ weight:'', length:'', width:'', height:'', harmonized_code:'', is_manufactured:'' });
          const [showImport, setShowImport] = useState(false);
          const fileRef = useRef();

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
              try { setLoading(true); const r = await api.get('/inventory'); setItems(r.data); }
              catch(e) { toast.error('Failed to load inventory'); }
              finally { setLoading(false); }
  };

  const openAdd = () => { setForm(EMPTY_ITEM); setEditing(null); setErrors({}); setShowModal(true); };
          const openEdit = (item) => { setForm({...EMPTY_ITEM,...item, is_manufactured: item.is_manufactured||false}); setEditing(item.id); setErrors({}); setShowModal(true); };
          const closeModal = () => { setShowModal(false); setErrors({}); };

  const handleChange = (e) => {
              const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
              setForm(f => ({...f, [e.target.name]: val}));
              if (errors[e.target.name]) setErrors(er => ({...er, [e.target.name]: null}));
  };

  const handleSave = async () => {
              try {
                            if (editing) { await api.put(`/inventory/${editing}`, form); toast.success('Item updated'); }
                            else { await api.post('/inventory', form); toast.success('Item added'); }
                            closeModal(); fetchItems();
              } catch(err) {
                            const errs = err.response?.data?.errors;
                            if (errs && errs.length) {
                                            const errMap = {};
                                            errs.forEach(e => { errMap[e.field] = e.message; });
                                            setErrors(errMap);
                                            toast.error(errs[0].message);
                                            setTimeout(() => { document.querySelector('.field-error')?.scrollIntoView({ behavior:'smooth', block:'center' }); }, 100);
                            } else { toast.error(err.response?.data?.error || 'Failed to save item'); }
              }
  };

  const handleDelete = async (id) => {
              if (!window.confirm('Delete this item?')) return;
              try { await api.delete(`/inventory/${id}`); toast.success('Deleted'); fetchItems(); }
              catch(e) { toast.error('Failed to delete'); }
  };

  // Quick toggle manufactured directly from table row
  const toggleManufactured = async (item, e) => {
              e.stopPropagation();
              try {
                            await api.put(`/inventory/${item.id}`, { ...item, is_manufactured: !item.is_manufactured });
                            setItems(prev => prev.map(x => x.id===item.id ? {...x, is_manufactured: !item.is_manufactured} : x));
              } catch(e) { toast.error('Failed to update'); }
  };

  const handleBulkUpdate = async () => {
              if (!selectedIds.length) return toast.error('No items selected');
              const payload = { ids: selectedIds };
              if (bulkForm.weight !== '') payload.weight = bulkForm.weight;
              if (bulkForm.harmonized_code !== '') payload.harmonized_code = bulkForm.harmonized_code;
              if (bulkForm.length !== '') payload.length = bulkForm.length;
              if (bulkForm.width !== '') payload.width = bulkForm.width;
              if (bulkForm.height !== '') payload.height = bulkForm.height;
              if (bulkForm.is_manufactured !== '') payload.is_manufactured = bulkForm.is_manufactured === 'true';
              try {
                            await api.put('/inventory/bulk/update', payload);
                            toast.success(`Updated ${selectedIds.length} items`);
                            setShowBulkModal(false); setSelectedIds([]); fetchItems();
              } catch(e) { toast.error('Bulk update failed'); }
  };

  const handleCSVImport = async (e) => {
              const file = e.target.files[0]; if (!file) return;
              const text = await file.text();
              const lines = text.split('\n').filter(Boolean);
              const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/ /g,'_'));
              const parsed = lines.slice(1).map(line => {
                            const vals = line.split(','); const obj = {};
                            headers.forEach((h,i) => { obj[h] = vals[i]?.trim()||''; }); return obj;
              });
              try {
                            const r = await api.post('/inventory/import', { items: parsed, source: 'csv' });
                            toast.success(r.data.message); fetchItems(); setShowImport(false);
              } catch(e) { toast.error('Import failed'); }
  };

  const downloadSampleCSV = () => {
              const csv = 'sku,name,description,cost,price,quantity,category,brand,weight,harmonized_code\nSKU 001,Sample Product,Description,10.00,19.99,50,Electronics,BrandName,1.5,8471.30';
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
              a.download = 'inventory_template.csv'; a.click();
  };

  const toggleSelect = (id) => setSelectedIds(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
          const toggleSelectAll = () => setSelectedIds(s => s.length===filtered.length ? [] : filtered.map(i=>i.id));
          const filtered = items.filter(i => !search || i.sku?.toLowerCase().includes(search.toLowerCase()) || i.name?.toLowerCase().includes(search.toLowerCase()));
          const iProps = { form, errors, onChange: handleChange };

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

      <div className="search-bar">
                <Search size={16} className="search-icon"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by SKU or name..." className="search-input"/>
        </div>

{loading ? <div className="loading">Loading...</div> : (
         <div className="table-container">
                  <table className="data-table">
                    <thead><tr>
                      <th><input type="checkbox" checked={selectedIds.length===filtered.length&&filtered.length>0} onChange={toggleSelectAll}/></th>
              <th>Photo</th><th>SKU</th><th>Name</th><th>Category</th><th>Mfg?</th><th>Stock</th><th>Cost</th><th>Price</th><th>Actions</th>
        </tr></thead>
                    <tbody>
{filtered.map(item=>(
                        <tr key={item.id} className={item.quantity<=item.low_stock_threshold?'low-stock-row':''}>
                                <td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={()=>toggleSelect(item.id)}/></td>
                          <td>{item.photo_url?<img src={item.photo_url} alt="" style={{width:32,height:32,borderRadius:4,objectFit:'cover'}}/>:<Package size={24} style={{opacity:.3}}/>}</td>
                  <td><code style={{fontSize:12}}>{item.sku}</code></td>
                          <td>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
{item.name}
{item.is_manufactured && <span title="Manufactured product" style={{color:'#8b5cf6'}}><Factory size={13}/></span>}
        </div>
        </td>
                  <td>{item.category||'—'}</td>
                  <td>
                            <input type="checkbox" checked={!!item.is_manufactured} onChange={e=>toggleManufactured(item,e)}
                              title="Toggle manufactured" style={{width:16,height:16,cursor:'pointer'}}/>
        </td>
                  <td><span style={{color:item.quantity<=item.low_stock_threshold?'#ef4444':'inherit',fontWeight:item.quantity<=item.low_stock_threshold?600:400}}>
{item.quantity}{item.quantity<=item.low_stock_threshold&&<AlertTriangle size={12} style={{marginLeft:4,display:'inline'}}/>}
        </span></td>
                          <td>${parseFloat(item.cost||0).toFixed(2)}</td>
                  <td>${parseFloat(item.price||0).toFixed(2)}</td>
                  <td>
                            <button className="btn-icon" onClick={()=>openEdit(item)}><Edit size={14}/></button>
                    <button className="btn-icon danger" onClick={()=>handleDelete(item.id)}><Trash2 size={14}/></button>
        </td>
        </tr>
              ))}
{filtered.length===0&&<tr><td colSpan={10} style={{textAlign:'center',padding:32,opacity:.5}}>No items found</td></tr>}
        </tbody>
        </table>
        </div>
      )}

{showModal&&(
                <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')closeModal();}}>
          <div className="modal large-modal">
                    <div className="modal-header"><h2>{editing?'Edit Item':'Add New Item'}</h2><button className="modal-close" onClick={closeModal}><X size={18}/></button></div>
                    <div className="modal-body">
                      <div className="form-section-title">Basic Info</div>
              <div className="form-grid-2"><InputField field="sku" {...iProps}/><InputField field="name" {...iProps}/></div>
              <InputField field="description" {...iProps}/>

              <div style={{display:'flex',alignItems:'center',gap:10,margin:'12px 0',padding:'10px 12px',background:'rgba(139,92,246,0.1)',borderRadius:8,border:'1px solid rgba(139,92,246,0.3)'}}>
                <input type="checkbox" name="is_manufactured" id="is_manufactured" checked={!!form.is_manufactured} onChange={handleChange} style={{width:18,height:18,cursor:'pointer'}}/>
                <label htmlFor="is_manufactured" style={{cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontWeight:500}}>
                  <Factory size={16} style={{color:'#8b5cf6'}}/> Manufactured Product
                  <span style={{fontSize:12,opacity:.6,fontWeight:400}}>— has a Bill of Materials, components tracked separately</span>
        </label>
        </div>

              <div className="form-section-title">Pricing & Stock</div>
              <div className="form-grid-4"><InputField field="cost" {...iProps}/><InputField field="price" {...iProps}/><InputField field="quantity" {...iProps}/><InputField field="low_stock_threshold" {...iProps}/></div>
              <div className="form-section-title">Classification</div>
              <div className="form-grid-2"><InputField field="category" {...iProps}/><InputField field="brand" {...iProps}/><InputField field="product_type" {...iProps}/><InputField field="collection" {...iProps}/><InputField field="tags" {...iProps}/><InputField field="country_of_origin" {...iProps}/></div>
              <div className="form-section-title">Shipping & Dimensions</div>
              <div className="form-grid-4"><InputField field="weight" {...iProps}/><InputField field="length" {...iProps}/><InputField field="width" {...iProps}/><InputField field="height" {...iProps}/></div>
              <div className="form-grid-2"><InputField field="harmonized_code" {...iProps}/><InputField field="photo_url" {...iProps}/></div>
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
                        <div className="form-group" key={f}>
                          <label className="form-label">{FIELD_RULES[f]?.label||f}</label>
                  <input value={bulkForm[f]||''} onChange={e=>setBulkForm(b=>({...b,[f]:e.target.value}))} className="form-input" placeholder="Leave blank to skip"/>
        </div>
              ))}
              <div className="form-group">
                                      <label className="form-label">Manufactured</label>
                <select value={bulkForm.is_manufactured} onChange={e=>setBulkForm(b=>({...b,is_manufactured:e.target.value}))} className="form-input">
                                        <option value="">— No change —</option>
                  <option value="true">Mark as Manufactured</option>
                  <option value="false">Mark as Not Manufactured</option>
                      </select>
                      </div>
                      </div>
            <div className="modal-footer">
                                    <button className="btn btn-ghost" onClick={()=>setShowBulkModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkUpdate}>Apply to {selectedIds.length} Items</button>
                      </div>
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
              .error-field{border-color:#ef4444!important;box-shadow:0 0 0 2px rgba(239,68,68,0.2)!important}
                      .field-error{color:#ef4444;font-size:12px;margin-top:4px}
                              .low-stock-row{background:rgba(239,68,68,0.05)}
                                      .form-section-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;opacity:.5;margin:20px 0 12px;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:6px}
                                              .form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
                                                      .form-grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px}
                                                              .large-modal{max-width:800px!important}
                                                                      .btn-icon{background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;opacity:.6}
                                                                              .btn-icon:hover{opacity:1;background:rgba(255,255,255,0.1)}
                                                                                      .btn-icon.danger:hover{color:#ef4444}
                                                                                              @media(max-width:600px){.form-grid-2,.form-grid-4{grid-template-columns:1fr}}
                                                                                                    `}</style>
              </div>
  );
}

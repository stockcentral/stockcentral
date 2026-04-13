import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, Upload, Download, Package, AlertTriangle, X, Factory, Image, RefreshCw, ArrowUpRight } from 'lucide-react';

const EMPTY_ITEM = {
            sku:'', name:'', description:'', cost:'', price:'', quantity:'',
            low_stock_threshold:'5', category:'', brand:'', weight:'',
            length:'', width:'', height:'', harmonized_code:'', photo_url:'',
            country_of_origin:'', product_type:'', tags:'', collection:'', is_manufactured:false
};

const FIELD_RULES = {
            sku:{ label:'SKU', required:true, hint:'Letters, numbers, spaces allowed' },
            name:{ label:'Item Name', required:true },
            cost:{ label:'Cost', hint:'e.g. 9.99' },
            price:{ label:'Price', hint:'e.g. 19.99' },
            quantity:{ label:'Quantity' },
            low_stock_threshold:{ label:'Low Stock Alert' },
            category:{ label:'Category' },
            brand:{ label:'Brand' },
            weight:{ label:'Weight (lbs)' },
            length:{ label:'Length (in)' },
            width:{ label:'Width (in)' },
            height:{ label:'Height (in)' },
            harmonized_code:{ label:'Harmonized Code' },
            country_of_origin:{ label:'Country of Origin' },
            product_type:{ label:'Product Type' },
            tags:{ label:'Tags' },
            collection:{ label:'Collection' },
            description:{ label:'Description' },
};

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
            const fileRef = useRef();
            const photoRef = useRef();

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
                try { setLoading(true); const r = await api.get('/inventory'); setItems(r.data); }
                catch(e) { toast.error('Failed to load inventory'); } finally { setLoading(false); }
  };

  const openAdd = () => {
                setForm(EMPTY_ITEM); setEditing(null); setErrors({});
                setPhotoFile(null); setPhotoPreview(null); setShowModal(true);
  };

  const openEdit = (item, e) => {
                if (e) e.stopPropagation();
                setForm({...EMPTY_ITEM, ...item, is_manufactured: item.is_manufactured||false});
                setEditing(item.id); setErrors({});
                setPhotoFile(null); setPhotoPreview(item.photo_url||null);
                setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setErrors({}); setPhotoFile(null); setPhotoPreview(null); };

  const handleChange = (e) => {
                const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                setForm(f => ({...f, [e.target.name]: val}));
                if (errors[e.target.name]) setErrors(er => ({...er, [e.target.name]: null}));
  };

  const handlePhotoChange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!['image/png','image/jpeg'].includes(file.type)) { toast.error('Only PNG or JPEG allowed'); return; }
                setPhotoFile(file);
                const reader = new FileReader();
                reader.onload = ev => setPhotoPreview(ev.target.result);
                reader.readAsDataURL(file);
  };

  const handleSave = async () => {
                try {
                                let photoUrl = form.photo_url;
                                if (photoFile) {
                                                  const fd = new FormData();
                                                  fd.append('photo', photoFile);
                                                  const uploadRes = await api.post('/inventory/upload-photo', fd, {
                                                                      headers: { 'Content-Type': 'multipart/form-data' }
                                                  });
                                                  photoUrl = uploadRes.data.url;
                                }
                                const payload = { ...form, photo_url: photoUrl };
                                if (editing) {
                                                  await api.put(`/inventory/${editing}`, payload);
                                                  toast.success('Item updated');
                                } else {
                                                  await api.post('/inventory', payload);
                                                  toast.success('Item added');
                                }
                                closeModal(); fetchItems();
                } catch(err) {
                                const errs = err.response?.data?.errors;
                                if (errs?.length) {
                                                  const errMap = {}; errs.forEach(e => { errMap[e.field] = e.message; });
                                                  setErrors(errMap); toast.error(errs[0].message);
                                                  setTimeout(() => { document.querySelector('.field-error')?.scrollIntoView({ behavior:'smooth', block:'center' }); }, 100);
                                } else { toast.error(err.response?.data?.error || 'Failed to save item'); }
                }
  };

  const handlePushToShopify = async () => {
                if (!editing) return;
                setPushingShopify(true);
                try {
                                await api.post(`/inventory/${editing}/push-to-shopify`, form);
                                toast.success('Pushed to Shopify successfully');
                } catch(e) {
                                toast.error(e.response?.data?.error || 'Push to Shopify failed');
                } finally { setPushingShopify(false); }
  };

  const handleDelete = async (id, e) => {
                if (e) e.stopPropagation();
                if (!window.confirm('Delete this item?')) return;
                try { await api.delete(`/inventory/${id}`); toast.success('Deleted'); fetchItems(); }
                catch(e) { toast.error('Failed to delete'); }
  };

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
                const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'inventory_template.csv'; a.click();
  };

  const toggleSelect = (id, e) => { e.stopPropagation(); setSelectedIds(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]); };
            const toggleSelectAll = () => setSelectedIds(s => s.length===filtered.length ? [] : filtered.map(i=>i.id));

  const

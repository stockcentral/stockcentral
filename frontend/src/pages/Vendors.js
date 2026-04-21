// Vendors Page
import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Upload, Download, X, Search } from 'lucide-react';

const EMPTY = { name:'', company_name:'', email:'', phone:'', address:'', website:'', notes:'', sales_rep_name:'', sales_rep_email:'', sales_rep_phone:'' };

export function AddVendorPopup({ onCreated, onClose }) {
  const [form, setForm] = useState({ name:'', company_name:'', sales_rep_name:'', sales_rep_email:'', sales_rep_phone:'' });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Vendor name is required');
    try { setSaving(true); const res = await api.post('/vendors', form); toast.success('Vendor added!'); onCreated(res.data); }
    catch(e) { toast.error(e.response?.data?.error || 'Failed to add vendor'); } finally { setSaving(false); }
  };
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:24,width:420,maxWidth:'90vw'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <h3 style={{margin:0,fontSize:16}}>Add New Vendor</h3>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',opacity:.6}}><X size={18}/></button>
        </div>
        {[['name','Vendor Name *'],['company_name','Company Name'],['sales_rep_name','Sales Rep Name'],['sales_rep_email','Sales Rep Email'],['sales_rep_phone','Sales Rep Phone']].map(([f,l])=>(
          <div key={f} style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:12,opacity:.6,marginBottom:4}}>{l}</label>
            <input value={form[f]||''} onChange={e=>setForm(v=>({...v,[f]:e.target.value}))} className="form-input" style={{width:'100%',boxSizing:'border-box'}}/>
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{flex:1}}>{saving?'Saving...':'Add Vendor'}</button>
        </div>
      </div>
    </div>
  );
}

export function VendorSelect({ value, onChange, name, className }) {
  const [vendors, setVendors] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  useEffect(()=>{ api.get('/vendors').then(r=>setVendors(r.data)).catch(()=>{}); },[]);
  const handleCreated = (vendor) => { setVendors(v=>[...v, vendor]); onChange({ target: { name, value: vendor.id } }); setShowAdd(false); };
  return (
    <>
      <select value={value} onChange={e=>{ if(e.target.value==='__add_new__'){setShowAdd(true);}else{onChange(e);}}} name={name} className={className}>
        <option value="__add_new__">+ Add New Vendor</option>
        <option value="">— Select Vendor —</option>
        {vendors.map(v=><option key={v.id} value={v.id}>{v.name}{v.company_name?` (${v.company_name})`:''}</option>)}
      </select>
      {showAdd && <AddVendorPopup onCreated={handleCreated} onClose={()=>setShowAdd(false)}/>}
    </>
  );
}

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [isDirty, setIsDirty] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef();

  useEffect(()=>{ fetchVendors(); },[]);

  const fetchVendors = async () => {
    try { setLoading(true); const r = await api.get('/vendors'); setVendors(r.data); }
    catch(e) { toast.error('Failed to load vendors'); } finally { setLoading(false); }
  };

  const openAdd = () => { setForm(EMPTY); setEditing(null); setIsDirty(false); setShowModal(true); };
  const openEdit = (v) => { setForm({...EMPTY,...v}); setEditing(v.id); setIsDirty(false); setShowModal(true); };

  const handleChange = (e) => { setForm(f=>({...f,[e.target.name]:e.target.value})); setIsDirty(true); };

  const attemptClose = () => {
    if (isDirty && !window.confirm('Discard changes?')) return;
    setShowModal(false); setIsDirty(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Vendor name is required');
    try {
      if (editing) { await api.put(`/vendors/${editing}`, form); toast.success('Vendor updated'); }
      else { await api.post('/vendors', form); toast.success('Vendor added'); }
      setShowModal(false); setIsDirty(false); fetchVendors();
    } catch(e) { toast.error(e.response?.data?.error || 'Failed to save'); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this vendor?')) return;
    try { await api.delete(`/vendors/${id}`); toast.success('Deleted'); fetchVendors(); }
    catch(e) { toast.error('Failed to delete'); }
  };

  const downloadSampleCSV = () => {
    const csv = 'name,company_name,email,phone,sales_rep_name,sales_rep_email,sales_rep_phone\nAcme Supplies,Acme Corp,info@acme.com,555-1234,John Smith,john@acme.com,555-5678';
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vendors_template.csv'; a.click();
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(Boolean);
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/ /g,'_'));
    const vendors = lines.slice(1).map(line=>{ const vals = line.split(','); const obj = {}; headers.forEach((h,i)=>{ obj[h]=vals[i]?.trim()||''; }); return obj; });
    try { const r = await api.post('/vendors/import', { vendors, source: 'csv' }); toast.success(r.data.message); fetchVendors(); setShowImport(false); }
    catch(e) { toast.error('Import failed'); }
  };

  const filtered = vendors.filter(v => !search || v.name?.toLowerCase().includes(search.toLowerCase()) || v.company_name?.toLowerCase().includes(search.toLowerCase()));

  const Field = ({name, label, type='text'}) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input name={name} value={form[name]||''} onChange={handleChange} className="form-input" type={type}/>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Vendors</h1><p className="page-subtitle">{vendors.length} vendors</p></div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={()=>setShowImport(true)}><Upload size={16}/> Import CSV</button>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Vendor</button>
        </div>
      </div>

      <div className="search-bar">
        <Search size={16} className="search-icon"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendors..." className="search-input"/>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Vendor Name</th><th>Company</th><th>Email</th><th>Phone</th><th>Sales Rep</th><th>Rep Email</th><th>Rep Phone</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map(v=>(
                <tr key={v.id} onClick={()=>openEdit(v)} style={{cursor:'pointer'}}
                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                  onMouseOut={e=>e.currentTarget.style.background=''}>
                  <td style={{fontWeight:600}}>{v.name}</td>
                  <td>{v.company_name||'—'}</td>
                  <td>{v.email||'—'}</td>
                  <td>{v.phone||'—'}</td>
                  <td>{v.sales_rep_name||'—'}</td>
                  <td>{v.sales_rep_email||'—'}</td>
                  <td>{v.sales_rep_phone||'—'}</td>
                  <td>
                    <button className="btn-icon danger" onClick={e=>handleDelete(v.id,e)}><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={8} style={{textAlign:'center',padding:32,opacity:.5}}>No vendors found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')attemptClose();}}>
          <div className="modal large-modal">
            <div className="modal-header"><h2>{editing?'Edit Vendor':'Add Vendor'}</h2><button className="modal-close" onClick={attemptClose}><X size={18}/></button></div>
            <div className="modal-body">
              <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:12}}>Vendor Info</div>
              <div className="form-grid-2">
                <Field name="name" label="Vendor Name *"/>
                <Field name="company_name" label="Company Name"/>
                <Field name="email" label="Email" type="email"/>
                <Field name="phone" label="Phone"/>
                <Field name="address" label="Address"/>
                <Field name="website" label="Website"/>
              </div>
              <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,margin:'20px 0 12px'}}>Sales Representative</div>
              <div className="form-grid-2">
                <Field name="sales_rep_name" label="Sales Rep Name"/>
                <Field name="sales_rep_email" label="Sales Rep Email"/>
                <Field name="sales_rep_phone" label="Sales Rep Phone"/>
              </div>
              <div className="form-group" style={{marginTop:12}}>
                <label className="form-label">Notes</label>
                <textarea name="notes" value={form.notes||''} onChange={handleChange} className="form-input" rows={3}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={attemptClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing?'Save Changes':'Add Vendor'}</button>
            </div>
          </div>
        </div>
      )}

      {showImport&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setShowImport(false);}}>
          <div className="modal">
            <div className="modal-header"><h2>Import Vendors</h2><button className="modal-close" onClick={()=>setShowImport(false)}><X size={18}/></button></div>
            <div className="modal-body">
              <p style={{marginBottom:16}}>Upload a CSV file to bulk import vendors.</p>
              <button className="btn btn-secondary" style={{marginBottom:16}} onClick={downloadSampleCSV}><Download size={14}/> Download Sample CSV</button>
              <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleCSVImport}/>
              <button className="btn btn-primary" onClick={()=>fileRef.current.click()}><Upload size={14}/> Choose CSV File</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.large-modal{max-width:700px!important}.form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.btn-icon{background:none;border:none;cursor:pointer;padding:4px;border-radius:4px;opacity:.6}.btn-icon:hover{opacity:1;background:rgba(255,255,255,0.1)}.btn-icon.danger:hover{color:#ef4444}@media(max-width:600px){.form-grid-2{grid-template-columns:1fr}}`}</style>
    </div>
  );
}

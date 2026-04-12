// RMA Page
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, X, FileText, Truck, Wrench, MessageSquare, Save, AlertTriangle } from 'lucide-react';

const EMPTY = { po_id:'', inventory_item_id:'', shopify_order_id:'', shopify_order_number:'', customer_name:'', customer_email:'', quantity:'1', reason:'', resolution:'', replacement_type:'refund', notes:'', status:'pending', rma_type:'client' };
const DIRS = [{value:'inbound_from_client',label:'Inbound from Client'},{value:'outbound_to_client',label:'Outbound to Client'},{value:'to_manufacturer',label:'To Manufacturer'},{value:'from_manufacturer',label:'From Manufacturer'}];
const SC = (s) => ({pending:'#f59e0b',approved:'#6366f1',completed:'#10b981',rejected:'#ef4444',draft:'#6b7280'}[s]||'#6b7280');

export default function RMA() {
    const [rmas,setRmas]=useState([]);
    const [loading,setLoading]=useState(true);
    const [showModal,setShowModal]=useState(false);
    const [showDetail,setShowDetail]=useState(null);
    const [form,setForm]=useState(EMPTY);
    const [isDirty,setIsDirty]=useState(false);
    const [pos,setPOs]=useState([]);
    const [orders,setOrders]=useState([]);
    const [inventory,setInventory]=useState([]);
    const [notes,setNotes]=useState([]);
    const [newNote,setNewNote]=useState('');
    const [steps,setSteps]=useState([]);
    const [newStep,setNewStep]=useState({description:'',outcome:''});
    const [tracking,setTracking]=useState([]);
    const [newTrack,setNewTrack]=useState({carrier:'',tracking_number:'',direction:'inbound_from_client',notes:''});
    const [tab,setTab]=useState('details');
    const [drafts,setDrafts]=useState([]);
    const [showDrafts,setShowDrafts]=useState(false);

  useEffect(()=>{fetchAll();},[]);

  const fetchAll=async()=>{
        try{
                setLoading(true);
                const[r,p,i,o]=await Promise.all([api.get('/rma'),api.get('/purchase-orders'),api.get('/inventory'),api.get('/orders').catch(()=>({data:[]}))]);
                setRmas(r.data);setPOs(p.data);setInventory(i.data);setOrders(o.data);
        }catch(e){toast.error('Failed to load');}finally{setLoading(false);}
  };

  const fetchDrafts=async()=>{
        try{const r=await api.get('/rma/drafts');setDrafts(r.data);}catch(e){}
  };

  const handleChange=(e)=>{
        const{name,value}=e.target;
        setForm(f=>{
                const u={...f,[name]:value};
                if(name==='po_id'&&value){const po=pos.find(p=>p.id===value);if(po){u.customer_name=po.vendor_name||u.customer_name;u.customer_email=po.vendor_email||u.customer_email;}}
                if(name==='shopify_order_id'&&value){const o=orders.find(o=>o.shopify_order_id===value||o.id===value);if(o){u.customer_name=o.customer_name||u.customer_name;u.customer_email=o.customer_email||u.customer_email;u.shopify_order_number=o.order_number||u.shopify_order_number;}}
                return u;
        });
        setIsDirty(true);
  };

  const handleSave=async(asDraft=false)=>{
        try{await api.post('/rma',{...form,is_draft:asDraft});toast.success(asDraft?'Saved as draft':'RMA created');setShowModal(false);setIsDirty(false);fetchAll();}
        catch(e){toast.error(e.response?.data?.error||'Failed to create RMA');}
  };

  const attemptClose=()=>{
        if(isDirty){if(window.confirm('Save as draft before closing?')){handleSave(true);}else{setShowModal(false);setIsDirty(false);}}
        else{setShowModal(false);}
  };

  const openDetail=async(rma)=>{
        setShowDetail(rma);setTab('details');
        try{
                const[n,s,t]=await Promise.all([api.get(`/rma/${rma.id}/notes`),api.get(`/rma/${rma.id}/troubleshooting`),api.get(`/rma/${rma.id}/tracking`)]);
                setNotes(n.data);setSteps(s.data);setTracking(t.data);
        }catch(e){toast.error('Failed to load details');}
  };

  const addNote=async()=>{
        if(!newNote.trim())return;
        try{await api.post(`/rma/${showDetail.id}/notes`,{note:newNote});setNewNote('');const r=await api.get(`/rma/${showDetail.id}/notes`);setNotes(r.data);toast.success('Note added');}
        catch(e){toast.error('Failed to add note');}
  };

  const deleteNote=async(nid)=>{
        try{await api.delete(`/rma/${showDetail.id}/notes/${nid}`);setNotes(n=>n.filter(x=>x.id!==nid));}
        catch(e){toast.error(e.response?.data?.error||'Cannot delete');}
  };

  const addStep=async()=>{
        if(!newStep.description.trim())return;
        try{await api.post(`/rma/${showDetail.id}/troubleshooting`,{...newStep,step_number:steps.length+1});setNewStep({description:'',outcome:''});const r=await api.get(`/rma/${showDetail.id}/troubleshooting`);setSteps(r.data);toast.success('Step added');}
        catch(e){toast.error('Failed');}
  };

  const addTrack=async()=>{
        if(!newTrack.tracking_number.trim())return;
        try{await api.post(`/rma/${showDetail.id}/tracking`,newTrack);setNewTrack({carrier:'',tracking_number:'',direction:'inbound_from_client',notes:''});const r=await api.get(`/rma/${showDetail.id}/tracking`);setTracking(r.data);toast.success('Tracking added');}
        catch(e){toast.error('Failed');}
  };

  const cleanupDrafts=async()=>{
        if(!window.confirm('Delete drafts older than 2 weeks?'))return;
        try{const r=await api.delete('/rma/drafts/cleanup');toast.success(`Deleted ${r.data.deleted} drafts`);fetchDrafts();}
        catch(e){toast.error('Failed');}
  };

  return (
        <div className="page-container">
          <div className="page-header">
            <div><h1 className="page-title">RMA</h1><p className="page-subtitle">{rmas.filter(r=>r.status!=='draft').length} active RMAs</p></div>
          <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={()=>{fetchDrafts();setShowDrafts(true);}}>Drafts{drafts.length>0&&<span style={{background:'#6366f1',borderRadius:10,padding:'1px 6px',fontSize:11,marginLeft:4}}>{drafts.length}</span>}</button>
            <button className="btn btn-primary" onClick={()=>{setForm(EMPTY);setIsDirty(false);setShowModal(true);}}><Plus size={16}/> New RMA</button>
  </div>
  </div>

{loading?<div className="loading">Loading...</div>:(
         <div className="table-container">
            <table className="data-table">
              <thead><tr><th>RMA #</th><th>Type</th><th>Customer/Company Name</th><th>Customer/Vendor Email</th><th>Item</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
             <tbody>
{rmas.filter(r=>r.status!=='draft').map(rma=>(
                  <tr key={rma.id}>
                  <td><code style={{fontSize:12}}>{rma.rma_number}</code></td>
                    <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:4,background:rma.rma_type==='internal'?'rgba(99,102,241,0.2)':'rgba(16,185,129,0.2)'}}>{rma.rma_type==='internal'?'Internal':'Client'}</span></td>
                    <td>{rma.customer_name||'—'}</td>
                  <td>{rma.customer_email||'—'}</td>
                  <td>{rma.item_name||'—'}</td>
                  <td><span style={{color:SC(rma.status),fontWeight:600,fontSize:12}}>{rma.status}</span></td>
                    <td style={{fontSize:12}}>{new Date(rma.created_at).toLocaleDateString()}</td>
                  <td><button className="btn btn-secondary" style={{fontSize:12,padding:'4px 10px'}} onClick={()=>openDetail(rma)}>View</button></td>
  </tr>
              ))}
{rmas.filter(r=>r.status!=='draft').length===0&&<tr><td colSpan={8} style={{textAlign:'center',padding:32,opacity:0.5}}>No RMAs found</td></tr>}
  </tbody>
  </table>
  </div>
      )}

{showModal&&(
          <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')attemptClose();}}>
          <div className="modal large-modal">
              <div className="modal-header"><h2>New RMA</h2><button className="modal-close" onClick={attemptClose}><X size={18}/></button></div>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">RMA Type</label>
                <div style={{display:'flex',gap:8}}>
{['client','internal'].map(t=>(
                      <button key={t} onClick={()=>{setForm(f=>({...f,rma_type:t}));setIsDirty(true);}} style={{flex:1,padding:8,borderRadius:6,border:'1px solid',cursor:'pointer',background:form.rma_type===t?'#6366f1':'transparent',borderColor:form.rma_type===t?'#6366f1':'rgba(255,255,255,0.2)',color:'inherit'}}>
{t==='client'?'Client Return':'Internal / Manufacturing'}
</button>
                  ))}
                    </div>
                    </div>
              <div className="form-grid-2">
                                    <div className="form-group"><label className="form-label">Linked PO</label><select name="po_id" value={form.po_id} onChange={handleChange} className="form-input"><option value="">— None —</option>{pos.map(p=><option key={p.id} value={p.id}>{p.po_number} — {p.vendor_name||'Unknown'}</option>)}</select></div>
                                                                                                                                                                                                                                                                 <div className="form-group"><label className="form-label">Inventory Item</label><select name="inventory_item_id" value={form.inventory_item_id} onChange={handleChange} className="form-input"><option value="">— Select —</option>{inventory.map(i=><option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}</select></div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 {form.rma_type==='client'&&(
                                    <div className="form-grid-2">
                                      <div className="form-group"><label className="form-label">Shopify Order</label><select name="shopify_order_id" value={form.shopify_order_id} onChange={handleChange} className="form-input"><option value="">— None —</option>{orders.map(o=><option key={o.id} value={o.shopify_order_id}>{o.order_number} — {o.customer_name}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Order Number</label><input name="shopify_order_number" value={form.shopify_order_number} onChange={handleChange} className="form-input" placeholder="Auto-filled from order"/></div>
                    </div>
              )}
              <div className="form-grid-2">
                                <div className="form-group"><label className="form-label">Customer/Company Name</label><input name="customer_name" value={form.customer_name} onChange={handleChange} className="form-input" placeholder="Auto-filled from PO or order"/></div>
                <div className="form-group"><label className="form-label">Customer/Vendor Email</label><input name="customer_email" value={form.customer_email} onChange={handleChange} className="form-input" placeholder="Auto-filled from PO or order"/></div>
                </div>
              <div className="form-grid-2">
                                <div className="form-group"><label className="form-label">Quantity</label><input name="quantity" value={form.quantity} onChange={handleChange} className="form-input" type="number" min="1"/></div>
                <div className="form-group"><label className="form-label">Resolution</label><select name="replacement_type" value={form.replacement_type} onChange={handleChange} className="form-input"><option value="refund">Refund</option><option value="replacement">Replacement</option><option value="repair">Repair</option><option value="store_credit">Store Credit</option></select></div>
                </div>
              <div className="form-group"><label className="form-label">Reason</label><textarea name="reason" value={form.reason} onChange={handleChange} className="form-input" rows={3}/></div>
              <div className="form-group"><label className="form-label">Notes</label><textarea name="notes" value={form.notes} onChange={handleChange} className="form-input" rows={2}/></div>
                </div>
            <div className="modal-footer">
                              <button className="btn btn-ghost" onClick={attemptClose}>Cancel</button>
              <button className="btn btn-secondary" onClick={()=>handleSave(true)}><Save size={14}/> Save as Draft</button>
              <button className="btn btn-primary" onClick={()=>handleSave(false)}>Create RMA</button>
                </div>
                </div>
                </div>
      )}

{showDetail&&(
          <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setShowDetail(null);}}>
          <div className="modal large-modal">
              <div className="modal-header"><div><h2>{showDetail.rma_number}</h2><span style={{fontSize:12,opacity:0.6}}>{showDetail.rma_type==='internal'?'Internal':'Client'} Return</span></div><button className="modal-close" onClick={()=>setShowDetail(null)}><X size={18}/></button></div>
              <div style={{display:'flex',gap:4,padding:'0 20px',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
{[['details','Details',FileText],['notes','Notes',MessageSquare],['troubleshooting','Troubleshooting',Wrench],['tracking','Tracking',Truck]].map(([id,label,Icon])=>(
                  <button key={id} onClick={()=>setTab(id)} style={{padding:'10px 14px',background:'none',border:'none',cursor:'pointer',borderBottom:tab===id?'2px solid #6366f1':'2px solid transparent',color:tab===id?'#6366f1':'inherit',display:'flex',alignItems:'center',gap:6,fontSize:13}}><Icon size={13}/>{label}</button>
              ))}
                </div>
            <div className="modal-body">
              {tab==='details'&&(<div className="form-grid-2">
                               <div><div style={{opacity:.5,fontSize:11,marginBottom:4}}>Customer/Company Name</div><div>{showDetail.customer_name||'—'}</div></div>
                <div><div style={{opacity:.5,fontSize:11,marginBottom:4}}>Customer/Vendor Email</div><div>{showDetail.customer_email||'—'}</div></div>
                <div><div style={{opacity:.5,fontSize:11,marginBottom:4}}>Item</div><div>{showDetail.item_name||'—'}{showDetail.item_sku?` (${showDetail.item_sku})`:''}</div></div>
                <div><div style={{opacity:.5,fontSize:11,marginBottom:4}}>Qty</div><div>{showDetail.quantity}</div></div>
                <div><div style={{opacity:.5,fontSize:11,marginBottom:4}}>Status</div><div style={{color:SC(showDetail.status),fontWeight:600}}>{showDetail.status}</div></div>
                <div><div style={{opacity:.5,fontSize:11,marginBottom:4}}>Resolution</div><div>{showDetail.replacement_type||'—'}</div></div>
                <div style={{gridColumn:'1/-1'}}><div style={{opacity:.5,fontSize:11,marginBottom:4}}>Reason</div><div>{showDetail.reason||'—'}</div></div>
                </div>)}
{tab==='notes'&&(<div>
{notes.length===0&&<p style={{opacity:.5,textAlign:'center',padding:24}}>No notes yet</p>}
{notes.map(n=>(<div key={n.id} style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:12,marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{fontWeight:600,fontSize:13}}>{n.author_name}</span><div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:11,opacity:.5}}>{new Date(n.created_at).toLocaleString()}</span><button onClick={()=>deleteNote(n.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:11}}>Delete</button></div></div>
                  <p style={{margin:0,fontSize:14}}>{n.note}</p>
  </div>))}
                <div style={{display:'flex',gap:8,marginTop:8}}><textarea value={newNote} onChange={e=>setNewNote(e.target.value)} className="form-input" rows={2} placeholder="Add a note..." style={{flex:1}}/><button className="btn btn-primary" onClick={addNote} style={{alignSelf:'flex-end'}}>Add</button></div>
  </div>)}
{tab==='troubleshooting'&&(<div>
{steps.length===0&&<p style={{opacity:.5,textAlign:'center',padding:24}}>No steps yet</p>}
{steps.map(s=>(<div key={s.id} style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:12,marginBottom:8,display:'flex',gap:10}}>
                  <div style={{background:'#6366f1',borderRadius:'50%',width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>{s.step_number}</div>
                  <div><p style={{margin:'0 0 4px',fontWeight:500}}>{s.description}</p>{s.outcome&&<p style={{margin:0,fontSize:13,opacity:.7}}>Outcome: {s.outcome}</p>}<p style={{margin:'4px 0 0',fontSize:11,opacity:.4}}>{s.author_name} — {new Date(s.created_at).toLocaleString()}</p></div>
  </div>))}
                <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:12,marginTop:8}}>
                  <div className="form-group"><label className="form-label">Step Description</label><textarea value={newStep.description} onChange={e=>setNewStep(s=>({...s,description:e.target.value}))} className="form-input" rows={2}/></div>
                  <div className="form-group"><label className="form-label">Outcome</label><input value={newStep.outcome} onChange={e=>setNewStep(s=>({...s,outcome:e.target.value}))} className="form-input"/></div>
                  <button className="btn btn-primary" onClick={addStep}>Add Step</button>
  </div>
  </div>)}
{tab==='tracking'&&(<div>
{tracking.length===0&&<p style={{opacity:.5,textAlign:'center',padding:24}}>No tracking yet</p>}
{tracking.map(t=>(<div key={t.id} style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:12,marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{fontWeight:600}}>{t.carrier} — {t.tracking_number}</span><span style={{fontSize:11,background:'rgba(99,102,241,0.2)',padding:'2px 8px',borderRadius:10}}>{DIRS.find(d=>d.value===t.direction)?.label}</span></div>
{t.notes&&<p style={{margin:'4px 0 0',fontSize:13,opacity:.7}}>{t.notes}</p>}
                  <p style={{margin:'4px 0 0',fontSize:11,opacity:.4}}>{new Date(t.created_at).toLocaleString()}</p>
  </div>))}
                <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:12,marginTop:8}}>
                  <div className="form-grid-2">
                      <div className="form-group"><label className="form-label">Carrier</label><input value={newTrack.carrier} onChange={e=>setNewTrack(t=>({...t,carrier:e.target.value}))} className="form-input" placeholder="UPS, FedEx..."/></div>
                    <div className="form-group"><label className="form-label">Tracking #</label><input value={newTrack.tracking_number} onChange={e=>setNewTrack(t=>({...t,tracking_number:e.target.value}))} className="form-input"/></div>
  </div>
                  <div className="form-group"><label className="form-label">Direction</label><select value={newTrack.direction} onChange={e=>setNewTrack(t=>({...t,direction:e.target.value}))} className="form-input">{DIRS.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
                    <div className="form-group"><label className="form-label">Notes</label><input value={newTrack.notes} onChange={e=>setNewTrack(t=>({...t,notes:e.target.value}))} className="form-input"/></div>
                  <button className="btn btn-primary" onClick={addTrack}>Add Tracking</button>
  </div>
  </div>)}
  </div>
  </div>
  </div>
      )}

{showDrafts&&(
          <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setShowDrafts(false);}}>
          <div className="modal"><div className="modal-header"><h2>Draft RMAs</h2><button className="modal-close" onClick={()=>setShowDrafts(false)}><X size={18}/></button></div>
            <div className="modal-body">
{drafts.length===0&&<p style={{opacity:.5,textAlign:'center',padding:24}}>No drafts</p>}
{drafts.map(d=>(<div key={d.id} style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:12,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontWeight:600}}>{d.rma_number}</div><div style={{fontSize:12,opacity:.6}}>{d.customer_name||'No customer'} — {new Date(d.created_at).toLocaleDateString()}</div></div>
              <button className="btn btn-secondary" style={{fontSize:12}} onClick={()=>{setForm({...EMPTY,...d});setShowDrafts(false);setShowModal(true);setIsDirty(true);}}>Edit</button>
  </div>))}
  </div>
          <div className="modal-footer"><button className="btn btn-ghost" style={{color:'#ef4444'}} onClick={cleanupDrafts}><AlertTriangle size={14}/> Delete Drafts Older Than 2 Weeks</button><button className="btn btn-ghost" onClick={()=>setShowDrafts(false)}>Close</button></div>
  </div>
  </div>
      )}
      <style>{`.large-modal{max-width:800px!important}.form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:600px){.form-grid-2{grid-template-columns:1fr}}`}</style>
        </div>
  );
}

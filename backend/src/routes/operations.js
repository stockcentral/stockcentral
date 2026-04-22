const express = require('express');
const { pool } = require('../models/database');
const auth = require('../middleware/auth');

const isValidUUID = (v) => v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const toUUID = (v) => isValidUUID(v) ? v : null;

const rmaRouter = express.Router();
rmaRouter.use(auth);

rmaRouter.get('/', async (req, res) => {
    try {
          const result = await pool.query(`SELECT r.*, ii.name as item_name, ii.sku as item_sku, v.name as vendor_name FROM rmas r LEFT JOIN inventory_items ii ON r.inventory_item_id = ii.id LEFT JOIN purchase_orders po ON r.po_id = po.id LEFT JOIN vendors v ON po.vendor_id = v.id ORDER BY r.created_at DESC`);
          res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.get('/drafts', async (req, res) => {
    try {
          const result = await pool.query("SELECT * FROM rmas WHERE status='draft' ORDER BY created_at DESC");
          res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.delete('/drafts/cleanup', async (req, res) => {
    try {
          const result = await pool.query("DELETE FROM rmas WHERE status='draft' AND created_at < NOW() - INTERVAL '14 days' RETURNING id");
          res.json({ deleted: result.rowCount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/', async (req, res) => {
    try {
          const { po_id, inventory_item_id, shopify_order_id, shopify_order_number, customer_name, customer_email, quantity, reason, resolution, replacement_type, notes, status, is_draft, rma_type } = req.body;
          const rmaNumber = 'RMA-' + Date.now() + '-' + Math.floor(Math.random()*1000);
          const finalStatus = is_draft ? 'draft' : (status || 'pending');
          const result = await pool.query(
                  'INSERT INTO rmas (rma_number, po_id, inventory_item_id, shopify_order_id, shopify_order_number, customer_name, customer_email, quantity, reason, resolution, replacement_type, notes, status, rma_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
                  [rmaNumber, toUUID(po_id), toUUID(inventory_item_id), shopify_order_id||null, shopify_order_number||null, customer_name||null, customer_email||null, parseInt(quantity)||1, reason||null, resolution||null, replacement_type||null, notes||null, finalStatus, rma_type||'client']
                );
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.put('/:id', async (req, res) => {
    try {
          const { status, resolution, replacement_type, notes, customer_name, customer_email } = req.body;
          const result = await pool.query('UPDATE rmas SET status=$1, resolution=$2, replacement_type=$3, notes=$4, customer_name=$5, customer_email=$6, updated_at=NOW() WHERE id=$7 RETURNING *', [status, resolution, replacement_type, notes, customer_name, customer_email, req.params.id]);
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.get('/:id/notes', async (req, res) => {
    try {
          const result = await pool.query('SELECT n.*, u.name as author_name FROM rma_notes n JOIN users u ON n.user_id = u.id WHERE n.rma_id=$1 ORDER BY n.created_at ASC', [req.params.id]);
          res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/:id/notes', async (req, res) => {
    try {
          const result = await pool.query('INSERT INTO rma_notes (rma_id, user_id, note) VALUES ($1,$2,$3) RETURNING *', [req.params.id, req.user.id, req.body.note]);
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.put('/:rmaId/notes/:noteId', async (req, res) => {
    try {
          const result = await pool.query('UPDATE rma_notes SET note=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *', [req.body.note, req.params.noteId, req.user.id]);
          if (!result.rows.length) return res.status(403).json({ error: 'Not authorized' });
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.delete('/:rmaId/notes/:noteId', async (req, res) => {
    try {
          const result = await pool.query('DELETE FROM rma_notes WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.noteId, req.user.id]);
          if (!result.rows.length) return res.status(403).json({ error: 'Not authorized' });
          res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.get('/:id/troubleshooting', async (req, res) => {
    try {
          const result = await pool.query('SELECT t.*, u.name as author_name FROM rma_troubleshooting t JOIN users u ON t.user_id = u.id WHERE t.rma_id=$1 ORDER BY t.step_number ASC', [req.params.id]);
          res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/:id/troubleshooting', async (req, res) => {
    try {
          const { step_number, description, outcome } = req.body;
          const result = await pool.query('INSERT INTO rma_troubleshooting (rma_id, user_id, step_number, description, outcome) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.params.id, req.user.id, step_number, description, outcome||null]);
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.get('/:id/tracking', async (req, res) => {
    try {
          const result = await pool.query('SELECT * FROM rma_tracking WHERE rma_id=$1 ORDER BY created_at ASC', [req.params.id]);
          res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

rmaRouter.post('/:id/tracking', async (req, res) => {
    try {
          const { carrier, tracking_number, direction, notes } = req.body;
          const result = await pool.query('INSERT INTO rma_tracking (rma_id, carrier, tracking_number, direction, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.params.id, carrier, tracking_number, direction||'inbound_from_client', notes||null]);
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// BOM Page - Multi-template support
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Layers, Edit2, Check, X, Copy, Download, AlertTriangle, Star } from 'lucide-react';

export default function BOM() {
  const [inventory, setInventory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [bom, setBom] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [newComp, setNewComp] = useState({ component_id: null, quantity: 1, notes: '', compSearch: '' });
  const [editingRow, setEditingRow] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [buildQty, setBuildQty] = useState(1);
  const [laborCost, setLaborCost] = useState(0);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [editingTemplateName, setEditingTemplateName] = useState(false);
  const [templateNameEdit, setTemplateNameEdit] = useState('');

  useEffect(() => { api.get('/inventory').then(r => setInventory(r.data)).catch(()=>{}); }, []);

  const manufacturedItems = inventory.filter(i => i.is_manufactured);
  const allItems = showAllProducts ? inventory : manufacturedItems;
  const filteredProducts = allItems.filter(i =>
    i.sku?.toLowerCase().includes(productSearch.toLowerCase()) ||
    i.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const loadTemplates = async (product) => {
    setSelectedProduct(product);
    setSelectedTemplate(null);
    setBom([]);
    try {
      const r = await api.get(`/bom/templates/${product.id}`);
      setTemplates(r.data || []);
      if (r.data?.length > 0) {
        const def = r.data.find(t => t.is_default) || r.data[0];
        loadBOM(def);
      }
    } catch(e) { setTemplates([]); }
  };

  const loadBOM = async (template) => {
    setSelectedTemplate(template);
    setLaborCost(0);
    try {
      const r = await api.get(`/bom/${template.finished_product_id}?template_id=${template.id}`);
      setBom(r.data || []);
    } catch(e) { setBom([]); }
  };

  const createTemplate = async () => {
    if (!newTemplateName.trim()) return toast.error('Enter a name');
    try {
      const r = await api.post('/bom/templates', {
        finished_product_id: selectedProduct.id,
        name: newTemplateName.trim()
      });
      setTemplates(t => [...t, r.data]);
      setNewTemplateName(''); setShowNewTemplate(false);
      loadBOM(r.data);
      toast.success('BOM created');
    } catch(e) { toast.error('Failed'); }
  };

  const renameTemplate = async () => {
    if (!templateNameEdit.trim()) return;
    try {
      await api.put(`/bom/templates/${selectedTemplate.id}`, { name: templateNameEdit });
      setTemplates(t => t.map(x => x.id === selectedTemplate.id ? {...x, name: templateNameEdit} : x));
      setSelectedTemplate(t => ({...t, name: templateNameEdit}));
      setEditingTemplateName(false);
      toast.success('Renamed');
    } catch(e) { toast.error('Failed'); }
  };

  const deleteTemplate = async () => {
    if (!window.confirm(`Delete BOM "${selectedTemplate.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/bom/templates/${selectedTemplate.id}`);
      const remaining = templates.filter(t => t.id !== selectedTemplate.id);
      setTemplates(remaining);
      if (remaining.length > 0) loadBOM(remaining[0]);
      else { setSelectedTemplate(null); setBom([]); }
      toast.success('BOM deleted');
    } catch(e) { toast.error('Failed'); }
  };

  const setDefault = async () => {
    try {
      await api.put(`/bom/templates/${selectedTemplate.id}`, { is_default: true });
      setTemplates(t => t.map(x => ({...x, is_default: x.id === selectedTemplate.id})));
      setSelectedTemplate(t => ({...t, is_default: true}));
      toast.success('Set as default BOM');
    } catch(e) { toast.error('Failed'); }
  };

  const cloneTemplate = async () => {
    const name = prompt(`Name for the cloned BOM:`, `${selectedTemplate.name} (copy)`);
    if (!name) return;
    try {
      const r = await api.post('/bom/templates', { finished_product_id: selectedProduct.id, name });
      for (const comp of bom) {
        await api.post('/bom', { finished_product_id: selectedProduct.id, component_id: comp.component_id, quantity: comp.quantity, notes: comp.notes, bom_template_id: r.data.id });
      }
      setTemplates(t => [...t, r.data]);
      loadBOM(r.data);
      toast.success('BOM cloned');
    } catch(e) { toast.error('Failed to clone'); }
  };

  const addComponent = async (e) => {
    e.preventDefault();
    if (!newComp.component_id) return toast.error('Select a component');
    if (!selectedTemplate) return toast.error('Select or create a BOM first');
    try {
      await api.post('/bom', {
        finished_product_id: selectedProduct.id,
        component_id: newComp.component_id,
        quantity: newComp.quantity,
        notes: newComp.notes,
        bom_template_id: selectedTemplate.id
      });
      toast.success('Component added');
      loadBOM(selectedTemplate);
      setNewComp({ component_id: null, quantity: 1, notes: '', compSearch: '' });
    } catch(err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const removeComponent = async (id) => {
    if (!window.confirm('Remove this component?')) return;
    try { await api.delete(`/bom/${id}`); loadBOM(selectedTemplate); }
    catch { toast.error('Error'); }
  };

  const saveEditQty = async (id) => {
    if (!editQty || parseFloat(editQty) <= 0) return toast.error('Invalid quantity');
    try {
      await api.put(`/bom/${id}`, { quantity: parseFloat(editQty) });
      toast.success('Updated');
      setEditingRow(null);
      loadBOM(selectedTemplate);
    } catch(e) { toast.error('Failed'); }
  };

  const exportCSV = () => {
    const rows = [['SKU','Component','Qty Required','Unit Cost','Total Cost','Sales Price','In Stock']];
    bom.forEach(c => rows.push([
      c.component_sku, c.component_name, c.quantity,
      parseFloat(c.component_cost||0).toFixed(2),
      (parseFloat(c.component_cost||0)*parseFloat(c.quantity||0)).toFixed(2),
      parseFloat(c.component_price||0).toFixed(2),
      c.component_stock
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `BOM-${selectedProduct.sku}-${selectedTemplate.name}.csv`; a.click();
  };

  const filteredComponents = inventory.filter(i =>
    (i.sku?.toLowerCase().includes(newComp.compSearch?.toLowerCase()||'') ||
     i.name?.toLowerCase().includes(newComp.compSearch?.toLowerCase()||'')) &&
    (!selectedProduct || i.id !== selectedProduct.id)
  );

  // Cost calculations
  const materialCost = bom.reduce((s,c) => s + (parseFloat(c.component_cost||0) * parseFloat(c.quantity||0)), 0);
  const totalSalesValue = bom.reduce((s,c) => s + (parseFloat(c.component_price||0) * parseFloat(c.quantity||0)), 0);
  const totalCost = materialCost + parseFloat(laborCost||0);
  const finishedPrice = selectedProduct ? parseFloat(selectedProduct.price||0) : 0;
  const margin = finishedPrice > 0 ? ((finishedPrice - totalCost) / finishedPrice * 100) : 0;
  const canBuild = bom.length > 0 ? Math.min(...bom.map(c => Math.floor(parseInt(c.component_stock||0) / parseFloat(c.quantity||1)))) : 0;

  const buildReqs = bom.map(c => {
    const needed = parseFloat(c.quantity||1) * buildQty;
    const stock = parseInt(c.component_stock||0);
    const short = Math.max(0, needed - stock);
    return {...c, needed, stock, short, ok: short === 0};
  });

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Bill of Materials</h1><p className="page-subtitle">Manage component lists for manufactured products</p></div>
      </div>

      <div style={{display:'flex', gap:20}}>
        {/* Product List */}
        <div style={{width:260, flexShrink:0}}>
          <input placeholder="Search products..." value={productSearch} onChange={e=>setProductSearch(e.target.value)}
            className="form-input" style={{marginBottom:8,width:'100%',boxSizing:'border-box'}}/>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:11,opacity:.5}}>{filteredProducts.length} products</span>
            <button onClick={()=>setShowAllProducts(s=>!s)} style={{fontSize:11,background:'none',border:'none',cursor:'pointer',color:'#6366f1'}}>
              {showAllProducts ? 'Mfg only' : 'Show all'}
            </button>
          </div>
          {!showAllProducts && manufacturedItems.length === 0 && (
            <div style={{padding:10,background:'rgba(245,158,11,.08)',borderRadius:8,border:'1px solid rgba(245,158,11,.2)',fontSize:11,marginBottom:8}}>
              No manufactured items. Open an inventory item and enable "Is Manufactured".
            </div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:500,overflowY:'auto'}}>
            {filteredProducts.map(p => (
              <div key={p.id} onClick={()=>loadTemplates(p)}
                style={{background:selectedProduct?.id===p.id?'var(--accent-dim)':'var(--bg-card)',
                  border:`1px solid ${selectedProduct?.id===p.id?'var(--accent)':'var(--border)'}`,
                  borderRadius:8,padding:'10px 14px',cursor:'pointer'}}>
                <div style={{fontWeight:500,fontSize:13,color:selectedProduct?.id===p.id?'var(--accent-light)':'var(--text-primary)'}}>{p.name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'monospace'}}>{p.sku}</div>
                {p.is_manufactured && <span style={{fontSize:10,padding:'1px 5px',borderRadius:3,background:'rgba(139,92,246,.2)',color:'#a78bfa',fontWeight:600}}>MFG</span>}
              </div>
            ))}
          </div>
        </div>

        {/* BOM Detail */}
        <div style={{flex:1, minWidth:0}}>
          {!selectedProduct ? (
            <div className="empty-state" style={{height:400}}>
              <Layers size={32}/><p>Select a product to manage its BOMs</p>
            </div>
          ) : (
            <>
              {/* Product header + BOM tabs */}
              <div style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div>
                    <h2 style={{fontSize:17,fontWeight:700,margin:0}}>{selectedProduct.name}</h2>
                    <div style={{fontSize:12,opacity:.5}}>{selectedProduct.sku} · Selling price: ${parseFloat(selectedProduct.price||0).toFixed(2)}</div>
                  </div>
                </div>

                {/* BOM Template Tabs */}
                <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
                  {templates.map(t => (
                    <button key={t.id} onClick={()=>loadBOM(t)}
                      style={{padding:'6px 14px',borderRadius:8,border:`1px solid ${selectedTemplate?.id===t.id?'#6366f1':'rgba(255,255,255,.15)'}`,
                        background:selectedTemplate?.id===t.id?'rgba(99,102,241,.15)':'rgba(255,255,255,.04)',
                        cursor:'pointer',color:'inherit',fontSize:13,fontWeight:selectedTemplate?.id===t.id?600:400,
                        display:'flex',alignItems:'center',gap:5}}>
                      {t.is_default && <Star size={10} style={{color:'#f59e0b'}}/>}
                      {t.name}
                    </button>
                  ))}
                  {showNewTemplate ? (
                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                      <input value={newTemplateName} onChange={e=>setNewTemplateName(e.target.value)}
                        placeholder="BOM name..." autoFocus
                        onKeyDown={e=>{if(e.key==='Enter')createTemplate();if(e.key==='Escape')setShowNewTemplate(false);}}
                        style={{padding:'5px 10px',borderRadius:6,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'inherit',fontSize:13,width:140}}/>
                      <button onClick={createTemplate} className="btn btn-primary" style={{fontSize:12,padding:'4px 10px'}}>Create</button>
                      <button onClick={()=>setShowNewTemplate(false)} style={{background:'none',border:'none',cursor:'pointer',opacity:.5,color:'inherit'}}><X size={14}/></button>
                    </div>
                  ) : (
                    <button onClick={()=>setShowNewTemplate(true)}
                      style={{padding:'6px 12px',borderRadius:8,border:'1px dashed rgba(99,102,241,.4)',background:'none',cursor:'pointer',color:'#6366f1',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                      <Plus size={12}/> New BOM
                    </button>
                  )}
                </div>
              </div>

              {!selectedTemplate ? (
                <div className="empty-state" style={{height:200}}>
                  <p style={{opacity:.5}}>Select a BOM or create a new one</p>
                </div>
              ) : (
                <>
                  {/* Selected BOM actions */}
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                    {editingTemplateName ? (
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <input value={templateNameEdit} onChange={e=>setTemplateNameEdit(e.target.value)}
                          autoFocus onKeyDown={e=>{if(e.key==='Enter')renameTemplate();if(e.key==='Escape')setEditingTemplateName(false);}}
                          style={{padding:'4px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'inherit',fontSize:13}}/>
                        <button onClick={renameTemplate} style={{background:'none',border:'none',cursor:'pointer',color:'#10b981'}}><Check size={14}/></button>
                        <button onClick={()=>setEditingTemplateName(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444'}}><X size={14}/></button>
                      </div>
                    ) : (
                      <button onClick={()=>{setEditingTemplateName(true);setTemplateNameEdit(selectedTemplate.name);}}
                        style={{background:'none',border:'none',cursor:'pointer',opacity:.5,color:'inherit',display:'flex',alignItems:'center',gap:4,fontSize:12}}>
                        <Edit2 size={11}/> Rename
                      </button>
                    )}
                    {!selectedTemplate.is_default && (
                      <button onClick={setDefault} style={{background:'none',border:'none',cursor:'pointer',color:'#f59e0b',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                        <Star size={11}/> Set Default
                      </button>
                    )}
                    <button onClick={cloneTemplate} style={{background:'none',border:'none',cursor:'pointer',color:'#6366f1',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                      <Copy size={11}/> Clone
                    </button>
                    {bom.length > 0 && (
                      <button onClick={exportCSV} style={{background:'none',border:'none',cursor:'pointer',color:'#10b981',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                        <Download size={11}/> Export CSV
                      </button>
                    )}
                    <button onClick={deleteTemplate} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:12,display:'flex',alignItems:'center',gap:4,marginLeft:'auto'}}>
                      <Trash2 size={11}/> Delete BOM
                    </button>
                  </div>

                  {/* Summary Cards */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,marginBottom:16}}>
                    {[
                      {label:'Material Cost',value:`$${materialCost.toFixed(2)}`,color:'#10b981'},
                      {label:'Components Sales Value',value:`$${totalSalesValue.toFixed(2)}`,color:'#3b82f6'},
                      {label:'Labor Cost',value:null,color:'#f59e0b',editable:true},
                      {label:'Total Cost/Unit',value:`$${totalCost.toFixed(2)}`,color:'#6366f1'},
                      {label:'Margin',value:`${margin.toFixed(1)}%`,color:margin>=30?'#10b981':margin>=15?'#f59e0b':'#ef4444'},
                    ].map(({label,value,color,editable})=>(
                      <div key={label} style={{padding:'10px 12px',background:'rgba(255,255,255,.04)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)'}}>
                        <div style={{fontSize:10,opacity:.5,marginBottom:4}}>{label}</div>
                        {editable ? (
                          <div style={{display:'flex',alignItems:'center',gap:2}}>
                            <span style={{opacity:.5,fontSize:13}}>$</span>
                            <input type="number" value={laborCost} onChange={e=>setLaborCost(e.target.value)} min="0" step="0.01"
                              style={{background:'none',border:'none',color,fontWeight:700,fontSize:15,width:60,outline:'none',padding:0}}/>
                          </div>
                        ) : (
                          <div style={{fontWeight:700,fontSize:15,color}}>{value}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Build Requirements Calculator */}
                  <div style={{marginBottom:14,padding:'10px 14px',background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:13,fontWeight:600}}>Build:</span>
                    <input type="number" min="1" value={buildQty} onChange={e=>setBuildQty(parseInt(e.target.value)||1)}
                      style={{width:60,padding:'4px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',color:'inherit',fontSize:13,textAlign:'center'}}/>
                    <span style={{fontSize:13,opacity:.6}}>units · Total cost: <strong style={{color:'#6366f1'}}>${(totalCost*buildQty).toFixed(2)}</strong></span>
                    <span style={{fontSize:13,opacity:.6}}>· Can build now: <strong style={{color:canBuild>0?'#10b981':'#ef4444'}}>{canBuild}</strong></span>
                    {buildReqs.some(r=>!r.ok) && (
                      <span style={{fontSize:12,color:'#ef4444',display:'flex',alignItems:'center',gap:4}}>
                        <AlertTriangle size={11}/> {buildReqs.filter(r=>!r.ok).length} component{buildReqs.filter(r=>!r.ok).length!==1?'s':''} short
                      </span>
                    )}
                  </div>

                  {/* Add Component */}
                  <div style={{background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)',padding:12,marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:8}}>Add Component</div>
                    <form onSubmit={addComponent}>
                      <div style={{display:'grid',gridTemplateColumns:'2fr 80px 1fr auto',gap:8,alignItems:'end'}}>
                        <div style={{position:'relative'}}>
                          <input className="form-input" placeholder="Search by SKU or name..." value={newComp.compSearch}
                            onChange={e=>setNewComp({...newComp,compSearch:e.target.value,component_id:null})}/>
                          {newComp.compSearch && !newComp.component_id && filteredComponents.length > 0 && (
                            <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#1e1e2e',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,zIndex:100,maxHeight:180,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,.5)'}}>
                              {filteredComponents.slice(0,8).map(c=>(
                                <div key={c.id} onMouseDown={()=>setNewComp({...newComp,component_id:c.id,compSearch:`${c.sku} — ${c.name}`})}
                                  style={{padding:'8px 12px',cursor:'pointer',fontSize:13,borderBottom:'1px solid rgba(255,255,255,.05)'}}
                                  onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'}
                                  onMouseOut={e=>e.currentTarget.style.background=''}>
                                  <span style={{color:'#6366f1',fontFamily:'monospace',fontSize:11}}>{c.sku}</span> — {c.name}
                                  <span style={{float:'right',fontSize:11,opacity:.4}}>Stock: {c.quantity}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <input className="form-input" type="number" step="0.001" min="0.001" value={newComp.quantity}
                            placeholder="Qty" onChange={e=>setNewComp({...newComp,quantity:e.target.value})}/>
                        </div>
                        <div>
                          <input className="form-input" value={newComp.notes} onChange={e=>setNewComp({...newComp,notes:e.target.value})} placeholder="Notes (optional)"/>
                        </div>
                        <button type="submit" className="btn btn-primary"><Plus size={14}/></button>
                      </div>
                    </form>
                  </div>

                  {/* BOM Table */}
                  <div className="card" style={{padding:0}}>
                    <div className="table-container">
                      <table className="data-table">
                        <thead><tr>
                          <th>SKU</th><th>Component</th>
                          <th>Qty/Unit</th>
                          <th>For {buildQty} unit{buildQty!==1?'s':''}</th>
                          <th>Cost/Unit</th><th>Line Cost</th>
                          <th>Sales Price</th><th>Line Sales</th>
                          <th>Stock</th><th>Status</th><th></th>
                        </tr></thead>
                        <tbody>
                          {bom.length === 0 ? (
                            <tr><td colSpan={11} style={{textAlign:'center',padding:32,opacity:.5}}>No components yet — add one above</td></tr>
                          ) : buildReqs.map(c => (
                            <tr key={c.id}>
                              <td style={{fontFamily:'monospace',fontSize:11,color:'#6366f1'}}>{c.component_sku}</td>
                              <td>
                                <div style={{fontWeight:500,fontSize:13}}>{c.component_name}</div>
                                {c.notes && <div style={{fontSize:11,opacity:.4}}>{c.notes}</div>}
                              </td>
                              <td>
                                {editingRow === c.id ? (
                                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                                    <input type="number" step="0.001" min="0.001" value={editQty} onChange={e=>setEditQty(e.target.value)}
                                      style={{width:60,padding:'3px 6px',borderRadius:5,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'inherit',fontSize:12}}
                                      autoFocus onKeyDown={e=>{if(e.key==='Enter')saveEditQty(c.id);if(e.key==='Escape')setEditingRow(null);}}/>
                                    <button onClick={()=>saveEditQty(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#10b981'}}><Check size={12}/></button>
                                    <button onClick={()=>setEditingRow(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444'}}><X size={12}/></button>
                                  </div>
                                ) : (
                                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                                    <span style={{fontWeight:600}}>{c.quantity}</span>
                                    <button onClick={()=>{setEditingRow(c.id);setEditQty(c.quantity);}} style={{background:'none',border:'none',cursor:'pointer',opacity:.3,padding:1,color:'inherit'}}><Edit2 size={10}/></button>
                                  </div>
                                )}
                              </td>
                              <td style={{color:c.ok?'inherit':'#ef4444',fontWeight:600}}>
                                {c.needed}{!c.ok&&<span style={{fontSize:10,marginLeft:3}}>({c.short} short)</span>}
                              </td>
                              <td style={{fontFamily:'monospace',fontSize:12}}>${parseFloat(c.component_cost||0).toFixed(2)}</td>
                              <td style={{fontFamily:'monospace',fontSize:12,fontWeight:600}}>${(parseFloat(c.component_cost||0)*parseFloat(c.quantity||0)).toFixed(2)}</td>
                              <td style={{fontFamily:'monospace',fontSize:12,color:'#3b82f6'}}>${parseFloat(c.component_price||0).toFixed(2)}</td>
                              <td style={{fontFamily:'monospace',fontSize:12,color:'#3b82f6'}}>${(parseFloat(c.component_price||0)*parseFloat(c.quantity||0)).toFixed(2)}</td>
                              <td><span style={{fontWeight:600,color:c.stock>=c.needed?'#10b981':'#ef4444'}}>{c.stock}</span></td>
                              <td>
                                {c.ok
                                  ? <span style={{fontSize:11,padding:'2px 6px',borderRadius:6,background:'rgba(16,185,129,.15)',color:'#10b981',fontWeight:600}}>✓ OK</span>
                                  : <span style={{fontSize:11,padding:'2px 6px',borderRadius:6,background:'rgba(239,68,68,.15)',color:'#ef4444',fontWeight:600,display:'flex',alignItems:'center',gap:2}}><AlertTriangle size={9}/>Short</span>}
                              </td>
                              <td>
                                <button onClick={()=>removeComponent(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',opacity:.5,padding:3}}><Trash2 size={12}/></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const mfgRouter = express.Router();
mfgRouter.use(auth);

mfgRouter.get('/', async (req, res) => {
    try {
          const result = await pool.query('SELECT mo.*, ii.name as product_name, ii.sku as product_sku FROM manufacturing_orders mo LEFT JOIN inventory_items ii ON mo.finished_product_id = ii.id ORDER BY mo.created_at DESC');
          res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

mfgRouter.post('/', async (req, res) => {
    try {
          const { finished_product_id, quantity, start_date, completion_date, notes } = req.body;
          const moNumber = 'MO-' + Date.now() + '-' + Math.floor(Math.random()*1000);
          const result = await pool.query('INSERT INTO manufacturing_orders (mo_number, finished_product_id, quantity, start_date, completion_date, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [moNumber, toUUID(finished_product_id), parseInt(quantity)||1, start_date||null, completion_date||null, notes||null]);
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

mfgRouter.put('/:id/complete', async (req, res) => {
    try {
          const mo = await pool.query('SELECT * FROM manufacturing_orders WHERE id=$1', [req.params.id]);
          const m = mo.rows[0];
          const bom = await pool.query('SELECT * FROM bom WHERE finished_product_id=$1', [m.finished_product_id]);
          for (const c of bom.rows) {
                  await pool.query('UPDATE inventory_items SET quantity=quantity-$1, updated_at=NOW() WHERE id=$2', [c.quantity * m.quantity, c.component_id]);
          }
          await pool.query('UPDATE inventory_items SET quantity=quantity+$1, updated_at=NOW() WHERE id=$2', [m.quantity, m.finished_product_id]);
          await pool.query("UPDATE manufacturing_orders SET status='completed', completion_date=NOW(), updated_at=NOW() WHERE id=$1", [req.params.id]);
          res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const invoiceRouter = express.Router();
invoiceRouter.use(auth);

invoiceRouter.get('/po/:poId', async (req, res) => {
    try {
          const result = await pool.query('SELECT * FROM invoices WHERE po_id=$1 ORDER BY created_at DESC', [req.params.poId]);
          res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

invoiceRouter.post('/', async (req, res) => {
    try {
          const { po_id, invoice_number, amount, due_date, notes } = req.body;
          const result = await pool.query('INSERT INTO invoices (po_id, invoice_number, amount, due_date, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *', [toUUID(po_id), invoice_number, parseFloat(amount)||0, due_date||null, notes||null]);
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

invoiceRouter.put('/:id', async (req, res) => {
    try {
          const { status, notes } = req.body;
          const result = await pool.query('UPDATE invoices SET status=$1, notes=$2, updated_at=NOW() WHERE id=$3 RETURNING *', [status, notes, req.params.id]);
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const paymentRouter = express.Router();
paymentRouter.use(auth);

paymentRouter.post('/', async (req, res) => {
    try {
          const { po_id, invoice_id, amount, payment_method, reference_number, payment_date, notes } = req.body;
          const result = await pool.query('INSERT INTO payments (po_id, invoice_id, amount, payment_method, reference_number, payment_date, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [toUUID(po_id), toUUID(invoice_id), parseFloat(amount)||0, payment_method||null, reference_number||null, payment_date||new Date(), notes||null]);
          if (invoice_id && isValidUUID(invoice_id)) {
                  const inv = await pool.query('SELECT amount FROM invoices WHERE id=$1', [invoice_id]);
                  const paid = await pool.query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE invoice_id=$1', [invoice_id]);
                  if (parseFloat(paid.rows[0].total) >= parseFloat(inv.rows[0].amount)) {
                            await pool.query("UPDATE invoices SET status='paid' WHERE id=$1", [invoice_id]);
                  }
          }
          res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = { rmaRouter, bomRouter, mfgRouter, invoiceRouter, paymentRouter };

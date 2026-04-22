// BOM Page
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Layers, Edit2, Check, X, Copy, Download, Package, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export default function BOM() {
  const [inventory, setInventory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [bom, setBom] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [newComp, setNewComp] = useState({ component_id: null, quantity: 1, notes: '', compSearch: '' });
  const [editingRow, setEditingRow] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [buildQty, setBuildQty] = useState(1);
  const [laborCost, setLaborCost] = useState(0);
  const [assemblyNotes, setAssemblyNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [cloneTarget, setCloneTarget] = useState('');

  useEffect(() => { api.get('/inventory').then(r => setInventory(r.data)).catch(()=>{}); }, []);

  const manufacturedItems = inventory.filter(i => i.is_manufactured);
  const allItems = showAllProducts ? inventory : manufacturedItems;

  const loadBOM = (product) => {
    setSelectedProduct(product);
    setLaborCost(0);
    setAssemblyNotes('');
    api.get(`/bom/${product.id}`).then(r => setBom(r.data)).catch(()=>setBom([]));
  };

  const addComponent = async (e) => {
    e.preventDefault();
    if (!newComp.component_id) return toast.error('Select a component');
    try {
      await api.post('/bom', {
        finished_product_id: selectedProduct.id,
        component_id: newComp.component_id,
        quantity: newComp.quantity,
        notes: newComp.notes
      });
      toast.success('Component added');
      loadBOM(selectedProduct);
      setNewComp({ component_id: null, quantity: 1, notes: '', compSearch: '' });
    } catch(err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const removeComponent = async (id) => {
    if (!window.confirm('Remove this component?')) return;
    try { await api.delete(`/bom/${id}`); loadBOM(selectedProduct); }
    catch { toast.error('Error'); }
  };

  const saveEditQty = async (id) => {
    if (!editQty || parseFloat(editQty) <= 0) return toast.error('Invalid quantity');
    try {
      await api.put(`/bom/${id}`, { quantity: parseFloat(editQty) });
      toast.success('Updated');
      setEditingRow(null);
      loadBOM(selectedProduct);
    } catch(e) { toast.error('Failed to update'); }
  };

  const cloneBOM = async () => {
    if (!cloneTarget) return toast.error('Select a target product');
    if (!window.confirm(`Copy all components from ${selectedProduct.name} to the selected product?`)) return;
    try {
      for (const comp of bom) {
        await api.post('/bom', {
          finished_product_id: cloneTarget,
          component_id: comp.component_id,
          quantity: comp.quantity,
          notes: comp.notes
        });
      }
      toast.success('BOM cloned successfully');
      setShowClone(false); setCloneTarget('');
    } catch(e) { toast.error('Failed to clone BOM'); }
  };

  const exportCSV = () => {
    const rows = [['SKU','Component','Qty Required','Unit Cost','Total Cost','In Stock']];
    bom.forEach(c => rows.push([c.component_sku, c.component_name, c.quantity, parseFloat(c.component_cost||0).toFixed(2), (parseFloat(c.component_cost||0)*parseFloat(c.quantity||0)).toFixed(2), c.component_stock]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `BOM-${selectedProduct.sku}.csv`; a.click();
    toast.success('BOM exported');
  };

  const filteredProducts = allItems.filter(i =>
    i.sku?.toLowerCase().includes(productSearch.toLowerCase()) ||
    i.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredComponents = inventory.filter(i =>
    (i.sku?.toLowerCase().includes(newComp.compSearch?.toLowerCase()||'') ||
     i.name?.toLowerCase().includes(newComp.compSearch?.toLowerCase()||'')) &&
    (!selectedProduct || i.id !== selectedProduct.id)
  );

  const materialCost = bom.reduce((sum, c) => sum + (parseFloat(c.component_cost||0) * parseFloat(c.quantity||0)), 0);
  const totalCost = materialCost + parseFloat(laborCost||0);

  // Can build calculation
  const canBuild = bom.length > 0 ? Math.min(...bom.map(c => {
    const stock = parseInt(c.component_stock||0);
    const needed = parseFloat(c.quantity||1);
    return Math.floor(stock / needed);
  })) : 0;

  // Build requirements for X units
  const buildReqs = bom.map(c => {
    const needed = parseFloat(c.quantity||1) * buildQty;
    const stock = parseInt(c.component_stock||0);
    const short = Math.max(0, needed - stock);
    return { ...c, needed, stock, short, ok: short === 0 };
  });

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Bill of Materials</h1><p className="page-subtitle">Define components for manufactured products</p></div>
      </div>

      <div style={{display:'flex', gap:20}}>
        {/* Product List */}
        <div style={{width:280, flexShrink:0}}>
          <input placeholder="Search products..." value={productSearch} onChange={e=>setProductSearch(e.target.value)}
            className="form-input" style={{marginBottom:8,width:'100%',boxSizing:'border-box'}}/>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <span style={{fontSize:11,opacity:.5}}>{filteredProducts.length} products</span>
            <button onClick={()=>setShowAllProducts(s=>!s)}
              style={{fontSize:11,background:'none',border:'none',cursor:'pointer',color:'#6366f1',opacity:.8}}>
              {showAllProducts ? 'Show manufactured only' : 'Show all inventory'}
            </button>
          </div>
          {!showAllProducts && manufacturedItems.length === 0 && (
            <div style={{padding:'12px',background:'rgba(245,158,11,.08)',borderRadius:8,border:'1px solid rgba(245,158,11,.2)',fontSize:12,marginBottom:8}}>
              No items marked as manufactured. Open an inventory item and check "Is Manufactured" to add it here.
            </div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:500,overflowY:'auto'}}>
            {filteredProducts.map(p => (
              <div key={p.id} onClick={()=>loadBOM(p)}
                style={{background:selectedProduct?.id===p.id?'var(--accent-dim)':'var(--bg-card)',
                  border:`1px solid ${selectedProduct?.id===p.id?'var(--accent)':'var(--border)'}`,
                  borderRadius:8, padding:'10px 14px', cursor:'pointer'}}>
                <div style={{fontWeight:500,fontSize:13,color:selectedProduct?.id===p.id?'var(--accent-light)':'var(--text-primary)'}}>{p.name}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'monospace'}}>{p.sku}</div>
                {p.is_manufactured && <span style={{fontSize:10,padding:'1px 5px',borderRadius:3,background:'rgba(139,92,246,.2)',color:'#a78bfa',fontWeight:600}}>MFG</span>}
              </div>
            ))}
          </div>
        </div>

        {/* BOM Detail */}
        <div style={{flex:1}}>
          {!selectedProduct ? (
            <div className="empty-state" style={{height:400}}>
              <Layers size={32}/>
              <p>Select a product to view or create its BOM</p>
              <p style={{fontSize:12,opacity:.5}}>Only manufactured items shown by default</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
                <div>
                  <h2 style={{fontSize:17,fontWeight:700,margin:0}}>{selectedProduct.name}</h2>
                  <div style={{fontSize:12,opacity:.5,marginTop:2}}>{selectedProduct.sku}</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  {bom.length > 0 && <>
                    <button onClick={exportCSV} className="btn btn-secondary" style={{fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                      <Download size={13}/> Export CSV
                    </button>
                    <button onClick={()=>setShowClone(s=>!s)} className="btn btn-secondary" style={{fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                      <Copy size={13}/> Clone BOM
                    </button>
                  </>}
                </div>
              </div>

              {/* Clone BOM */}
              {showClone && (
                <div style={{marginBottom:16,padding:'12px 16px',background:'rgba(99,102,241,.08)',borderRadius:8,border:'1px solid rgba(99,102,241,.2)',display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:13,opacity:.8,whiteSpace:'nowrap'}}>Clone to:</span>
                  <select value={cloneTarget} onChange={e=>setCloneTarget(e.target.value)} className="form-input" style={{flex:1}}>
                    <option value="">— Select target product —</option>
                    {inventory.filter(i=>i.id!==selectedProduct.id).map(i=><option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
                  </select>
                  <button onClick={cloneBOM} className="btn btn-primary" style={{fontSize:12}}>Clone</button>
                  <button onClick={()=>setShowClone(false)} style={{background:'none',border:'none',cursor:'pointer',opacity:.5,color:'inherit'}}><X size={15}/></button>
                </div>
              )}

              {/* Summary Cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
                {[
                  {label:'Material Cost',value:`$${materialCost.toFixed(2)}`,color:'#10b981'},
                  {label:'Labor Cost',value:`$${parseFloat(laborCost||0).toFixed(2)}`,color:'#3b82f6',editable:true},
                  {label:'Total Cost/Unit',value:`$${totalCost.toFixed(2)}`,color:'#6366f1'},
                  {label:'Can Build Now',value:`${canBuild} units`,color:canBuild>0?'#10b981':'#ef4444'},
                ].map(({label,value,color,editable})=>(
                  <div key={label} style={{padding:'12px 14px',background:'rgba(255,255,255,.04)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)'}}>
                    <div style={{fontSize:11,opacity:.5,marginBottom:4}}>{label}</div>
                    {editable ? (
                      <div style={{display:'flex',alignItems:'center',gap:4}}>
                        <span style={{opacity:.5,fontSize:13}}>$</span>
                        <input type="number" value={laborCost} onChange={e=>setLaborCost(e.target.value)} min="0" step="0.01"
                          style={{background:'none',border:'none',color,fontWeight:700,fontSize:16,width:70,outline:'none',padding:0}}/>
                      </div>
                    ) : (
                      <div style={{fontWeight:700,fontSize:16,color}}>{value}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Build Requirements Calculator */}
              <div style={{marginBottom:16,padding:'12px 16px',background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <span style={{fontSize:13,fontWeight:600}}>Build Requirements:</span>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:13,opacity:.6}}>Build</span>
                    <input type="number" min="1" value={buildQty} onChange={e=>setBuildQty(parseInt(e.target.value)||1)}
                      style={{width:60,padding:'4px 8px',borderRadius:6,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.08)',color:'inherit',fontSize:13,textAlign:'center'}}/>
                    <span style={{fontSize:13,opacity:.6}}>units</span>
                  </div>
                  <span style={{fontSize:13,opacity:.6}}>→ Total cost: <strong style={{color:'#6366f1'}}>${(totalCost * buildQty).toFixed(2)}</strong></span>
                  {buildReqs.some(r=>!r.ok) && (
                    <span style={{fontSize:12,color:'#ef4444',display:'flex',alignItems:'center',gap:4}}>
                      <AlertTriangle size={12}/> Short on {buildReqs.filter(r=>!r.ok).length} component{buildReqs.filter(r=>!r.ok).length!==1?'s':''}
                    </span>
                  )}
                </div>
              </div>

              {/* Add Component */}
              <div style={{background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)',padding:14,marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:10}}>Add Component</div>
                <form onSubmit={addComponent}>
                  <div style={{display:'grid',gridTemplateColumns:'2fr 80px 1fr auto',gap:8,alignItems:'end'}}>
                    <div style={{position:'relative'}}>
                      <label className="form-label">Component (SKU or Name)</label>
                      <input className="form-input" placeholder="Search inventory..." value={newComp.compSearch}
                        onChange={e=>setNewComp({...newComp, compSearch:e.target.value, component_id:null})}/>
                      {newComp.compSearch && !newComp.component_id && filteredComponents.length > 0 && (
                        <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#1e1e2e',border:'1px solid rgba(255,255,255,.15)',borderRadius:8,zIndex:10,maxHeight:180,overflowY:'auto',boxShadow:'0 8px 24px rgba(0,0,0,.5)'}}>
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
                      <label className="form-label">Qty</label>
                      <input className="form-input" type="number" step="0.001" min="0.001" value={newComp.quantity}
                        onChange={e=>setNewComp({...newComp,quantity:e.target.value})}/>
                    </div>
                    <div>
                      <label className="form-label">Notes (optional)</label>
                      <input className="form-input" value={newComp.notes} onChange={e=>setNewComp({...newComp,notes:e.target.value})} placeholder="e.g. must be pre-cut"/>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{marginBottom:0}}><Plus size={14}/> Add</button>
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
                      <th>For {buildQty} units</th>
                      <th>Unit Cost</th><th>Total Cost</th>
                      <th>In Stock</th><th>Status</th><th></th>
                    </tr></thead>
                    <tbody>
                      {bom.length === 0 ? (
                        <tr><td colSpan={9} style={{textAlign:'center',padding:32,opacity:.5}}>No components defined yet</td></tr>
                      ) : buildReqs.map(c => (
                        <tr key={c.id}>
                          <td style={{fontFamily:'monospace',fontSize:12,color:'#6366f1'}}>{c.component_sku}</td>
                          <td>
                            <div style={{fontWeight:500}}>{c.component_name}</div>
                            {c.notes && <div style={{fontSize:11,opacity:.4}}>{c.notes}</div>}
                          </td>
                          <td>
                            {editingRow === c.id ? (
                              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                                <input type="number" step="0.001" min="0.001" value={editQty} onChange={e=>setEditQty(e.target.value)}
                                  style={{width:60,padding:'3px 6px',borderRadius:5,border:'1px solid rgba(255,255,255,.2)',background:'rgba(255,255,255,.08)',color:'inherit',fontSize:12}}
                                  autoFocus onKeyDown={e=>{if(e.key==='Enter')saveEditQty(c.id);if(e.key==='Escape')setEditingRow(null);}}/>
                                <button onClick={()=>saveEditQty(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#10b981',padding:2}}><Check size={13}/></button>
                                <button onClick={()=>setEditingRow(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',padding:2}}><X size={13}/></button>
                              </div>
                            ) : (
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{fontWeight:600}}>{c.quantity}</span>
                                <button onClick={()=>{setEditingRow(c.id);setEditQty(c.quantity);}}
                                  style={{background:'none',border:'none',cursor:'pointer',opacity:.3,padding:2,color:'inherit'}}><Edit2 size={11}/></button>
                              </div>
                            )}
                          </td>
                          <td style={{fontWeight:600,color:c.ok?'#10b981':'#ef4444'}}>
                            {c.needed}
                            {!c.ok && <span style={{fontSize:11,marginLeft:4,color:'#ef4444'}}>({c.short} short)</span>}
                          </td>
                          <td style={{fontFamily:'monospace',fontSize:12}}>${parseFloat(c.component_cost||0).toFixed(2)}</td>
                          <td style={{fontFamily:'monospace',fontSize:12,fontWeight:600}}>${(parseFloat(c.component_cost||0)*parseFloat(c.quantity||0)).toFixed(2)}</td>
                          <td>
                            <span style={{fontWeight:600,color:c.stock>=c.needed?'#10b981':'#ef4444'}}>{c.stock}</span>
                          </td>
                          <td>
                            {c.ok
                              ? <span style={{fontSize:11,padding:'2px 6px',borderRadius:6,background:'rgba(16,185,129,.15)',color:'#10b981',fontWeight:600}}>✓ OK</span>
                              : <span style={{fontSize:11,padding:'2px 6px',borderRadius:6,background:'rgba(239,68,68,.15)',color:'#ef4444',fontWeight:600,display:'flex',alignItems:'center',gap:3}}><AlertTriangle size={10}/>Short</span>}
                          </td>
                          <td>
                            <button onClick={()=>removeComponent(c.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',opacity:.5,padding:4}}><Trash2 size={13}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assembly Notes */}
              <div style={{marginTop:16,padding:'14px 16px',background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)'}}>
                <div style={{fontSize:12,fontWeight:600,textTransform:'uppercase',opacity:.5,marginBottom:8}}>Assembly Instructions / Notes</div>
                <textarea value={assemblyNotes} onChange={e=>setAssemblyNotes(e.target.value)} rows={3} className="form-input"
                  placeholder="Add assembly instructions, special notes, or steps for the manufacturing team..."/>
                <div style={{fontSize:11,opacity:.4,marginTop:4}}>These notes are shown in the Manufacturing module when this product is in production.</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

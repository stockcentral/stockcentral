// BOM Page
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Layers } from 'lucide-react';

export default function BOM() {
  const [inventory, setInventory] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [bom, setBom] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [compSearch, setCompSearch] = useState('');
  const [newComp, setNewComp] = useState({ component_id: null, quantity: 1, notes: '', compSearch: '' });

  useEffect(() => { api.get('/inventory').then(r => setInventory(r.data)); }, []);

  const loadBOM = (product) => {
    setSelectedProduct(product);
    api.get(`/bom/${product.id}`).then(r => setBom(r.data));
  };

  const addComponent = async (e) => {
    e.preventDefault();
    if (!newComp.component_id) { toast.error('Select a component'); return; }
    try {
      await api.post('/bom', { finished_product_id: selectedProduct.id, component_id: newComp.component_id, quantity: newComp.quantity, notes: newComp.notes });
      toast.success('Component added');
      loadBOM(selectedProduct);
      setNewComp({ component_id: null, quantity: 1, notes: '', compSearch: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const removeComponent = async (id) => {
    try { await api.delete(`/bom/${id}`); loadBOM(selectedProduct); }
    catch { toast.error('Error'); }
  };

  const filteredProducts = inventory.filter(i => i.sku.toLowerCase().includes(productSearch.toLowerCase()) || i.name.toLowerCase().includes(productSearch.toLowerCase()));
  const filteredComponents = inventory.filter(i => (i.sku.toLowerCase().includes(newComp.compSearch?.toLowerCase()||'') || i.name.toLowerCase().includes(newComp.compSearch?.toLowerCase()||'')) && (!selectedProduct || i.id !== selectedProduct.id));

  const totalCost = bom.reduce((sum, c) => sum + (parseFloat(c.component_cost||0) * parseFloat(c.quantity||0)), 0);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Bill of Materials</h1><p className="page-subtitle">Define components for finished products</p></div>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ width: 300, flexShrink: 0 }}>
          <div className="search-bar" style={{ marginBottom: 12 }}>
            <input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflow: 'auto' }}>
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => loadBOM(p)}
                style={{ background: selectedProduct?.id === p.id ? 'var(--accent-dim)' : 'var(--bg-card)', border: `1px solid ${selectedProduct?.id === p.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: selectedProduct?.id === p.id ? 'var(--accent-light)' : 'var(--text-primary)' }}>{p.name}</div>
                <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.sku}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {!selectedProduct ? <div className="empty-state" style={{ height: 400 }}><Layers size={32} /><p>Select a product to view BOM</p></div> : (
            <>
              <div className="page-header" style={{ marginBottom: 16 }}>
                <div><h2 style={{ fontSize: 17, fontWeight: 700 }}>{selectedProduct.name}</h2><p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total BOM Cost: <span className="font-mono text-success">${totalCost.toFixed(2)}</span></p></div>
              </div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 12 }}>Add Component</div>
                <form onSubmit={addComponent}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                    <div>
                      <label className="form-label">Component</label>
                      <input className="form-input" placeholder="Search..." value={newComp.compSearch} onChange={e => setNewComp({...newComp, compSearch: e.target.value, component_id: null})} />
                      {newComp.compSearch && !newComp.component_id && (
                        <div style={{ position: 'absolute', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 10, maxHeight: 160, overflow: 'auto', width: 280 }}>
                          {filteredComponents.slice(0, 6).map(c => (
                            <div key={c.id} onClick={() => setNewComp({...newComp, component_id: c.id, compSearch: `${c.sku} — ${c.name}`})}
                              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <span className="font-mono" style={{ color: 'var(--accent-light)', fontSize: 11 }}>{c.sku}</span> — {c.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div><label className="form-label">Qty</label><input className="form-input" type="number" step="0.001" min="0.001" value={newComp.quantity} onChange={e => setNewComp({...newComp, quantity: e.target.value})} /></div>
                    <div><label className="form-label">Notes</label><input className="form-input" value={newComp.notes} onChange={e => setNewComp({...newComp, notes: e.target.value})} /></div>
                    <button type="submit" className="btn btn-primary btn-sm btn-icon" style={{ marginBottom: 0 }}><Plus size={14} /></button>
                  </div>
                </form>
              </div>
              <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                  <table>
                    <thead><tr><th>SKU</th><th>Component</th><th>Qty Required</th><th>Unit Cost</th><th>Total Cost</th><th>In Stock</th><th></th></tr></thead>
                    <tbody>
                      {bom.length === 0 ? <tr><td colSpan={7}><div className="empty-state" style={{ padding: 24 }}>No components defined</div></td></tr> : bom.map(c => (
                        <tr key={c.id}>
                          <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{c.component_sku}</td>
                          <td>{c.component_name}</td>
                          <td style={{ fontWeight: 600 }}>{c.quantity}</td>
                          <td className="font-mono" style={{ fontSize: 12 }}>${parseFloat(c.component_cost||0).toFixed(2)}</td>
                          <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>${(parseFloat(c.component_cost||0)*parseFloat(c.quantity||0)).toFixed(2)}</td>
                          <td><span style={{ color: parseInt(c.component_stock||0) >= parseFloat(c.quantity) ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{c.component_stock}</span></td>
                          <td><button className="btn btn-danger btn-sm btn-icon" onClick={() => removeComponent(c.id)}><Trash2 size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

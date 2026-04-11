import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit, Trash2, ChevronRight, X } from 'lucide-react';

const EMPTY = { name: '', email: '', phone: '', address: '', city: '', state: '', zip: '', country: 'US', contact_name: '', payment_terms: '', notes: '' };

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [vendorDetail, setVendorDetail] = useState(null);
  const [skuModal, setSkuModal] = useState(false);
  const [skuForm, setSkuForm] = useState({ vendor_sku: '', vendor_cost: '', lead_time_days: '' });
  const [inventory, setInventory] = useState([]);
  const [skuSearch, setSkuSearch] = useState('');

  const load = () => api.get('/vendors').then(r => setVendors(r.data));
  const loadInventory = () => api.get('/inventory').then(r => setInventory(r.data));

  useEffect(() => { load(); loadInventory(); }, []);

  const loadVendorDetail = (id) => api.get(`/vendors/${id}`).then(r => setVendorDetail(r.data));

  const filtered = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.email?.toLowerCase().includes(search.toLowerCase()));

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/vendors/${editing}`, form); toast.success('Vendor updated'); }
      else { await api.post('/vendors', form); toast.success('Vendor created'); }
      setModal(false); setForm(EMPTY); setEditing(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this vendor?')) return;
    try { await api.delete(`/vendors/${id}`); toast.success('Deleted'); load(); if (selected === id) { setSelected(null); setVendorDetail(null); } }
    catch { toast.error('Error deleting'); }
  };

  const addSku = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/vendors/${selected}/skus`, { ...skuForm, inventory_item_id: skuForm.inventory_item_id });
      toast.success('Vendor SKU added');
      setSkuModal(false); setSkuForm({ vendor_sku: '', vendor_cost: '', lead_time_days: '' });
      loadVendorDetail(selected);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const removeSku = async (skuId) => {
    try { await api.delete(`/vendors/${selected}/skus/${skuId}`); loadVendorDetail(selected); }
    catch { toast.error('Error'); }
  };

  const filteredInventory = inventory.filter(i => i.sku.toLowerCase().includes(skuSearch.toLowerCase()) || i.name.toLowerCase().includes(skuSearch.toLowerCase()));

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 100px)' }}>
      {/* Vendor List */}
      <div style={{ width: 320, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm btn-icon" onClick={() => { setForm(EMPTY); setEditing(null); setModal(true); }}><Plus size={14} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
          {filtered.map(v => (
            <div key={v.id} onClick={() => { setSelected(v.id); loadVendorDetail(v.id); }}
              style={{ background: selected === v.id ? 'var(--accent-dim)' : 'var(--bg-card)', border: `1px solid ${selected === v.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: selected === v.id ? 'var(--accent-light)' : 'var(--text-primary)' }}>{v.name}</div>
                  {v.contact_name && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{v.contact_name}</div>}
                  {v.email && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{v.email}</div>}
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginTop: 2 }} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state"><p>No vendors found</p></div>}
        </div>
      </div>

      {/* Vendor Detail */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!vendorDetail ? (
          <div className="empty-state" style={{ height: '100%' }}><p>Select a vendor to view details</p></div>
        ) : (
          <>
            <div className="page-header" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{vendorDetail.name}</h2>
                <p className="page-subtitle">{vendorDetail.payment_terms && `Payment Terms: ${vendorDetail.payment_terms}`}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { setForm(vendorDetail); setEditing(vendorDetail.id); setModal(true); }}><Edit size={13} />Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(vendorDetail.id)}><Trash2 size={13} />Delete</button>
              </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Contact Info</div>
                {[['Email', vendorDetail.email], ['Phone', vendorDetail.phone], ['Contact', vendorDetail.contact_name]].map(([l, v]) => v && (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{l}</span>
                    <span style={{ fontSize: 13 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Address</div>
                {vendorDetail.address && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  {vendorDetail.address}<br />
                  {[vendorDetail.city, vendorDetail.state, vendorDetail.zip].filter(Boolean).join(', ')}<br />
                  {vendorDetail.country}
                </div>}
              </div>
            </div>

            {/* Vendor SKUs */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Vendor SKUs ({vendorDetail.vendor_skus?.length || 0})</span>
                <button className="btn btn-primary btn-sm" onClick={() => setSkuModal(true)}><Plus size={13} />Add SKU</button>
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Internal SKU</th><th>Item Name</th><th>Vendor SKU</th><th>Vendor Cost</th><th>Lead Time</th><th></th></tr></thead>
                  <tbody>
                    {(vendorDetail.vendor_skus || []).map(sku => (
                      <tr key={sku.id}>
                        <td className="font-mono" style={{ fontSize: 12, color: 'var(--accent-light)' }}>{sku.internal_sku}</td>
                        <td>{sku.item_name}</td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{sku.vendor_sku}</td>
                        <td className="font-mono" style={{ fontSize: 12 }}>{sku.vendor_cost ? `$${parseFloat(sku.vendor_cost).toFixed(2)}` : '—'}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{sku.lead_time_days ? `${sku.lead_time_days} days` : '—'}</td>
                        <td><button className="btn btn-danger btn-sm btn-icon" onClick={() => removeSku(sku.id)}><X size={12} /></button></td>
                      </tr>
                    ))}
                    {(!vendorDetail.vendor_skus || vendorDetail.vendor_skus.length === 0) && (
                      <tr><td colSpan={6}><div className="empty-state" style={{ padding: 20 }}>No vendor SKUs added</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Vendor Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={save}>
              <div className="grid-2">
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Company Name *</label><input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Contact Name</label><input className="form-input" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Payment Terms</label><input className="form-input" value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})} placeholder="Net 30, Net 60..." /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Address</label><input className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">State</label><input className="form-input" value={form.state} onChange={e => setForm({...form, state: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">ZIP</label><input className="form-input" value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Country</label><input className="form-input" value={form.country} onChange={e => setForm({...form, country: e.target.value})} /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Notes</label><textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Save' : 'Add Vendor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SKU Modal */}
      {skuModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSkuModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Add Vendor SKU</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSkuModal(false)}>✕</button>
            </div>
            <form onSubmit={addSku}>
              <div className="form-group">
                <label className="form-label">Search Inventory Item</label>
                <input className="form-input" placeholder="Search SKU or name..." value={skuSearch} onChange={e => setSkuSearch(e.target.value)} />
                {skuSearch && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, maxHeight: 160, overflow: 'auto' }}>
                    {filteredInventory.slice(0, 8).map(item => (
                      <div key={item.id} onClick={() => { setSkuForm({...skuForm, inventory_item_id: item.id}); setSkuSearch(`${item.sku} — ${item.name}`); }}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <span className="font-mono" style={{ color: 'var(--accent-light)', fontSize: 12 }}>{item.sku}</span> — {item.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group"><label className="form-label">Vendor SKU *</label><input className="form-input" value={skuForm.vendor_sku} onChange={e => setSkuForm({...skuForm, vendor_sku: e.target.value})} required /></div>
              <div className="grid-2">
                <div className="form-group"><label className="form-label">Vendor Cost ($)</label><input className="form-input" type="number" step="0.01" value={skuForm.vendor_cost} onChange={e => setSkuForm({...skuForm, vendor_cost: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Lead Time (days)</label><input className="form-input" type="number" value={skuForm.lead_time_days} onChange={e => setSkuForm({...skuForm, lead_time_days: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSkuModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add SKU</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

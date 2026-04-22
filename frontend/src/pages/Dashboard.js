import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Package, ShoppingCart, AlertTriangle, RotateCcw, FileText, Factory, ExternalLink, RefreshCw } from 'lucide-react';

const fmt = (n) => `$${parseFloat(n||0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';

const STATUS_COLORS = {
  pending:'#f59e0b', sent:'#3b82f6', partial:'#f97316', ordered:'#8b5cf6',
  approved:'#10b981', draft:'#6b7280', received:'#10b981', cancelled:'#ef4444',
  open:'#6366f1', in_progress:'#3b82f6', completed:'#10b981',
};

function StatCard({ label, value, icon:Icon, color, sublabel, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={{borderLeft:`3px solid ${color}`,cursor:onClick?'pointer':'default',transition:'background .15s'}}
      onMouseOver={e=>{if(onClick)e.currentTarget.style.background='rgba(255,255,255,.04)'}}
      onMouseOut={e=>e.currentTarget.style.background=''}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span className="stat-label">{label}</span>
        <Icon size={16} style={{color}}/>
      </div>
      <div className="stat-value">{value}</div>
      {sublabel && <div style={{fontSize:11,opacity:.5,marginTop:2}}>{sublabel}</div>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ inventory:0, lowStock:0, openPOs:0, openRMAs:0, quotes:0, manufacturing:0 });
  const [recentPOs, setRecentPOs] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentRMAs, setRecentRMAs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inv, low, pos, rmas, quotes, mfg] = await Promise.all([
        api.get('/inventory'),
        api.get('/inventory?low_stock=true'),
        api.get('/purchase-orders'),
        api.get('/rma'),
        api.get('/quotes'),
        api.get('/manufacturing').catch(()=>({data:[]})),
      ]);

      const openPOs = pos.data.filter(p => !['received','cancelled','draft'].includes(p.status));
      const openRMAs = rmas.data.filter(r => !['completed','rejected','draft'].includes(r.status));
      const activeQuotes = quotes.data.filter(q => !['converted','rejected'].includes(q.status));
      const inProduction = mfg.data.filter(m => m.status === 'in_progress');

      setStats({
        inventory: inv.data.length,
        lowStock: low.data.length,
        openPOs: openPOs.length,
        openRMAs: openRMAs.length,
        quotes: activeQuotes.length,
        manufacturing: inProduction.length,
      });

      // Recent open POs — most recent 6, sorted by date
      setRecentPOs(openPOs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6));
      setLowStockItems(low.data.slice(0,6));
      setRecentRMAs(openRMAs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5));
    } catch(e) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const statCards = [
    { label:'Total SKUs', value:stats.inventory, icon:Package, color:'var(--accent)', sublabel:'Items in inventory', onClick:()=>navigate('/inventory') },
    { label:'Low Stock', value:stats.lowStock, icon:AlertTriangle, color:'#f59e0b', sublabel:'Below threshold', onClick:()=>navigate('/inventory') },
    { label:'Open POs', value:stats.openPOs, icon:ShoppingCart, color:'#10b981', sublabel:'Excluding drafts & received', onClick:()=>navigate('/purchase-orders') },
    { label:'Pending RMAs', value:stats.openRMAs, icon:RotateCcw, color:'#ef4444', sublabel:'All active statuses', onClick:()=>navigate('/rma') },
    { label:'Active Quotes', value:stats.quotes, icon:FileText, color:'#a78bfa', sublabel:'All non-converted', onClick:()=>navigate('/quotes') },
    { label:'In Production', value:stats.manufacturing, icon:Factory, color:'#38bdf8', sublabel:'Jobs in progress', onClick:()=>navigate('/manufacturing') },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Operations overview · {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary" style={{fontSize:12,display:'flex',alignItems:'center',gap:6}}>
          <RefreshCw size={13}/> Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {statCards.map(({label,value,icon,color,sublabel,onClick})=>(
          <StatCard key={label} label={label} value={loading?'…':value} icon={icon} color={color} sublabel={sublabel} onClick={onClick}/>
        ))}
      </div>

      <div className="grid-2">
        {/* Recent Open POs */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Open Purchase Orders</span>
            <button onClick={()=>navigate('/purchase-orders')} style={{background:'none',border:'none',cursor:'pointer',color:'#6366f1',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
              View all <ExternalLink size={11}/>
            </button>
          </div>
          {recentPOs.length === 0 ? (
            <div className="empty-state"><ShoppingCart size={32}/><p>{loading?'Loading...':'No open purchase orders'}</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>PO #</th><th>Vendor</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {recentPOs.map(po => (
                    <tr key={po.id} onClick={()=>navigate('/purchase-orders')} style={{cursor:'pointer'}}
                      onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                      onMouseOut={e=>e.currentTarget.style.background=''}>
                      <td style={{fontSize:12,fontFamily:'monospace',color:'#6366f1',fontWeight:600}}>{po.po_number}</td>
                      <td style={{fontSize:13}}>{po.vendor_name||'—'}</td>
                      <td style={{fontFamily:'monospace',fontSize:13}}>{fmt(po.total||0)}</td>
                      <td>
                        <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:600,
                          background:`${STATUS_COLORS[po.status]||'#6b7280'}22`,
                          color:STATUS_COLORS[po.status]||'#6b7280'}}>
                          {po.status}
                        </span>
                      </td>
                      <td style={{fontSize:11,opacity:.5}}>{fmtDate(po.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Low Stock Alerts</span>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {stats.lowStock > 0 && <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:'rgba(245,158,11,.15)',color:'#f59e0b',fontWeight:600}}>{stats.lowStock} items</span>}
              <button onClick={()=>navigate('/inventory')} style={{background:'none',border:'none',cursor:'pointer',color:'#6366f1',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                View all <ExternalLink size={11}/>
              </button>
            </div>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="empty-state"><Package size={32}/><p>{loading?'Loading...':'All stock levels healthy!'}</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>SKU</th><th>Name</th><th>Stock</th><th>Threshold</th></tr></thead>
                <tbody>
                  {lowStockItems.map(item => (
                    <tr key={item.id} onClick={()=>navigate('/inventory')} style={{cursor:'pointer'}}
                      onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                      onMouseOut={e=>e.currentTarget.style.background=''}>
                      <td style={{fontSize:11,fontFamily:'monospace',color:'#6366f1'}}>{item.sku}</td>
                      <td style={{maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:13}}>{item.name}</td>
                      <td><span style={{color:'#ef4444',fontWeight:700}}>{item.quantity}</span></td>
                      <td style={{opacity:.5,fontSize:12}}>{item.low_stock_threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{padding:'10px 16px',borderTop:'1px solid rgba(255,255,255,.06)',fontSize:11,opacity:.4}}>
            💡 Low stock threshold is set per item in Inventory → open any item → "Low Stock Threshold" field
          </div>
        </div>

        {/* Active RMAs */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Active RMAs</span>
            <button onClick={()=>navigate('/rma')} style={{background:'none',border:'none',cursor:'pointer',color:'#6366f1',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
              View all <ExternalLink size={11}/>
            </button>
          </div>
          {recentRMAs.length === 0 ? (
            <div className="empty-state"><RotateCcw size={32}/><p>{loading?'Loading...':'No active RMAs'}</p></div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>RMA #</th><th>Customer</th><th>Type</th><th>Status</th></tr></thead>
                <tbody>
                  {recentRMAs.map(rma => (
                    <tr key={rma.id} onClick={()=>navigate('/rma')} style={{cursor:'pointer'}}
                      onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}
                      onMouseOut={e=>e.currentTarget.style.background=''}>
                      <td style={{fontSize:11,fontFamily:'monospace',color:'#6366f1',fontWeight:600}}>{rma.rma_number}</td>
                      <td style={{fontSize:13}}>{rma.customer_name||'—'}</td>
                      <td><span style={{fontSize:11,padding:'2px 6px',borderRadius:4,background:rma.rma_type==='internal'?'rgba(99,102,241,.2)':'rgba(16,185,129,.2)',color:rma.rma_type==='internal'?'#818cf8':'#10b981'}}>{rma.rma_type==='internal'?'Internal':'Client'}</span></td>
                      <td><span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:600,background:`${STATUS_COLORS[rma.status]||'#6b7280'}22`,color:STATUS_COLORS[rma.status]||'#6b7280'}}>{rma.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Info */}
        <div className="card">
          <div className="card-header"><span className="card-title">Quick Reference</span></div>
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:12}}>
            <div style={{padding:'12px 14px',borderRadius:8,background:'rgba(99,102,241,.06)',border:'1px solid rgba(99,102,241,.15)'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#818cf8',marginBottom:4}}>💡 Low Stock Threshold</div>
              <div style={{fontSize:12,opacity:.7}}>Set per item in <strong>Inventory</strong> → open any product → find the <strong>"Low Stock Threshold"</strong> field. Default is 5 units.</div>
            </div>
            <div style={{padding:'12px 14px',borderRadius:8,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.15)'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#10b981',marginBottom:4}}>📦 In Production</div>
              <div style={{fontSize:12,opacity:.7}}>Shows Manufacturing jobs with status <strong>"In Progress"</strong>. Create jobs in the <strong>Manufacturing</strong> module.</div>
            </div>
            <div style={{padding:'12px 14px',borderRadius:8,background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.15)'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#f59e0b',marginBottom:4}}>🔗 Total SKUs</div>
              <div style={{fontSize:12,opacity:.7}}>Counts all items in StockCentral inventory. Import products from <strong>Shopify → Sync</strong> to match your store SKUs.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { LayoutDashboard, Package, Users, FileText, ShoppingCart, RotateCcw, Layers, Factory, ShoppingBag, Settings, LogOut, ChevronRight, Menu, MessageSquare, Headphones } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'Orders', icon: ShoppingBag, path: '/orders' },
  { label: 'Inventory', icon: Package, path: '/inventory' },
  { divider: true, label: 'PURCHASING' },
  { label: 'Quote Requests', icon: FileText, path: '/quotes' },
  { label: 'Purchase Orders', icon: ShoppingCart, path: '/purchase-orders' },
  { divider: true, label: 'PRODUCTION' },
  { label: 'Bill of Materials', icon: Layers, path: '/bom' },
  { label: 'Manufacturing', icon: Factory, path: '/manufacturing' },
  { divider: true, label: 'SUPPORT' },
  { label: 'Tickets', icon: Headphones, path: '/tickets' },
  { label: 'RMA', icon: RotateCcw, path: '/rma' },
  { divider: true, label: 'DATA' },
  { label: 'Vendors', icon: Users, path: '/vendors' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <aside style={{ width:collapsed?60:220, minWidth:collapsed?60:220, background:'var(--bg-secondary)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', transition:'width 0.2s, min-width 0.2s', overflow:'hidden' }}>
        <div style={{ padding:'16px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {!collapsed && (
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, background:'#4f46e5', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="18" height="18" viewBox="0 0 22 22" fill="none"><rect x="2" y="6" width="5" height="11" rx="1.5" fill="#818cf8"/><rect x="8.5" y="9" width="5" height="8" rx="1.5" fill="#a5b4fc"/><rect x="15" y="7" width="5" height="10" rx="1.5" fill="#10b981"/><polygon points="17.5,3 20.5,7 14.5,7" fill="#10b981"/></svg>
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:15,letterSpacing:'-0.3px',color:'var(--text-primary)'}}>Stock<span style={{color:'#818cf8'}}>Central</span></div>
                <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px' }}>ERP System</div>
              </div>
            </div>
          )}
          {collapsed && <div style={{ width:28, height:28, background:'var(--accent)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto' }}><svg width="18" height="18" viewBox="0 0 22 22" fill="none"><rect x="2" y="6" width="5" height="11" rx="1.5" fill="#818cf8"/><rect x="8.5" y="9" width="5" height="8" rx="1.5" fill="#a5b4fc"/><rect x="15" y="7" width="5" height="10" rx="1.5" fill="#10b981"/><polygon points="17.5,3 20.5,7 14.5,7" fill="#10b981"/></svg></div>}
          <button onClick={()=>setCollapsed(!collapsed)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:4, borderRadius:4, display:'flex', marginLeft:collapsed?'auto':0 }}>
            {collapsed ? <ChevronRight size={14}/> : <Menu size={14}/>}
          </button>
        </div>

        <nav style={{ flex:1, overflow:'auto', padding:'8px 8px' }}>
          {navItems.map((item, i) => {
            if (item.divider) return (
              !collapsed && <div key={i} style={{ padding:'12px 8px 4px', fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px' }}>{item.label}</div>
            );
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} end={item.path === '/'}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:6,
                  color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-dim)' : 'transparent',
                  textDecoration:'none', fontSize:13, fontWeight:500, marginBottom:2,
                  transition:'all 0.15s', whiteSpace:'nowrap', overflow:'hidden',
                  justifyContent: collapsed ? 'center' : 'flex-start'
                })}>
                <Icon size={16} style={{ flexShrink:0 }}/>
                {!collapsed && item.label}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding:'12px 8px', borderTop:'1px solid var(--border)' }}>
          {!collapsed && (
            <div style={{ padding:'8px 10px', marginBottom:4 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</div>
            </div>
          )}
          <button onClick={handleLogout}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:6, background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:13, width:'100%', justifyContent:collapsed?'center':'flex-start', transition:'all 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.color='var(--danger)'}
            onMouseLeave={e=>e.currentTarget.style.color='var(--text-muted)'}>
            <LogOut size={16}/>
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      <main style={{ flex:1, overflow:'auto', background:'var(--bg-primary)' }}>
        <div style={{ padding:'24px 28px', maxWidth:1400, margin:'0 auto' }}>
          <Outlet/>
        </div>
      </main>
    </div>
  );
}

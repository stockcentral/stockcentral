import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import api from './utils/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Vendors from './pages/Vendors';
import Quotes from './pages/Quotes';
import QuoteDetail from './pages/QuoteDetail';
import PurchaseOrders from './pages/PurchaseOrders';
import PODetail from './pages/PODetail';
import RMA from './pages/RMA';
import BOM from './pages/BOM';
import Manufacturing from './pages/Manufacturing';
import OrderHistory from './pages/OrderHistory';
import Settings from './pages/Settings';

export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('stockcentral_token');
    if (token) {
      api.get('/auth/me').then(res => { setUser(res.data); setLoading(false); }).catch(() => { localStorage.removeItem('stockcentral_token'); setLoading(false); });
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('stockcentral_token', res.data.token);
    setUser(res.data.user);
  };

  const logout = () => { localStorage.removeItem('stockcentral_token'); setUser(null); };

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0f', color:'#fff', fontFamily:'monospace', fontSize:'14px' }}>Loading StockCentral...</div>;

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a2e', color: '#fff', border: '1px solid #2a2a4a' } }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/:id" element={<QuoteDetail />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="purchase-orders/:id" element={<PODetail />} />
            <Route path="rma" element={<RMA />} />
            <Route path="bom" element={<BOM />} />
            <Route path="manufacturing" element={<Manufacturing />} />
            <Route path="orders" element={<OrderHistory />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

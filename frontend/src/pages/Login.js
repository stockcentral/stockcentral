import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import toast from 'react-hot-toast';
import { Boxes, Lock, Mail } from 'lucide-react';
import api from '../utils/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        await api.post('/auth/register', form);
        await login(form.email, form.password);
      }
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Authentication failed');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: 'var(--accent)', borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
            <svg width="28" height="28" viewBox="0 0 22 22" fill="none"><rect x="2" y="6" width="5" height="11" rx="1.5" fill="#818cf8"/><rect x="8.5" y="9" width="5" height="8" rx="1.5" fill="#a5b4fc"/><rect x="15" y="7" width="5" height="10" rx="1.5" fill="#10b981"/><polygon points="17.5,3 20.5,7 14.5,7" fill="#10b981"/></svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing:'-0.5px' }}>Stock<span style={{color:'#818cf8'}}>Central</span></h1>
          <p style={{ color: '#6366f1', fontSize: 11, marginTop: 4, letterSpacing:'2px', textTransform:'uppercase', fontWeight:500 }}>ERP Platform</p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 28 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 8, padding: 4, marginBottom: 24 }}>
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '7px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: tab === t ? 'var(--bg-card)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.15s', textTransform: 'capitalize'
              }}>{t === 'login' ? 'Sign In' : 'Create Account'}</button>
            ))}
          </div>

          <form onSubmit={handle}>
            {tab === 'register' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: 8 }} disabled={loading}>
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 16 }}>
          Powered by Apex Property Ventures
        </p>
      </div>
    </div>
  );
}

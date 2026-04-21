import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Search, X, Send, Clock, User, Tag, AlertTriangle, CheckCircle, MessageSquare, RefreshCw, ChevronDown, Lock, Zap, ExternalLink, Trash2, Edit2 } from 'lucide-react';

const STATUS_CONFIG = {
  open:             { label:'Open',             color:'#6366f1', bg:'rgba(99,102,241,.15)' },
  in_progress:      { label:'In Progress',      color:'#f59e0b', bg:'rgba(245,158,11,.15)' },
  pending_customer: { label:'Pending Customer', color:'#3b82f6', bg:'rgba(59,130,246,.15)' },
  resolved:         { label:'Resolved',         color:'#10b981', bg:'rgba(16,185,129,.15)' },
  closed:           { label:'Closed',           color:'#6b7280', bg:'rgba(107,114,128,.15)' },
};

const PRIORITY_CONFIG = {
  low:    { label:'Low',    color:'#6b7280' },
  normal: { label:'Normal', color:'#3b82f6' },
  high:   { label:'High',   color:'#f59e0b' },
  urgent: { label:'Urgent', color:'#ef4444' },
};

const TICKET_TYPES = ['general','billing','technical','shipping','return','complaint','other'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:cfg.bg,color:cfg.color,fontWeight:600,whiteSpace:'nowrap'}}>{cfg.label}</span>;
}

function PriorityBadge({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  return <span style={{fontSize:11,color:cfg.color,fontWeight:600}}>● {cfg.label}</span>;
}

function isStale(ticket) {
  if (['resolved','closed'].includes(ticket.status)) return false;
  const lastMsg = ticket.last_message_at || ticket.created_at;
  return (Date.now() - new Date(lastMsg).getTime()) > 24 * 60 * 60 * 1000;
}

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [staff, setStaff] = useState([]);
  const [sel, setSel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [quickReplies, setQuickReplies] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showNewQR, setShowNewQR] = useState(false);
  const [newQR, setNewQR] = useState({ title:'', body:'' });
  const [newTicket, setNewTicket] = useState({ subject:'', type:'general', priority:'normal', customer_name:'', customer_email:'', shopify_order_number:'', body:'' });
  const [saving, setSaving] = useState(false);
  const msgEndRef = useRef();

  useEffect(() => { fetchTickets(); fetchStaff(); fetchQuickReplies(); }, []);
  useEffect(() => { if (sel) { fetchMessages(sel.id); } }, [sel]);
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const fetchTickets = async () => {
    try { setLoading(true); const r = await api.get('/tickets'); setTickets(r.data); }
    catch(e) { toast.error('Failed to load tickets'); } finally { setLoading(false); }
  };

  const fetchStaff = async () => {
    try { const r = await api.get('/tickets/meta/staff'); setStaff(r.data); } catch(e) {}
  };

  const fetchMessages = async (id) => {
    try { const r = await api.get(`/tickets/${id}/messages`); setMessages(r.data); } catch(e) {}
  };

  const fetchQuickReplies = async () => {
    try { const r = await api.get('/tickets/quick-replies/all'); setQuickReplies(r.data); } catch(e) {}
  };

  const openTicket = async (ticket) => {
    setSel(ticket); setMsgText(''); setIsInternal(false);
    try { const r = await api.get(`/tickets/${ticket.id}`); setSel(r.data); } catch(e) {}
  };

  const handleSend = async () => {
    if (!msgText.trim() || !sel) return;
    setSending(true);
    try {
      const r = await api.post(`/tickets/${sel.id}/messages`, { body: msgText, is_internal: isInternal });
      setMessages(prev => [...prev, r.data]);
      setMsgText(''); fetchTickets();
      if (!isInternal && sel.customer_email) toast.success('Message sent to customer');
    } catch(e) { toast.error('Failed to send'); } finally { setSending(false); }
  };

  const updateTicket = async (field, value) => {
    try {
      const r = await api.put(`/tickets/${sel.id}`, { [field]: value });
      setSel(r.data);
      setTickets(prev => prev.map(t => t.id === sel.id ? { ...t, ...r.data } : t));
      toast.success('Updated');
    } catch(e) { toast.error('Failed to update'); }
  };

  const createTicket = async () => {
    if (!newTicket.subject.trim()) return toast.error('Subject is required');
    setSaving(true);
    try {
      const r = await api.post('/tickets', newTicket);
      toast.success(`Ticket ${r.data.ticket_number} created`);
      setShowNewTicket(false);
      setNewTicket({ subject:'', type:'general', priority:'normal', customer_name:'', customer_email:'', shopify_order_number:'', body:'' });
      fetchTickets();
      openTicket(r.data);
    } catch(e) { toast.error(e.response?.data?.error || 'Failed to create ticket'); } finally { setSaving(false); }
  };

  const saveQuickReply = async () => {
    if (!newQR.title.trim() || !newQR.body.trim()) return toast.error('Title and body required');
    try {
      await api.post('/tickets/quick-replies', newQR);
      setNewQR({ title:'', body:'' }); setShowNewQR(false);
      fetchQuickReplies(); toast.success('Quick reply saved');
    } catch(e) { toast.error('Failed to save'); }
  };

  const deleteQuickReply = async (id) => {
    try {
      await api.delete(`/tickets/quick-replies/${id}`);
      fetchQuickReplies(); toast.success('Deleted');
    } catch(e) { toast.error('Failed'); }
  };

  const createRMA = async () => {
    if (!sel) return;
    try {
      const r = await api.post('/rma', {
        customer_name: sel.customer_name,
        reason: sel.subject,
        status: 'pending',
        notes: `Created from ticket ${sel.ticket_number}`
      });
      await updateTicket('rma_id', r.data.id);
      await api.post(`/tickets/${sel.id}/messages`, {
        body: `RMA created: ${r.data.rma_number || r.data.id}`,
        is_internal: true
      });
      fetchMessages(sel.id);
      toast.success('RMA created and linked to ticket');
    } catch(e) { toast.error(e.response?.data?.error || 'Failed to create RMA'); }
  };

  const filtered = tickets.filter(t => {
    const s = search.toLowerCase();
    const matchSearch = !search || t.ticket_number?.toLowerCase().includes(s) || t.subject?.toLowerCase().includes(s) || t.customer_name?.toLowerCase().includes(s) || t.customer_email?.toLowerCase().includes(s);
    const matchStatus = !filterStatus || t.status === filterStatus;
    const matchPriority = !filterPriority || t.priority === filterPriority;
    const matchAssigned = !filterAssigned || (filterAssigned === 'unassigned' ? !t.assigned_to_user_id : t.assigned_to_user_id === filterAssigned);
    return matchSearch && matchStatus && matchPriority && matchAssigned;
  });

  const selectStyle = { padding:'7px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,.12)', background:'rgba(255,255,255,.05)', color:'inherit', fontSize:12 };

  return (
    <div className="page-container" style={{display:'flex',flexDirection:'column',height:'100%',padding:0}}>
      {/* Header */}
      <div style={{padding:'20px 24px 16px',borderBottom:'1px solid rgba(255,255,255,.08)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <h1 className="page-title" style={{margin:0}}>Support Tickets</h1>
          <p style={{margin:0,opacity:.5,fontSize:13}}>{tickets.length} tickets total · {tickets.filter(t=>t.status==='open').length} open</p>
        </div>
        <button className="btn btn-primary" style={{display:'flex',alignItems:'center',gap:6}} onClick={()=>setShowNewTicket(true)}>
          <Plus size={14}/> New Ticket
        </button>
      </div>

      <div style={{display:'flex',flex:1,minHeight:0}}>
        {/* Ticket List */}
        <div style={{width:sel?380:undefined,minWidth:sel?380:undefined,flex:sel?'none':1,borderRight:sel?'1px solid rgba(255,255,255,.08)':'none',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Filters */}
          <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.06)',display:'flex',gap:8,flexWrap:'wrap'}}>
            <div style={{position:'relative',flex:1,minWidth:140}}>
              <Search size={13} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',opacity:.4}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tickets..." style={{...selectStyle,paddingLeft:26,width:'100%',boxSizing:'border-box'}}/>
            </div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selectStyle}>
              <option value="">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)} style={selectStyle}>
              <option value="">All Priority</option>
              {Object.entries(PRIORITY_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterAssigned} onChange={e=>setFilterAssigned(e.target.value)} style={selectStyle}>
              <option value="">All Staff</option>
              <option value="unassigned">Unassigned</option>
              {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* List */}
          <div style={{flex:1,overflowY:'auto'}}>
            {loading ? <div style={{padding:32,textAlign:'center',opacity:.5}}>Loading...</div> :
              filtered.length === 0 ? <div style={{padding:32,textAlign:'center',opacity:.5}}>No tickets found</div> :
              filtered.map(ticket => {
                const stale = isStale(ticket);
                const isSelected = sel?.id === ticket.id;
                return (
                  <div key={ticket.id} onClick={()=>openTicket(ticket)}
                    style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.05)',cursor:'pointer',background:isSelected?'rgba(99,102,241,.1)':stale?'rgba(239,68,68,.03)':'transparent',borderLeft:isSelected?'3px solid #6366f1':stale?'3px solid #ef4444':'3px solid transparent',transition:'background .15s'}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:4}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <span style={{fontSize:11,fontFamily:'monospace',color:'#6366f1',fontWeight:600}}>{ticket.ticket_number}</span>
                          <StatusBadge status={ticket.status}/>
                          {stale && <span style={{fontSize:10,color:'#ef4444',fontWeight:600}}>⚠ Stale</span>}
                        </div>
                        <div style={{fontWeight:600,fontSize:13,marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ticket.subject}</div>
                      </div>
                      <PriorityBadge priority={ticket.priority}/>
                    </div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:11,opacity:.5}}>
                      <span>{ticket.customer_name||'No customer'}{ticket.shopify_order_number&&` · #${ticket.shopify_order_number}`}</span>
                      <span style={{display:'flex',alignItems:'center',gap:4}}>
                        {ticket.message_count > 0 && <><MessageSquare size={10}/>{ticket.message_count}</>}
                        <span style={{marginLeft:4}}>{ticket.assigned_to_name||'Unassigned'}</span>
                      </span>
                    </div>
                    <div style={{fontSize:11,opacity:.35,marginTop:2}}>{fmtTime(ticket.updated_at)}</div>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Ticket Detail */}
        {sel && (
          <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
            {/* Ticket Header */}
            <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(255,255,255,.08)',display:'flex',alignItems:'flex-start',gap:12,flexShrink:0}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                  <span style={{fontSize:13,fontFamily:'monospace',color:'#6366f1',fontWeight:700}}>{sel.ticket_number}</span>
                  <StatusBadge status={sel.status}/>
                  <PriorityBadge priority={sel.priority}/>
                  {isStale(sel) && <span style={{fontSize:11,color:'#ef4444',fontWeight:600}}>⚠ No response 24h+</span>}
                </div>
                <div style={{fontWeight:700,fontSize:16}}>{sel.subject}</div>
                <div style={{fontSize:12,opacity:.5,marginTop:2}}>
                  {sel.customer_name&&<span>{sel.customer_name}</span>}
                  {sel.customer_email&&<span> · {sel.customer_email}</span>}
                  {sel.shopify_order_number&&<span> · Order #{sel.shopify_order_number}</span>}
                </div>
              </div>
              <button onClick={()=>setSel(null)} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',opacity:.5,padding:4,flexShrink:0}}><X size={18}/></button>
            </div>

            <div style={{display:'flex',flex:1,minHeight:0}}>
              {/* Messages */}
              <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
                <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
                  {messages.length === 0 && <div style={{opacity:.4,textAlign:'center',padding:32,fontSize:13}}>No messages yet. Send the first message below.</div>}
                  {messages.map(msg => (
                    <div key={msg.id} style={{display:'flex',flexDirection:'column',alignItems:msg.sender_type==='staff'?'flex-end':'flex-start'}}>
                      <div style={{maxWidth:'80%',padding:'10px 14px',borderRadius:msg.sender_type==='staff'?'12px 12px 2px 12px':'12px 12px 12px 2px',
                        background:msg.is_internal?'rgba(245,158,11,.1)':msg.sender_type==='staff'?'rgba(99,102,241,.2)':'rgba(255,255,255,.06)',
                        border:msg.is_internal?'1px solid rgba(245,158,11,.3)':msg.sender_type==='staff'?'1px solid rgba(99,102,241,.3)':'1px solid rgba(255,255,255,.1)'}}>
                        {msg.is_internal && <div style={{fontSize:10,color:'#f59e0b',fontWeight:600,marginBottom:4,display:'flex',alignItems:'center',gap:4}}><Lock size={9}/>Internal Note</div>}
                        <div style={{fontSize:13,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{msg.body}</div>
                        <div style={{fontSize:10,opacity:.5,marginTop:5,display:'flex',alignItems:'center',gap:4}}>
                          <User size={9}/>{msg.sender_name||msg.sender_type} · {fmtTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={msgEndRef}/>
                </div>

                {/* Reply Box */}
                <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,.08)',flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <button onClick={()=>setIsInternal(false)} style={{fontSize:12,padding:'4px 10px',borderRadius:6,border:'none',cursor:'pointer',background:!isInternal?'#6366f1':'rgba(255,255,255,.08)',color:'inherit',fontWeight:!isInternal?600:400}}>
                      Reply to Customer
                    </button>
                    <button onClick={()=>setIsInternal(true)} style={{fontSize:12,padding:'4px 10px',borderRadius:6,border:'none',cursor:'pointer',background:isInternal?'#f59e0b':'rgba(255,255,255,.08)',color:'inherit',fontWeight:isInternal?600:400,display:'flex',alignItems:'center',gap:4}}>
                      <Lock size={10}/>Internal Note
                    </button>
                    <div style={{marginLeft:'auto',position:'relative'}}>
                      <button onClick={()=>setShowQuickReplies(s=>!s)} style={{fontSize:12,padding:'4px 10px',borderRadius:6,border:'1px solid rgba(255,255,255,.15)',background:'none',cursor:'pointer',color:'inherit',display:'flex',alignItems:'center',gap:4}}>
                        <Zap size={11}/>Quick Reply <ChevronDown size={10}/>
                      </button>
                      {showQuickReplies && (
                        <div style={{position:'absolute',bottom:'110%',right:0,background:'#1e1e2e',border:'1px solid rgba(255,255,255,.15)',borderRadius:10,padding:8,minWidth:260,zIndex:100,boxShadow:'0 8px 32px rgba(0,0,0,.5)',maxHeight:220,overflowY:'auto'}}>
                          {quickReplies.length === 0 && <div style={{padding:'8px 10px',opacity:.5,fontSize:12}}>No quick replies yet.</div>}
                          {quickReplies.map(qr => (
                            <div key={qr.id} style={{display:'flex',alignItems:'center',gap:6}}>
                              <button onClick={()=>{setMsgText(qr.body);setShowQuickReplies(false);}} style={{flex:1,textAlign:'left',padding:'7px 10px',background:'none',border:'none',cursor:'pointer',color:'inherit',fontSize:13,borderRadius:6}}
                                onMouseOver={e=>e.currentTarget.style.background='rgba(255,255,255,.06)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                                {qr.title}
                              </button>
                              <button onClick={()=>deleteQuickReply(qr.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',opacity:.5,padding:4,flexShrink:0}}><Trash2 size={11}/></button>
                            </div>
                          ))}
                          <div style={{borderTop:'1px solid rgba(255,255,255,.08)',marginTop:6,paddingTop:6}}>
                            {!showNewQR ? (
                              <button onClick={()=>setShowNewQR(true)} style={{width:'100%',textAlign:'left',padding:'6px 10px',background:'none',border:'none',cursor:'pointer',color:'#6366f1',fontSize:12,display:'flex',alignItems:'center',gap:4}}>
                                <Plus size={11}/>Save new quick reply
                              </button>
                            ) : (
                              <div style={{padding:'6px 4px'}}>
                                <input value={newQR.title} onChange={e=>setNewQR(n=>({...n,title:e.target.value}))} placeholder="Title" style={{width:'100%',padding:'5px 8px',borderRadius:5,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:12,marginBottom:5,boxSizing:'border-box'}}/>
                                <textarea value={newQR.body} onChange={e=>setNewQR(n=>({...n,body:e.target.value}))} placeholder="Message body..." rows={2} style={{width:'100%',padding:'5px 8px',borderRadius:5,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:12,resize:'none',boxSizing:'border-box',marginBottom:5}}/>
                                <div style={{display:'flex',gap:5}}>
                                  <button onClick={saveQuickReply} className="btn btn-primary" style={{fontSize:11,padding:'3px 10px'}}>Save</button>
                                  <button onClick={()=>setShowNewQR(false)} className="btn btn-ghost" style={{fontSize:11,padding:'3px 10px'}}>Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                    <textarea value={msgText} onChange={e=>setMsgText(e.target.value)} rows={3}
                      placeholder={isInternal ? 'Internal note (not visible to customer)...' : 'Reply to customer...'}
                      style={{flex:1,padding:'10px 12px',borderRadius:8,border:`1px solid ${isInternal?'rgba(245,158,11,.3)':'rgba(255,255,255,.15)'}`,background:isInternal?'rgba(245,158,11,.05)':'rgba(255,255,255,.05)',color:'inherit',fontSize:13,resize:'none'}}
                      onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();handleSend();}}}/>
                    <button onClick={handleSend} disabled={sending||!msgText.trim()} className="btn btn-primary" style={{padding:'10px 16px',display:'flex',alignItems:'center',gap:6,alignSelf:'stretch'}}>
                      {sending?<RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/>:<Send size={14}/>}
                      {isInternal?'Add Note':'Send'}
                    </button>
                  </div>
                  <div style={{fontSize:11,opacity:.35,marginTop:5}}>Cmd+Enter to send{!isInternal&&sel.customer_email&&` · Email will be sent to ${sel.customer_email}`}</div>
                </div>
              </div>

              {/* Sidebar */}
              <div style={{width:240,flexShrink:0,borderLeft:'1px solid rgba(255,255,255,.08)',overflowY:'auto',padding:'16px 14px',display:'flex',flexDirection:'column',gap:14}}>
                {/* Status */}
                <div>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',marginBottom:6}}>Status</div>
                  <select value={sel.status} onChange={e=>updateTicket('status',e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:13}}>
                    {Object.entries(STATUS_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',marginBottom:6}}>Priority</div>
                  <select value={sel.priority} onChange={e=>updateTicket('priority',e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:13}}>
                    {Object.entries(PRIORITY_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>

                {/* Type */}
                <div>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',marginBottom:6}}>Type</div>
                  <select value={sel.type||'general'} onChange={e=>updateTicket('type',e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:13}}>
                    {TICKET_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>

                {/* Assigned To */}
                <div>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',marginBottom:6}}>Assigned To</div>
                  <select value={sel.assigned_to_user_id||''} onChange={e=>updateTicket('assigned_to_user_id',e.target.value||null)} style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:13}}>
                    <option value="">Unassigned</option>
                    {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                {/* Customer */}
                {(sel.customer_name||sel.customer_email) && (
                  <div style={{padding:'10px 12px',background:'rgba(255,255,255,.04)',borderRadius:8,border:'1px solid rgba(255,255,255,.08)'}}>
                    <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',marginBottom:6}}>Customer</div>
                    {sel.customer_name&&<div style={{fontWeight:600,fontSize:13}}>{sel.customer_name}</div>}
                    {sel.customer_email&&<div style={{fontSize:12,opacity:.5,wordBreak:'break-all'}}>{sel.customer_email}</div>}
                  </div>
                )}

                {/* Order Link */}
                {sel.shopify_order_number && (
                  <div style={{padding:'8px 12px',background:'rgba(99,102,241,.08)',borderRadius:8,border:'1px solid rgba(99,102,241,.2)',fontSize:12}}>
                    <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',marginBottom:4}}>Linked Order</div>
                    <span style={{color:'#6366f1',fontWeight:600}}>#{sel.shopify_order_number}</span>
                  </div>
                )}

                {/* RMA */}
                <div>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',marginBottom:6}}>RMA</div>
                  {sel.rma_id ? (
                    <div style={{padding:'8px 12px',background:'rgba(16,185,129,.08)',borderRadius:8,border:'1px solid rgba(16,185,129,.2)',fontSize:12,color:'#10b981',fontWeight:600}}>
                      ✓ RMA Linked
                    </div>
                  ) : (
                    <button onClick={createRMA} style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'none',cursor:'pointer',color:'inherit',fontSize:12,textAlign:'left',display:'flex',alignItems:'center',gap:6}}>
                      <Plus size={11}/>Create RMA from ticket
                    </button>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <div style={{fontSize:10,fontWeight:600,opacity:.4,textTransform:'uppercase',marginBottom:6}}>Tags</div>
                  <input value={sel.tags||''} onChange={e=>setSel(s=>({...s,tags:e.target.value}))}
                    onBlur={e=>updateTicket('tags',e.target.value)}
                    placeholder="tag1, tag2..." style={{width:'100%',padding:'7px 10px',borderRadius:8,border:'1px solid rgba(255,255,255,.15)',background:'rgba(255,255,255,.05)',color:'inherit',fontSize:12,boxSizing:'border-box'}}/>
                </div>

                {/* Created */}
                <div style={{fontSize:11,opacity:.35,paddingTop:4,borderTop:'1px solid rgba(255,255,255,.06)'}}>
                  <div>Created {fmtDate(sel.created_at)}</div>
                  {sel.created_by_name&&<div>by {sel.created_by_name}</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="modal-overlay" onClick={e=>{if(e.target.className==='modal-overlay')setShowNewTicket(false);}}>
          <div className="modal" style={{maxWidth:560}}>
            <div className="modal-header"><h2>New Ticket</h2><button className="modal-close" onClick={()=>setShowNewTicket(false)}><X size={18}/></button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Subject *</label><input value={newTicket.subject} onChange={e=>setNewTicket(n=>({...n,subject:e.target.value}))} className="form-input" placeholder="Brief description of the issue"/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group"><label className="form-label">Type</label>
                  <select value={newTicket.type} onChange={e=>setNewTicket(n=>({...n,type:e.target.value}))} className="form-input">
                    {TICKET_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Priority</label>
                  <select value={newTicket.priority} onChange={e=>setNewTicket(n=>({...n,priority:e.target.value}))} className="form-input">
                    {Object.entries(PRIORITY_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="form-group"><label className="form-label">Customer Name</label><input value={newTicket.customer_name} onChange={e=>setNewTicket(n=>({...n,customer_name:e.target.value}))} className="form-input" placeholder="John Smith"/></div>
                <div className="form-group"><label className="form-label">Customer Email</label><input value={newTicket.customer_email} onChange={e=>setNewTicket(n=>({...n,customer_email:e.target.value}))} className="form-input" placeholder="john@example.com" type="email"/></div>
              </div>
              <div className="form-group"><label className="form-label">Order # (optional)</label><input value={newTicket.shopify_order_number} onChange={e=>setNewTicket(n=>({...n,shopify_order_number:e.target.value}))} className="form-input" placeholder="1001"/></div>
              <div className="form-group"><label className="form-label">Initial Message (optional)</label><textarea value={newTicket.body} onChange={e=>setNewTicket(n=>({...n,body:e.target.value}))} className="form-input" rows={3} placeholder="Describe the issue..."/></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowNewTicket(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createTicket} disabled={saving}>{saving?'Creating...':'Create Ticket'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .page-container{padding:0!important}
      `}</style>
    </div>
  );
}

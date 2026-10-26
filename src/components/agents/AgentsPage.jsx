import { useState, useEffect, useCallback } from 'react';
import api, { fmt, getErrorMsg, dateNow, agentLabel } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { Modal, PageHeader, PageLoader, EmptyState, ConfirmDialog, SearchInput } from '../shared';

function AgentForm({ agent, nextCode, onSave, onClose }) {
  const [form, setForm] = useState({
    name:              agent?.name              || '',
    username:          agent?.username          || '',
    password:          '',
    mobile:            agent?.mobile            || '',
    address:           agent?.address           || '',
    // Per-account-type commission rates only
    typeCommissions:   agent?.typeCommissions?.map(r=>({...r})) || [],
  });
  const [accountTypes, setAccountTypes] = useState([]); 
  const [saving,       setSaving]       = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/account-types').then(r => setAccountTypes(r.data || [])).catch(() => {});
  }, []);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const addTypeRow = () =>
    setForm(p => ({ ...p, typeCommissions: [...p.typeCommissions, { typeName:'', rate:0 }] }));

  const removeTypeRow = idx =>
    setForm(p => ({ ...p, typeCommissions: p.typeCommissions.filter((_,i)=>i!==idx) }));

  const updateTypeRow = (idx, key, val) =>
    setForm(p => ({
      ...p,
      typeCommissions: p.typeCommissions.map((row,i) =>
        i===idx ? {...row,[key]:val} : row
      ),
    }));

  const usedTypes = new Set(form.typeCommissions.map(r=>r.typeName).filter(Boolean));

  const submit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      const p = {
        ...form,
        typeCommissions: form.typeCommissions
          .filter(r => r.typeName)
          .map(r => ({ typeName: r.typeName, rate: parseFloat(r.rate) || 0 })),
      };
      if (agent && !p.password) delete p.password;
      const r = agent ? await api.put(`/agents/${agent._id}`, p) : await api.post('/agents', p);
      onSave(r.data);
    } catch(err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="modal-body space-y-4">
      {/* ── Basic fields ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Agent Code</label>
          <div className="input bg-slate-50 font-mono font-bold text-blue-700 flex items-center justify-between">
            <span>{agent?.agentCode || nextCode}</span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Auto</span>
          </div>
        </div>
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={form.name} onChange={e=>f('name',e.target.value)} required placeholder="Agent's name"/>
        </div>
        <div>
          <label className="label">Username *</label>
          <input className="input" value={form.username} onChange={e=>f('username',e.target.value)} required/>
        </div>
        <div>
          <label className="label">{agent?'New Password (optional)':'Password *'}</label>
          <input type="password" className="input" value={form.password}
            onChange={e=>f('password',e.target.value)} required={!agent}
            placeholder={agent?'Leave blank to keep':'Min 4 chars'}/>
        </div>
        <div className="col-span-2">
          <label className="label">Mobile *</label>
          <input className="input" value={form.mobile} onChange={e=>f('mobile',e.target.value)}
            required placeholder="+91 XXXXXXXXXX"/>
        </div>
        <div className="col-span-2">
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={e=>f('address',e.target.value)} placeholder="Address"/>
        </div>
      </div>

      {/* ── Per-account-type commission ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="label mb-0">Account Type Commission</label>
          </div>
          <button type="button" onClick={addTypeRow}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0">
            <i className="fas fa-plus text-[10px]"/> Add Type
          </button>
        </div>

        {form.typeCommissions.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-4 text-center text-sm text-slate-400">
            No per-type rates configured. Click <strong className="text-slate-500">Add Type</strong> to set commission rates.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
            {form.typeCommissions.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2.5">
                <select className="select flex-1 text-sm" value={row.typeName}
                  onChange={e=>updateTypeRow(idx,'typeName',e.target.value)} required>
                  <option value="">Select account type…</option>
                  {accountTypes.map(t => (
                    <option key={t._id} value={t.name}
                      disabled={usedTypes.has(t.name) && t.name !== row.typeName}>
                      {t.name}{usedTypes.has(t.name) && t.name !== row.typeName ? ' ✓' : ''}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <input type="number" step="0.01" min="0" max="100"
                    className="input w-20 text-right text-sm"
                    value={row.rate} placeholder="0"
                    onChange={e=>updateTypeRow(idx,'rate',e.target.value)}/>
                  <span className="text-slate-400 text-sm font-medium">%</span>
                </div>

                <button type="button" onClick={()=>removeTypeRow(idx)}
                  className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <i className="fas fa-times text-xs"/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="modal-footer px-0 pb-0">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
          {agent?'Update Agent':'Create Agent'}
        </button>
      </div>
    </form>
  );
}

function AssignModal({ agent, onClose }) {
  const [accounts,setAccounts]= useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [selected,setSelected]= useState(new Set());
  const [saving,  setSaving]  = useState(false);
  const toast = useToast();

  useEffect(()=>{
    api.get('/accounts?status=active&category=customer').then(r=>{
      setAccounts(r.data);
      setSelected(new Set((agent.assignedAccounts||[]).map(id=>id.toString())));
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[agent]);

  const toggle=id=>setSelected(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const save=async()=>{
    setSaving(true);
    try { await api.put(`/agents/${agent._id}/assign`,{accountIds:Array.from(selected)}); toast.success('Assignments saved'); onClose(); }
    catch(err){ toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };
  const filtered=accounts.filter(a=>a.name.toLowerCase().includes(search.toLowerCase())||(a.accNo&&a.accNo.toLowerCase().includes(search.toLowerCase()))||(a.custId?.name&&a.custId.name.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="modal-body space-y-3">
      <SearchInput value={search} onChange={setSearch} placeholder="Search accounts…"/>
      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>{selected.size} selected</span>
        <div className="flex gap-2">
          <button onClick={()=>setSelected(new Set(filtered.map(a=>a._id.toString())))} className="text-blue-600 hover:underline">Select All</button>
          <button onClick={()=>setSelected(new Set())} className="text-slate-400 hover:underline">Clear</button>
        </div>
      </div>
      {loading
        ? <PageLoader/>
        : <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50">
            {filtered.map(a=>{
              const id=a._id.toString(); const sel=selected.has(id);
              return (
                <label key={a._id} className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${sel?'bg-blue-50':'hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={sel} onChange={()=>toggle(id)} className="rounded flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-700">{a.custId?.name||a.name}</div>
                    <div className="text-xs text-slate-400">{a.accNo} &nbsp;·&nbsp; {a.type}</div>
                  </div>
                  <span className={`text-sm font-mono font-bold flex-shrink-0 ${a.balance<0?'text-red-500':'text-emerald-600'}`}>{fmt.format(a.balance)}</span>
                </label>
              );
            })}
          </div>
      }
      <div className="modal-footer px-0 pb-0">
        <button onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button onClick={save} disabled={saving} className="btn btn-primary">{saving?'…':'Save Assignments'}</button>
      </div>
    </div>
  );
}

function HandoverModal({ agents, onClose, onSuccess }) {
  const [agentId,setAgentId]= useState('');
  const [holding,setHolding]= useState(0);
  const [amt,    setAmt]    = useState('');
  const [date,   setDate]   = useState(dateNow());
  const [loading,setLoading]= useState(false);
  const toast = useToast();

  const fetchHolding=async id=>{
    if(!id) return;
    try { const r=await api.get(`/agents/${id}/cash`); setHolding(r.data.balance||0); setAmt(r.data.balance>0?r.data.balance.toString():''); } catch{}
  };

  const submit=async e=>{
    e.preventDefault(); if(!agentId||!amt) return;
    setLoading(true);
    try {
      const r=await api.post('/agents/handover',{agentId,amt:parseFloat(amt),date});
      toast.success(`Received ${fmt.format(parseFloat(amt))}. Commission calculated successfully.`);
      onSuccess(); onClose();
    } catch(err){ toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="modal-body space-y-4">
      <div>
        <label className="label">Select Agent *</label>
        <select className="select" value={agentId} onChange={e=>{setAgentId(e.target.value);fetchHolding(e.target.value);}} required>
          <option value="">— Select Agent —</option>
          {agents.map(a=><option key={a._id} value={a._id} style={{color:'#1e293b',background:'#fff'}}>{agentLabel(a)}</option>)}
        </select>
      </div>
      {agentId&&(
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
          <span className="text-sm text-slate-600 font-medium">Current Cash Holding</span>
          <span className={`text-2xl font-bold font-mono ${holding>0?'text-red-600':'text-emerald-600'}`}>{fmt.format(holding)}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Date</label>
          <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <div><label className="label">Amount to Receive *</label>
          <input type="number" step="0.01" className="input" value={amt} onChange={e=>setAmt(e.target.value)} required placeholder="0.00"/></div>
      </div>
      <div className="modal-footer px-0 pb-0">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn btn-success">
          {loading?'…':<><i className="fas fa-hand-holding-usd"/> Receive Cash</>}
        </button>
      </div>
    </form>
  );
}

export default function AgentsPage() {
  const [agents,    setAgents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [handover,  setHandover]  = useState(false);
  const [confirm,   setConfirm]   = useState(null);
  const toast = useToast();

  // next free agent code: ag01, ag02 … (the server assigns the real one)
  const nextCode = 'ag' + String(agents.reduce((m,a)=>{ const n=/^ag(\d+)$/i.exec(a.agentCode||''); return n?Math.max(m,parseInt(n[1],10)):m; },0)+1).padStart(2,'0');

  const load=useCallback(async()=>{
    try { setLoading(true); const r=await api.get('/agents'); setAgents(r.data); }
    catch(err){ toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const del=async id=>{
    try { await api.delete(`/agents/${id}`); toast.success('Agent deactivated'); load(); } catch(err){ toast.error(getErrorMsg(err)); }
    setConfirm(null);
  };

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Manage field collection agents and their configurations"
        actions={
          <div className="flex gap-2">
            <button onClick={()=>{setEditing(null);setShowForm(true);}} className="btn btn-primary"><i className="fas fa-user-plus"/> Add Agent</button>
            <button onClick={()=>setHandover(true)} className="btn btn-success"><i className="fas fa-hand-holding-usd"/> Receive Cash</button>
          </div>
        }
      />

      {loading
        ? <PageLoader/>
        : agents.length===0
          ? <div className="card"><EmptyState icon="fa-user-tie" title="No agents yet" message="Add agents to assign customer accounts for field collection" action={<button onClick={()=>setShowForm(true)} className="btn btn-primary">Add Agent</button>}/></div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(a=>(
                <div key={a._id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <i className="fas fa-user-tie text-blue-600"/>
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{a.name || a.username}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a.agentCode && <span className="badge badge-blue font-mono">{a.agentCode}</span>}
                          <span className="text-xs text-slate-400">@{a.username} · {a.mobile||'No mobile'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={()=>{setEditing(a);setShowForm(true);}} className="btn btn-warning btn-sm"><i className="fas fa-edit"/></button>
                      <button onClick={()=>setConfirm(a._id)} className="btn btn-danger btn-sm"><i className="fas fa-trash"/></button>
                    </div>
                  </div>
                  <div className="mb-3 bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-slate-800">{a.assignedAccounts?.length||0}</div>
                    <div className="text-xs text-slate-400 font-medium">Assigned Accounts</div>
                  </div>
                  {a.address&&<div className="text-xs text-slate-400 mb-3 truncate"><i className="fas fa-map-marker-alt mr-1 text-slate-300"/>{a.address}</div>}
                  <button onClick={()=>setAssigning(a)} className="btn btn-outline w-full btn-sm">
                    <i className="fas fa-tasks"/> Assign Accounts
                  </button>
                </div>
              ))}
            </div>
      }

      <Modal isOpen={showForm} onClose={()=>{setShowForm(false);setEditing(null);}} title={editing?'Edit Agent':'Add Agent'}>
        <AgentForm agent={editing} nextCode={nextCode} onSave={()=>{setShowForm(false);setEditing(null);load();toast.success(editing?'Agent updated':'Agent created');}} onClose={()=>{setShowForm(false);setEditing(null);}}/>
      </Modal>
      <Modal isOpen={!!assigning} onClose={()=>setAssigning(null)} title={`Assign Accounts — ${assigning ? agentLabel(assigning) : ''}`} size="lg">
        {assigning&&<AssignModal agent={assigning} onClose={()=>{setAssigning(null);load();}}/>}
      </Modal>
      <Modal isOpen={handover} onClose={()=>setHandover(false)} title="Receive Cash from Agent">
        <HandoverModal agents={agents} onClose={()=>setHandover(false)} onSuccess={load}/>
      </Modal>
      <ConfirmDialog isOpen={!!confirm} title="Deactivate Agent" message="Agent will be deactivated. All data is preserved." confirmText="Deactivate" onConfirm={()=>del(confirm)} onCancel={()=>setConfirm(null)}/>
    </div>
  );
}
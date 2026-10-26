import { useState, useEffect, useCallback } from 'react';
import api, { fmt, getErrorMsg } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { Modal, PageHeader, PageLoader, EmptyState, ConfirmDialog, SearchInput } from '../shared';

export default function MasterPage() {
  const [accounts,setAccounts]= useState([]);
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [showForm,setShowForm]= useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [form,    setForm]    = useState({ name:'', group:'', type:'general' });
  const toast = useToast();

  const load=useCallback(async()=>{
    try {
      setLoading(true);
      const [ar,gr]=await Promise.all([api.get('/accounts?category=ledger'),api.get('/groups')]);
      setAccounts(ar.data); setGroups(gr.data);
      if (gr.data.length) setForm(f=>({...f,group:f.group||gr.data[0].name}));
    } catch(err){ toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{ load(); },[load]);

  const openCreate=()=>{ setForm({name:'',group:groups[0]?.name||'',type:'general'}); setEditing(null); setShowForm(true); };
  const openEdit=a=>{ setForm({name:a.name,group:a.group,type:a.type}); setEditing(a); setShowForm(true); };

  const submit=async e=>{
    e.preventDefault();
    try {
      if (editing){ const r=await api.put(`/accounts/${editing._id}`,{name:form.name,group:form.group,type:form.type}); setAccounts(p=>p.map(a=>a._id===editing._id?r.data:a)); toast.success('Updated'); }
      else { const r=await api.post('/accounts/ledger',form); setAccounts(p=>[r.data,...p]); toast.success('Account created'); }
      setShowForm(false);
    } catch(err){ toast.error(getErrorMsg(err)); }
  };

  const del=async id=>{
    try { await api.delete(`/accounts/${id}`); setAccounts(p=>p.filter(a=>a._id!==id)); toast.success('Deleted'); }
    catch(err){ toast.error(getErrorMsg(err)); }
    setConfirm(null);
  };

  const tc={cash:'badge-green',bank:'badge-blue',general:'badge-slate'};
  const filtered=accounts.filter(a=>(showDefaults||!a.isDefault)&&(a.name.toLowerCase().includes(search.toLowerCase())||a.group.toLowerCase().includes(search.toLowerCase())||a.type.toLowerCase().includes(search.toLowerCase())));

  return (
    <div>
      <PageHeader title="Account Master" subtitle="Manage ledger accounts — Cash, Bank, Income, Expense etc."
        actions={<button onClick={openCreate} className="btn btn-primary"><i className="fas fa-plus"/> Add Account</button>}/>
      <div className="card">
        <div className="mb-4 flex items-center gap-3"><SearchInput value={search} onChange={setSearch} placeholder="Search accounts…" className="max-w-sm"/><button onClick={()=>setShowDefaults(!showDefaults)} className="btn btn-sm btn-secondary"><i className={`fas fa-${showDefaults?'eye-slash':'eye'}`}/> {showDefaults?'Hide':'Show'} Defaults</button></div>
        {loading
          ? <PageLoader/>
          : filtered.length===0
            ? <EmptyState icon="fa-book" title="No ledger accounts" message="Add master accounts for cash, bank, income etc." action={<button onClick={openCreate} className="btn btn-primary">Add Account</button>}/>
            : <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Account Name</th><th>Type</th><th>Group</th><th>Balance</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filtered.map(a=>(
                      <tr key={a._id}>
                        <td>
                          <div className="font-semibold text-slate-800">{a.name}</div>
                          {a.isDefault&&<span className="badge badge-slate text-[10px] mt-0.5">Default</span>}
                        </td>
                        <td><span className={`badge ${tc[a.type]||'badge-slate'}`}>{a.type}</span></td>
                        <td className="text-slate-500 text-sm">{a.group}</td>
                        <td className={`font-mono font-bold text-sm ${a.balance<0?'text-red-500':'text-emerald-600'}`}>{fmt.format(a.balance)}</td>
                        <td>
                          <div className="flex gap-1">
                            <button onClick={()=>openEdit(a)} className="btn btn-warning btn-sm"><i className="fas fa-edit"/></button>
                            <button onClick={()=>setConfirm(a._id)} className="btn btn-danger btn-sm"><i className="fas fa-trash"/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </div>
      <Modal isOpen={showForm} onClose={()=>setShowForm(false)} title={editing?'Edit Account':'Add Ledger Account'}>
        <form onSubmit={submit} className="modal-body space-y-4">
          <div><label className="label">Account Name *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="e.g. Petty Cash"/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Type</label>
              <select className="select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option value="general">General</option><option value="cash">Cash</option><option value="bank">Bank</option>
              </select></div>
            <div><label className="label">Group *</label>
              <select className="select" value={form.group} onChange={e=>setForm(f=>({...f,group:e.target.value}))} required>
                {groups.map(g=><option key={g._id} value={g.name}>{g.name} ({g.type})</option>)}
              </select></div>
          </div>
          <div className="modal-footer px-0 pb-0">
            <button type="button" onClick={()=>setShowForm(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">{editing?'Update':'Add Account'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!confirm} title="Delete Account" message="Permanently delete this account? Cannot undo." confirmText="Delete" onConfirm={()=>del(confirm)} onCancel={()=>setConfirm(null)}/>
    </div>
  );
}

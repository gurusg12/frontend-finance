import { useState, useEffect, useCallback } from 'react';
import api, { getErrorMsg } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { Modal, PageHeader, PageLoader, EmptyState, ConfirmDialog, SearchInput } from '../shared';
export default function AccountTypesPage(){
  const [types,  setTypes]  =useState([]);
  const [groups, setGroups] =useState([]);
  const [loading,setLoading]=useState(true);
  const [search, setSearch] =useState('');
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [showDefaults, setShowDefaults] =useState(false);
  const [form,   setForm]   =useState({name:'',prefix:'',group:''});
  const toast=useToast();
  const load=useCallback(async()=>{ try{setLoading(true);const[tr,gr]=await Promise.all([api.get('/account-types'),api.get('/groups')]);setTypes(tr.data);setGroups(gr.data);if(gr.data.length)setForm(f=>({...f,group:f.group||gr.data[0].name}));}catch(err){toast.error(getErrorMsg(err));}finally{setLoading(false);}  },[]);
  useEffect(()=>{ load(); },[load]);
  const submit=async e=>{ e.preventDefault();
    try{ if(editing){const r=await api.put(`/account-types/${editing._id}`,form);setTypes(p=>p.map(t=>t._id===editing._id?r.data:t));toast.success('Updated');}
    else{const r=await api.post('/account-types',form);setTypes(p=>[...p,r.data]);toast.success('Account type created');}
    setShowForm(false);}catch(err){toast.error(getErrorMsg(err));}
  };
  const del=async id=>{ try{await api.delete(`/account-types/${id}`);setTypes(p=>p.filter(t=>t._id!==id));toast.success('Deleted');}catch(err){toast.error(getErrorMsg(err));}setConfirm(null);};
  const filtered=types.filter(t=>(showDefaults||!t.isDefault)&&(t.name.toLowerCase().includes(search.toLowerCase())||t.prefix.toLowerCase().includes(search.toLowerCase())));
  return(
    <div>
      <PageHeader title="Account Types" subtitle="Configure Savings, Pigmy, Loan and other account types" actions={<button onClick={()=>{setForm({name:'',prefix:'',group:groups[0]?.name||''});setEditing(null);setShowForm(true);}} className="btn btn-primary"><i className="fas fa-plus"/> Add Type</button>}/>
      <div className="mb-4 flex items-center gap-3"><SearchInput value={search} onChange={setSearch} placeholder="Search types…" className="max-w-sm"/><button onClick={()=>setShowDefaults(!showDefaults)} className="btn btn-sm btn-secondary"><i className={`fas fa-${showDefaults?'eye-slash':'eye'}`}/> {showDefaults?'Hide':'Show'} Defaults</button></div>
      {loading?<PageLoader/>:types.length===0?<div className="card"><EmptyState icon="fa-tags" title="No account types" message="Add account types to open customer accounts" action={<button onClick={()=>setShowForm(true)} className="btn btn-primary">Add Type</button>}/></div>:
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(t=>{
            const isLoan=(t.group||'').toLowerCase().includes('loan');
            return(
              <div key={t._id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold ${isLoan?'bg-red-100 text-red-600':'bg-emerald-100 text-emerald-600'}`}>{t.prefix}</div>
                  <div className="flex gap-1">
                    <button onClick={()=>{setForm({name:t.name,prefix:t.prefix,group:t.group});setEditing(t);setShowForm(true);}} className="btn btn-warning btn-sm"><i className="fas fa-edit"/></button>
                    <button onClick={()=>setConfirm(t._id)} className="btn btn-danger btn-sm"><i className="fas fa-trash"/></button>
                  </div>
                </div>
                <div className="font-bold text-slate-800 text-sm">{t.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{t.group}</div>
                {t.isDefault&&<span className="badge badge-slate mt-2 text-[10px]">Default</span>}
              </div>
            );
          })}
        </div>
      }
      <Modal isOpen={showForm} onClose={()=>setShowForm(false)} title={editing?'Edit Account Type':'Add Account Type'}>
        <form onSubmit={submit} className="modal-body space-y-4">
          <div><label className="label">Type Name *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="e.g. Fixed Deposit"/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Prefix *</label><input className="input uppercase" value={form.prefix} onChange={e=>setForm(f=>({...f,prefix:e.target.value.toUpperCase()}))} required placeholder="e.g. FD" maxLength={4}/><p className="text-xs text-slate-400 mt-1">Accounts start with this</p></div>
            <div><label className="label">Group *</label><select className="select" value={form.group} onChange={e=>setForm(f=>({...f,group:e.target.value}))} required>{groups.map(g=><option key={g._id} value={g.name}>{g.name} ({g.type})</option>)}</select></div>
          </div>
          <div className="modal-footer px-0 pb-0"><button type="button" onClick={()=>setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{editing?'Update':'Add Type'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!confirm} title="Delete Account Type" message="Cannot delete if accounts exist with this type." confirmText="Delete" onConfirm={()=>del(confirm)} onCancel={()=>setConfirm(null)}/>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import api, { getErrorMsg } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { Modal, PageHeader, PageLoader, EmptyState, ConfirmDialog, SearchInput } from '../shared';
const TYPES=['Asset','Liability','Income','Expense','Equity'];
const TC   ={Asset:'badge-blue',Liability:'badge-amber',Income:'badge-green',Expense:'badge-red',Equity:'badge-slate'};
export default function GroupsPage(){
  const [groups, setGroups] =useState([]);
  const [loading,setLoading]=useState(true);
  const [search, setSearch] =useState('');
  const [showForm,setShowForm]=useState(false);
  const [editing,setEditing] =useState(null);
  const [confirm,setConfirm] =useState(null);
  const [showDefaults, setShowDefaults] =useState(false);
  const [form,   setForm]    =useState({name:'',type:'Asset'});
  const toast=useToast();
  const load=useCallback(async()=>{ try{setLoading(true);const r=await api.get('/groups');setGroups(r.data);}catch(err){toast.error(getErrorMsg(err));}finally{setLoading(false);}  },[]);
  useEffect(()=>{ load(); },[load]);
  const submit=async e=>{ e.preventDefault();
    try{ if(editing){const r=await api.put(`/groups/${editing._id}`,form);setGroups(p=>p.map(g=>g._id===editing._id?r.data:g));toast.success('Updated');}
    else{const r=await api.post('/groups',form);setGroups(p=>[...p,r.data]);toast.success('Group created');}
    setShowForm(false);}catch(err){toast.error(getErrorMsg(err));}
  };
  const del=async id=>{ try{await api.delete(`/groups/${id}`);setGroups(p=>p.filter(g=>g._id!==id));toast.success('Deleted');}catch(err){toast.error(getErrorMsg(err));}setConfirm(null);};
  const filtered=groups.filter(g=>(showDefaults||!g.isDefault)&&(g.name.toLowerCase().includes(search.toLowerCase())||g.type.toLowerCase().includes(search.toLowerCase())));
  const grouped=TYPES.reduce((acc,type)=>{ const items=filtered.filter(g=>g.type===type);if(items.length)acc[type]=items;return acc;},{});
  return(
    <div>
      <PageHeader title="Groups" subtitle="Organize accounts under financial groups" actions={<button onClick={()=>{setForm({name:'',type:'Asset'});setEditing(null);setShowForm(true);}} className="btn btn-primary"><i className="fas fa-plus"/> Add Group</button>}/>
      <div className="mb-4 flex items-center gap-3"><SearchInput value={search} onChange={setSearch} placeholder="Search groups…" className="max-w-sm"/><button onClick={()=>setShowDefaults(!showDefaults)} className="btn btn-sm btn-secondary"><i className={`fas fa-${showDefaults?'eye-slash':'eye'}`}/> {showDefaults?'Hide':'Show'} Defaults</button></div>
      {loading?<PageLoader/>:groups.length===0?<div className="card"><EmptyState icon="fa-layer-group" title="No groups" message="Create groups to categorize accounts" action={<button onClick={()=>setShowForm(true)} className="btn btn-primary">Add Group</button>}/></div>:
        <div className="space-y-4">
          {Object.entries(grouped).map(([type,items])=>(
            <div key={type} className="card">
              <div className="flex items-center gap-2 mb-3"><span className={`badge ${TC[type]}`}>{type}</span><span className="text-xs text-slate-400">{items.length} groups</span></div>
              <div className="table-wrap"><table className="table"><thead><tr><th>Group Name</th><th>Type</th><th>Default</th><th>Actions</th></tr></thead>
                <tbody>{items.map(g=>(
                  <tr key={g._id}>
                    <td className="font-semibold text-slate-800">{g.name}</td>
                    <td><span className={`badge ${TC[g.type]}`}>{g.type}</span></td>
                    <td>{g.isDefault?<span className="badge badge-slate">Default</span>:'—'}</td>
                    <td><div className="flex gap-1">
                      <button onClick={()=>{setForm({name:g.name,type:g.type});setEditing(g);setShowForm(true);}} className="btn btn-warning btn-sm"><i className="fas fa-edit"/></button>
                      <button onClick={()=>setConfirm(g._id)} className="btn btn-danger btn-sm"><i className="fas fa-trash"/></button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          ))}
        </div>
      }
      <Modal isOpen={showForm} onClose={()=>setShowForm(false)} title={editing?'Edit Group':'Add Group'}>
        <form onSubmit={submit} className="modal-body space-y-4">
          <div><label className="label">Group Name *</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="e.g. Fixed Deposits"/></div>
          <div><label className="label">Type *</label><select className="select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div className="modal-footer px-0 pb-0"><button type="button" onClick={()=>setShowForm(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">{editing?'Update':'Add Group'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!confirm} title="Delete Group" message="Cannot delete if accounts exist inside." confirmText="Delete" onConfirm={()=>del(confirm)} onCancel={()=>setConfirm(null)}/>
    </div>
  );
}

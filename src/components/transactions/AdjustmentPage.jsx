import { useState, useEffect } from 'react';
import api, { fmt, dateDisp, dateNow, getErrorMsg } from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';
import { Modal, PageHeader, PageLoader, EmptyState } from '../shared';

function AccSearchModal({ title, onSelect, onClose }) {
  const [q,       setQ]       = useState('');
  const [accounts,setAccounts]= useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ api.get('/accounts?status=active').then(r=>setAccounts(r.data)).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  const filtered = accounts.filter(a=>a.name.toLowerCase().includes(q.toLowerCase())||(a.accNo&&a.accNo.toLowerCase().includes(q.toLowerCase()))||(a.custId?.name&&a.custId.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="modal-body space-y-3">
      <input className="input" placeholder="Search by name, account no…" value={q} onChange={e=>setQ(e.target.value)} autoFocus/>
      <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-50">
        {loading
          ? <div className="flex justify-center py-8"><span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>
          : filtered.length===0
            ? <div className="text-center text-slate-400 py-8 text-sm">No accounts found</div>
            : filtered.map(a=>(
                <button key={a._id} onClick={()=>onSelect(a)} className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 text-sm">{a.custId?.name||a.name}</span>
                      {a.accNo&&<span className="ml-2 font-mono text-xs text-slate-400">{a.accNo}</span>}
                    </div>
                    <span className={`font-bold font-mono text-sm flex-shrink-0 ml-3 ${a.balance<0?'text-red-500':'text-emerald-600'}`}>{fmt.format(a.balance)}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{a.type} &nbsp;·&nbsp; {a.group} &nbsp;·&nbsp; {a.category}</div>
                </button>
              ))
        }
      </div>
      <div className="modal-footer px-0 pb-0"><button onClick={onClose} className="btn btn-secondary w-full">Cancel</button></div>
    </div>
  );
}

export default function AdjustmentPage() {
  const [drAcc,   setDrAcc]   = useState(null);
  const [crAcc,   setCrAcc]   = useState(null);
  const [searchFor,setSearchFor]= useState(null);
  const [form,    setForm]    = useState({ date:dateNow(), amt:'', desc:'' });
  const [saving,  setSaving]  = useState(false);
  const [history, setHistory] = useState([]);
  const [histLoad,setHistLoad]= useState(true);
  const toast = useToast();

  useEffect(()=>{ loadHistory(); },[]);
  const loadHistory = async()=>{
    try {
      setHistLoad(true);
      const r = await api.get('/transactions?limit=30');
      setHistory(r.data.filter(t=>t.type==='adjustment'));
    } catch(err){ toast.error(getErrorMsg(err)); }
    finally { setHistLoad(false); }
  };

  const submit = async e => {
    e.preventDefault();
    if (!drAcc||!crAcc) return toast.error('Select both Debit and Credit accounts');
    if (drAcc._id===crAcc._id) return toast.error('DR and CR accounts must be different');
    setSaving(true);
    try {
      await api.post('/transactions/adjustment',{ date:form.date, drId:drAcc._id, crId:crAcc._id, amt:form.amt, desc:form.desc });
      toast.success('Adjustment entry posted successfully');
      setDrAcc(null); setCrAcc(null); setForm({ date:dateNow(), amt:'', desc:'' });
      loadHistory();
    } catch(err){ toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  return (
    <div>
      <PageHeader title="Adjustment Entry" subtitle="Double-entry: transfer balance between any two accounts"/>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-title">New Adjustment</div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Date *</label>
                  <input type="date" className="input" value={form.date} onChange={e=>f('date',e.target.value)} required/></div>
                <div><label className="label">Amount (₹) *</label>
                  <input type="number" step="0.01" className="input" value={form.amt} onChange={e=>f('amt',e.target.value)} placeholder="0.00" required/></div>
              </div>

              {/* DR */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-md flex items-center justify-center text-xs font-bold">DR</span>
                    <span className="text-sm font-bold text-emerald-800">Debit Account</span>
                  </div>
                  <button type="button" onClick={()=>setSearchFor('dr')} className="btn btn-success btn-sm">
                    <i className="fas fa-search"/> {drAcc?'Change':'Select'}
                  </button>
                </div>
                {drAcc
                  ? <div>
                      <div className="font-bold text-slate-800 text-sm">{drAcc.custId?.name||drAcc.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{drAcc.accNo||''} &nbsp;·&nbsp; Balance: <span className="font-mono font-semibold">{fmt.format(drAcc.balance)}</span></div>
                    </div>
                  : <div className="text-sm text-emerald-600 italic">No account selected</div>
                }
              </div>

              {/* CR */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-500 text-white rounded-md flex items-center justify-center text-xs font-bold">CR</span>
                    <span className="text-sm font-bold text-red-800">Credit Account</span>
                  </div>
                  <button type="button" onClick={()=>setSearchFor('cr')} className="btn btn-danger btn-sm">
                    <i className="fas fa-search"/> {crAcc?'Change':'Select'}
                  </button>
                </div>
                {crAcc
                  ? <div>
                      <div className="font-bold text-slate-800 text-sm">{crAcc.custId?.name||crAcc.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{crAcc.accNo||''} &nbsp;·&nbsp; Balance: <span className="font-mono font-semibold">{fmt.format(crAcc.balance)}</span></div>
                    </div>
                  : <div className="text-sm text-red-600 italic">No account selected</div>
                }
              </div>

              <div><label className="label">Narration</label>
                <input className="input" value={form.desc} onChange={e=>f('desc',e.target.value)} placeholder="Reason for adjustment"/></div>

              <div className="flex gap-3">
                <button type="button" onClick={()=>{setDrAcc(null);setCrAcc(null);setForm({date:dateNow(),amt:'',desc:''}); }} className="btn btn-secondary flex-shrink-0"><i className="fas fa-eraser"/> Clear</button>
                <button type="submit" disabled={saving||!drAcc||!crAcc} className="btn btn-primary flex-1">
                  {saving?<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>:<i className="fas fa-check"/>}
                  Post Entry
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-3">
          <div className="card">
            <div className="card-title">Recent Adjustments</div>
            {histLoad
              ? <PageLoader/>
              : history.length===0
                ? <EmptyState icon="fa-balance-scale" title="No adjustments yet" message="Posted adjustment entries will appear here"/>
                : <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Date</th><th>Debit (DR)</th><th>Credit (CR)</th><th>Amount</th><th>Narration</th></tr></thead>
                      <tbody>
                        {history.map(t=>{
                          const dr=t.accId, cr=t.secAccId;
                          return (
                            <tr key={t._id}>
                              <td className="text-xs whitespace-nowrap">{dateDisp(t.date)}</td>
                              <td>
                                <div className="text-sm font-semibold text-emerald-700">{dr?.custId?.name||dr?.name||'?'}</div>
                                {dr?.accNo&&<div className="text-xs text-slate-400 font-mono">{dr.accNo}</div>}
                              </td>
                              <td>
                                <div className="text-sm font-semibold text-red-600">{cr?.custId?.name||cr?.name||'?'}</div>
                                {cr?.accNo&&<div className="text-xs text-slate-400 font-mono">{cr.accNo}</div>}
                              </td>
                              <td className="font-bold font-mono text-blue-700">{fmt.format(t.amt)}</td>
                              <td className="text-xs text-slate-400 max-w-[140px] truncate">{(t.desc||'').replace('[ADJ] ','')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
            }
          </div>
        </div>
      </div>

      <Modal isOpen={!!searchFor} onClose={()=>setSearchFor(null)} title={searchFor==='dr'?'Select Debit Account':'Select Credit Account'}>
        <AccSearchModal
          title={searchFor==='dr'?'Debit Account':'Credit Account'}
          onSelect={acc=>{ if(searchFor==='dr') setDrAcc(acc); else setCrAcc(acc); setSearchFor(null); }}
          onClose={()=>setSearchFor(null)}
        />
      </Modal>
    </div>
  );
}

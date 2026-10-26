import { useState, useEffect, useRef } from 'react';
import api, { getErrorMsg } from '../../utils/api';
import { customersFromCSV, CUSTOMER_CSV_TEMPLATE } from '../../utils/finance';
import { Spinner } from '../shared';

/**
 * Import customers from a CSV file (Excel → Save As → CSV).
 * Columns: Name, Mobile, Address (header row optional). Opened with Ctrl+I on the Customers page.
 */
export default function ImportCustomers({ onClose, onDone }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows]         = useState([]);
  const [existing, setExisting] = useState(new Set());
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);
  const [drag, setDrag]         = useState(false);
  const inputRef = useRef(null);

  // names already in the system, so we can warn before importing
  useEffect(() => {
    api.get('/customers').then(r => setExisting(new Set((r.data || []).map(c => c.name.trim().toLowerCase())))).catch(() => {});
  }, []);

  const readFile = file => {
    setError(''); setResult(null);
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('File is too large (max 3 MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const { rows: parsed } = customersFromCSV(String(reader.result || ''));
      if (!parsed.length) { setError('No data found in this file.'); setRows([]); return; }
      if (parsed.length > 5000) { setError('Maximum 5000 customers per import.'); setRows([]); return; }
      setFileName(file.name);
      setRows(parsed);
    };
    reader.onerror = () => setError('Could not read the file.');
    reader.readAsText(file);
  };

  // mark each row: ok / problem
  const seen = new Set();
  const checked = rows.map(r => {
    const key = r.name.toLowerCase();
    let problem = '';
    if (!r.name) problem = 'Name is missing';
    else if (existing.has(key)) problem = 'Already exists';
    else if (seen.has(key)) problem = 'Duplicate in file';
    if (!problem && r.name) seen.add(key);
    return { ...r, problem };
  });
  const good = checked.filter(r => !r.problem);
  const bad  = checked.length - good.length;

  const downloadTemplate = () => {
    const blob = new Blob(['\uFEFF' + CUSTOMER_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'customers-template.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const r = await api.post('/customers/import', { customers: good.map(({ row, name, mobile, address }) => ({ row, name, mobile, address })) });
      setResult(r.data);
      onDone && onDone(r.data);
    } catch (err) { setError(getErrorMsg(err)); }
    finally { setBusy(false); }
  };

  /* ── result screen ─────────────────────────────────────────────── */
  if (result) return (
    <div className="modal-body space-y-4">
      <div className="text-center py-4">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 flex items-center justify-center"><i className="fas fa-check text-emerald-600 text-xl" /></div>
        <div className="text-lg font-bold text-slate-800">{result.created} customer{result.created !== 1 ? 's' : ''} imported</div>
        {result.skipped.length > 0 && <div className="text-sm text-amber-600 mt-1">{result.skipped.length} row(s) skipped</div>}
      </div>
      {result.skipped.length > 0 && (
        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-sm">
          {result.skipped.map((s, i) => (
            <div key={i} className="px-3 py-2 flex justify-between gap-3"><span className="truncate">Line {s.row}: {s.name || '(blank)'}</span><span className="text-slate-400 flex-shrink-0">{s.reason}</span></div>
          ))}
        </div>
      )}
      <div className="modal-footer px-0 pb-0"><button onClick={onClose} className="btn btn-primary">Done</button></div>
    </div>
  );

  /* ── pick file / preview ───────────────────────────────────────── */
  return (
    <div className="modal-body space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${drag ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
      >
        <i className="fas fa-file-csv text-3xl text-emerald-600 mb-2" />
        <div className="font-semibold text-slate-700 text-sm">{fileName || 'Choose a CSV file or drop it here'}</div>
        <div className="text-xs text-slate-400 mt-1">Columns: Name, Mobile, Address &nbsp;•&nbsp; Excel: File → Save As → CSV</div>
        <input ref={inputRef} type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={e => { readFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <button type="button" onClick={downloadTemplate} className="text-xs font-semibold text-blue-600 hover:underline">
        <i className="fas fa-download mr-1" /> Download sample CSV template
      </button>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {checked.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">{good.length} ready to import</span>
            {bad > 0 && <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">{bad} will be skipped</span>}
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{checked.length} rows in file</span>
          </div>
          <div className="max-h-64 overflow-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr><th className="text-left px-3 py-2">Line</th><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Mobile</th><th className="text-left px-3 py-2">Address</th><th className="text-left px-3 py-2">Status</th></tr>
              </thead>
              <tbody>
                {checked.slice(0, 200).map(r => (
                  <tr key={r.row} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-400">{r.row}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-700">{r.name || '—'}</td>
                    <td className="px-3 py-1.5">{r.mobile || '—'}</td>
                    <td className="px-3 py-1.5 max-w-[140px] truncate">{r.address || '—'}</td>
                    <td className="px-3 py-1.5">{r.problem ? <span className="text-amber-600 font-semibold">{r.problem}</span> : <span className="text-emerald-600 font-semibold">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {checked.length > 200 && <div className="text-center text-xs text-slate-400 py-2">…and {checked.length - 200} more rows</div>}
          </div>
        </>
      )}

      <div className="modal-footer px-0 pb-0">
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="button" onClick={submit} disabled={busy || good.length === 0} className="btn btn-primary">
          {busy ? <Spinner size="sm" /> : <i className="fas fa-file-import" />} Import {good.length > 0 ? `${good.length} customer${good.length !== 1 ? 's' : ''}` : ''}
        </button>
      </div>
    </div>
  );
}

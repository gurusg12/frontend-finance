import { useState, useEffect, useCallback, useRef } from 'react';
import api, { fmt, dateDisp, dateNow, getErrorMsg } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal, PageHeader, PageLoader, EmptyState, SearchInput } from '../shared';
import AccountTermsCard from './AccountTerms';
import { accountCategory, termsFor, loanArrears, lateFeeAmount } from '../../utils/finance';

const TYPE_COLORS = { deposit:'badge-green', withdraw:'badge-red', disburse:'badge-amber', repay_princ:'badge-blue', adjustment:'badge-slate', agent_handover:'badge-green', income:'badge-green', expense:'badge-red' };
const TYPE_LABELS = { deposit:'Deposit', withdraw:'Withdraw', disburse:'Disburse', repay_princ:'Repayment', adjustment:'Adjustment', agent_handover:'Handover', income:'Income', expense:'Expense' };
const isIncoming  = t => ['deposit','repay_princ','income','agent_handover'].includes(t);

/* ── Preset charge types ──────────────────────────────────────────────────────
   "interest" is special: its amount is AUTO-CALCULATED from the selected
   account's roi / period / opDate and is NOT manually editable (read-only,
   shown greyed-out) unless the user unlocks it via the lock icon.
──────────────────────────────────────────────────────────────────────────── */
const PRESET_CHARGES = [
  { key:'interest',    label:'Interest',          icon:'fa-percent',       auto:true  },
  { key:'late_fee',     label:'Late Fee',          icon:'fa-clock',         auto:false },
  { key:'processing_fee', label:'Processing Fee',  icon:'fa-file-invoice', auto:false },
  { key:'penalty',      label:'Penalty',           icon:'fa-exclamation',  auto:false },
  { key:'service_charge', label:'Service Charge',  icon:'fa-cogs',         auto:false },
  { key:'insurance',    label:'Insurance',         icon:'fa-shield-alt',   auto:false },
  { key:'doc_charge',   label:'Documentation Charge', icon:'fa-file-alt',  auto:false },
  { key:'other',        label:'Other Charge',      icon:'fa-ellipsis-h',   auto:false },
];

/* Simple-interest auto-calculation from account roi/period/opDate.
   Returns 0 if the account has no interest configuration. */
function calcAutoInterest(account, asOfDate) {
  if (!account || !account.roi || !account.opDate) return 0;
  const principal = Math.abs(account.balance || 0);
  if (!principal) return 0;

  const roi = parseFloat(account.roi) || 0;          // annual rate %
  const opDate = new Date(account.opDate);
  const today   = asOfDate ? new Date(asOfDate) : new Date();
  if (isNaN(opDate.getTime()) || isNaN(today.getTime())) return 0;

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(0, Math.round((today - opDate) / msPerDay));

  // Simple interest: P * R * (days/365) / 100
  const interest = (principal * roi * days) / (365 * 100);
  return Math.round(interest * 100) / 100;
}

/* ── ChargesPanel ─────────────────────────────────────────────────────────────
   Collapsible "⋯" trigger under the Amount field. Lets the user search/select
   preset charge types (checkbox-style), auto-calculates Interest from the
   account, allows custom charges, and locks the total. Returns the combined
   charges total via onTotalChange — does NOT touch any other form state.
──────────────────────────────────────────────────────────────────────────── */
function ChargesPanel({ account, txDate, suggested = {}, onTotalChange }) {
  const [open,        setOpen]        = useState(false);
  const [q,           setQ]           = useState('');
  const [selected,    setSelected]    = useState({});   // { key: amount }
  const [interestLocked, setInterestLocked] = useState(true); // locked = auto value, can't edit
  const [customName,  setCustomName]  = useState('');
  const [customAmt,   setCustomAmt]   = useState('');
  const [customList,  setCustomList]  = useState([]);   // [{id,name,amt}]

  const autoInterest = calcAutoInterest(account, txDate);

  // Recompute and emit total whenever any charge changes
  useEffect(() => {
    const presetTotal = Object.values(selected).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    const customTotal = customList.reduce((s, c) => s + (parseFloat(c.amt) || 0), 0);
    const total = presetTotal + customTotal;
    onTotalChange(total, buildChargesSummary());
    // eslint-disable-next-line
  }, [selected, customList]);

  const buildChargesSummary = () => {
    const parts = [];
    PRESET_CHARGES.forEach(c => {
      if (selected[c.key] !== undefined) {
        parts.push(`${c.label}: ${fmt.format(parseFloat(selected[c.key]) || 0)}`);
      }
    });
    customList.forEach(c => parts.push(`${c.name}: ${fmt.format(parseFloat(c.amt) || 0)}`));
    return parts.join(', ');
  };

  const toggleCharge = (chargeKey) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[chargeKey] !== undefined) {
        delete next[chargeKey];
      } else {
        // interest and late fee start from the calculated amount (the user can still change late fee)
        next[chargeKey] = chargeKey === 'interest' ? autoInterest : (Number(suggested[chargeKey]) || 0);
      }
      return next;
    });
  };

  const updateChargeAmt = (chargeKey, val) => {
    setSelected(prev => ({ ...prev, [chargeKey]: val }));
  };

  const addCustomCharge = () => {
    if (!customName.trim() || !customAmt || parseFloat(customAmt) <= 0) return;
    setCustomList(prev => [...prev, { id: Date.now(), name: customName.trim(), amt: customAmt }]);
    setCustomName(''); setCustomAmt('');
  };

  const removeCustom = (id) => setCustomList(prev => prev.filter(c => c.id !== id));

  // Keep interest amount synced to auto-calc while locked
  useEffect(() => {
    if (interestLocked && selected.interest !== undefined) {
      setSelected(prev => ({ ...prev, interest: autoInterest }));
    }
    // eslint-disable-next-line
  }, [autoInterest, interestLocked]);

  const filteredPresets = !q
    ? PRESET_CHARGES
    : PRESET_CHARGES.filter(c => c.label.toLowerCase().includes(q.toLowerCase()));

  const grandTotal = Object.values(selected).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                    + customList.reduce((s, c) => s + (parseFloat(c.amt) || 0), 0);
  const activeCount = Object.keys(selected).length + customList.length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Trigger row — the "⋯" (3 dots) under Amount */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
          <i className="fas fa-ellipsis-h text-slate-400"/>
          Charges {activeCount > 0 && <span className="badge badge-blue text-[10px]">{activeCount}</span>}
        </span>
        <span className="flex items-center gap-2">
          {grandTotal > 0 && (
            <span className="text-xs font-bold font-mono text-blue-600">+{fmt.format(grandTotal)}</span>
          )}
          <i className={`fas fa-chevron-${open ? 'up' : 'down'} text-slate-400 text-xs`}/>
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-3 bg-white border-t border-slate-100">
          {/* Search */}
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"/>
            <input
              className="input pl-8 text-sm"
              placeholder="Search charge type…"
              value={q}
              onChange={e=>setQ(e.target.value)}
            />
          </div>

          {/* Preset charges list — checkbox select */}
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {filteredPresets.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-3">No charges match "{q}"</div>
            ) : filteredPresets.map(c => {
              const isChecked = selected[c.key] !== undefined;
              const isInterest = c.key === 'interest';
              return (
                <div key={c.key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${isChecked ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleCharge(c.key)}
                    className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                      isChecked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <i className="fas fa-check text-white text-[10px]"/>}
                  </button>

                  <i className={`fas ${c.icon} text-slate-400 text-xs w-4 flex-shrink-0`}/>
                  <span className="text-sm text-slate-700 flex-1">{c.label}
                    {Number(suggested[c.key]) > 0 && !isChecked && (
                      <span className="ml-1.5 text-[10px] font-bold text-red-500">due {fmt.format(suggested[c.key])}</span>
                    )}
                  </span>

                  {isChecked && (
                    <div className="flex items-center gap-1.5">
                      {isInterest && (
                        <button
                          type="button"
                          title={interestLocked ? 'Auto-calculated — click to edit manually' : 'Manual — click to lock to auto-calc'}
                          onClick={() => setInterestLocked(l => !l)}
                          className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600"
                        >
                          <i className={`fas ${interestLocked ? 'fa-lock' : 'fa-lock-open'} text-xs`}/>
                        </button>
                      )}
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={isInterest && interestLocked}
                        className="input text-xs py-1 w-24 text-right font-mono disabled:bg-slate-100 disabled:text-slate-400"
                        value={selected[c.key]}
                        onChange={e => updateChargeAmt(c.key, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom charge entries already added */}
          {customList.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-100">
              {customList.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-50">
                  <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center bg-amber-500">
                    <i className="fas fa-check text-white text-[10px]"/>
                  </div>
                  <i className="fas fa-tag text-amber-500 text-xs w-4 flex-shrink-0"/>
                  <span className="text-sm text-slate-700 flex-1 truncate">{c.name}</span>
                  <span className="text-xs font-bold font-mono text-amber-700">{fmt.format(parseFloat(c.amt)||0)}</span>
                  <button type="button" onClick={()=>removeCustom(c.id)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500">
                    <i className="fas fa-times text-xs"/>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add custom charge */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <input
              className="input text-xs py-1.5 flex-1"
              placeholder="Custom charge name"
              value={customName}
              onChange={e=>setCustomName(e.target.value)}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              className="input text-xs py-1.5 w-20 text-right font-mono"
              placeholder="0.00"
              value={customAmt}
              onChange={e=>setCustomAmt(e.target.value)}
            />
            <button
              type="button"
              onClick={addCustomCharge}
              disabled={!customName.trim() || !customAmt}
              className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center text-white flex-shrink-0"
            >
              <i className="fas fa-plus text-xs"/>
            </button>
          </div>

          {/* Total */}
          {grandTotal > 0 && (
            <div className="flex items-center justify-between px-2 py-2 bg-blue-50 rounded-lg">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Total Charges</span>
              <span className="text-sm font-bold font-mono text-blue-700">{fmt.format(grandTotal)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ── VoucherModal ───────────────────────────────────────────────────────────── */
function VoucherModal({ voucher, onClose }) {
  const voucherRef = useRef(null);
  const { user } = useAuth();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    api.get('/settings').then(r => setCompany(r.data)).catch(() => {});
  }, []);

  const companyName = company?.name || 'MY FINANCE';
  const adminMobile = company?.mobile || '';
  const issuedBy    = user?.role === 'agent' ? (user?.username || 'AGENT') : 'ADMIN';
  const hasOpeningBal = voucher.openingBal !== undefined && voucher.openingBal !== null;

  // ── Share / Print helpers ─────────────────────────────────────────────────

  const getVoucherText = () =>
`${companyName}
Transaction Receipt${voucher.isDuplicate ? ' (DUPLICATE)' : ''}
-----------------------------
Date       : ${voucher.date}
Voucher No : ${voucher.voucherNo}
Customer   : ${voucher.customerName}
Account    : ${voucher.accNo}
Type       : ${(voucher.type||'').toUpperCase()}
-----------------------------
${hasOpeningBal ? `Opening Bal: ${fmt.format(voucher.openingBal)}\n` : ''}Amount     : ${fmt.format(voucher.amt)}
Avail. Bal : ${fmt.format(voucher.availableBal)}
Details    : ${voucher.desc || 'N/A'}
-----------------------------
Thank you
Issued by  : ${issuedBy}
Mob        : ${adminMobile}`;

  const handleWhatsApp = () => {
    const text = encodeURIComponent(getVoucherText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleSMS = () => {
    const text = encodeURIComponent(getVoucherText());
    window.open(`sms:?body=${text}`, '_self');
  };

  const handleSaveImage = async () => {
    try {
      const el = voucherRef.current;
      if (!el) return;
      // Use html2canvas via CDN loaded inline, fallback to print
      if (window.html2canvas) {
        const canvas = await window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = `receipt_${voucher.voucherNo}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        // Load html2canvas dynamically
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = async () => {
          const canvas = await window.html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const link = document.createElement('a');
          link.download = `receipt_${voucher.voucherNo}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        };
        document.head.appendChild(script);
      }
    } catch { alert('Save as image failed. Please use Print instead.'); }
  };

  const handlePrint = () => {
    const el = voucherRef.current;
    if (!el) return;
    const html = `<!DOCTYPE html><html><head><title>Receipt</title>
<style>
  body{font-family:monospace;font-size:12px;margin:0;padding:16px;background:#fff;}
  .center{text-align:center;} .bold{font-weight:bold;} .big{font-size:16px;}
  .line{border-top:1px dashed #555;margin:8px 0;}
  .row{display:flex;justify-content:space-between;margin:4px 0;}
  .amount{font-size:18px;font-weight:bold;}
  @media print{body{padding:4px;}}
</style></head><body>
<div class="center bold big">${companyName}</div>
<div class="center">Transaction Receipt${voucher.isDuplicate ? ' <b>(DUPLICATE)</b>' : ''}</div>
<div class="line"></div>
<div class="row"><span><b>Date:</b></span><span>${voucher.date}</span></div>
<div class="row"><span><b>Voucher No:</b></span><span>${voucher.voucherNo}</span></div>
<div class="row"><span><b>Customer:</b></span><span>${voucher.customerName}</span></div>
<div class="row"><span><b>Account:</b></span><span>${voucher.accNo}</span></div>
<div class="row"><span><b>Type:</b></span><span>${(voucher.type||'').toUpperCase()}</span></div>
<div class="line"></div>
${hasOpeningBal ? `<div class="row"><span>Opening Bal:</span><span>${fmt.format(voucher.openingBal)}</span></div>` : ''}
<div class="row"><span>Amount:</span><span class="amount">${fmt.format(voucher.amt)}</span></div>
<div class="row"><span>Available Bal:</span><span>${fmt.format(voucher.availableBal)}</span></div>
<div class="row"><span>Details:</span><span>${voucher.desc || 'N/A'}</span></div>
<div class="line"></div>
<div class="center">Thank you</div>
<div class="center">Issued by: ${issuedBy}</div>
<div class="center">Mob: ${adminMobile}</div>
</body></html>`;
    const w = window.open('', '_blank', 'width=380,height=620');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  // Bluetooth / ESC-POS thermal printer via Web Bluetooth API
  const handleBluetoothPrint = async () => {
    if (!navigator.bluetooth) {
      alert('Web Bluetooth is not supported on this browser/device.\nTry Chrome on Android.');
      return;
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });
      const server  = await device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const char    = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      const ESC = 0x1b, GS = 0x1d;
      const enc = new TextEncoder();
      const lines = [
        [ESC,0x40],                        // Init
        [ESC,0x61,0x01],                   // Center align
        [ESC,0x45,0x01], ...enc.encode(companyName + '\n'), [ESC,0x45,0x00],
        ...enc.encode('Transaction Receipt\n'),
        [ESC,0x61,0x00],                   // Left align
        ...enc.encode('--------------------------------\n'),
        ...enc.encode(`Date   : ${voucher.date}\n`),
        ...enc.encode(`Voucher: ${voucher.voucherNo}\n`),
        ...enc.encode(`Cust   : ${voucher.customerName}\n`),
        ...enc.encode(`A/C    : ${voucher.accNo}\n`),
        ...enc.encode(`Type   : ${(voucher.type||'').toUpperCase()}\n`),
        ...enc.encode('--------------------------------\n'),
        ...(hasOpeningBal ? enc.encode(`Opening: ${fmt.format(voucher.openingBal)}\n`) : []),
        [GS,0x21,0x11],                    // Double size
        ...enc.encode(`Amt: ${fmt.format(voucher.amt)}\n`),
        [GS,0x21,0x00],                    // Normal size
        ...enc.encode(`Avail  : ${fmt.format(voucher.availableBal)}\n`),
        ...enc.encode(`Details: ${voucher.desc||'N/A'}\n`),
        ...enc.encode('--------------------------------\n'),
        [ESC,0x61,0x01],
        ...enc.encode('Thank you\n'),
        ...enc.encode(`Issued by: ${issuedBy}\n`),
        ...enc.encode(`Mob: ${adminMobile}\n`),
        [0x0a,0x0a,0x0a],                  // Feed lines
        [GS,0x56,0x42,0x00],               // Cut paper
      ];

      const flat = new Uint8Array(lines.flat());
      // Send in 512-byte chunks
      for (let i = 0; i < flat.length; i += 512) {
        await char.writeValue(flat.slice(i, i + 512));
      }
      alert('Printed successfully!');
    } catch (err) {
      if (err.name !== 'NotFoundError') alert('Bluetooth print failed: ' + err.message);
    }
  };

  return (
    <div className="modal-body p-0">
      {/* Voucher preview */}
      <div
        ref={voucherRef}
        style={{ fontFamily: "'Courier New', monospace", background: '#fff', padding: '20px 24px' }}
        className="border border-dashed border-slate-300 mx-4 mt-4 rounded-lg"
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>{companyName}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Transaction Receipt</div>
          {voucher.isDuplicate && (
            <div style={{ fontSize: 11, fontWeight: 'bold', color: '#dc2626', letterSpacing: 1, marginTop: 2 }}>DUPLICATE COPY</div>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '10px 0' }}/>

        {/* Details */}
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <tbody>
            {[
              ['Date',       voucher.date],
              ['Voucher No', voucher.voucherNo],
              ['Customer',   voucher.customerName],
              ['Account',    voucher.accNo],
              ['Type',       (voucher.type||'').toUpperCase()],
            ].map(([k,v]) => (
              <tr key={k}>
                <td style={{ paddingBottom: 3, fontWeight: 'bold', width: '40%' }}>{k}:</td>
                <td style={{ paddingBottom: 3 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '10px 0' }}/>

        {/* Amounts */}
        <div style={{ fontSize: 12 }}>
          {hasOpeningBal && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Opening Bal:</span>
              <span>{fmt.format(voucher.openingBal)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 'bold' }}>Amount:</span>
            <span style={{ fontSize: 22, fontWeight: 'bold', color: isIncoming(voucher.type) ? '#059669' : '#dc2626' }}>
              {fmt.format(voucher.amt)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Available Bal:</span>
            <span>{fmt.format(voucher.availableBal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Details:</span>
            <span>{voucher.desc || 'N/A'}</span>
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px dashed #aaa', margin: '10px 0' }}/>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 12, color: '#555' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Thank you</div>
          <div>Issued by: {issuedBy}</div>
          {adminMobile && <div>Mob: {adminMobile}</div>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pt-3 pb-4 space-y-2">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSaveImage}
            className="btn w-full flex items-center justify-center gap-2 text-white"
            style={{ background: '#7c3aed' }}
          >
            <i className="fas fa-image text-sm"/> Save Image
          </button>
          <button
            onClick={handleWhatsApp}
            className="btn w-full flex items-center justify-center gap-2 text-white"
            style={{ background: '#25d366' }}
          >
            <i className="fab fa-whatsapp text-sm"/> WhatsApp
          </button>
        </div>
        {/* Row 2 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSMS}
            className="btn w-full flex items-center justify-center gap-2 text-white"
            style={{ background: '#0ea5e9' }}
          >
            <i className="fas fa-sms text-sm"/> SMS
          </button>
          <button
            onClick={handleBluetoothPrint}
            className="btn w-full flex items-center justify-center gap-2 text-white"
            style={{ background: '#1e40af' }}
          >
            <i className="fas fa-bluetooth-b text-sm"/> Bluetooth
          </button>
        </div>
        {/* Row 3 */}
        <button
          onClick={handlePrint}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          <i className="fas fa-print text-sm"/> Print Receipt
        </button>
        <button onClick={onClose} className="btn btn-secondary w-full btn-sm">
          Close
        </button>
      </div>
    </div>
  );
}

/* ── Edit Transaction Modal ─────────────────────────────────────────────────── */
function EditTransModal({ trans, onSave, onDelete, onClose }) {
  const [form,  setForm]  = useState({ date:trans.date, type:trans.type, amt:trans.amt, desc:trans.desc||'' });
  const [saving,setSaving]= useState(false);
  const toast = useToast();

  const TYPES = trans.type==='adjustment'
    ? [{v:'adjustment',l:'Adjustment'}]
    : trans.type==='agent_handover'
    ? [{v:'agent_handover',l:'Agent Handover'}]
    : [{v:'deposit',l:'Deposit/Receipt'},{v:'withdraw',l:'Withdraw/Payment'},{v:'disburse',l:'Disburse'},{v:'repay_princ',l:'Repayment'}];

  const update = async e => {
    e.preventDefault(); setSaving(true);
    try { await api.put(`/transactions/${trans._id}`,form); toast.success('Transaction updated'); onSave(); }
    catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };
  const del = async () => {
    if (!window.confirm('Delete this transaction? Balances will be reversed.')) return;
    setSaving(true);
    try { await api.delete(`/transactions/${trans._id}`); toast.success('Deleted and balances reversed'); onDelete(); }
    catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const name = trans.accId?.custId?.name || trans.accId?.name || '—';
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  return (
    <form onSubmit={update} className="modal-body space-y-4">
      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-receipt text-blue-600 text-sm"/></div>
        <div>
          <div className="font-bold text-blue-800 text-sm">{name}</div>
          {trans.accId?.accNo && <div className="text-xs text-blue-500 font-mono">{trans.accId.accNo}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Date</label>
          <input type="date" className="input" value={form.date} onChange={e=>f('date',e.target.value)} required/></div>
        <div><label className="label">Type</label>
          <select className="select" value={form.type} onChange={e=>f('type',e.target.value)}>
            {TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
          </select></div>
        <div><label className="label">Amount (₹)</label>
          <input type="number" step="0.01" className="input" value={form.amt} onChange={e=>f('amt',e.target.value)} required/></div>
        <div><label className="label">Description</label>
          <input className="input" value={form.desc} onChange={e=>f('desc',e.target.value)} placeholder="Narration"/></div>
      </div>
      <div className="modal-footer px-0 pb-0">
        <button type="button" onClick={del} disabled={saving} className="btn btn-danger mr-auto"><i className="fas fa-trash"/> Delete</button>
        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving&&<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}Update
        </button>
      </div>
    </form>
  );
}

/* ── PayAccountPicker ───────────────────────────────────────────────────────── */
function PayAccountPicker({ mode, customerId, excludeIds=[], onSelect, onClose }) {
  const [q,        setQ]       = useState('');
  const [accounts, setAccounts]= useState([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const r = await api.get('/accounts?status=active');
        let data = r.data || [];

        if (mode === 'customer' && customerId) {
          data = data.filter(a =>
            (a.custId?._id || a.custId)?.toString() === customerId.toString()
          );
          const typeRank = t => {
            const l = (t||'').toLowerCase();
            if (l === 'cash') return 0;
            if (l === 'bank') return 1;
            return 2;
          };
          data.sort((a,b) => typeRank(a.type) - typeRank(b.type));
        }

        if (excludeIds.length) data = data.filter(a => !excludeIds.includes(a._id));
        setAccounts(data);
      } catch { setAccounts([]); }
      finally { setLoading(false); }
    };
    load();
  }, [mode, customerId, excludeIds.join(',')]);

  const filtered = !q ? accounts : accounts.filter(a => {
    const qL = q.toLowerCase();
    return (
      (a.name||'').toLowerCase().includes(qL) ||
      (a.accNo||'').toLowerCase().includes(qL) ||
      (a.custId?.name||'').toLowerCase().includes(qL) ||
      (a.type||'').toLowerCase().includes(qL)
    );
  });

  return (
    <div className="modal-body p-0">
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"/>
          <input
            className="input pl-8 text-sm"
            placeholder="Search name, account no, type…"
            value={q}
            onChange={e=>setQ(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 border-t border-slate-100">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-sm">
            {q ? `No accounts match "${q}"` : 'No accounts available'}
          </div>
        ) : filtered.map(a => (
          <button
            key={a._id}
            onClick={()=>onSelect(a)}
            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 text-sm truncate">
                  {a.custId?.name || a.name}
                  {a.accNo && <span className="ml-1.5 text-xs text-slate-400 font-mono">({a.accNo})</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold
                    ${ (a.type||'').toLowerCase()==='cash' ? 'bg-emerald-50 text-emerald-700' :
                       (a.type||'').toLowerCase()==='bank' ? 'bg-blue-50 text-blue-700' :
                       'bg-slate-100 text-slate-600' }`}>
                    {a.type}
                  </span>
                  {a.group && <span>· {a.group}</span>}
                </div>
              </div>
              <span className={`text-sm font-bold font-mono flex-shrink-0 ${a.balance<0?'text-red-500':'text-emerald-600'}`}>
                {fmt.format(a.balance)}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-slate-100">
        <button onClick={onClose} className="btn btn-secondary w-full btn-sm">Cancel</button>
      </div>
    </div>
  );
}

/* ── Main TransactionsPage ──────────────────────────────────────────────────── */
export default function TransactionsPage({ preSelectAccId }) {
  const [selAcc,      setSelAcc]      = useState(null);
  const [searchQ,     setSearchQ]     = useState('');
  const [results,     setResults]     = useState([]);
  const [showRes,     setShowRes]     = useState(false);
  const [cashAccs,    setCashAccs]    = useState([]);
  const [txTypes,     setTxTypes]     = useState([]);
  const [form,        setForm]        = useState({ type:'', date:dateNow(), secAccId:'', amt:'', desc:'' });
  const [history,     setHistory]     = useState([]);
  const [histLoad,    setHistLoad]    = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [editTrans,   setEditTrans]   = useState(null);
  const [showPayCust, setShowPayCust] = useState(false);
  const [showPayAll,  setShowPayAll]  = useState(false);
  const [payAcc,      setPayAcc]      = useState(null);
  const [cashLoaded,  setCashLoaded]  = useState(false);
  const [voucher,     setVoucher]     = useState(null);   // ← receipt modal data
  const [chargesTotal,   setChargesTotal]   = useState(0);   // ← sum of selected charges
  const [chargesSummary, setChargesSummary] = useState('');  // ← human-readable list for narration
  const [config,      setConfig]      = useState(null);   // company Configuration (default late fee, grace …)
  const [groupTypeMap,setGroupTypeMap]= useState({});     // group name -> Asset / Liability …
  const [fFrom,       setFFrom]       = useState('');
  const [fTo,         setFTo]         = useState('');
  const [fText,       setFText]       = useState('');
  const searchRef   = useRef(null);
  const cashAccsRef = useRef([]);

  const { isAdmin, user, isAgent, assignedAccounts } = useAuth();
  const toast = useToast();

  // ── Duplicate Print / SMS / WhatsApp for an EXISTING transaction ────────
  // Reopens the same VoucherModal used right after creating a transaction,
  // in duplicate mode, for any past row — available to admin AND agent.
  const [duplicateLoading, setDuplicateLoading] = useState(null); // holds the tx id currently loading
  const openDuplicateVoucher = async (t) => {
    setDuplicateLoading(t._id);
    try {
      const acc = t.accId;
      let bal = 0;
      if (acc?._id) {
        try { const r = await api.get(`/accounts/${acc._id}`); bal = r.data.balance ?? 0; } catch {}
      }
      setVoucher({
        voucherNo:    t._id ? String(t._id).slice(-12).toUpperCase() : String(Date.now()),
        date:         dateDisp(t.date),
        customerName: acc?.custId?.name || acc?.name || '—',
        accNo:        acc?.accNo || '—',
        type:         t.type,
        amt:          t.amt,
        availableBal: bal,
        desc:         t.desc || '',
        isDuplicate:  true,
      });
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setDuplicateLoading(null);
    }
  };


  const sortCashAccounts = (accounts, role) => {
    if (role !== 'agent') return accounts;
    return [...accounts].sort((a, b) => {
      const aIsCash = (a.type || '').toLowerCase() === 'cash' ? 0 : 1;
      const bIsCash = (b.type || '').toLowerCase() === 'cash' ? 0 : 1;
      return aIsCash - bIsCash;
    });
  };

  const resolveCashAccountId = (accounts, currentId, role) => {
    if (!accounts || accounts.length === 0) return '';
    if (currentId && accounts.some(a => a._id === currentId)) return currentId;
    if (role === 'agent') {
      const cashAcc = accounts.find(a => (a.type || '').toLowerCase() === 'cash');
      if (cashAcc) return cashAcc._id;
    }
    return accounts[0]._id;
  };

  /* load cash/bank accounts */
  useEffect(() => {
    const loadCashAccounts = async () => {
      try {
        const r = await api.get('/accounts?category=ledger&status=active');
        let liq = r.data.filter(
          a => ['cash', 'bank'].includes((a.type || '').toLowerCase())
        );
        liq = sortCashAccounts(liq, user?.role);
        setCashAccs(liq);
        cashAccsRef.current = liq;
        const defaultId  = resolveCashAccountId(liq, '', user?.role);
        const defaultAcc = liq.find(a => a._id === defaultId) || liq[0] || null;
        setPayAcc(defaultAcc);
        setForm(prev => ({
          ...prev,
          secAccId: defaultId || '__cash__',
        }));
      } catch (err) {
        console.error('Failed to load ledger accounts', err);
        setCashAccs([]);
        cashAccsRef.current = [];
        setForm(prev => ({ ...prev, secAccId: prev.secAccId || '__cash__' }));
      } finally {
        setCashLoaded(true);
      }
    };
    loadCashAccounts();
  }, [user]);

  useEffect(() => { cashAccsRef.current = cashAccs; }, [cashAccs]);

  /* company configuration + group types → used by the Loan / Deposit / Pigmy terms card */
  useEffect(() => {
    api.get('/config').then(r => setConfig(r.data)).catch(() => {});
    api.get('/groups').then(r => {
      const m = {}; r.data.forEach(g => { m[g.name] = g.type; }); setGroupTypeMap(m);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (cashAccs.length > 0) {
      setForm(prev => ({
        ...prev,
        secAccId: resolveCashAccountId(cashAccs, prev.secAccId, user?.role),
      }));
    }
  }, [cashAccs]);

  /* pre-select account from customer profile */
  useEffect(()=>{
    if (preSelectAccId) api.get(`/accounts/${preSelectAccId}`).then(r=>selectAccount(r.data)).catch(()=>{});
  },[preSelectAccId]);

  /* fetch history */
  const loadHistory = useCallback(async()=>{
    try {
      setHistLoad(true);
      const p = new URLSearchParams({ limit:'80' });
      if (fFrom) p.append('from',fFrom);
      if (fTo)   p.append('to',fTo);
      const r = await api.get(`/transactions?${p}`);
      setHistory(r.data);
    } catch(err){ toast.error(getErrorMsg(err)); }
    finally { setHistLoad(false); }
  },[fFrom,fTo]);

  useEffect(()=>{ loadHistory(); },[loadHistory]);

  /* account search */
  useEffect(()=>{
    if (searchQ.length<2){ setResults([]); setShowRes(false); return; }
    const t = setTimeout(async()=>{
      try {
        const r = await api.get('/accounts?status=active');
        const q = searchQ.toLowerCase();
        setResults(r.data.filter(a=>(a.accNo&&a.accNo.toLowerCase().includes(q))||a.name.toLowerCase().includes(q)||(a.custId?.name&&a.custId.name.toLowerCase().includes(q))).slice(0,8));
        setShowRes(true);
      } catch{}
    },300);
    return()=>clearTimeout(t);
  },[searchQ]);

  /* click outside */
  useEffect(()=>{
    const h=e=>{ if(searchRef.current&&!searchRef.current.contains(e.target)){ setShowRes(false); } };
    document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h);
  },[]);

  const selectAccount = acc => {
    setSelAcc(acc); setShowRes(false); setSearchQ('');
    // search results are light — fetch terms + loan history (disbursed / repaid) for the terms card
    api.get(`/accounts/${acc._id}`)
      .then(r => setSelAcc(cur => (cur && cur._id === acc._id ? { ...cur, ...r.data } : cur)))
      .catch(() => {});
    setChargesTotal(0);
    setChargesSummary('');
    const tLower = (acc.type||'').toLowerCase();
    let types = [];
    if (user?.role==='agent') {
      types = [{v:'deposit',l:'Collection'}];
      if (tLower.includes('loan')) types.push({v:'repay_princ',l:'Repayment'});
    } else {
      if (tLower.includes('loan')||(acc.group||'').toLowerCase().includes('loan')) {
        types = [{v:'disburse',l:'Disburse Loan'},{v:'repay_princ',l:'Repayment'}];
      } else {
        types = [{v:'deposit',l:'Deposit / Receipt'},{v:'withdraw',l:'Withdraw / Payment'}];
      }
    }
    setTxTypes(types);
    const latestCashAccs = cashAccsRef.current;
    setForm(f => ({
      ...f,
      type:     types[0]?.v || '',
      date:     dateNow(),
      secAccId: resolveCashAccountId(latestCashAccs, f.secAccId, user?.role) || f.secAccId || '__cash__',
    }));
  };

  /* ── handleSubmit: save transaction (incl. charges) then show voucher ─── */
  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      // Capture opening balance before the transaction
      const openingBal = selAcc.balance ?? 0;

      // Combine the principal amount with any selected charges (interest,
      // late fee, etc.) into the single amount posted — charges are
      // additive to the transaction value, never a separate ledger entry,
      // so no other balance logic anywhere else is touched.
      const principal   = parseFloat(form.amt) || 0;
      const totalAmt    = principal + (chargesTotal || 0);
      const combinedDesc = chargesSummary
        ? `${form.desc ? form.desc + ' | ' : ''}Charges: ${chargesSummary}`
        : form.desc;

      const res = await api.post('/transactions', {
        date:     form.date,
        accId:    selAcc._id,
        secAccId: form.secAccId,
        type:     form.type,
        amt:      totalAmt,
        desc:     combinedDesc,
      });
      const savedTx = res.data;

      // Refresh account to get new balance
      const accRes = await api.get(`/accounts/${selAcc._id}`);
      const updatedAcc = accRes.data;
      setSelAcc(updatedAcc);

      // Refresh payment account balance in state (Cash in Hand etc.)
      if (payAcc && payAcc._id && form.secAccId !== '__cash__') {
        try {
          const payRes = await api.get(`/accounts/${payAcc._id}`);
          setPayAcc(payRes.data);
        } catch {}
      }

      // Build voucher data for modal
      setVoucher({
        voucherNo:    savedTx._id
          ? String(savedTx._id).slice(-12).toUpperCase()
          : String(Date.now()),
        date:         dateDisp(form.date),
        customerName: updatedAcc.custId?.name || updatedAcc.name || '—',
        accNo:        updatedAcc.accNo || '—',
        type:         form.type,
        openingBal,
        amt:          totalAmt,
        availableBal: updatedAcc.balance ?? 0,
        desc:         combinedDesc || '',
      });

      setForm(f => ({ ...f, amt:'', desc:'' }));
      setChargesTotal(0);
      setChargesSummary('');
      loadHistory();
    } catch(err){ toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  };

  const cancel = () => {
    setSelAcc(null);
    setForm(f=>({...f,amt:'',desc:''}));
    setSearchQ('');
    setChargesTotal(0);
    setChargesSummary('');
  };
  const filt   = history.filter(t=>{
    if (!fText) return true;
    const q=fText.toLowerCase(), a=t.accId;
    return (a?.name||'').toLowerCase().includes(q)||(a?.accNo||'').toLowerCase().includes(q)||(a?.custId?.name||'').toLowerCase().includes(q)||(t.desc||'').toLowerCase().includes(q);
  });

  // ── terms of the selected account: interest / EMI / grace / late fee / accrued deposit interest ──
  const termCat    = selAcc ? accountCategory(selAcc, groupTypeMap) : 'other';
  const termVals   = selAcc && termCat !== 'other' ? termsFor(selAcc, config, termCat) : {};
  const arrearsNow = termCat === 'loan' ? loanArrears(selAcc, termVals, form.date) : null;
  const suggested  = { late_fee: arrearsNow ? lateFeeAmount(termVals, arrearsNow) : 0 };

  const setPayment = (acc) => {
    setPayAcc(acc);
    setForm(f => ({ ...f, secAccId: acc._id }));
  };

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Record deposits, withdrawals, disbursals and repayments"/>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Entry form */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-title">New Transaction</div>

            {!selAcc ? (
              <div className="relative" ref={searchRef}>
                <label className="label">Search Account / Customer</label>
                <div className="relative">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"/>
                  <input className="input pl-8" placeholder="Type account no, name…" value={searchQ} onChange={e=>setSearchQ(e.target.value)} onFocus={()=>results.length&&setShowRes(true)}/>
                </div>
                {showRes&&results.length>0&&(
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 mt-1 overflow-hidden max-h-64 overflow-y-auto">
                    {results.map(acc=>(
                      <button key={acc._id} onClick={()=>selectAccount(acc)} className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800 text-sm">{acc.custId?.name||acc.name}</span>
                            {acc.accNo&&<span className="ml-2 text-xs text-slate-400 font-mono">{acc.accNo}</span>}
                          </div>
                          <span className={`text-sm font-bold font-mono flex-shrink-0 ml-3 ${acc.balance<0?'text-red-500':'text-emerald-600'}`}>{fmt.format(acc.balance)}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{acc.type} &nbsp;·&nbsp; {dateDisp(acc.opDate)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Account info */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-blue-900">{selAcc.custId?.name||selAcc.name}</div>
                      <div className="text-xs text-blue-600 mt-0.5 font-mono">{selAcc.accNo} &nbsp;·&nbsp; Opened {dateDisp(selAcc.opDate)}</div>
                    </div>
                    <button onClick={cancel} className="text-blue-400 hover:text-blue-600 text-xs flex items-center gap-1 transition-colors">
                      <i className="fas fa-times"/> Cancel
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between">
                    <span className="text-xs text-blue-600 font-medium">Current Balance</span>
                    <span className={`font-bold font-mono ${selAcc.balance<0?'text-red-600':'text-emerald-700'}`}>{fmt.format(selAcc.balance)}</span>
                  </div>
                </div>

                {/* Interest / late fee / grace / due day — loans, deposits and pigmy */}
                <AccountTermsCard
                  account={selAcc} config={config} groupTypeMap={groupTypeMap}
                  txDate={form.date} txType={form.type} amount={form.amt}
                />

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Type</label>
                      <select className="select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} required>
                        {txTypes.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                      </select></div>
                    <div><label className="label">Date</label>
                      <input type="date" className="input" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required/></div>
                  </div>

                  {/* ── Payment Mode ──────────────────────────────────── */}
                  <div className="col-span-2">
                    <label className="label" style={{fontSize:'10px',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'#64748b'}}>
                      Payment Mode
                    </label>

                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          (payAcc?.type||'').toLowerCase()==='cash' ? 'bg-emerald-400' :
                          (payAcc?.type||'').toLowerCase()==='bank' ? 'bg-blue-400' : 'bg-slate-400'
                        }`}/>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {!cashLoaded ? 'Loading…' : payAcc ? payAcc.name : 'Cash in Hand'}
                          </div>
                          {payAcc && user?.role !== 'agent' && (
                            <div className="text-xs text-slate-400 font-mono">
                              Bal: {fmt.format(payAcc.balance)}
                            </div>
                          )}
                        </div>
                      </div>

                      {user?.role !== 'agent' && (
                        <>
                          <button
                            type="button"
                            title="Customer's accounts (cash → bank → others)"
                            onClick={()=>setShowPayCust(true)}
                            className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 flex items-center justify-center transition-all shadow-sm"
                          >
                            <i className="fas fa-search text-slate-500 text-xs"/>
                          </button>
                          <button
                            type="button"
                            title="All available accounts"
                            onClick={()=>setShowPayAll(true)}
                            className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-300 bg-white hover:bg-indigo-50 hover:border-indigo-400 flex items-center justify-center transition-all shadow-sm font-bold text-slate-600 text-sm"
                          >
                            T
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div><label className="label">Amount (₹) *</label>
                    <input type="number" step="0.01" min="0.01" className="input" value={form.amt} onChange={e=>setForm(f=>({...f,amt:e.target.value}))} placeholder="0.00" required/></div>

                  {/* ── Charges (⋯) — interest, late fee, etc. ──────────── */}
                  <ChargesPanel
                    account={selAcc}
                    txDate={form.date}
                    suggested={suggested}
                    onTotalChange={(total, summary) => { setChargesTotal(total); setChargesSummary(summary); }}
                  />

                  {chargesTotal > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 rounded-lg">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Total Payable</span>
                      <span className="text-sm font-bold font-mono text-emerald-700">
                        {fmt.format((parseFloat(form.amt)||0) + chargesTotal)}
                      </span>
                    </div>
                  )}

                  <div><label className="label">Narration</label>
                    <input className="input" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="Optional description"/></div>

                  <button type="submit" disabled={saving || !cashLoaded} className="btn btn-primary w-full">
                    {saving
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                      : <i className="fas fa-check"/>}
                    Save Transaction
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-3">
          <div className="card">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="font-bold text-slate-800">Transaction History</div>
              <div className="flex flex-wrap gap-2">
                <input type="date" className="input text-xs py-1.5 w-32" value={fFrom} onChange={e=>setFFrom(e.target.value)} title="From date"/>
                <input type="date" className="input text-xs py-1.5 w-32" value={fTo}   onChange={e=>setFTo(e.target.value)}   title="To date"/>
                <SearchInput value={fText} onChange={setFText} placeholder="Filter…" className="w-36"/>
                {(fFrom||fTo||fText)&&<button onClick={()=>{setFFrom('');setFTo('');setFText('');}} className="btn btn-secondary btn-sm"><i className="fas fa-times"/></button>}
              </div>
            </div>

            {histLoad
              ? <PageLoader/>
              : filt.length===0
                ? <EmptyState icon="fa-receipt" title="No transactions" message="Transactions will appear here"/>
                : <div className="space-y-0.5">
                    {filt.map(t=>{
                      const acc  = t.accId;
                      const name = acc?.custId?.name||acc?.name||'—';
                      const accNo= acc?.accNo||'';
                      const inc  = isIncoming(t.type);
                      return (
                        <div key={t._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${inc?'bg-emerald-50':'bg-red-50'}`}>
                            <i className={`fas ${inc?'fa-arrow-down':'fa-arrow-up'} text-xs ${inc?'text-emerald-500':'text-red-400'}`}/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-700 truncate">
                              {name}{accNo&&<span className="ml-1 text-xs text-slate-400 font-mono font-normal">({accNo})</span>}
                            </div>
                            <div className="text-xs text-slate-400">{dateDisp(t.date)}{t.desc&&` · ${t.desc}`}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`badge ${TYPE_COLORS[t.type]||'badge-slate'} hidden sm:inline-flex`}>{TYPE_LABELS[t.type]||t.type}</span>
                            <span className={`text-sm font-bold font-mono ${inc?'text-emerald-600':'text-red-500'}`}>{fmt.format(t.amt)}</span>
                            <button
                              onClick={()=>openDuplicateVoucher(t)}
                              disabled={duplicateLoading===t._id}
                              title="Duplicate Print / SMS / WhatsApp"
                              className="btn btn-secondary btn-sm"
                            >
                              {duplicateLoading===t._id
                                ? <span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin inline-block"/>
                                : <i className="fas fa-receipt"/>}
                            </button>
                            {isAdmin&&(
                              <button onClick={()=>setEditTrans(t)} className="btn btn-warning btn-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <i className="fas fa-edit"/>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
            }
          </div>
        </div>
      </div>

      {/* ── Voucher / Receipt Modal ─────────────────────────────────────── */}
      {voucher && (
        <Modal isOpen={!!voucher} onClose={()=>setVoucher(null)} title="Receipt Preview">
          <VoucherModal voucher={voucher} onClose={()=>setVoucher(null)}/>
        </Modal>
      )}

      {/* ── Pay Mode: Customer accounts ─────────────────────────────────── */}
      {showPayCust && selAcc && (
        <Modal isOpen={showPayCust} onClose={()=>setShowPayCust(false)} title="Select Payment Account">
          <PayAccountPicker
            mode="customer"
            customerId={selAcc.custId?._id || selAcc.custId || selAcc._id}
            excludeIds={[form.secAccId, selAcc._id].filter(Boolean)}
            onSelect={acc=>{ setPayment(acc); setShowPayCust(false); }}
            onClose={()=>setShowPayCust(false)}
          />
        </Modal>
      )}

      {/* ── Pay Mode: All accounts ──────────────────────────────────────── */}
      {showPayAll && (
        <Modal isOpen={showPayAll} onClose={()=>setShowPayAll(false)} title="Select Payment Account — All">
          <PayAccountPicker
            mode="all"
            excludeIds={[form.secAccId, selAcc?._id].filter(Boolean)}
            onSelect={acc=>{ setPayment(acc); setShowPayAll(false); }}
            onClose={()=>setShowPayAll(false)}
          />
        </Modal>
      )}

      {editTrans&&(
        <Modal isOpen={!!editTrans} onClose={()=>setEditTrans(null)} title="Edit Transaction">
          <EditTransModal trans={editTrans} onSave={()=>{setEditTrans(null);loadHistory();}} onDelete={()=>{setEditTrans(null);loadHistory();}} onClose={()=>setEditTrans(null)}/>
        </Modal>
      )}
    </div>
  );
}
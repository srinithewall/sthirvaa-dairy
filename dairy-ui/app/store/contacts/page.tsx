'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import StoreTabs from '@/components/store/StoreTabs';
import Portal from '@/components/store/Portal';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import {
  StoreFarmer, FarmerAccount, StorePaymentMode, STORE_NAME, rupees, apiError, daysAgo, paymentLabel,
  canManageStore, currentRole, DEFAULT_VILLAGE, phoneError, rewardsHowTo,
} from '@/lib/store';
import { ChevronDown, ChevronUp, Pencil, Plus, Search, Send, Wallet, X } from 'lucide-react';

interface Summary { farmer: StoreFarmer; balance: number; lastVisit?: string; rewardCoins?: number; }

const reminderUrl = (s: Summary) => {
  const text = `Namaskara ${s.farmer.name}, your balance at ${STORE_NAME} is ${rupees(s.balance)}. `
    + 'Kindly clear it on your next visit. Thank you! / ಧನ್ಯವಾದಗಳು';
  return s.farmer.phone ? `https://wa.me/91${s.farmer.phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
};

export default function ContactsPage() {
  const { showToast } = useNotification();
  const [rows, setRows] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [owingOnly, setOwingOnly] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const [editing, setEditing] = useState<Partial<StoreFarmer> | null>(null);
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null); // shown after a save with a short number
  const [nameMissing, setNameMissing] = useState(false); // highlights the name after a save without one
  const [paying, setPaying] = useState<{ id: number; amount: number | ''; mode: StorePaymentMode } | null>(null);
  const [statement, setStatement] = useState<FarmerAccount | null>(null);

  const load = () =>
    api.get('/store/farmers/accounts')
      .then((r) => setRows(r.data))
      .catch((err) => showToast(apiError(err, 'Failed to load contacts'), 'error'))
      .finally(() => setLoading(false));

  useEffect(() => { setIsOwner(canManageStore(currentRole())); load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!owingOnly || r.balance > 0)
      && (!q || r.farmer.name.toLowerCase().includes(q) || (r.farmer.phone || '').includes(q) || (r.farmer.village || '').toLowerCase().includes(q)));
  }, [rows, query, owingOnly]);
  const totalOwed = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const owingCount = rows.filter((r) => r.balance > 0).length;

  const toggleStatement = async (id: number) => {
    if (statement?.farmer.id === id) { setStatement(null); return; }
    try { setStatement((await api.get(`/store/farmers/${id}/account`)).data); }
    catch (err) { showToast(apiError(err, 'Could not load statement'), 'error'); }
  };

  const receive = async () => {
    if (!paying || !paying.amount) return;
    try {
      const r = await api.post(`/store/farmers/${paying.id}/payments`, { amount: paying.amount, paymentMode: paying.mode });
      showToast(`Payment of ${rupees(Number(paying.amount))} saved`, 'success');
      if (statement?.farmer.id === paying.id) setStatement(r.data);
      setPaying(null);
      load();
    } catch (err) {
      showToast(apiError(err, 'Could not record payment'), 'error');
    }
  };

  const saveFarmer = async () => {
    if (!editing) return;
    const noName = !(editing.name ?? '').trim();
    setNameMissing(noName);
    if (noName) { showToast('Please enter the contact name', 'error'); return; }
    const bad = phoneError(editing.phone);
    setPhoneMsg(bad);
    if (bad) { showToast(bad, 'error'); return; }
    try {
      if (editing.id) await api.put(`/store/farmers/${editing.id}`, editing);
      else await api.post('/store/farmers', editing);
      showToast('Contact saved', 'success');
      setEditing(null);
      load();
    } catch (err) {
      showToast(apiError(err, 'Could not save contact'), 'error');
    }
  };

  const input = 'w-full px-3 py-2 border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand';
  const label = 'block text-xs font-bold text-text2 uppercase tracking-wide mb-1';

  return (
    <AppLayout>
      <StoreTabs action={
        <button onClick={() => setEditing({ active: true, village: DEFAULT_VILLAGE })} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap">
          <Plus size={16} /> Add<span className="hidden sm:inline"> contact</span>
        </button>
      } />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white rounded-xl border border-border-custom p-3 shadow-sm">
          <p className="text-[11px] font-bold text-text3 uppercase tracking-wide">Total to collect</p>
          <p className="text-xl font-bold text-danger">{rupees(totalOwed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-border-custom p-3 shadow-sm">
          <p className="text-[11px] font-bold text-text3 uppercase tracking-wide">Contacts with dues</p>
          <p className="text-xl font-bold text-text">{owingCount} <span className="text-sm font-normal text-text3">of {rows.length}</span></p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone or village"
            className="w-full pl-9 pr-3 py-2 bg-white border border-border-custom rounded-lg text-sm focus:outline-none focus:border-brand" />
        </div>
        <div className="inline-flex rounded-lg border border-border-custom bg-white p-0.5 text-sm font-semibold">
          {[{ v: true, l: 'With dues' }, { v: false, l: 'All contacts' }].map((o) => (
            <button key={o.l} onClick={() => setOwingOnly(o.v)}
              className={`px-3 py-1.5 rounded-md ${owingOnly === o.v ? 'bg-brand text-white' : 'text-text2'}`}>{o.l}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border-custom overflow-hidden shadow-sm">
        <ul className="divide-y divide-border-custom">
          {visible.map((r) => {
            const f = r.farmer;
            const overLimit = f.creditLimit && f.creditLimit > 0 && r.balance > f.creditLimit;
            return (
              <li key={f.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button onClick={() => toggleStatement(f.id)} className="text-left min-w-0">
                    <p className="font-bold text-text flex items-center gap-1">
                      {f.name}{statement?.farmer.id === f.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </p>
                    <p className="text-[12px] text-text3">
                      {[f.phone || 'No phone', f.village].filter(Boolean).join(' · ')} · {r.lastVisit ? `last visit ${daysAgo(r.lastVisit)}` : 'no bills yet'}
                      {!!r.rewardCoins && <span className="text-[#1E4E8C] font-bold" title={rewardsHowTo()}> · 💎 {r.rewardCoins}</span>}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="text-right">
                      <p className={`font-bold ${r.balance > 0 ? 'text-danger' : 'text-brand'}`}>{r.balance > 0 ? rupees(r.balance) : 'No dues'}</p>
                      <p className={`text-[11px] ${overLimit ? 'text-danger font-bold' : 'text-text3'}`}>
                        {f.creditLimit && f.creditLimit > 0 ? `limit ${rupees(f.creditLimit)}${overLimit ? ' · over' : ''}` : 'no limit set'}
                      </p>
                    </div>
                    {r.balance > 0 && (
                      <>
                        <button onClick={() => setPaying({ id: f.id, amount: '', mode: 'CASH' })} title="Receive payment"
                          className="p-2 rounded-lg border border-border-custom text-brand hover:border-brand"><Wallet size={16} /></button>
                        <a href={reminderUrl(r)} target="_blank" rel="noreferrer" title="WhatsApp reminder"
                          className="p-2 rounded-lg border border-border-custom text-[#25D366] hover:border-[#25D366]"><Send size={16} /></a>
                      </>
                    )}
                    <button onClick={() => setEditing({ ...f })} title="Edit contact" className="p-2 text-text3 hover:text-brand"><Pencil size={16} /></button>
                  </div>
                </div>

                {paying?.id === f.id && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 bg-surface2 rounded-lg p-2">
                    <span className="text-[12px] text-text2">Received ₹</span>
                    <input type="number" inputMode="decimal" autoFocus placeholder={`Max ${Math.round(r.balance)}`} value={paying.amount}
                      onChange={(e) => setPaying({ ...paying, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-28 h-8 px-2 border border-border-custom rounded-md text-sm text-right bg-white" />
                    {(['CASH', 'UPI'] as StorePaymentMode[]).map((m) => (
                      <button key={m} onClick={() => setPaying({ ...paying, mode: m })}
                        className={`h-8 px-3 rounded-md border text-[12px] font-bold ${paying.mode === m ? 'bg-brand text-white border-brand' : 'border-border-custom text-text2 bg-white'}`}>
                        {paymentLabel(m)}
                      </button>
                    ))}
                    <button onClick={receive} disabled={!paying.amount} className="h-8 px-3 rounded-md bg-brand text-white text-[12px] font-bold disabled:opacity-50">Save</button>
                    <button onClick={() => setPaying(null)} className="text-text3"><X size={14} /></button>
                  </div>
                )}

                {statement?.farmer.id === f.id && (
                  <div className="mt-2 border border-border-custom rounded-lg overflow-hidden">
                    <p className="px-3 py-1.5 text-[11px] font-bold text-text3 uppercase tracking-wide bg-surface2">Statement (last 50)</p>
                    {statement.entries.length === 0 ? (
                      <p className="px-3 py-2 text-[12px] text-text3">No credit or payments yet.</p>
                    ) : (
                      <ul className="divide-y divide-border-custom text-[12px]">
                        {statement.entries.map((e) => (
                          <li key={e.id} className="px-3 py-1.5 flex justify-between gap-2">
                            <span>{e.entryDate} · {e.type === 'PAYMENT' ? `Payment (${paymentLabel(e.paymentMode ?? 'CASH')})` : e.type === 'SALE_CREDIT' ? 'Credit' : 'Adjustment'}
                              {e.notes && <span className="text-text3"> · {e.notes}</span>}</span>
                            <b className={e.amount > 0 ? 'text-danger' : 'text-brand'}>{e.amount > 0 ? '+' : '−'}{rupees(Math.abs(e.amount))}</b>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!loading && visible.length === 0 && (
            <li className="p-6 text-center text-sm text-text3">{owingOnly ? 'No one owes anything. 🎉' : 'No contacts yet.'}</li>
          )}
          {loading && <li className="p-6 text-center text-sm text-text3">Loading…</li>}
        </ul>
      </div>

      {editing && (
        <Portal>
          <div className="fixed inset-0 bg-black/40 z-[2000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">{editing.id ? 'Edit contact' : 'New contact'}</h2>
                <button onClick={() => { setEditing(null); setPhoneMsg(null); setNameMissing(false); }}><X size={20} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block"><span className={label}>Name</span>
                  <input value={editing.name ?? ''} placeholder="Required" onChange={(e) => { setEditing({ ...editing, name: e.target.value }); setNameMissing(false); }}
                    className={`${input} font-bold placeholder:font-normal ${nameMissing ? '!border-danger bg-red-50' : ''}`} /></label>
                {nameMissing && <p className="col-span-2 text-[12px] text-danger font-semibold -mt-2">Please enter the contact name</p>}
                <label className="block"><span className={label}>Phone (optional)</span>
                  <input inputMode="tel" value={editing.phone ?? ''} placeholder="10 digits" onChange={(e) => { setEditing({ ...editing, phone: e.target.value }); setPhoneMsg(null); }}
                    className={`${input} ${phoneMsg ? '!border-danger' : ''}`} /></label>
                <label className="block"><span className={label}>Village</span>
                  <span className="relative block">
                    <input value={editing.village ?? ''} onChange={(e) => setEditing({ ...editing, village: e.target.value })} className={`${input} pr-9`} />
                    {editing.village && (
                      <button type="button" onClick={() => setEditing({ ...editing, village: '' })} aria-label="Clear village"
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-text3 hover:text-danger"><X size={16} /></button>
                    )}
                  </span></label>
                {phoneMsg && <p className="col-span-2 text-[12px] text-danger font-semibold -mt-1">{phoneMsg}</p>}
                <label className="block"><span className={label}>Cows</span>
                  <input type="number" inputMode="numeric" value={editing.cowsCount ?? ''}
                    onChange={(e) => setEditing({ ...editing, cowsCount: e.target.value === '' ? undefined : Number(e.target.value) })} className={input} /></label>
                <label className="block"><span className={label}>Credit limit ₹</span>
                  <input type="number" inputMode="numeric" disabled={!isOwner} value={editing.creditLimit ?? ''} placeholder="0 = no limit"
                    onChange={(e) => setEditing({ ...editing, creditLimit: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className={`${input} disabled:bg-surface2 disabled:text-text3`} /></label>
                <p className="col-span-2 text-[11px] text-text3 -mt-1">
                  {isOwner ? 'Most this contact can owe. Staff can’t bill on credit beyond it; 0 means no limit.' : 'Only the owner can change the credit limit.'}
                </p>
                {editing.id && (
                  <label className="col-span-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} />
                    Active
                  </label>
                )}
              </div>
              <button onClick={saveFarmer} className="w-full mt-5 bg-brand text-white py-3 rounded-lg font-bold">Save</button>
            </div>
          </div>
        </Portal>
      )}
    </AppLayout>
  );
}

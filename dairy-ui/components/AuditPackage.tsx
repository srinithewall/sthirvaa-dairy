'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { rupees, categoryLabel } from '@/lib/bank';
import PdfViewer from '@/components/PdfViewer';
import { AuditPackageView, CashExpense, LedgerExpense, buildPackageCsv, buildPackagePdf, figures } from '@/lib/auditPackage';
import { AlertTriangle, Check, ChevronDown, Eye, FileDown, FileSpreadsheet, Paperclip, Pencil, Plus, RefreshCw, RotateCcw, Save, Trash2, X } from 'lucide-react';

const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const shortDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
const stamp = (s?: string | null) => s
  ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

/**
 * A month's auditor package: cash expenses come in from the Digital Ledger by themselves and can be
 * removed or added; the rest is worked out from the books. Download builds the merged PDF in the
 * agreed order and keeps a copy with the package.
 */
/** month: YYYY-MM, taken from the Bank page's period (its From date), so there is one date control. */
export default function AuditPackage({ month }: { month: string }) {
  const { showToast } = useNotification();
  const [view, setView] = useState<AuditPackageView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'' | 'save' | 'refresh' | 'pdf' | 'view' | 'upload'>('');
  /** The PDF shown in the viewer: a preview, or the saved copy. */
  const [viewer, setViewer] = useState<{ url: string; blob: Blob; label: string } | null>(null);
  // The preview pops up over the page: Escape closes it, and the page behind does not scroll.
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewer(null); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [viewer]);
  useEffect(() => () => { if (viewer) URL.revokeObjectURL(viewer.url); }, [viewer]);
  const [includeGst, setIncludeGst] = useState(false);
  const [gstNote, setGstNote] = useState('');
  const [notes, setNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  /** The purchase list starts folded; its header carries the totals. */
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (v: AuditPackageView) => {
    setView(v);
    setIncludeGst(v.package.includeGst);
    setGstNote(v.package.gstNote || '');
    setNotes(v.package.notes || '');
  };

  const open = async (m = month) => {
    setLoading(true);
    setViewer(null);
    try {
      apply((await api.post('/audit-packages', null, { params: { month: m } })).data);
    } catch (err: any) {
      setView(null);
      showToast(err.response?.data?.message || 'Could not open the package.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { open(month); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const id = view?.package.id;
  const call = async (what: () => Promise<any>, ok?: string) => {
    try {
      const res = await what();
      if (res?.data?.package) {
        apply(res.data);
        setViewer(null); // the package changed, so an open preview is out of date
      }
      if (ok) showToast(ok);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Something went wrong.', 'error');
    }
  };

  const dirty = !!view && (includeGst !== view.package.includeGst || gstNote !== (view.package.gstNote || '')
    || notes !== (view.package.notes || ''));

  const save = async () => {
    setBusy('save');
    await call(() => api.put(`/audit-packages/${id}`, { includeGst, gstNote, notes }), 'Package saved.');
    setBusy('');
  };

  const refresh = async () => {
    setBusy('refresh');
    await call(() => api.post(`/audit-packages/${id}/refresh`), 'Checked the ledger for new cash expenses.');
    setBusy('');
  };

  const remove = (line: CashExpense) =>
    call(() => api.patch(`/audit-packages/${id}/expenses/${line.id}`, { excluded: true }), 'Deleted from the package.');
  const restore = (line: CashExpense) =>
    call(() => api.patch(`/audit-packages/${id}/expenses/${line.id}`, { excluded: false }), 'Put back.');

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy('upload');
    for (const file of files) {
      const fd = new FormData();
      fd.append('file', file);
      await call(() => api.post(`/audit-packages/${id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
        `${file.name} attached.`);
    }
    setBusy('');
  };

  /** Saves any unsaved notes first, builds the PDF, keeps a copy with the package, then downloads it. */
  /** Saves any unsaved notes first, then builds the package PDF from the books as they stand now. */
  const buildPdf = async (): Promise<Blob> => {
    let v = view!;
    if (dirty) {
      v = (await api.put(`/audit-packages/${id}`, { includeGst, gstNote, notes })).data;
      apply(v);
    }
    const who = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').username || 'admin'; } catch { return 'admin'; } })();
    const bytes = await buildPackagePdf(v,
      async sid => (await api.get(`/audit-packages/${id}/statements/${sid}/file`, { responseType: 'arraybuffer' })).data,
      async aid => (await api.get(`/audit-packages/${id}/attachments/${aid}/file`, { responseType: 'arraybuffer' })).data,
      who);
    return new Blob([bytes as BlobPart], { type: 'application/pdf' });
  };

  const showInViewer = (blob: Blob, label: string) => {
    setViewer(prev => { if (prev) URL.revokeObjectURL(prev.url); return { url: URL.createObjectURL(blob), blob, label }; });
  };

  /** Builds the PDF and shows it here, without saving or downloading anything. */
  const preview = async () => {
    if (!view) return;
    setBusy('view');
    try {
      showInViewer(await buildPdf(), 'Preview, not saved');
    } catch (err: any) {
      console.error('Package preview failed:', err);
      showToast(err.response?.data?.message || 'Could not build the package PDF.', 'error');
    } finally {
      setBusy('');
    }
  };

  /** Builds the PDF, keeps a copy with the package, shows it in the viewer and downloads it. */
  const downloadPdf = async () => {
    if (!view) return;
    setBusy('pdf');
    try {
      const blob = await buildPdf();
      const fd = new FormData();
      fd.append('file', blob, `audit-${month}.pdf`);
      await api.post(`/audit-packages/${id}/document`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showInViewer(blob, 'Saved copy');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      apply((await api.get(`/audit-packages/${id}`)).data);
      showToast('Package PDF saved and downloaded.');
    } catch (err: any) {
      console.error('Package PDF failed:', err);
      showToast(err.response?.data?.message || 'Could not build the package PDF.', 'error');
    } finally {
      setBusy('');
    }
  };

  /** The package as a CSV for Excel, from the books as they stand now (unsaved notes are saved first). */
  const downloadCsv = async () => {
    if (!view) return;
    try {
      let v = view;
      if (dirty) {
        v = (await api.put(`/audit-packages/${id}`, { includeGst, gstNote, notes })).data;
        apply(v);
      }
      const who = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').username || 'admin'; } catch { return 'admin'; } })();
      const url = URL.createObjectURL(new Blob([buildPackageCsv(v, who)], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not build the CSV.', 'error');
    }
  };

  /** Shows the copy kept with the package (what was last downloaded). */
  const viewSaved = async () => {
    try {
      const res = await api.get(`/audit-packages/${id}/document`, { responseType: 'blob' });
      showInViewer(new Blob([res.data], { type: 'application/pdf' }), `Saved copy, ${stamp(view?.package.documentSavedAt)}`);
    } catch {
      showToast('No saved copy yet.', 'error');
    }
  };

  const downloadSaved = async () => {
    try {
      const res = await api.get(`/audit-packages/${id}/document`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${month}-saved.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast('No saved copy yet.', 'error');
    }
  };

  const f = useMemo(() => (view ? figures(view) : null), [view]);
  const kept = view?.cashExpenses.filter(c => !c.excluded) || [];
  const removed = view?.cashExpenses.filter(c => c.excluded) || [];
  /** Bank expenses and manual ones in one date order, so the two can be told apart by colour. */
  const purchaseRows = useMemo(() => {
    const bank = (view?.bank.lines || []).filter(l => l.status === 'MAPPED' && l.direction === 'DEBIT' && l.kind === 'EXPENSE' && !l.salaryOf)
      .map(line => ({ kind: 'BANK' as const, date: line.date, line }));
    const manual = kept.map(line => ({ kind: 'MANUAL' as const, date: line.date, line }));
    const salary = (view?.salaries || []).map(line => ({ kind: 'SALARY' as const, date: view!.package.periodTo, line }));
    return [...bank, ...manual, ...salary].sort((a, b) => a.date.localeCompare(b.date));
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Month and actions */}
      <div className="bg-white p-3 sm:p-4 rounded-radius-custom-lg border border-border-custom shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="min-w-0">
            <div className="text-[14px] font-black text-text">{monthName(month)}</div>
            {view?.package.documentSavedAt && (
              <div className="text-[11px] text-text3">
                Saved {stamp(view.package.documentSavedAt)} · <button onClick={viewSaved} className="underline text-brand">view</button> · <button onClick={downloadSaved} className="underline text-brand">download</button>
              </div>
            )}
          </div>
          <div className="flex gap-1.5 sm:gap-2 sm:ml-auto">
            <button onClick={preview} disabled={!view || !!busy} title="Show the PDF below without saving"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg border border-border-custom bg-white text-text2 text-[12px] font-black disabled:opacity-40">
              <Eye size={15} /> {busy === 'view' ? '…' : 'VIEW'}
            </button>
            {dirty && (
              <button onClick={save} disabled={!view || !!busy}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg border border-amber-400 bg-amber-50 text-amber-800 text-[12px] font-black disabled:opacity-40">
                <Save size={15} /> {busy === 'save' ? '…' : 'SAVE'}
              </button>
            )}
            <button onClick={downloadCsv} disabled={!view || !!busy} title="Download as CSV"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg border border-border-custom bg-white text-text2 text-[12px] font-black disabled:opacity-40">
              <FileSpreadsheet size={15} className="text-brand" /> CSV
            </button>
            <button onClick={downloadPdf} disabled={!view || !!busy} title="Download as PDF (a copy is kept with the package)"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg bg-brand text-white text-[12px] font-black shadow disabled:opacity-40">
              <FileDown size={15} /> {busy === 'pdf' ? '…' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {loading || !view || !f ? (
        <div className="p-16 text-center"><div className="inline-block w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Executive summary figures */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <Tile label="Sales" value={rupees(f.totalSales)} tone="brand"
              sub={view.sales.unreviewedCount ? `${view.sales.unreviewedCount} not reviewed` : undefined} />
            <Tile label="Purchases" value={rupees(f.totalPurchases)} tone="danger" />
            <Tile label="Net result" value={`${f.totalSales - f.totalPurchases < 0 ? '−' : ''}${rupees(Math.abs(f.totalSales - f.totalPurchases))}`} tone={f.totalSales >= f.totalPurchases ? 'brand' : 'danger'} />
            <Tile label="Bank closing" value={view.bank.closingBalance == null ? '—' : rupees(view.bank.closingBalance)} />
          </div>

          {/* Purchases: bank lines (blue) and manual entries from the app (amber) */}
          <div className="bg-white rounded-radius-custom-lg border border-border-custom card-shadow overflow-hidden">
            <button onClick={() => setPurchasesOpen(v => !v)} aria-expanded={purchasesOpen}
              className="w-full px-3 sm:px-4 py-3 flex items-center gap-2 text-left">
              <ChevronDown size={16} className={`text-text3 flex-shrink-0 transition-transform ${purchasesOpen ? '' : '-rotate-90'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-black uppercase tracking-widest text-text2">Purchases · {rupees(f.totalPurchases)}</div>
                <div className="text-[11px] text-text3 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-200" /> Bank {rupees(f.bankPurchases)}</span>
                  {f.salaryPurchases > 0 && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-violet-200" /> Salary {rupees(f.salaryPurchases)}</span>}
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-200" /> Manual {rupees(f.cashPurchases)}</span>
                </div>
              </div>
              {f.manualToReview > 0 && (
                <span className="text-[10px] font-black text-amber-800 bg-amber-100 rounded px-1.5 py-1 flex-shrink-0">{f.manualToReview} TO REVIEW</span>
              )}
            </button>
            {purchasesOpen && <>
            <div className="px-3 sm:px-4 pb-3 flex gap-2 border-b border-border-custom">
              <button onClick={refresh} disabled={!!busy} title="Add new manual expenses from the Digital Ledger"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border-custom text-text2 text-[12px] font-black disabled:opacity-40">
                <RefreshCw size={14} className={busy === 'refresh' ? 'animate-spin' : ''} /> CHECK LEDGER
              </button>
              <button onClick={() => setAdding(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1b4332] text-white text-[12px] font-black">
                <Plus size={14} /> ADD
              </button>
            </div>
            {purchaseRows.length === 0 ? (
              <div className="p-8 text-center text-text3 text-[13px]">No purchases this month.</div>
            ) : (
              <div className="divide-y divide-border-custom">
                {purchaseRows.map(r => r.kind === 'SALARY' ? (
                  <div key={`s${r.line.staffId}`} className="px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 bg-violet-50/70 border-l-4 border-violet-300">
                    <div className="w-14 text-[11px] font-black text-text2">{shortDate(r.date)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-text text-[13px] truncate">
                        Salary · {r.line.name}
                        <span className="ml-2 align-middle text-[10px] font-black px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">SALARY</span>
                      </div>
                      <div className="text-[11px] text-text3 truncate">Fixed monthly salary</div>
                    </div>
                    <div className="font-black text-danger whitespace-nowrap">{rupees(r.line.amount)}</div>
                    <div className="w-[68px]" />
                  </div>
                ) : r.kind === 'BANK' ? (
                  <div key={`b${r.line.id}`} className="px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 bg-sky-50/70 border-l-4 border-sky-300">
                    <div className="w-14 text-[11px] font-black text-text2">{shortDate(r.line.date)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-text text-[13px] truncate">
                        {categoryLabel(r.line.category)}
                        <span className="ml-2 align-middle text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">BANK</span>
                      </div>
                      <div className="text-[11px] text-text3 truncate">{[r.line.counterparty, r.line.narration].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="font-black text-danger whitespace-nowrap">{rupees(r.line.amount)}</div>
                    <div className="w-[68px]" />
                  </div>
                ) : editingLine === r.line.id ? (
                  <EditManualRow key={`m${r.line.id}`} line={r.line} period={view.package}
                    onCancel={() => setEditingLine(null)}
                    onSave={async body => { await call(() => api.patch(`/audit-packages/${id}/expenses/${r.line.id}`, body), 'Saved in the package.'); setEditingLine(null); }} />
                ) : (
                  <div key={`m${r.line.id}`} className="px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 bg-amber-50/70 border-l-4 border-amber-300">
                    <div className="w-14 text-[11px] font-black text-text2">{shortDate(r.line.date)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-text text-[13px] truncate">
                        {categoryLabel(r.line.category)}
                        <span className="ml-2 align-middle text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">MANUAL</span>
                        {r.line.reviewed
                          ? <span className="ml-1 align-middle text-[10px] font-bold text-brand" title={r.line.reviewedBy ? `Checked by ${r.line.reviewedBy}` : 'Checked'}>✓ checked{r.line.edited ? ', edited' : ''}</span>
                          : <span className="ml-1 align-middle text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-400 text-amber-800">REVIEW</span>}
                      </div>
                      <div className="text-[11px] text-text3 truncate">
                        {[r.line.description, r.line.paidBy && `paid by ${r.line.paidBy}`, !r.line.ledgerExpenseId && 'added in this package only'].filter(Boolean).join(' · ')}
                      </div>
                      {r.line.paidThroughBank && (
                        <div className="text-[11px] text-amber-700 font-bold"><AlertTriangle size={11} className="inline -mt-0.5" /> Now matched to a bank payment: delete it, or it counts twice.</div>
                      )}
                    </div>
                    <div className="font-black text-danger whitespace-nowrap">{rupees(r.line.amount)}</div>
                    <div className="flex items-center gap-0.5">
                      {!r.line.reviewed && (
                        <button onClick={() => call(() => api.patch(`/audit-packages/${id}/expenses/${r.line.id}`, { reviewed: true }))}
                          title="Mark as checked" className="p-1.5 rounded-lg text-text3 hover:text-brand hover:bg-white"><Check size={15} /></button>
                      )}
                      <button onClick={() => setEditingLine(r.line.id)} title="Edit in the package" className="p-1.5 rounded-lg text-text3 hover:text-text hover:bg-white"><Pencil size={14} /></button>
                      <button onClick={() => remove(r.line)} title="Delete from the package" className="p-1.5 rounded-lg text-text3 hover:text-danger hover:bg-white"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {removed.length > 0 && (
              <div className="border-t border-border-custom">
                <button onClick={() => setShowRemoved(v => !v)} className="w-full text-left px-4 py-2 text-[12px] text-text3 hover:text-text">
                  {showRemoved ? 'Hide' : 'Show'} {removed.length} deleted
                </button>
                {showRemoved && removed.map(c => (
                  <div key={c.id} className="px-4 py-2 flex items-center gap-3 bg-surface2/40 text-text3">
                    <div className="w-14 text-[11px] font-black">{shortDate(c.date)}</div>
                    <div className="flex-1 min-w-0 text-[12px] truncate line-through">{categoryLabel(c.category)} · {c.description}</div>
                    <div className="text-[12px] whitespace-nowrap">{rupees(c.amount)}</div>
                    <button onClick={() => restore(c)} title="Put back" className="p-2 rounded-lg hover:text-brand hover:bg-white"><RotateCcw size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            </>}
          </div>

          {/* GST and notes */}
          <div className="bg-white rounded-radius-custom-lg border border-border-custom card-shadow p-3 sm:p-4 space-y-3">
            <label className="flex items-center gap-2.5 text-[13px] font-bold text-text cursor-pointer">
              <input type="checkbox" checked={includeGst} onChange={e => setIncludeGst(e.target.checked)} />
              Include GST summary
            </label>
            {includeGst && (
              <textarea value={gstNote} onChange={e => setGstNote(e.target.value)} rows={3}
                className="w-full text-[13px] border border-border-custom rounded-lg p-2.5" />
            )}
            <label className="block">
              <span className="block text-[11px] font-black text-text3 uppercase tracking-widest mb-1.5">Notes for the auditor</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={2000}
                className="w-full text-[13px] border border-border-custom rounded-lg p-2.5" />
            </label>
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-radius-custom-lg border border-border-custom card-shadow overflow-hidden">
            <div className="px-3 sm:px-4 py-2.5 border-b border-border-custom flex items-center gap-2">
              <div className="mr-auto text-[12px] font-black uppercase tracking-widest text-text2">Invoices</div>
              <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={upload} />
              <button onClick={() => fileRef.current?.click()} disabled={!!busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-custom text-text2 text-[12px] font-black disabled:opacity-40">
                <Paperclip size={14} /> {busy === 'upload' ? 'UPLOADING...' : 'ATTACH'}
              </button>
            </div>
            {view.attachments.length === 0 ? (
              <div className="px-4 py-3 text-text3 text-[12px]">None attached.</div>
            ) : (
              <div className="divide-y divide-border-custom">
                {view.attachments.map(a => (
                  <label key={a.id} className="px-4 py-2.5 flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={a.included}
                      onChange={e => call(() => api.patch(`/audit-packages/${id}/attachments/${a.id}`, { included: e.target.checked }))} />
                    <span className="flex-1 min-w-0 text-[13px] font-bold text-text truncate">{a.fileName}</span>
                    <span className="text-[11px] text-text3">{Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span>
                    <button onClick={e => { e.preventDefault(); call(() => api.delete(`/audit-packages/${id}/attachments/${a.id}`), 'Invoice removed.'); }}
                      title="Delete" className="p-2 rounded-lg text-text3 hover:text-danger hover:bg-surface2"><Trash2 size={15} /></button>
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {viewer && createPortal(
        <div className="fixed inset-0 z-[3000] flex items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setViewer(null)} role="dialog" aria-modal="true" aria-label="PDF preview">
          <div className="bg-white w-full h-full sm:h-[92vh] sm:max-w-4xl sm:rounded-[20px] overflow-hidden shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border-custom flex items-center gap-2 flex-shrink-0">
              <Eye size={16} className="text-brand" />
              <span className="text-[12px] font-black uppercase tracking-widest text-text2 truncate">{viewer.label}</span>
              <a href={viewer.url} target="_blank" rel="noreferrer" className="ml-auto text-[12px] text-brand underline whitespace-nowrap">new tab</a>
              <button onClick={() => setViewer(null)} title="Close" aria-label="Close the preview"
                className="p-1.5 rounded-lg text-text3 hover:text-text hover:bg-surface2"><X size={20} /></button>
            </div>
            <PdfViewer blob={viewer.blob} className="flex-1 min-h-0" />
          </div>
        </div>,
        document.body,
      )}

      {adding && view && (
        <AddExpenseModal view={view} onClose={() => setAdding(false)}
          onAdd={async body => { await call(() => api.post(`/audit-packages/${id}/expenses`, body), 'Added to the package.'); setAdding(false); }} />
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'brand' | 'danger' }) {
  return (
    <div className="bg-white border border-border-custom rounded-radius-custom-lg p-3 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text3">{label}</div>
      <div className={`text-xl font-black mt-0.5 ${tone === 'brand' ? 'text-brand' : tone === 'danger' ? 'text-danger' : 'text-text'}`}>{value}</div>
      {sub && <div className="text-[10px] text-text3 mt-0.5">{sub}</div>}
    </div>
  );
}

/** A manual line opened for correction in the row itself. Only the package changes, not the ledger. */
function EditManualRow({ line, period, onCancel, onSave }: {
  line: CashExpense; period: { periodFrom: string; periodTo: string };
  onCancel: () => void; onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [date, setDate] = useState(line.date);
  const [category, setCategory] = useState(line.category || '');
  const [description, setDescription] = useState(line.description || '');
  const [amount, setAmount] = useState(String(line.amount));
  const [saving, setSaving] = useState(false);
  const input = 'h-8 text-[12px] border border-border-custom rounded-md px-2 bg-white';
  return (
    <div className="px-4 py-2.5 bg-amber-50 border-l-4 border-amber-400 flex flex-wrap items-center gap-2">
      <input type="date" value={date} min={period.periodFrom} max={period.periodTo} onChange={e => setDate(e.target.value)} className={`${input} w-[140px]`} aria-label="Date" />
      <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Category" className={`${input} w-[130px]`} aria-label="Category" />
      <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className={`${input} flex-1 min-w-[160px]`} aria-label="Description" />
      <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} className={`${input} w-[100px] text-right`} aria-label="Amount" />
      <button disabled={saving || !category.trim() || !(Number(amount) > 0)}
        onClick={async () => { setSaving(true); try { await onSave({ date, category, description, amount: Number(amount) }); } finally { setSaving(false); } }}
        className="h-8 px-3 rounded-md bg-brand text-white text-[11px] font-black disabled:opacity-40">{saving ? 'SAVING...' : 'SAVE'}</button>
      <button onClick={onCancel} className="h-8 px-3 rounded-md border border-border-custom text-text2 text-[11px] font-black">CANCEL</button>
    </div>
  );
}

function AddExpenseModal({ view, onClose, onAdd }: {
  view: AuditPackageView; onClose: () => void; onAdd: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [mode, setMode] = useState<'LEDGER' | 'TYPE'>(view.ledgerExpenses.length ? 'LEDGER' : 'TYPE');
  const [date, setDate] = useState(view.package.periodTo);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async (body: Record<string, unknown>) => {
    setSaving(true);
    try { await onAdd(body); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-[24px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border-custom flex items-center gap-2">
          <div className="font-black text-text uppercase tracking-wider text-[13px] mr-auto">Add a cash expense</div>
          <button onClick={onClose} className="text-text3 hover:text-text"><X size={20} /></button>
        </div>
        <div className="flex gap-1 px-4 pt-3">
          {([['LEDGER', 'From the ledger'], ['TYPE', 'Type it in']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setMode(v)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-bold border ${mode === v ? 'bg-text text-white border-text' : 'bg-white text-text2 border-border-custom'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="p-4 overflow-y-auto">
          {mode === 'LEDGER' ? (
            view.ledgerExpenses.length === 0 ? (
              <div className="text-center text-text3 text-[13px] py-6">Every ledger expense for the month is already in the package.</div>
            ) : (
              <div className="divide-y divide-border-custom border border-border-custom rounded-xl">
                {view.ledgerExpenses.map((e: LedgerExpense) => (
                  <div key={e.id} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="w-14 text-[11px] font-black text-text2">{shortDate(e.date)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-text truncate">{categoryLabel(e.category)} · {rupees(e.amount)}</div>
                      <div className="text-[11px] text-text3 truncate">{e.description}</div>
                      {e.paidThroughBank && <div className="text-[11px] text-amber-700 font-bold">Paid through the bank: already in the register from the bank side.</div>}
                    </div>
                    <button disabled={saving} onClick={() => add({ ledgerExpenseId: e.id })}
                      className="px-3 py-1.5 rounded-lg bg-brand text-white text-[11px] font-black disabled:opacity-40">
                      <Check size={13} className="inline -mt-0.5" /> ADD
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[11px] font-bold text-text3 uppercase">Date
                  <input type="date" value={date} min={view.package.periodFrom} max={view.package.periodTo}
                    onChange={e => setDate(e.target.value)} className="mt-1 w-full border border-border-custom rounded-lg px-2 py-2 text-[13px] text-text normal-case" />
                </label>
                <label className="block text-[11px] font-bold text-text3 uppercase">Amount (₹)
                  <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)}
                    className="mt-1 w-full border border-border-custom rounded-lg px-2 py-2 text-[13px] text-text" />
                </label>
              </div>
              <label className="block text-[11px] font-bold text-text3 uppercase">Category
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Feed"
                  className="mt-1 w-full border border-border-custom rounded-lg px-2 py-2 text-[13px] text-text normal-case" />
              </label>
              <label className="block text-[11px] font-bold text-text3 uppercase">Description
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="mt-1 w-full border border-border-custom rounded-lg px-2 py-2 text-[13px] text-text normal-case" />
              </label>
              <label className="block text-[11px] font-bold text-text3 uppercase">Paid by (optional)
                <input value={paidBy} onChange={e => setPaidBy(e.target.value)}
                  className="mt-1 w-full border border-border-custom rounded-lg px-2 py-2 text-[13px] text-text normal-case" />
              </label>
              <p className="text-[11px] text-text3">Added to this package only; the Digital Ledger is not changed.</p>
              <button disabled={saving || !amount || Number(amount) <= 0 || !category.trim()}
                onClick={() => add({ date, category, description, amount: Number(amount), paidBy })}
                className="w-full py-3 rounded-lg bg-brand text-white font-black disabled:opacity-40">
                {saving ? 'ADDING...' : 'ADD TO PACKAGE'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

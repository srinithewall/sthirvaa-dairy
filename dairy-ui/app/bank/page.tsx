'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import AuditPackage from '@/components/AuditPackage';
import StatementTable from '@/components/bank/StatementTable';
import AddRuleForm from '@/components/bank/AddRuleForm';
import SalaryRules from '@/components/bank/SalaryRules';
import api from '@/lib/api';
import { useNotification } from '@/components/NotificationContext';
import { RefreshCw, Upload, Landmark, X, Check, FileSpreadsheet, FileDown, Trash2, Undo2, Layers, ChevronDown } from 'lucide-react';
import {
  BankTxn, BankRule, BankKind, BankStatementDoc, ruleLabel, rupees, typeFromBooking, TYPE_LABEL, FIXED_CATEGORY, categoryLabel, partyOf, buildReport, downloadExcel, downloadPdf,
} from '@/lib/bank';

interface Category { id: number; name: string; type: 'EXPENSE' | 'INCOME' }
interface FeedStatus {
  configured: boolean;
  accountLast4?: string | null;
  lastFetchedAt?: string | null;
  latestTxnDate?: string | null;
  unmapped: number;
  suggested: number;
}

type Tab = 'REVIEW' | 'REPORT' | 'AUDIT' | 'RULES';
type Segment = 'ALL' | 'CATTLE' | 'POULTRY';
type Choice = BankKind | 'IGNORE';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => iso(new Date());
const monthStart = (offset = 0) => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() + offset, 1)); };
const monthEnd = (offset = 0) => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() + offset + 1, 0)); };
/** Indian financial year: April to March. */
const fyStart = () => { const d = new Date(); return iso(new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1)); };
/** 2026-10-01..2026-10-31 -> "Oct 2026"; other spans as "1 Oct – 15 Nov 2026". */
const periodLabel = (f: string, t: string) => {
  const a = new Date(f + 'T00:00:00'), b = new Date(t + 'T00:00:00');
  const wholeMonth = a.getDate() === 1 && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    && new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate() === b.getDate();
  return wholeMonth
    ? a.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : `${a.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};
const shortDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const STATUS_STYLE: Record<string, string> = {
  UNMAPPED: 'bg-amber-100 text-amber-800',
  SUGGESTED: 'bg-sky-100 text-sky-800',
  MAPPED: 'bg-brand/10 text-brand',
  IGNORED: 'bg-surface2 text-text3',
};
const KIND_LABEL: Record<Choice, string> = {
  EXPENSE: 'Expense', INCOME: 'Income', SETTLEMENT: 'Settles ledger income', IGNORE: 'Ignore',
};
/** Money out can settle too: paying staff back for cash they spent, or an advance to them. */
const kindLabel = (k: Choice, direction: string) =>
  k === 'SETTLEMENT' && direction === 'DEBIT' ? 'Staff settlement / advance' : KIND_LABEL[k];
/** Categories for a staff settlement; the ledger has its own expense categories for real expenses. */
const STAFF_SETTLEMENTS = ['STAFF_REIMBURSEMENT', 'STAFF_ADVANCE'];

export default function BankPage() {
  const { showToast, confirm } = useNotification();
  const [status, setStatus] = useState<FeedStatus | null>(null);
  const [txns, setTxns] = useState<BankTxn[]>([]);
  const [rules, setRules] = useState<BankRule[]>([]);
  const [builtInRules, setBuiltInRules] = useState<BuiltInRule[]>([]);
  // Kotak's own PDF statements on file for the period, attached to the PDF report.
  const [statements, setStatements] = useState<BankStatementDoc[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'' | 'fetch' | 'import' | 'approve' | 'excel' | 'pdf'>('');
  const [tab, setTab] = useState<Tab>('REVIEW');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [segment, setSegment] = useState<Segment>('ALL');
  const [editing, setEditing] = useState<BankTxn | null>(null);
  // Bank access follows the BANK row of role_permissions; the backend refuses everyone else.
  const [denied, setDenied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (f = from, t = to) => {
    setLoading(true);
    try {
      const [st, tx, ru, cat, docs, builtIn] = await Promise.allSettled([
        api.get('/bank/status'),
        api.get('/bank/transactions', { params: { from: f, to: t } }),
        api.get('/bank/rules'),
        api.get('/categories'),
        api.get('/bank/statements', { params: { from: f, to: t } }),
        api.get('/bank/rules/built-in'),
      ]);
      if (builtIn.status === 'fulfilled') setBuiltInRules(builtIn.value.data);
      if (docs.status === 'fulfilled') setStatements(docs.value.data);
      if (st.status === 'fulfilled') setStatus(st.value.data);
      if (tx.status === 'fulfilled') setTxns(tx.value.data);
      if (ru.status === 'fulfilled') setRules(ru.value.data);
      if (cat.status === 'fulfilled') setCategories(cat.value.data);
      const refused = (r: PromiseSettledResult<any>) => r.status === 'rejected'
        && (r.reason?.response?.status === 403 || r.reason?.response?.data?.message === 'Access Denied');
      if (refused(st)) { setDenied(true); return; }
      if (tx.status === 'rejected') showToast(tx.reason?.response?.data?.message || 'Could not load bank transactions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRange = (f: string, t: string) => { setFrom(f); setTo(t); load(f, t); };

  const summaryToast = (s: any, what: string) => {
    if (!s.new) { showToast(`${what}: nothing new.`); return; }
    const parts = [`${s.new} new`, s.mapped && `${s.mapped} mapped`, s.suggested && `${s.suggested} suggested`,
      s.unmapped && `${s.unmapped} to review`, s.ignored && `${s.ignored} ignored`].filter(Boolean);
    showToast(`${what}: ${parts.join(', ')}.`);
  };

  /** Shows the period the new lines are in, so they appear in the list. */
  const widenTo = (s: any) => {
    const f = s.from && s.from < from ? s.from : from;
    const t = s.to && s.to > to ? s.to : to;
    setRange(f, t);
  };

  const handleFetch = async () => {
    setBusy('fetch');
    try {
      const res = await api.post('/bank/fetch');
      summaryToast(res.data, 'Fetched from Kotak');
      widenTo(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not fetch from Kotak.', 'error');
    } finally {
      setBusy('');
    }
  };

  /** CSV: the transactions. PDF: Kotak's own statement, kept to attach to the PDF report. Both can go at once. */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBusy('import');
    let f = from, t = to;
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        try {
          const res = await api.post('/bank/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          const doc = res.data.statement;
          if (doc) {
            showToast(`Kotak statement for ${periodLabel(doc.periodFrom, doc.periodTo)} saved (${doc.pages} pages).`);
            if (doc.periodFrom < f) f = doc.periodFrom;
            if (doc.periodTo > t) t = doc.periodTo;
          } else {
            summaryToast(res.data, `Imported ${file.name}`);
            if (res.data.from && res.data.from < f) f = res.data.from;
            if (res.data.to && res.data.to > t) t = res.data.to;
          }
        } catch (err: any) {
          showToast(`${file.name}: ${err.response?.data?.message || 'could not read this statement.'}`, 'error');
        }
      }
    } finally {
      setBusy('');
      setRange(f, t);
    }
  };

  const openCount = txns.filter(t => t.status === 'UNMAPPED' || t.status === 'SUGGESTED').length;
  const report = useMemo(() => buildReport(txns, from, to, segment), [txns, from, to, segment]);

  const deleteRule = (r: BankRule) => confirm(`Stop mapping "${r.pattern}" automatically? Lines already mapped stay as they are.`, async () => {
    try {
      await api.delete(`/bank/rules/${r.id}`);
      showToast('Rule removed.');
      load();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not remove the rule.', 'error');
    }
  }, 'danger');

  const fetchStatementPdf = async (id: number) =>
    (await api.get(`/bank/statements/${id}/file`, { responseType: 'arraybuffer' })).data as ArrayBuffer;

  const download = async (kind: 'excel' | 'pdf') => {
    setBusy(kind);
    try {
      await (kind === 'excel' ? downloadExcel(report) : downloadPdf(report, statements, fetchStatementPdf));
    } catch (err) {
      console.error('Report download failed:', err);
      showToast('Could not create the file.', 'error');
    } finally {
      setBusy('');
    }
  };

  const lastFetched = status?.lastFetchedAt
    ? new Date(status.lastFetchedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  if (denied) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto mt-10 bg-white rounded-radius-custom-lg border border-border-custom p-8 text-center card-shadow">
          <Landmark size={32} className="mx-auto text-text3 mb-3" />
          <div className="font-black text-text uppercase tracking-wide">Bank account</div>
          <p className="text-[13px] text-text3 mt-2">Your role does not have access to the farm&apos;s bank account.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto pb-10 px-1">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-black text-text tracking-tight uppercase flex items-center gap-3">
              <Landmark size={24} className="text-brand" /> Bank Account
            </h1>
            <p className="text-[13px] text-text3 mt-1 font-medium">
              Kotak current account{status?.accountLast4 ? ` ••${status.accountLast4}` : ''}
              {lastFetched && ` · last updated ${lastFetched}`}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            <input ref={fileRef} type="file" multiple accept=".csv,text/csv,.pdf,application/pdf" className="hidden" onChange={handleImport} />
            <button onClick={() => fileRef.current?.click()} disabled={!!busy}
              title="Import the CSV (transactions) and PDF (official copy) downloaded from Kotak net banking"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg border border-border-custom bg-white text-text2 font-black text-[12px] tracking-wide whitespace-nowrap disabled:opacity-40">
              <Upload size={16} className={busy === 'import' ? 'animate-pulse' : ''} /> {busy === 'import' ? 'IMPORTING...' : 'IMPORT'}
            </button>
            <button onClick={handleFetch} disabled={!!busy || !status?.configured}
              title={status?.configured ? 'Fetch new transactions from Kotak' : 'Kotak API access is not set up yet'}
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg bg-brand text-white font-black text-[12px] tracking-wide whitespace-nowrap shadow disabled:opacity-40">
              <RefreshCw size={16} className={busy === 'fetch' ? 'animate-spin' : ''} />
              {busy === 'fetch' ? 'FETCHING...' : <>FETCH<span className="hidden sm:inline">&nbsp;TRANSACTIONS</span></>}
            </button>
          </div>
        </div>

        {status && !status.configured && (
          <div className="bg-amber-400/10 border border-amber-400/30 p-4 rounded-radius-custom-lg mb-5 text-[13px] text-amber-800">
            <b>Kotak API not connected yet.</b> Fetch turns on once Kotak issues the API Banking credentials
            (set as KOTAK_* settings on the server). Until then, download the statement from Kotak net banking
            as CSV and use <b>Import</b>: it is mapped the same way. Import the PDF statement too, to attach it to the PDF report.
          </div>
        )}

        {/* Period and side */}
        <div className="bg-white p-4 rounded-radius-custom-lg border border-border-custom shadow-sm mb-4 flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="grid grid-cols-2 gap-2 items-end">
            <label className="block min-w-0">
              <span className="block text-[11px] font-black text-text3 uppercase tracking-widest mb-1.5">From</span>
              <input type="date" value={from} max={to} onChange={e => setRange(e.target.value, to)}
                className="w-full min-w-0 bg-surface2 border border-border-custom text-text text-sm rounded-lg px-2 sm:px-3 py-2" />
            </label>
            <label className="block min-w-0">
              <span className="block text-[11px] font-black text-text3 uppercase tracking-widest mb-1.5">To</span>
              <input type="date" value={to} min={from} onChange={e => setRange(from, e.target.value)}
                className="w-full min-w-0 bg-surface2 border border-border-custom text-text text-sm rounded-lg px-2 sm:px-3 py-2" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([['This month', monthStart(), today()], ['Last month', monthStart(-1), monthEnd(-1)], ['This FY', fyStart(), today()]] as const).map(([label, f, t]) => (
              <button key={label} onClick={() => setRange(f, t)}
                className={`px-3 py-2 rounded-lg text-[12px] font-bold border ${from === f && to === t ? 'bg-[#1b4332] text-white border-[#1b4332]' : 'bg-white text-text2 border-border-custom'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="lg:ml-auto self-start bg-white p-1 rounded-xl border border-border-custom flex" role="group" aria-label="Cattle, all or poultry">
            {([['CATTLE', 'C', 'Cattle'], ['ALL', 'All', 'Cattle and poultry'], ['POULTRY', 'P', 'Poultry and fish']] as const).map(([v, label, title]) => (
              <button key={v} type="button" title={title} aria-label={title} onClick={() => setSegment(v)}
                className={`min-w-[44px] px-3 py-2 inline-flex items-center justify-center rounded-lg text-[12px] font-black tracking-widest ${segment === v ? 'bg-[#1b4332] text-white' : 'text-text3'}`}>
                {v === 'ALL' ? <Layers size={16} /> : label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-border-custom overflow-x-auto">
          {([
            ['REVIEW', 'Transactions', openCount ? ` (${openCount})` : ''],
            ['REPORT', 'Report', ''],
            ['AUDIT', 'Audit', ''],
            ['RULES', 'Rules', ''],
          ] as const).map(([v, label, count]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-3 sm:px-4 py-2.5 text-[12px] font-black uppercase tracking-wider whitespace-nowrap border-b-2 -mb-px ${tab === v ? 'border-brand text-brand' : 'border-transparent text-text3 hover:text-text'}`}>
              {v === 'REPORT' ? <><span className="hidden sm:inline">Sales &amp; Purchase </span>{label}</> : label}{count}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-16 text-center"><div className="inline-block w-8 h-8 border-4 border-brand/30 border-t-brand rounded-full animate-spin" /></div>
        ) : tab === 'REVIEW' ? (
          <StatementTable txns={txns} categories={categories}
            onUpdated={t => setTxns(list => list.map(x => (x.id === t.id ? t : x)))}
            onReload={msg => { if (msg) showToast(msg); load(); }}
            onMore={setEditing}
            onError={msg => showToast(msg, 'error')} />
        ) : tab === 'REPORT' ? (
          <ReportView report={report} statements={statements} busy={busy} onDownload={download}
            onShowPending={() => setTab('REVIEW')} />
        ) : tab === 'AUDIT' ? (
          <AuditPackage />
        ) : (
          <RulesView rules={rules} builtIn={builtInRules} categories={categories} onDelete={deleteRule}
            onAdded={msg => { showToast(msg); load(); }} onError={msg => showToast(msg, 'error')} />
        )}
      </div>

      {editing && (
        <AssignModal txn={editing} categories={categories} onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); showToast(msg); load(); }}
          onError={(msg) => showToast(msg, 'error')} />
      )}
    </AppLayout>
  );
}

/** The report's entries as a plain table. Lines are changed on the Transactions tab, not here. */
function ReportEntries({ lines }: { lines: BankTxn[] }) {
  if (lines.length === 0) {
    return <div className="bg-white rounded-radius-custom-lg border border-border-custom p-10 text-center text-text3 font-bold">No confirmed entries in this period.</div>;
  }
  const rows = [...lines].sort((a, b) => a.txnDate.localeCompare(b.txnDate) || a.id - b.id);
  return (
    <div className="bg-white rounded-radius-custom-lg border border-border-custom card-shadow overflow-x-auto">
      <table className="w-full text-[12px] min-w-[720px] table-fixed">
        <colgroup><col className="w-[62px]" /><col /><col className="w-[120px]" /><col className="w-[150px]" /><col className="w-[92px]" /><col className="w-[92px]" /></colgroup>
        <thead>
          <tr className="text-[10px] font-black text-text3 uppercase tracking-wider border-b border-border-custom bg-surface2/50">
            <th className="text-left px-2 py-2">Date</th>
            <th className="text-left px-2 py-2">Description</th>
            <th className="text-left px-2 py-2">Type</th>
            <th className="text-left px-2 py-2">Category</th>
            <th className="text-right px-2 py-2">Out</th>
            <th className="text-right px-2 py-2">In</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-custom">
          {rows.map(t => {
            const type = typeFromBooking(t.direction, t.kind, t.category);
            return (
              <tr key={t.id}>
                <td className="px-2 py-2 font-bold text-text2">{shortDate(t.txnDate)}</td>
                <td className="px-2 py-2">
                  <div className="font-bold text-text truncate">{partyOf(t)}</div>
                  <div className="text-[11px] text-text3 truncate" title={t.narration || ''}>{t.narration}{t.note ? ` · ${t.note}` : ''}</div>
                </td>
                <td className="px-2 py-2 text-text2">{type ? TYPE_LABEL[type] : ''}</td>
                <td className="px-2 py-2 text-text2 truncate">{FIXED_CATEGORY[type as keyof typeof FIXED_CATEGORY] ? (type === 'ADVANCE' ? 'Staff advance' : 'Staff paid cash') : categoryLabel(t.category)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-bold text-danger">{t.direction === 'DEBIT' ? rupees(t.amount) : ''}</td>
                <td className="px-2 py-2 text-right tabular-nums font-bold text-brand">{t.direction === 'CREDIT' ? rupees(t.amount) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ReportView({ report, statements, busy, onDownload, onShowPending }: {
  report: ReturnType<typeof buildReport>; statements: BankStatementDoc[]; busy: string; onDownload: (k: 'excel' | 'pdf') => void;
  onShowPending: () => void;
}) {
  const net = report.totalIn - report.totalOut;
  const Table = ({ title, groups, total, tone }: { title: string; groups: typeof report.sales; total: number; tone: string }) => (
    <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow">
      <div className={`px-4 py-3 text-[12px] font-black uppercase tracking-widest ${tone}`}>{title}</div>
      <table className="w-full text-[13px]">
        <tbody className="divide-y divide-border-custom">
          {groups.length === 0 && <tr><td className="px-4 py-4 text-text3">None in this period.</td></tr>}
          {groups.map(g => (
            <tr key={g.category}>
              <td className="px-4 py-2.5 font-bold text-text">{g.category}</td>
              <td className="px-2 py-2.5 text-text3 text-right">{g.count}</td>
              <td className="px-4 py-2.5 font-black text-right">{rupees(g.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface2/60">
            <td className="px-4 py-2.5 font-black">Total</td>
            <td />
            <td className="px-4 py-2.5 font-black text-right">{rupees(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="text-[13px] text-text2 font-medium">
          Net for the period: <b className={net >= 0 ? 'text-brand' : 'text-danger'}>{net < 0 ? '−' : ''}{rupees(Math.abs(net))}</b>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => onDownload('excel')} disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-custom bg-white text-text2 text-[12px] font-black disabled:opacity-40">
            <FileSpreadsheet size={15} className="text-brand" /> {busy === 'excel' ? 'PREPARING...' : 'EXCEL'}
          </button>
          <button onClick={() => onDownload('pdf')} disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border-custom bg-white text-text2 text-[12px] font-black disabled:opacity-40">
            <FileDown size={15} className="text-danger" /> {busy === 'pdf' ? 'PREPARING...' : 'PDF'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-border-custom px-4 py-3 rounded-radius-custom-lg mb-4 text-[13px] text-text2 flex items-start gap-2">
        <FileDown size={16} className="text-danger mt-0.5 flex-shrink-0" />
        {statements.length > 0 ? (
          <span>
            The PDF download attaches Kotak&apos;s statement{statements.length > 1 ? 's' : ''} for{' '}
            <b>{statements.map(d => periodLabel(d.periodFrom, d.periodTo)).join(', ')}</b> after the report.
          </span>
        ) : (
          <span>No Kotak PDF statement on file for this period. Use <b>Import</b> with the PDF from net banking to attach it to the PDF download.</span>
        )}
      </div>

      {report.pending.count > 0 && (
        <button onClick={onShowPending}
          className="w-full text-left bg-amber-400/10 border border-amber-400/30 px-4 py-3 rounded-radius-custom-lg mb-4 text-[13px] text-amber-800">
          {report.pending.count} bank lines ({rupees(report.pending.amount)}) still need review and are not in this report. <u>Review them</u>
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Table title="Sales (money in)" groups={report.sales} total={report.totalIn} tone="bg-brand/5 text-brand" />
        <Table title="Purchases & expenses (money out)" groups={report.purchases} total={report.totalOut} tone="bg-danger/5 text-danger" />
        {report.staffSettlements.length > 0 && (
          <Table title="Staff settlements & advances (not expenses)" groups={report.staffSettlements}
            total={report.totalStaffSettlements} tone="bg-surface2 text-text2" />
        )}
      </div>

      <div className="text-[12px] font-black text-text2 uppercase tracking-widest mb-2 px-1">Entries</div>
      <ReportEntries lines={report.lines} />
    </>
  );
}

/** A rule written into the app's code (BankFeedService), shown read-only. */
interface BuiltInRule { step: number; direction: 'CREDIT' | 'DEBIT' | 'ANY'; when: string; then: string; note?: string }

function RulesView({ rules, builtIn, categories, onDelete, onAdded, onError }: {
  rules: BankRule[]; builtIn: BuiltInRule[]; categories: Category[]; onDelete: (r: BankRule) => void;
  onAdded: (message: string) => void; onError: (message: string) => void;
}) {
  const dir = (d: string) => d === 'CREDIT' ? 'Money in' : d === 'DEBIT' ? 'Money out' : 'Any line';
  const [showBuiltIn, setShowBuiltIn] = useState(false);
  return (
    <div className="space-y-5">
      <AddRuleForm categories={categories} onAdded={onAdded} onError={onError} />
      <div>
        <div className="text-[12px] font-black text-text2 uppercase tracking-widest mb-2 px-1">Your rules ({rules.length})</div>
        {rules.length === 0 ? (
          <div className="bg-white rounded-radius-custom-lg border border-border-custom p-8 text-center text-text3 text-[13px]">
            No rules yet. When you pick a category for a bank line and keep <b>Always do this</b> ticked, the app remembers it
            and maps that party automatically from then on.
          </div>
        ) : (
          <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-hidden card-shadow divide-y divide-border-custom">
            {rules.map(r => (
              <div key={r.id} className="p-3 sm:p-4 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-black text-text text-[14px]">
                    {r.direction === 'CREDIT' ? 'Money from' : r.direction === 'DEBIT' ? 'Money to' : 'Money to or from'} “{r.pattern}”
                  </div>
                  <div className="text-[12px] text-text3">
                    → {ruleLabel(r)}{r.segment === 'POULTRY' ? ' · Poultry' : ''}
                    {' · '}used {r.hits} time{r.hits === 1 ? '' : 's'}
                  </div>
                </div>
                <button title="Delete rule" onClick={() => onDelete(r)} className="p-2 rounded-lg text-text3 hover:text-danger hover:bg-surface2">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <button type="button" onClick={() => setShowBuiltIn(v => !v)} aria-expanded={showBuiltIn}
          className="flex items-center gap-1.5 text-[12px] font-black text-text2 uppercase tracking-widest mb-1 px-1 hover:text-text">
          Built into the app ({builtIn.length})
          <ChevronDown size={16} className={`transition-transform ${showBuiltIn ? '' : '-rotate-90'}`} />
        </button>
        {showBuiltIn && <>
        <p className="text-[12px] text-text3 mb-2 px-1">
          Every new bank line goes through these steps in order and stops at the first that applies. They are part of the
          app&apos;s code, so they can be read here but not changed.
        </p>
        <div className="bg-white rounded-radius-custom-lg border border-border-custom overflow-x-auto card-shadow">
          <table className="w-full text-[12px] min-w-[560px]">
            <thead>
              <tr className="text-[10px] font-black text-text3 uppercase tracking-widest border-b border-border-custom">
                <th className="text-left px-3 py-2 w-12">Step</th>
                <th className="text-left px-3 py-2 w-24">Applies to</th>
                <th className="text-left px-3 py-2">When</th>
                <th className="text-left px-3 py-2">Then</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-custom">
              {builtIn.map((b, i) => (
                <tr key={i} className={b.then.startsWith('Skipped') ? 'text-text3' : 'text-text2'}>
                  <td className="px-3 py-2 font-black">{b.step}</td>
                  <td className="px-3 py-2">{dir(b.direction)}</td>
                  <td className="px-3 py-2">{b.when}{b.note && <div className="text-[11px] text-text3">{b.note}</div>}</td>
                  <td className={`px-3 py-2 ${b.then.startsWith('Skipped') ? 'italic' : 'font-bold text-text'}`}>{b.then}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>}
      </div>

      <SalaryRules onSaved={onAdded} onError={onError} />
    </div>
  );
}

function AssignModal({ txn, categories, onClose, onSaved, onError }: {
  txn: BankTxn; categories: Category[]; onClose: () => void; onSaved: (msg: string) => void; onError: (msg: string) => void;
}) {
  const credit = txn.direction === 'CREDIT';
  const choices: Choice[] = credit ? ['INCOME', 'SETTLEMENT', 'IGNORE'] : ['EXPENSE', 'SETTLEMENT', 'IGNORE'];
  const [kind, setKind] = useState<Choice>(
    txn.status === 'IGNORED' ? 'IGNORE' : (txn.kind as Choice) || (credit ? 'INCOME' : 'EXPENSE'));
  const [category, setCategory] = useState(txn.category || '');
  const [segment, setSegment] = useState<'CATTLE' | 'POULTRY'>(txn.segment === 'POULTRY' ? 'POULTRY' : 'CATTLE');
  const [note, setNote] = useState(txn.note || '');
  const [remember, setRemember] = useState(true);
  const [pattern, setPattern] = useState(txn.counterparty || '');
  const [saving, setSaving] = useState(false);

  // Money-in settlements are booked against income categories (milk sales are MILK_SALES, which may not be
  // a listed category); money-out settlements are a staff reimbursement or advance.
  const options = useMemo(() => {
    if (kind === 'SETTLEMENT' && !credit) {
      return category && !STAFF_SETTLEMENTS.includes(category) ? [category, ...STAFF_SETTLEMENTS] : STAFF_SETTLEMENTS;
    }
    const type = kind === 'EXPENSE' ? 'EXPENSE' : 'INCOME';
    // Names, not ids: the ledger stores the name. Two categories can share one, so de-duplicate.
    const names = [...new Set(categories.filter(c => c.type === type).map(c => c.name))].sort((a, b) => a.localeCompare(b));
    if (kind === 'SETTLEMENT' && !names.includes('MILK_SALES')) names.unshift('MILK_SALES');
    if (category && !names.includes(category)) names.unshift(category);
    return names;
  }, [categories, kind, category, credit]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/bank/transactions/${txn.id}`, {
        kind, category: kind === 'IGNORE' ? null : category, segment, note, remember, pattern,
      });
      const more = res.data.alsoMapped ? ` ${res.data.alsoMapped} similar lines mapped too.` : '';
      onSaved(`${kind === 'IGNORE' ? 'Ignored' : 'Saved'}.${more}`);
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await api.post(`/bank/transactions/${txn.id}/reset`);
      onSaved(txn.posted ? 'Unmapped, and the ledger entry it created was removed.' : 'Unmapped.');
    } catch (err: any) {
      onError(err.response?.data?.message || 'Could not unmap.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[24px] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className={`p-5 text-white ${credit ? 'bg-brand' : 'bg-danger'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-widest opacity-80">
                {credit ? 'Money in' : 'Money out'} · {shortDate(txn.txnDate)} {txn.mode ? `· ${txn.mode}` : ''}
              </div>
              <div className="text-2xl font-black mt-1">{rupees(txn.amount)}</div>
              <div className="text-[13px] font-bold mt-1 truncate">{partyOf(txn)}</div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white"><X size={22} /></button>
          </div>
          <div className="text-[11px] mt-2 opacity-80 break-words">{txn.narration}</div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-[11px] font-bold text-text3 uppercase mb-2">This is</label>
            <div className="grid grid-cols-1 gap-1.5">
              {choices.map(c => (
                <button key={c} type="button" onClick={() => { setKind(c); if (c !== kind) setCategory(''); }}
                  className={`text-left px-3 py-2 rounded-xl border text-[13px] font-bold ${kind === c ? 'bg-[#1b4332] text-white border-[#1b4332]' : 'bg-white text-text2 border-border-custom'}`}>
                  {kindLabel(c, txn.direction)}
                  {c === 'SETTLEMENT' && <span className={`block text-[11px] font-medium ${kind === c ? 'text-white/80' : 'text-text3'}`}>
                    {credit
                      ? <>Payment for income the app already books, e.g. the society&apos;s milk bill. Not added to the ledger again.</>
                      : <>Paying staff back for cash they spent on the farm (already in the ledger), or an advance. Not an expense.</>}
                  </span>}
                </button>
              ))}
            </div>
          </div>

          {kind !== 'IGNORE' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-text3 uppercase mb-2">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-surface2 border border-border-custom text-text text-sm rounded-lg px-3 py-2.5">
                  <option value="">Select…</option>
                  {options.map(n => <option key={n} value={n}>{categoryLabel(n)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([['CATTLE', 'Cattle'], ['POULTRY', 'Poultry / fish']] as const).map(([v, label]) => (
                  <button key={v} type="button" onClick={() => setSegment(v)}
                    className={`py-2 rounded-xl border text-[12px] font-bold ${segment === v ? 'bg-[#1b4332] text-white border-[#1b4332]' : 'bg-white text-text2 border-border-custom'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text3 uppercase mb-2">Note (optional)</label>
                <input value={note} onChange={e => setNote(e.target.value)}
                  className="w-full text-sm text-text2 border-b border-border-custom outline-none py-1" />
              </div>
            </>
          )}

          <div className="bg-surface2/60 rounded-xl p-3 text-[12px] text-text2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              <span><b>Always do this</b> for {credit ? 'money from' : 'money to'}</span>
            </label>
            {remember && (
              <>
                <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="name in the narration"
                  aria-label="Text to look for in the narration"
                  className="block w-full mt-2 bg-white border border-border-custom rounded-md px-2 py-1 text-[12px] font-bold uppercase" />
                <span className="block mt-1 text-text3">Future lines with this text are mapped automatically.</span>
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border-custom flex gap-2">
          {txn.status !== 'UNMAPPED' && (
            <button onClick={reset} disabled={saving} title="Back to unmapped"
              className="inline-flex items-center gap-1.5 px-3 py-3 rounded-lg border border-border-custom text-text2 text-[12px] font-black disabled:opacity-40">
              <Undo2 size={14} /> UNMAP
            </button>
          )}
          <button onClick={save} disabled={saving || (kind !== 'IGNORE' && !category) || (remember && pattern.trim().length < 3)}
            className="flex-1 py-3 rounded-lg font-black text-white bg-brand disabled:opacity-40">
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Download } from 'lucide-react';
import api from '@/lib/api';

/* ─── Types ──────────────────────────────────────────── */
// One pour as stored by the AMCS import (the society's milk-collection system)
interface AmcsPour {
  date: string | number[];
  shift: 'MORNING' | 'EVENING';
  memberCode: string;
  sampleNo: number;
  animalType: string | null;
  quantity: number;
  fat: number | null;
  snf: number | null;
  clr: number | null;
  ratePerLitre: number | null;
  amount: number;
  qualityManual: boolean | null;
  quantityManual: boolean | null;
  amcsUpdatedBy: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Use local date (not UTC) so IST users don't get tomorrow's date
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = () => { const d = new Date(); d.setDate(1); return isoDate(d); };

// LocalDate can arrive as "2026-10-23" or as [2026, 10, 23]
const dateKey = (d: string | number[]): string =>
  Array.isArray(d) ? `${d[0]}-${pad(d[1])}-${pad(d[2])}` : d.slice(0, 10);

const showDate = (key: string) => key.split('-').reverse().join('/'); // dd/mm/yyyy, as in the AMCS app

const num = (n: number | null, digits: number) => (n == null ? '—' : n.toFixed(digits));
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`; // amounts are always whole rupees

// A = read by the AMCS machine, M = keyed in by hand (the society supervisor does this when the
// machine has a problem, so a supervisor edit counts as manual too)
const qualityManual = (p: AmcsPour) => !!p.qualityManual || !!p.amcsUpdatedBy;
const litresManual = (p: AmcsPour) => !!p.quantityManual || !!p.amcsUpdatedBy;

function Badge({ manual, label }: { manual: boolean; label?: string }) {
  return (
    <span
      title={manual ? 'Keyed in by hand at the society (machine problem)' : 'Read automatically by the AMCS machine'}
      className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded border text-[9px] font-black leading-none whitespace-nowrap ${
        manual ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }`}
    >
      {label}{manual ? 'M' : 'A'}
    </span>
  );
}

// Litres-weighted average, so a bigger pour counts for more
const weighted = (rows: AmcsPour[], pick: (p: AmcsPour) => number | null): number | null => {
  const withValue = rows.filter((p) => pick(p) != null && p.quantity > 0);
  const litres = withValue.reduce((s, p) => s + p.quantity, 0);
  if (litres <= 0) return null;
  return withValue.reduce((s, p) => s + (pick(p) as number) * p.quantity, 0) / litres;
};

/* The report itself. Rendered twice: in the modal for the screen and in a portal for printing. */
function ReportBody({ rows, from, to, print }: { rows: AmcsPour[]; from: string; to: string; print?: boolean }) {
  const totals = useMemo(() => {
    const litres = rows.reduce((s, p) => s + p.quantity, 0);
    const amount = rows.reduce((s, p) => s + p.amount, 0);
    return {
      litres,
      amount,
      fat: weighted(rows, (p) => p.fat),
      snf: weighted(rows, (p) => p.snf),
      clr: weighted(rows, (p) => p.clr),
      rate: litres > 0 ? amount / litres : null,
      manualQuality: rows.filter(qualityManual).length,
    };
  }, [rows]);

  const th = 'px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-text3 whitespace-nowrap';
  const td = 'px-3 py-2 whitespace-nowrap';

  return (
    <div>
      {print && (
        <div className="mb-4">
          <h1 className="text-xl font-black text-text">Sthirvaa Farms — Milk Collection Report</h1>
          <p className="text-[12px] text-text3 mt-1">
            Society collection (AMCS) · Member {rows[0]?.memberCode ?? '—'} · {showDate(from)} to {showDate(to)}
          </p>
          <p className="text-[11px] text-text3">Generated {new Date().toLocaleString('en-IN')}</p>
        </div>
      )}

      <table className="w-full text-[12px]">
        <thead className="bg-surface border-b border-border-custom">
          <tr>
            <th className={th}>Date</th>
            <th className={th}>Shift</th>
            <th className={th}>S.no</th>
            <th className={th}>Type</th>
            <th className={`${th} text-right`}>Qty (L)</th>
            <th className={`${th} text-right`}>FAT %</th>
            <th className={`${th} text-right`}>SNF %</th>
            <th className={`${th} text-right`}>CLR</th>
            <th className={`${th} text-right`}>Rate (₹/L)</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={th} title="A = read by the machine, M = keyed in by hand">Entry</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={`${dateKey(p.date)}-${p.shift}-${p.sampleNo}-${i}`} className="border-b border-border-custom/60 break-inside-avoid">
              <td className={`${td} font-bold text-text`}>{showDate(dateKey(p.date))}</td>
              <td className={`${td} ${p.shift === 'MORNING' ? 'text-amber-700' : 'text-indigo-700'} font-bold`}>
                {p.shift === 'MORNING' ? 'Morning' : 'Evening'}
              </td>
              <td className={`${td} text-text3`}>{p.sampleNo}</td>
              <td className={`${td} text-text3`}>{p.animalType ?? '—'}</td>
              <td className={`${td} text-right font-black text-text`}>{p.quantity.toFixed(2)}</td>
              <td className={`${td} text-right`}>{num(p.fat, 1)}</td>
              <td className={`${td} text-right`}>{num(p.snf, 1)}</td>
              <td className={`${td} text-right`}>{num(p.clr, 1)}</td>
              <td className={`${td} text-right`}>{num(p.ratePerLitre, 2)}</td>
              <td className={`${td} text-right font-bold text-text`}>{rupees(p.amount)}</td>
              <td className={td}>
                <span className="inline-flex items-center gap-1">
                  <Badge manual={qualityManual(p)} />
                  {litresManual(p) && <Badge manual label="L:" />}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-surface font-black text-text">
            <td className={td} colSpan={4}>Total · {rows.length} collections</td>
            <td className={`${td} text-right`}>{totals.litres.toFixed(2)}</td>
            <td className={`${td} text-right`}>{num(totals.fat, 1)}</td>
            <td className={`${td} text-right`}>{num(totals.snf, 1)}</td>
            <td className={`${td} text-right`}>{num(totals.clr, 1)}</td>
            <td className={`${td} text-right`}>{num(totals.rate, 2)}</td>
            <td className={`${td} text-right`}>{rupees(totals.amount)}</td>
            <td className={td} />
          </tr>
        </tfoot>
      </table>

      <p className="text-[10px] text-text3 mt-3">
        FAT, SNF and CLR in the total row are averages weighted by litres; the rate is the average paid per litre.
        Entry: <b>A</b> = FAT/SNF/CLR read by the machine, <b>M</b> = keyed in by hand
        {totals.manualQuality > 0 ? ` (${totals.manualQuality} of ${rows.length} collections)` : ''}, <b>L:M</b> = litres keyed in by hand.
      </p>
    </div>
  );
}

/* ─── Modal ──────────────────────────────────────────── */
export default function AmcsReportModal({ onClose }: { onClose: () => void }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(isoDate(new Date()));
  const [rows, setRows] = useState<AmcsPour[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!from || !to || from > to) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    api
      .get('/amcs/collections', { params: { from, to } })
      .then((res) => {
        if (cancelled) return;
        // Newest first, evening above morning within a day - the order the AMCS passbook uses
        const sorted = [...(res.data as AmcsPour[])].sort((a, b) =>
          dateKey(b.date).localeCompare(dateKey(a.date)) || a.shift.localeCompare(b.shift)
        );
        setRows(sorted);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('AMCS report unavailable', err);
        setFailed(true);
        setRows([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [from, to]);

  const preset = (kind: 'month' | 'last-month' | '7d') => {
    const now = new Date();
    if (kind === 'month') { setFrom(monthStart()); setTo(isoDate(now)); }
    if (kind === '7d') { const s = new Date(); s.setDate(s.getDate() - 6); setFrom(isoDate(s)); setTo(isoDate(now)); }
    if (kind === 'last-month') {
      setFrom(isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setTo(isoDate(new Date(now.getFullYear(), now.getMonth(), 0)));
    }
  };

  const invalidRange = !from || !to || from > to;
  const chip = 'px-2.5 py-1 rounded-lg border border-white/30 text-[10px] font-black uppercase tracking-wide hover:bg-white/20 transition-colors';

  return (
    <>
      {/* Print stylesheet: show only the report portal, as A4 */}
      <style>{`
        #amcs-print-root { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body > *:not(#amcs-print-root) { display: none !important; }
          #amcs-print-root { display: block !important; background: #fff; color: #111; }
          #amcs-print-root thead { display: table-header-group; }
          #amcs-print-root tr { break-inside: avoid; }
          #amcs-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#2d6a4f 0%,#1b4332 100%)' }} className="px-5 pt-5 pb-4 text-white flex-shrink-0">
            <div className="flex justify-between items-start mb-3 gap-3">
              <div className="flex items-center gap-2.5">
                <FileText size={20} />
                <div>
                  <h2 className="text-[17px] font-bold m-0">Milk Collection Report</h2>
                  <p className="text-[12px] opacity-70 mt-0.5">What the society (AMCS) collected and paid</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Close report" className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors flex-shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[10px] font-black uppercase tracking-wider opacity-80">
                From
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
                  className="block mt-1 rounded-lg bg-white/15 border border-white/25 px-2.5 py-1.5 text-[12px] font-bold text-white [color-scheme:dark]" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wider opacity-80">
                To
                <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)}
                  className="block mt-1 rounded-lg bg-white/15 border border-white/25 px-2.5 py-1.5 text-[12px] font-bold text-white [color-scheme:dark]" />
              </label>
              <div className="flex gap-1.5 pb-0.5">
                <button className={chip} onClick={() => preset('7d')}>Last 7 days</button>
                <button className={chip} onClick={() => preset('month')}>This month</button>
                <button className={chip} onClick={() => preset('last-month')}>Last month</button>
              </div>
              <button
                onClick={() => window.print()}
                disabled={loading || rows.length === 0}
                className="ml-auto flex items-center gap-1.5 bg-white text-[#1B4332] px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                title="Opens the print dialog - choose Save as PDF"
              >
                <Download size={14} /> Download PDF
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-auto p-4 sm:p-5">
            {invalidRange ? (
              <p className="py-12 text-center text-text3 text-[13px]">Pick a start date that is on or before the end date.</p>
            ) : loading ? (
              <p className="py-12 text-center text-text3 text-[13px] italic">Loading collections…</p>
            ) : failed ? (
              <p className="py-12 text-center text-text3 text-[13px]">The AMCS report could not be loaded. Please try again.</p>
            ) : rows.length === 0 ? (
              <p className="py-12 text-center text-text3 text-[13px]">No AMCS collections between {showDate(from)} and {showDate(to)}.</p>
            ) : (
              <div className="min-w-[760px]"><ReportBody rows={rows} from={from} to={to} /></div>
            )}
          </div>
        </div>
      </div>

      {/* Printable copy, attached to <body> so it paginates normally */}
      {mounted && rows.length > 0 &&
        createPortal(
          <div id="amcs-print-root"><ReportBody rows={rows} from={from} to={to} print /></div>,
          document.body
        )}
    </>
  );
}

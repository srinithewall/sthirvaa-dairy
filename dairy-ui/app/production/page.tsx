'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import LogYieldModal from '@/components/LogYieldModal';
import api from '@/lib/api';
import { Droplets, Plus, TrendingUp, Sun, Moon, ChevronLeft, ChevronRight } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────── */
interface Herd {
  id: number;
  tagNumber: string;
  animalName: string;
  breed: string;
  animalType: string;
  animalStatus: string;
}

interface DaySummary {
  date: string;
  morning: number;
  evening: number;
  total: number;
  cowCount: number;
}

const todayStr = () => new Date().toISOString().split('T')[0];
const fmt = (n: number) => n % 1 === 0 ? `${n}` : n.toFixed(1);

/* ─── Stat card ───────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 flex flex-col gap-1 shadow-lg text-white ${color}`}>
      <div className="absolute -right-4 -top-4 opacity-10 scale-150">{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">{label}</span>
      <span className="text-3xl font-black tracking-tight leading-none">{value}</span>
      {sub && <span className="text-[10px] opacity-70 font-medium mt-0.5">{sub}</span>}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────── */
export default function MilkProductionPage() {
  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [lactating, setLactating] = useState<Herd[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PER_PAGE = 10;

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [summaryRes, herdRes] = await Promise.all([
        api.get('/milk-records/summary'),
        api.get('/herds'),
      ]);
      setSummary(summaryRes.data);
      const allHerds: Herd[] = herdRes.data.herds || herdRes.data;
      setLactating((allHerds || []).filter((h) => h.animalStatus === 'LACTATING'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const todayData = summary.find((d) => d.date === todayStr());
  const weekTotal = summary
    .slice(0, 7)
    .reduce((sum, d) => sum + d.total, 0);
  const avgDaily =
    summary.length > 0
      ? summary.reduce((s, d) => s + d.total, 0) / summary.length
      : 0;

  const paged = summary.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(summary.length / PER_PAGE);

  return (
    <AppLayout>
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div className="px-1">
          <h1 className="text-2xl font-black text-text tracking-tight uppercase">Milk Production</h1>
          <p className="text-[12px] text-text3 mt-0.5 font-medium">
            Daily morning &amp; evening yield per lactating cow
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand text-white flex items-center gap-2 py-2.5 px-5 rounded-xl font-black text-[12px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-md active:scale-95"
        >
          <Plus size={16} />
          <span>Log Yield</span>
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Droplets size={56} />}
          label="Today's Total"
          value={todayData ? `${fmt(todayData.total)} L` : '—'}
          sub={todayData ? `${fmt(todayData.morning)}L AM · ${fmt(todayData.evening)}L PM` : 'Not logged yet'}
          color="bg-gradient-to-br from-brand to-brand-dark"
        />
        <StatCard
          icon={<Sun size={56} />}
          label="Today Morning"
          value={todayData ? `${fmt(todayData.morning)} L` : '—'}
          color="bg-gradient-to-br from-amber-500 to-amber-700"
        />
        <StatCard
          icon={<Moon size={56} />}
          label="Today Evening"
          value={todayData ? `${fmt(todayData.evening)} L` : '—'}
          color="bg-gradient-to-br from-indigo-500 to-indigo-800"
        />
        <StatCard
          icon={<TrendingUp size={56} />}
          label="7-Day Total"
          value={`${fmt(weekTotal)} L`}
          sub={`Avg ${fmt(avgDaily)} L/day`}
          color="bg-gradient-to-br from-teal-600 to-teal-900"
        />
      </div>

      {/* ── History Table ── */}
      <div className="bg-white border border-border-custom rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-custom flex items-center justify-between">
          <h2 className="text-[13px] font-black text-text uppercase tracking-[0.15em]">Production History</h2>
          <span className="text-[11px] text-text3 font-medium">{summary.length} days recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-surface text-text3 uppercase text-[10px] font-black tracking-[0.15em] border-b border-border-custom">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-amber-600">Morning (L)</th>
                <th className="px-5 py-3 text-indigo-600">Evening (L)</th>
                <th className="px-5 py-3 text-brand">Total (L)</th>
                <th className="px-5 py-3">Cows</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-text3 text-[13px] italic">
                    Loading production logs…
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Droplets size={40} className="mx-auto text-border-custom mb-3" />
                    <p className="text-text3 text-[13px] font-medium">No milk records logged yet.</p>
                    <p className="text-text3 text-[11px] mt-1">Click "+ Log Yield" to start recording.</p>
                  </td>
                </tr>
              ) : (
                paged.map((day) => (
                  <tr
                    key={day.date}
                    className="border-b border-border-custom/50 hover:bg-surface/50 transition-colors last:border-0"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-black text-text">{day.date}</div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-amber-700">{fmt(day.morning)} L</td>
                    <td className="px-5 py-3.5 font-bold text-indigo-700">{fmt(day.evening)} L</td>
                    <td className="px-5 py-3.5">
                      <span className="font-black text-brand-dark text-[14px]">{fmt(day.total)} L</span>
                    </td>
                    <td className="px-5 py-3.5 text-text3 font-medium">{day.cowCount} cows</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-black rounded-full border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Logged
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border-custom bg-surface/30">
            <span className="text-[11px] text-text3 font-medium">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-border-custom text-text3 hover:border-brand hover:text-brand disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded-lg border border-border-custom text-text3 hover:border-brand hover:text-brand disabled:opacity-30 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Log Yield Modal ── */}
      {showModal && (
        <LogYieldModal
          lactatingCows={lactating}
          onClose={() => setShowModal(false)}
          onSave={fetchAll}
        />
      )}
    </AppLayout>
  );
}

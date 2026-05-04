'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import LogYieldModal from '@/components/LogYieldModal';
import DistributeModal from '@/components/DistributeModal';
import api from '@/lib/api';
import { Droplets, Plus, TrendingUp, Sun, Moon, ChevronLeft, ChevronRight, Pencil, Truck, CheckCircle2, AlertCircle } from 'lucide-react';

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
  distributed: number;
  cowCount: number;
}

const todayStr = () => new Date().toISOString().split('T')[0];

const fmt = (n: number) => n % 1 === 0 ? `${n}` : n.toFixed(1);

/* ─── Compact Stat card ───────────────────────────────── */
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-3 flex flex-col shadow text-white ${color}`}>
      <div className="absolute -right-2 -top-2 opacity-10 scale-125">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-wider opacity-80">{label}</span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-xl font-black tracking-tight leading-none">{value}</span>
      </div>
      {sub && <span className="text-[8px] opacity-70 font-bold mt-1 tracking-tight truncate">{sub}</span>}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────── */
export default function MilkProductionPage() {
  const [summary, setSummary] = useState<DaySummary[]>([]);
  const [lactating, setLactating] = useState<Herd[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [distributeTarget, setDistributeTarget] = useState<{ date: string; shift: string; total: number } | null>(null);
  const [editTarget, setEditTarget] = useState<{ date: string } | null>(null);
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

      {/* ── History Section ── */}
      <div className="bg-white border border-border-custom rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-custom flex items-center justify-between">
          <h2 className="text-[13px] font-black text-text uppercase tracking-[0.15em]">Production History</h2>
          <span className="text-[11px] text-text3 font-medium">{summary.length} days recorded</span>
        </div>

        {/* ── MOBILE: Card List (hidden on md+) ── */}
        <div className="md:hidden divide-y divide-border-custom">
          {loading ? (
            <div className="py-12 text-center text-text3 text-[13px] italic">Loading production logs…</div>
          ) : paged.length === 0 ? (
            <div className="py-12 text-center px-4">
              <Droplets size={36} className="mx-auto text-border-custom mb-3" />
              <p className="text-text3 text-[13px] font-medium">No milk records logged yet.</p>
              <p className="text-text3 text-[11px] mt-1">Tap "+ Log Yield" to start recording.</p>
            </div>
          ) : (
            paged.map((day) => {
              const isFullyDistributed = day.distributed >= day.total && day.total > 0;
              const today = new Date(); today.setHours(0,0,0,0);
              const target = new Date(day.date); target.setHours(0,0,0,0);
              const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);
              const canEdit = diff <= 1;
              return (
                <div key={day.date} className="p-4 hover:bg-surface/40 transition-colors">
                  {/* Card Header: Date + Distribution Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-black text-text text-[14px]">{day.date}</span>
                    {isFullyDistributed ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} /> Fully Distributed
                      </span>
                    ) : day.distributed > 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <AlertCircle size={10} /> Partial
                      </span>
                    ) : (
                      <span className="text-[10px] font-black text-text3 bg-surface px-2 py-0.5 rounded-full">Not Distributed</span>
                    )}
                  </div>

                  {/* Yield Stats Row */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="bg-amber-50 rounded-lg p-2 text-center">
                      <div className="text-[9px] font-black text-amber-600 uppercase tracking-wide mb-0.5">Morning</div>
                      <div className="font-black text-amber-700 text-[13px]">{fmt(day.morning)}L</div>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <div className="text-[9px] font-black text-indigo-600 uppercase tracking-wide mb-0.5">Evening</div>
                      <div className="font-black text-indigo-700 text-[13px]">{fmt(day.evening)}L</div>
                    </div>
                    <div className="bg-brand/10 rounded-lg p-2 text-center">
                      <div className="text-[9px] font-black text-brand uppercase tracking-wide mb-0.5">Total</div>
                      <div className="font-black text-brand text-[13px]">{fmt(day.total)}L</div>
                    </div>
                    <div className="bg-surface rounded-lg p-2 text-center">
                      <div className="text-[9px] font-black text-text3 uppercase tracking-wide mb-0.5">Dist.</div>
                      <div className={`font-black text-[13px] ${isFullyDistributed ? 'text-brand' : 'text-amber-600'}`}>{fmt(day.distributed)}L</div>
                    </div>
                  </div>

                  {/* Sub info + Actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text3 font-medium">{day.cowCount} cows milked</span>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => { setEditTarget({ date: day.date }); setShowModal(true); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-custom text-text3 hover:border-brand hover:text-brand text-[10px] font-black uppercase tracking-wide transition-all"
                        >
                          <Pencil size={10} /> Edit
                        </button>
                      )}
                      <button
                        onClick={() => setDistributeTarget({ date: day.date, shift: 'COMBINED', total: day.total })}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wide transition-all ${
                          isFullyDistributed
                            ? 'border-brand bg-brand text-white'
                            : 'border-brand/40 text-brand hover:bg-brand hover:text-white'
                        }`}
                      >
                        <Truck size={10} /> {isFullyDistributed ? 'Update' : 'Distribute'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── DESKTOP: Full Table (hidden below md) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px] text-left">
            <thead className="bg-surface text-text3 uppercase text-[10px] font-black tracking-[0.15em] border-b border-border-custom">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-amber-600">Morning (L)</th>
                <th className="px-5 py-3 text-indigo-600">Evening (L)</th>
                <th className="px-5 py-3 text-brand">Total (L)</th>
                <th className="px-5 py-3 text-brand-dark">Distributed (L)</th>
                <th className="px-5 py-3">Cows</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-text3 text-[13px] italic">
                    Loading production logs…
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Droplets size={40} className="mx-auto text-border-custom mb-3" />
                    <p className="text-text3 text-[13px] font-medium">No milk records logged yet.</p>
                    <p className="text-text3 text-[11px] mt-1">Click "+ Log Yield" to start recording.</p>
                  </td>
                </tr>
              ) : (
                paged.map((day) => {
                  const isFullyDistributed = day.distributed >= day.total && day.total > 0;
                  return (
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
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isFullyDistributed ? 'text-brand' : 'text-amber-600'}`}>
                            {fmt(day.distributed)} L
                          </span>
                          {isFullyDistributed ? (
                            <CheckCircle2 size={14} className="text-brand" />
                          ) : day.distributed > 0 ? (
                            <AlertCircle size={14} className="text-amber-500" />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-text3 font-medium">{day.cowCount} cows</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-center">
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const target = new Date(day.date);
                            target.setHours(0, 0, 0, 0);
                            const diff = (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24);
                            return diff <= 1 && (
                              <button
                                onClick={() => { setEditTarget({ date: day.date }); setShowModal(true); }}
                                title="Edit yield entry"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border-custom text-text3 hover:border-brand hover:text-brand text-[10px] font-black uppercase tracking-wider transition-all"
                              >
                                <Pencil size={11} /> Edit
                              </button>
                            );
                          })()}
                          {/* Distribute */}
                          <button
                            onClick={() => setDistributeTarget({ date: day.date, shift: 'COMBINED', total: day.total })}
                            title="Distribute milk to customers"
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${
                              isFullyDistributed 
                                ? 'border-brand bg-brand text-white hover:bg-brand-dark' 
                                : 'border-brand/40 text-brand hover:bg-brand hover:text-white'
                            }`}
                          >
                            <Truck size={11} /> {isFullyDistributed ? 'Update Dist.' : 'Distribute'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
          editDate={editTarget?.date}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          onSave={fetchAll}
        />
      )}

      {/* ── Distribute Modal ── */}
      {distributeTarget && (
        <DistributeModal
          date={distributeTarget.date}
          shift={distributeTarget.shift}
          totalProduced={distributeTarget.total}
          onClose={() => setDistributeTarget(null)}
          onSave={fetchAll}
        />
      )}
    </AppLayout>
  );
}

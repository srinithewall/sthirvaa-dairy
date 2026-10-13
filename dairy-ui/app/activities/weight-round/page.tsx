"use client";

import React, { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { ArrowLeft, Check, RefreshCw, Play, X, TrendingDown, TrendingUp, Minus, Clock } from "lucide-react";
import WeightUpdateModal, { AnimalWeightTarget } from "@/components/WeightUpdateModal";

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function WeightRoundInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = searchParams.get("logId");

  const [rows, setRows] = useState<AnimalWeightTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [task, setTask] = useState<any | null>(null);
  
  const [wizardAnimals, setWizardAnimals] = useState<AnimalWeightTarget[]>([]);
  const [historyModalOpen, setHistoryModalOpen] = useState<number | null>(null);
  const [historyByHerd, setHistoryByHerd] = useState<Record<number, any[]>>({});

  const roundDate = localDate(new Date());

  const loadRound = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/herds/weight/round?date=${roundDate}`);
      setRows(res.data || []);
    } catch (err) {
      setError("Could not load the herd list.");
    } finally {
      setLoading(false);
    }
  }, [roundDate]);

  useEffect(() => { loadRound(); }, [loadRound]);

  useEffect(() => {
    if (!logId) return;
    api.get(`/activities/logs/${logId}`).then(res => setTask(res.data)).catch(() => {});
  }, [logId]);

  const toggleHistory = async (herdId: number) => {
    setHistoryModalOpen(herdId);
    if (historyByHerd[herdId]) return;
    try {
      const res = await api.get(`/herds/${herdId}/weight`);
      setHistoryByHerd(prev => ({ ...prev, [herdId]: res.data || [] }));
    } catch (err) {
      setHistoryByHerd(prev => ({ ...prev, [herdId]: [] }));
    }
  };

  const measuredCount = rows.filter((r: any) => r.measuredInRound).length;
  const alreadyDone = task?.status === "COMPLETED";

  const handleStartAll = () => {
    setWizardAnimals(rows.filter((r: any) => !r.measuredInRound));
  };

  const handleStartSingle = (row: AnimalWeightTarget) => {
    setWizardAnimals([row]);
  };

  const handleWizardClose = () => {
    setWizardAnimals([]);
    loadRound();
  };

  const handleMarkDone = async () => {
    if (!logId) return;
    const remaining = rows.length - measuredCount;
    const question = remaining > 0
      ? `${remaining} animal(s) are still unmeasured. Close the chore anyway? Reminders will stop for today.`
      : "Mark the weight round as done? Reminders will stop for today.";
    if (!confirm(question)) return;
    try {
      await api.patch(`/activities/logs/${logId}/status`, { status: "COMPLETED" });
      router.push("/activities");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not update the task.");
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col max-w-2xl mx-auto pb-28">
        <button onClick={() => router.push("/activities")} className="flex items-center gap-1 text-text3 hover:text-text text-sm mb-3">
          <ArrowLeft size={16} /> Back to chores
        </button>

        <h1 className="text-2xl font-bold text-text">Herd weight round</h1>
        <p className="text-sm text-text3 mt-1">
          {roundDate} &middot; {measuredCount} of {rows.length} animals measured
        </p>

        {rows.length > 0 && (
          <div className="mt-3 h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden relative">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round((measuredCount / rows.length) * 100)}%` }} />
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center p-8 text-text3"><RefreshCw className="animate-spin w-5 h-5 mr-2" /> Loading herd...</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 text-center p-8 bg-surface border border-border rounded-radius-custom text-text3 text-sm">No active animals to weigh.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((row: any) => (
              <div key={row.herdId} className={`bg-white p-3 rounded-xl border flex items-center justify-between shadow-sm transition-colors ${row.measuredInRound ? 'border-green-200 bg-green-50/30' : 'border-border'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-lg font-black">
                    {(row.animalName || row.tagNumber || "#")[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      {row.animalName || row.tagNumber || `#${row.herdId}`}
                      {row.measuredInRound && <Check size={14} className="text-green-600 bg-green-100 rounded-full p-0.5" />}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                      {[row.tagNumber, row.breed, row.animalStatus].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <span className="opacity-70">Last:</span>
                      <span className="font-bold text-slate-700">{row.lastWeightKg ? `${row.lastWeightKg.toFixed(1)} kg` : "--"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => toggleHistory(row.herdId)} className="p-2 text-slate-400 hover:text-brand bg-slate-50 hover:bg-brand/10 rounded-lg transition-colors" title="Weight History">
                     <Clock size={16} />
                   </button>
                   {!row.measuredInRound && (
                     <button onClick={() => handleStartSingle(row)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors">
                       Weigh
                     </button>
                   )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-3 flex gap-2 justify-center z-40">
        <div className="w-full max-w-2xl flex gap-2">
          <button
            onClick={handleStartAll}
            disabled={measuredCount === rows.length}
            className="flex-[2] inline-flex items-center justify-center gap-2 bg-brand text-white text-sm font-bold rounded-xl py-3 hover:bg-brand-dark disabled:opacity-50"
          >
            <Play size={18} /> {measuredCount === rows.length ? "All Done!" : `Start Measuring (${rows.length - measuredCount})`}
          </button>
          {logId && !alreadyDone && (
            <button onClick={handleMarkDone} className="flex-1 inline-flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 text-sm font-bold rounded-xl py-3 hover:bg-slate-50">
              <Check size={18} /> Close Chore
            </button>
          )}
        </div>
      </div>

      <WeightUpdateModal
        isOpen={wizardAnimals.length > 0}
        onClose={handleWizardClose}
        animals={wizardAnimals}
        onComplete={handleWizardClose}
        logId={logId}
      />

      {historyModalOpen !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => setHistoryModalOpen(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between bg-slate-50">
              <h2 className="font-bold text-slate-800 text-[15px]">Weight History</h2>
              <button onClick={() => setHistoryModalOpen(null)} className="text-slate-400 hover:text-slate-800"><X size={20} /></button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {(() => {
                const history = historyByHerd[historyModalOpen];
                if (!history) return <div className="text-center text-sm text-slate-500 py-4"><RefreshCw className="animate-spin w-4 h-4 mx-auto mb-2" /> Loading...</div>;
                if (history.length === 0) return <div className="text-center text-sm text-slate-500 py-4">No readings recorded yet.</div>;
                return (
                  <div className="space-y-3">
                    {history.map((h: any) => {
                      const change = h.weightChangeKg ?? 0;
                      return (
                         <div key={h.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                           <span className="text-slate-500 font-medium">{new Date(h.recordDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                           <span className="font-bold text-slate-800">{h.weightKg != null ? `${h.weightKg.toFixed(1)} kg` : "--"}</span>
                           <span className={`inline-flex items-center gap-1 font-bold text-xs ${change > 0 ? "text-emerald-600" : change < 0 ? "text-red-500" : "text-slate-400"}`}>
                             {change > 0 ? <TrendingUp size={14} /> : change < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                             {change === 0 ? "--" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`}
                           </span>
                         </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function WeightRoundPage() {
  return (
    <Suspense fallback={null}>
      <WeightRoundInner />
    </Suspense>
  );
}

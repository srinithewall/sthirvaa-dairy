"use client";

import React, { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, RefreshCw, Save, TrendingDown, TrendingUp, Minus,
} from "lucide-react";

interface RoundRow {
  herdId: number;
  tagNumber?: string;
  animalName?: string;
  animalType?: string;
  breed?: string;
  animalStatus?: string;
  lastWeightKg?: number | null;
  lastRecordDate?: string | null;
  lastHeartGirthCm?: number | null;
  lastBodyLengthCm?: number | null;
  daysSinceLastRecord?: number | null;
  measuredInRound?: boolean;
}

interface Entry {
  girth: string;
  length: string;
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function WeightRoundInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = searchParams.get("logId");

  const [rows, setRows] = useState<RoundRow[]>([]);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [task, setTask] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [historyByHerd, setHistoryByHerd] = useState<Record<number, any[]>>({});

  const roundDate = localDate(new Date());

  const loadRound = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/herds/weight/round?date=${roundDate}`);
      setRows(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Could not load the herd list.");
    } finally {
      setLoading(false);
    }
  }, [roundDate]);

  useEffect(() => {
    loadRound();
  }, [loadRound]);

  useEffect(() => {
    if (!logId) return;
    api.get(`/activities/logs/${logId}`)
      .then(res => setTask(res.data))
      .catch(() => {});
  }, [logId]);

  const setEntry = (herdId: number, field: keyof Entry, value: string) => {
    setEntries(prev => {
      const current = prev[herdId] || { girth: "", length: "" };
      return { ...prev, [herdId]: { ...current, [field]: value } };
    });
  };

  const toggleHistory = async (herdId: number) => {
    if (expanded === herdId) {
      setExpanded(null);
      return;
    }
    setExpanded(herdId);
    if (historyByHerd[herdId]) return;
    try {
      const res = await api.get(`/herds/${herdId}/weight`);
      setHistoryByHerd(prev => ({ ...prev, [herdId]: res.data || [] }));
    } catch (err) {
      setHistoryByHerd(prev => ({ ...prev, [herdId]: [] }));
    }
  };

  const filledEntries = Object.entries(entries).filter(([, e]) => e.girth && parseFloat(e.girth) > 0);
  const measuredCount = rows.filter(r => r.measuredInRound).length;
  const alreadyDone = task?.status === "COMPLETED";

  const handleSave = async () => {
    if (filledEntries.length === 0) {
      setError("Enter a girth for at least one animal.");
      return;
    }
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const payload = filledEntries.map(([herdId, e]) => ({
        herdId: parseInt(herdId, 10),
        recordDate: roundDate,
        measurementMethod: "HEART_GIRTH_TAPE",
        heartGirthCm: parseFloat(e.girth),
        bodyLengthCm: e.length ? parseFloat(e.length) : null,
      }));
      const query = logId ? `?logId=${logId}&date=${roundDate}` : `?date=${roundDate}`;
      const res = await api.post(`/herds/weight/bulk${query}`, payload);
      const result = res.data || {};
      setEntries({});
      setHistoryByHerd({});

      if (result.taskCompleted) {
        setMessage(`All ${result.totalCount} animals measured. The chore is done - reminders have stopped.`);
        setTask((prev: any) => (prev ? { ...prev, status: "COMPLETED" } : prev));
      } else {
        setMessage(`Saved ${(result.saved || []).length} readings. ${result.measuredCount} of ${result.totalCount} animals measured.`);
      }
      await loadRound();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not save the readings.");
    } finally {
      setSaving(false);
    }
  };

  // The round closes itself once every animal is measured. This is the way out when one
  // cannot be measured at all - a sick or absent animal should not nag staff all day.
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
        <button
          onClick={() => router.push("/activities")}
          className="flex items-center gap-1 text-text3 hover:text-text text-sm mb-3"
        >
          <ArrowLeft size={16} /> Back to chores
        </button>

        <h1 className="text-2xl font-bold text-text">Herd weight round</h1>
        <p className="text-sm text-text3 mt-1">
          {roundDate} &middot; {measuredCount} of {rows.length} animals measured
        </p>

        {rows.length > 0 && (
          <div className="mt-3 h-2 bg-surface border border-border rounded-full overflow-hidden">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${Math.round((measuredCount / rows.length) * 100)}%` }}
            />
          </div>
        )}

        {message && (
          <div className="mt-4 text-sm text-green-800 bg-surface-green border border-border-green rounded-md p-3">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-8 text-text3">
            <RefreshCw className="animate-spin w-5 h-5 mr-2" /> Loading herd...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 text-center p-8 bg-surface border border-border rounded-radius-custom text-text3 text-sm">
            No active animals to weigh.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map(row => {
              const entry = entries[row.herdId] || { girth: "", length: "" };
              const history = historyByHerd[row.herdId];
              const isOpen = expanded === row.herdId;
              return (
                <div
                  key={row.herdId}
                  className={`bg-white rounded-radius-custom border shadow-sm ${
                    row.measuredInRound ? "border-border-green" : "border-border"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-text text-[15px] flex items-center gap-2">
                          {row.animalName || row.tagNumber || `#${row.herdId}`}
                          {row.measuredInRound && (
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-green-50 text-green-700">
                              <Check size={10} /> Done
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-text3 mt-0.5">
                          {[row.tagNumber, row.breed, row.animalStatus].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-text">
                          {row.lastWeightKg != null ? `${row.lastWeightKg.toFixed(1)} kg` : "--"}
                        </p>
                        <p className="text-[11px] text-text3">
                          {row.daysSinceLastRecord != null
                            ? row.daysSinceLastRecord === 0
                              ? "today"
                              : `${row.daysSinceLastRecord}d ago`
                            : "never weighed"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="block text-[11px] font-medium text-text3 mb-1">Heart girth (cm)</label>
                        <input
                          type="number" inputMode="decimal" step="0.1" value={entry.girth}
                          onChange={e => setEntry(row.herdId, "girth", e.target.value)}
                          placeholder={row.lastHeartGirthCm ? String(row.lastHeartGirthCm) : ""}
                          className="w-full border border-border rounded-md p-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-text3 mb-1">Body length (cm, optional)</label>
                        <input
                          type="number" inputMode="decimal" step="0.1" value={entry.length}
                          onChange={e => setEntry(row.herdId, "length", e.target.value)}
                          placeholder={row.lastBodyLengthCm ? String(row.lastBodyLengthCm) : ""}
                          className="w-full border border-border rounded-md p-2 text-sm"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => toggleHistory(row.herdId)}
                      className="mt-3 text-xs font-medium text-brand flex items-center gap-1 hover:underline"
                    >
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isOpen ? "Hide history" : "View history"}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border bg-surface px-4 py-3">
                      {!history ? (
                        <div className="flex items-center text-xs text-text3">
                          <RefreshCw className="animate-spin w-3 h-3 mr-2" /> Loading...
                        </div>
                      ) : history.length === 0 ? (
                        <p className="text-xs text-text3">No readings recorded yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {history.slice(0, 8).map((h: any) => {
                            const change = h.weightChangeKg ?? 0;
                            return (
                              <div key={h.id} className="flex items-center justify-between text-xs">
                                <span className="text-text3">{h.recordDate}</span>
                                <span className="font-medium text-text">
                                  {h.weightKg != null ? `${h.weightKg.toFixed(1)} kg` : "--"}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 font-medium ${
                                    change > 0 ? "text-green-700" : change < 0 ? "text-red-600" : "text-text3"
                                  }`}
                                >
                                  {change > 0 ? <TrendingUp size={12} /> : change < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                                  {change === 0 ? "--" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-3 flex gap-2 justify-center z-40">
        <div className="w-full max-w-2xl flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || filledEntries.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-brand text-white text-sm font-medium rounded-md py-2.5 hover:bg-brand-dark disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : `Save ${filledEntries.length || ""} reading${filledEntries.length === 1 ? "" : "s"}`}
          </button>
          {logId && !alreadyDone && (
            <button
              onClick={handleMarkDone}
              className="flex-1 inline-flex items-center justify-center gap-2 border border-brand text-brand text-sm font-medium rounded-md py-2.5 hover:bg-brand/5"
            >
              <Check size={16} /> Close without the rest
            </button>
          )}
          {alreadyDone && (
            <span className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-medium text-green-700">
              <Check size={16} /> Chore completed
            </span>
          )}
        </div>
      </div>
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

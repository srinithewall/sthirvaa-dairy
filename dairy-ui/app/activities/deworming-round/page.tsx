"use client";

import React, { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { ArrowLeft, Baby, Check, Droplets, Heart, Leaf, RefreshCw } from "lucide-react";

interface DewormingRow {
  herdId: number;
  tagNumber?: string;
  animalName?: string;
  animalType?: string;
  breed?: string;
  animalStatus?: string;
  age?: string;
  lastDewormedDate?: string | null;
  nextDueDate: string;
  dose: number;
  daysOverdue: number;
  due: boolean;
  dewormedInRound: boolean;
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmt = (iso?: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never";

// Status as a small symbol (full name on hover) so rows stay short on a phone.
function StatusIcon({ status }: { status?: string }) {
  const key = (status || "").toUpperCase();
  const map: Record<string, { Icon: React.ElementType; cls: string; label: string }> = {
    LACTATING: { Icon: Droplets, cls: "text-blue-600", label: "Lactating" },
    DRY: { Icon: Leaf, cls: "text-amber-600", label: "Dry" },
    CALF: { Icon: Baby, cls: "text-green-600", label: "Calf" },
    HEIFER: { Icon: Baby, cls: "text-teal-600", label: "Heifer" },
    PREGNANT: { Icon: Heart, cls: "text-pink-600", label: "Pregnant" },
  };
  const m = map[key];
  if (!m) return status ? <span>{status}</span> : null;
  return <span title={m.label} aria-label={m.label} className={`inline-flex items-center ${m.cls}`}><m.Icon size={13} /></span>;
}

function duePill(row: DewormingRow) {
  const label = row.dose > 0 ? `Dose ${row.dose}` : "Routine";
  if (row.dewormedInRound) return { text: "Done today", cls: "bg-green-100 text-green-700" };
  if (row.daysOverdue > 0) return { text: `${label} overdue ${row.daysOverdue}d`, cls: "bg-red-100 text-red-700" };
  if (row.daysOverdue === 0) return { text: `${label} due today`, cls: "bg-amber-100 text-amber-700" };
  return { text: `${label} in ${-row.daysOverdue}d`, cls: "bg-slate-100 text-slate-600" };
}

function DewormingRoundInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = searchParams.get("logId");
  const today = localDate(new Date());

  const [rows, setRows] = useState<DewormingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  // herdId -> date; present means the animal is ticked
  const [ticked, setTicked] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/herds/deworming/round");
      setRows(res.data || []);
    } catch {
      setError("Could not load the herd list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: number) =>
    setTicked(prev => {
      const next = { ...prev };
      if (id in next) delete next[id]; else next[id] = today;
      return next;
    });

  const handleSave = async () => {
    const entries = Object.entries(ticked).map(([id, date]) => ({ herdId: Number(id), date }));
    if (entries.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.post(`/herds/deworming/bulk${logId ? `?logId=${logId}` : ""}`, entries);
      setTicked({});
      await load();
      if (res.data?.taskCompleted) router.push("/activities");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not save the deworming records.");
    } finally {
      setSaving(false);
    }
  };

  const worklist = rows.filter(r => r.due || r.dewormedInRound);
  const visible = showAll ? rows : worklist;
  const doneCount = rows.filter(r => r.dewormedInRound).length;
  const totalCount = worklist.length;
  const tickedCount = Object.keys(ticked).length;

  return (
    <AppLayout>
      <div className="flex flex-col max-w-2xl mx-auto">
        <button onClick={() => router.push("/activities")} className="flex items-center gap-1 text-text3 hover:text-text text-sm mb-3">
          <ArrowLeft size={16} /> Back to chores
        </button>

        <h1 className="text-2xl font-bold text-text">Herd deworming</h1>
        <p className="text-sm text-text3 mt-1">
          {fmt(today)} &middot; {doneCount} of {totalCount} animals done today
        </p>

        {totalCount > 0 && (
          <div className="mt-3 h-2.5 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }} />
          </div>
        )}

        <label className="mt-3 flex items-center gap-2 text-xs text-text3 cursor-pointer select-none">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Show all animals, including those not due yet
        </label>

        {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center p-8 text-text3"><RefreshCw className="animate-spin w-5 h-5 mr-2" /> Loading herd...</div>
        ) : visible.length === 0 ? (
          <div className="mt-6 text-center p-8 bg-surface border border-border rounded-radius-custom text-text3 text-sm">
            No animal is due for deworming.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {visible.map(row => {
              const pill = duePill(row);
              const isTicked = row.herdId in ticked;
              return (
                <div key={row.herdId} className={`bg-white p-3 rounded-xl border shadow-sm transition-colors ${row.dewormedInRound ? "border-green-200 bg-green-50/30" : "border-border"}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {row.dewormedInRound ? (
                      <Check size={22} className="flex-none text-green-600 bg-green-100 rounded-md p-0.5" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isTicked}
                        onChange={() => toggle(row.herdId)}
                        aria-label={`${row.animalName || row.tagNumber} dewormed`}
                        className="w-[22px] h-[22px] flex-none cursor-pointer"
                      />
                    )}
                    <div className="w-10 h-10 flex-none bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-base font-black">
                      {(row.animalName || row.tagNumber || "#")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                        <span>{row.animalName || row.tagNumber || `#${row.herdId}`}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${pill.cls}`}>{pill.text}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center flex-wrap gap-x-1.5 leading-4">
                        <StatusIcon status={row.animalStatus} />
                        {row.age && row.age !== "N/A" && <span>{row.age}</span>}
                        <span>·</span><span>Last dewormed on <span className={row.lastDewormedDate ? "" : "text-red-600 font-bold"}>{fmt(row.lastDewormedDate)}</span></span>
                      </p>
                    </div>
                  {isTicked && (
                    <div className="flex items-center gap-2 w-full pl-[86px] sm:w-auto sm:pl-0">
                      <span className="text-[11px] text-slate-500">Dewormed on</span>
                      <input
                        type="date"
                        value={ticked[row.herdId]}
                        max={today}
                        onChange={e => setTicked(prev => ({ ...prev, [row.herdId]: e.target.value }))}
                        aria-label="Date dewormed"
                        className="text-xs border border-border rounded-lg px-2 py-1.5"
                      />
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-text3 mt-3">Tick an animal to confirm it was dewormed. The date defaults to today; change it if it was done earlier.</p>

        {/* Sticks to the bottom of the content column, so it lines up with the cards. */}
        <div className="sticky bottom-0 z-30 mt-4 -mx-1 px-1 pb-3 pt-2 bg-gradient-to-t from-[#F0F4F1] via-[#F0F4F1] to-transparent">
          <button
            onClick={handleSave}
            disabled={tickedCount === 0 || saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand text-white text-sm font-bold rounded-xl py-3 hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
            {tickedCount > 0 ? `Save ticked (${tickedCount})` : "Save ticked"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

export default function DewormingRoundPage() {
  return (
    <Suspense fallback={null}>
      <DewormingRoundInner />
    </Suspense>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import api, { formatImageUrl } from "@/lib/api";
import { ArrowLeft, Bug, ChevronRight, Microscope, RefreshCw, ShieldCheck, Syringe } from "lucide-react";

interface ReminderRow {
  eventId: number;
  herdId: number;
  tagNumber?: string;
  animalName?: string;
  animalStatus?: string;
  imageUrl?: string | null;
  eventType: string;
  title?: string;
  dueDate: string;
  daysOverdue: number;
}

// One icon and colour per reminder type; the name shows on hover.
const TYPE: Record<string, { Icon: React.ElementType; cls: string; label: string }> = {
  VACCINATION_DUE: { Icon: ShieldCheck, cls: "bg-teal-50 text-teal-700 border-teal-200", label: "Vaccination" },
  DEWORMING_DUE: { Icon: Bug, cls: "bg-orange-50 text-orange-700 border-orange-200", label: "Deworming" },
  PREGNANCY_CHECK_DUE: { Icon: Microscope, cls: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "PD check" },
  AI_DUE: { Icon: Syringe, cls: "bg-violet-50 text-violet-700 border-violet-200", label: "AI" },
};

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function AnimalRemindersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ReminderRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/herds/reminders/due")
      .then(res => setRows(res.data || []))
      .catch(() => { setRows([]); setError("Could not load the reminders."); });
  }, []);

  const counts = Object.keys(TYPE).map(k => ({ k, n: (rows ?? []).filter(r => r.eventType === k).length })).filter(c => c.n > 0);

  return (
    <AppLayout>
      <div className="flex flex-col max-w-2xl mx-auto">
        <button onClick={() => router.push("/activities")} className="flex items-center gap-1 text-text3 hover:text-text text-sm mb-3">
          <ArrowLeft size={16} /> Back to chores
        </button>

        <h1 className="text-2xl font-bold text-text">Animal health reminders</h1>
        {counts.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {counts.map(({ k, n }) => {
              const t = TYPE[k];
              return (
                <span key={k} title={t.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${t.cls}`}>
                  <t.Icon size={14} /> {n}
                </span>
              );
            })}
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>}

        {rows === null ? (
          <div className="flex items-center justify-center p-8 text-text3"><RefreshCw className="animate-spin w-5 h-5 mr-2" /> Loading...</div>
        ) : rows.length === 0 ? (
          <div className="mt-6 text-center p-8 bg-surface border border-border rounded-radius-custom text-text3 text-sm">
            ✓ Nothing due
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map(r => {
              const t = TYPE[r.eventType] ?? TYPE.VACCINATION_DUE;
              const img = r.imageUrl ? formatImageUrl(r.imageUrl) : null;
              const pill = r.daysOverdue > 0
                ? { text: `${r.daysOverdue}d overdue`, cls: "bg-red-100 text-red-700" }
                : { text: "Today", cls: "bg-amber-100 text-amber-700" };
              return (
                <button key={r.eventId} onClick={() => router.push(`/herds?herdId=${r.herdId}&tab=health`)}
                  className="w-full flex items-center gap-3 bg-white p-3 rounded-xl border border-border shadow-sm hover:border-brand/40 text-left">
                  {img ? (
                    <img src={img} alt="" className="w-10 h-10 flex-none rounded-lg object-cover border border-slate-200" />
                  ) : (
                    <div className="w-10 h-10 flex-none bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-base font-black">
                      {(r.animalName || r.tagNumber || "#").trim()[0]?.toUpperCase()}
                    </div>
                  )}
                  <span title={t.label} aria-label={t.label} className={`w-9 h-9 flex-none rounded-lg border flex items-center justify-center ${t.cls}`}>
                    <t.Icon size={17} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-text truncate">{r.animalName?.trim() || r.tagNumber}</div>
                    <div className="text-[11px] text-text3 truncate">{r.title || t.label} · {fmt(r.dueDate)}</div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md whitespace-nowrap ${pill.cls}`}>{pill.text}</span>
                  <ChevronRight size={16} className="text-text3 flex-none" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

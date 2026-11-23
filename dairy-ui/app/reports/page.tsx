
"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import HerdWeightOverview, { nameOf, type Row } from "@/components/HerdWeightOverview";
import HerdWeightHistory from "@/components/HerdWeightHistory";

function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The EMP milk forecast moved to Efficiency; old links still land on it.
  useEffect(() => {
    if (searchParams.get("type") === "emp") router.replace("/efficiency?tab=emp");
  }, [searchParams, router]);

  // Animals come from the weight overview (same order as its chart); ?herd= opens one directly.
  const [animals, setAnimals] = useState<Row[]>([]);
  const [selected, setSelected] = useState<number | null>(() => {
    const id = Number(searchParams.get("herd"));
    return Number.isFinite(id) && id > 0 ? id : null;
  });
  const historyRef = useRef<HTMLDivElement>(null);

  const onRows = (rows: Row[]) => {
    setAnimals(rows);
    setSelected(cur => cur ?? (rows.find(r => r.currentWeightKg != null) ?? rows[0])?.herdId ?? null);
    // Opened from an animal (e.g. the weight round): go straight to her history.
    if (searchParams.get("focus") === "history") {
      setTimeout(() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    }
  };

  const pick = (herdId: number, scroll: boolean) => {
    setSelected(herdId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("herd", String(herdId));
    router.replace(`/reports?${params.toString()}`, { scroll: false });
    if (scroll) historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Analytics & Reports</h1>
            <p className="text-sm text-slate-500">Correlate animal health metrics with farm productivity.</p>
          </div>
        </div>

        <HerdWeightOverview selectedId={selected} onSelect={id => pick(id, true)} onRows={onRows} />

        <div ref={historyRef} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 scroll-mt-4">
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div>
              <h2 className="font-bold text-slate-700">Weight History &amp; Milk</h2>
            </div>
            <select
              value={selected ?? ""}
              onChange={(e) => pick(Number(e.target.value), false)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50"
            >
              {animals.map((a) => (
                <option key={a.herdId} value={a.herdId}>
                  {nameOf(a)}{a.animalName && a.tagNumber && a.tagNumber !== a.animalName ? ` (${a.tagNumber})` : ""}{a.currentWeightKg == null ? " - not weighed" : ""}
                </option>
              ))}
            </select>
          </div>

          {selected != null ? (
            <HerdWeightHistory herdId={selected} />
          ) : (
            <div className="h-40 flex items-center justify-center text-slate-400">No animals to show.</div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function ReportsPageWithSuspense() {
  return (
    <Suspense fallback={<div>Loading Reports...</div>}>
      <ReportsPage />
    </Suspense>
  );
}


"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import api from "@/lib/api";
import { BCS_LEVELS } from "@/components/BcsPicker";

ChartJS.register(BarController, LineController, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

/** One animal from GET /reports/herd-weights (HerdWeightOverviewRow). */
type Row = {
  herdId: number;
  tagNumber: string | null;
  animalName: string | null;
  breed: string | null;
  animalStatus: string | null;
  ageMonths: number | null;
  /** days in milk since her last calving; null if she has not calved */
  dim: number | null;
  currentWeightKg: number | null;
  weightDate: string | null;
  weightMethod: string | null;
  targetWeightKg: number | null;
  /** target - current: positive = kg still missing, negative = above target */
  gapKg: number | null;
  targetBasis: string | null;
  /** breed/age figure, and her own weight brought to BCS 3 (null without weight + BCS) */
  breedTargetKg: number | null;
  frameTargetKg: number | null;
  pregnancyKg: number | null;
  daysPregnant: number | null;
  verdict: "SHORT" | "HEALTHY" | "AHEAD" | "OVER_CONDITIONED" | null;
  bcs: number | null;
  bcsDate: string | null;
  bcsLabel: string | null;
};

// Validated pair (dataviz validate_palette: light, all checks pass) + chart ink.
const CURRENT = "#2a78d6";
const MISSING = "#e34948";
/** Weight above target - green for "good"; validated with blue and red (labels carry it for colour-blind readers). */
const ABOVE = "#008300";
const INK = "#0b0b0b";
const INK_2 = "#52514e";
const GRID = "#ececea";
/** Same y-axis width on both charts so the BCS dots sit under their weight bars. */
const Y_AXIS_WIDTH = 78;
const fixedWidth = (scale: any) => { scale.width = Y_AXIS_WIDTH; };

/** Writes "−kg" still missing over underweight animals and "+kg" above target over the rest, so it reads without hovering. */
const targetLabels = {
  id: "targetLabels",
  afterDatasetsDraw(chart: any) {
    const index = chart.data.datasets.findIndex((d: any) => d.label === "Minimum healthy weight");
    const missing = chart.data.datasets.find((d: any) => d.label === "Still to gain")?.data ?? [];
    const aboveIndex = chart.data.datasets.findIndex((d: any) => d.label === "Above target");
    const above = aboveIndex >= 0 ? chart.data.datasets[aboveIndex].data : [];
    if (index < 0 || !chart.isDatasetVisible(index)) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = "600 11px sans-serif";
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    // White halo keeps the number readable where the mark sits inside a bar.
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
    const aboveBars = aboveIndex >= 0 ? chart.getDatasetMeta(aboveIndex).data : [];
    chart.getDatasetMeta(index).data.forEach((point: any, i: number) => {
      const short = Math.round(missing[i] ?? 0);
      const extra = Math.round(above[i] ?? 0);
      let text = "";
      let y = point.y;
      if (short > 0) text = `−${short} kg`;                                  // above the target mark
      else if (extra > 0) { text = `+${extra} kg`; y = aboveBars[i]?.y ?? y; } // above the green top
      if (!text) return;
      ctx.strokeText(text, point.x, y - 5);
      ctx.fillText(text, point.x, y - 5);
    });
    ctx.restore();
  },
};

const METHOD: Record<string, string> = { SCALE: "Scale", HEART_GIRTH_TAPE: "Tape", GIRTH_ESTIMATE: "Girth est." };

const kg = (n: number) => `${Math.round(n).toLocaleString("en-IN")} kg`;
const day = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
const nameOf = (r: Row) => r.animalName || r.tagNumber || `#${r.herdId}`;
const age = (m: number | null) => (m == null ? "" : m < 24 ? `${m} mo` : `${Math.floor(m / 12)} y ${m % 12} mo`);

function bcsStyle(bcs: number | null) {
  if (bcs == null) return null;
  return BCS_LEVELS.find(l => l.score === bcs) ?? null;
}

/** Being above the minimum is not overweight: grown cows have a healthy range, young stock no ceiling. BCS shows fat. */
function verdictText(r: Row): { head: string; sub: string; tone: "short" | "ok" | "warn" } | null {
  if (r.verdict == null || r.gapKg == null) return null;
  const g = Math.round(r.gapKg);
  switch (r.verdict) {
    case "SHORT": return { head: `▼ ${kg(g)}`, sub: "short", tone: "short" };
    case "HEALTHY": return { head: "✓ Healthy", sub: g < 0 ? `+${kg(-g)} above target` : "", tone: "ok" };
    case "AHEAD": return { head: "✓ On track", sub: g < 0 ? `${kg(-g)} ahead of growth curve` : "", tone: "ok" };
    case "OVER_CONDITIONED": return { head: "▲ Over-conditioned", sub: `BCS ${r.bcs}`, tone: "warn" };
  }
}

function Gap({ r }: { r: Row }) {
  const v = verdictText(r);
  if (!v) return <span className="text-slate-400">—</span>;
  const color = v.tone === "short" ? "text-red-700 font-bold" : v.tone === "warn" ? "text-amber-700 font-bold" : "text-green-700 font-semibold";
  return (<><div className={color}>{v.head}</div>{v.sub && <div className="text-[11px] text-slate-500">{v.sub}</div>}</>);
}

/**
 * Kg above her healthy weight - grown cows only. A heifer over the growth curve is big for her age,
 * not well covered (BCS shows that), so her lead is a table note, never green on the chart.
 */
const aboveKg = (r: Row) =>
  r.verdict === "AHEAD" || r.currentWeightKg == null || r.targetWeightKg == null
    ? 0 : Math.max(0, Math.round(r.currentWeightKg - r.targetWeightKg));

/** The frame figure drives the target when her own weight at BCS 3 beats the breed/age minimum. */
const byFrame = (r: Row) => !!r.targetBasis?.startsWith("Her frame");
const range = (r: Row) => kg(r.targetWeightKg!);

export default function HerdWeightOverview() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/reports/herd-weights")
      .then(res => setRows(res.data))
      .catch(() => setError("Could not load herd weights."));
  }, []);

  // Chart only the animals that have both a weight and a target; the table lists everyone.
  const charted = useMemo(
    () => (rows ?? []).filter(r => r.currentWeightKg != null && r.targetWeightKg != null),
    [rows],
  );

  const stats = useMemo(() => {
    const list = rows ?? [];
    const short = list.filter(r => (r.gapKg ?? 0) > 0);
    return {
      weighed: list.filter(r => r.currentWeightKg != null).length,
      total: list.length,
      shortCount: short.length,
      shortKg: short.reduce((s, r) => s + Math.round(r.gapKg ?? 0), 0),
      aboveCount: list.filter(r => aboveKg(r) > 0).length,
      lowBcs: list.filter(r => r.bcs != null && r.bcs < 3).length,
      scored: list.filter(r => r.bcs != null).length,
    };
  }, [rows]);

  const labels = charted.map(nameOf);

  const weightData = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Weight up to target",
        data: charted.map(r => (r.verdict === "AHEAD" ? r.currentWeightKg! : Math.min(r.currentWeightKg!, r.targetWeightKg!))),
        backgroundColor: CURRENT,
        stack: "w",
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        borderColor: "#ffffff",
        borderWidth: { top: 2, left: 0, right: 0, bottom: 0 },
        maxBarThickness: 36,
        order: 2,
      },
      {
        type: "bar" as const,
        label: "Above target",
        data: charted.map(r => aboveKg(r)),
        backgroundColor: ABOVE,
        stack: "w",
        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        maxBarThickness: 36,
        order: 2,
      },
      {
        type: "bar" as const,
        label: "Still to gain",
        data: charted.map(r => Math.max(0, Math.round(r.gapKg ?? 0))),
        backgroundColor: MISSING,
        stack: "w",
        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        maxBarThickness: 36,
        order: 2,
      },
      {
        type: "line" as const,
        label: "Minimum healthy weight",
        data: charted.map(r => r.targetWeightKg),
        stack: "target",
        showLine: false,
        pointStyle: "line" as const,
        pointRadius: 16,
        pointHoverRadius: 18,
        pointBorderWidth: 3,
        borderColor: INK,
        backgroundColor: INK,
        order: 1,
      },
    ],
  };

  const tooltipLines = (i: number) => {
    const r = charted[i];
    if (!r) return [];
    const lines = [
      `Current: ${kg(r.currentWeightKg!)}${r.weightMethod ? ` (${METHOD[r.weightMethod] ?? r.weightMethod}${r.weightDate ? `, ${day(r.weightDate)}` : ""})` : ""}`,
      `Healthy minimum: ${range(r)}`,
    ];
    const v = verdictText(r);
    if (v) lines.push(`${v.head}${v.sub ? ` ${v.sub}` : ""}`);
    if (r.bcs != null) lines.push(`BCS ${r.bcs} · ${r.bcsLabel ?? ""}`);
    if (r.targetBasis) lines.push(r.targetBasis);
    return lines;
  };

  const weightOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 6 } },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top", align: "start", labels: { color: INK_2, usePointStyle: true, boxWidth: 10, font: { size: 12 } } },
      tooltip: {
        filter: (item: any) => item.datasetIndex === 0,
        callbacks: {
          title: (items: any[]) => (items[0] ? `${items[0].label}${charted[items[0].dataIndex]?.breed ? ` · ${charted[items[0].dataIndex].breed}` : ""}` : ""),
          label: (item: any) => tooltipLines(item.dataIndex),
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: INK_2, font: { size: 11 }, autoSkip: false, maxRotation: 60 } },
      y: {
        stacked: true,
        beginAtZero: true,
        grace: "8%",
        grid: { color: GRID },
        border: { display: false },
        afterFit: fixedWidth,
        ticks: { color: INK_2, callback: (v: number) => `${v} kg` },
      },
    },
  };

  const bcsData = {
    labels,
    datasets: [
      {
        type: "line" as const,
        label: "Body condition score",
        data: charted.map(r => r.bcs),
        showLine: false,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: CURRENT,
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
    ],
  };

  const bcsOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item: any) => {
            const r = charted[item.dataIndex];
            return r?.bcs != null ? `BCS ${r.bcs} · ${r.bcsLabel ?? ""}${r.bcsDate ? ` (${day(r.bcsDate)})` : ""}` : "Not scored";
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { display: false } },
      y: {
        min: 1,
        max: 5,
        border: { display: false },
        afterFit: fixedWidth,
        grid: { color: (c: any) => (c.tick?.value === 3 ? "#9ca3af" : GRID) },
        ticks: {
          stepSize: 1,
          color: INK_2,
          font: { size: 11 },
          callback: (v: number) => ({ 1: "1 Very thin", 2: "2 Thin", 3: "3 Ideal", 4: "4 Fat", 5: "5 Very fat" } as Record<number, string>)[v] ?? v,
        },
      },
    },
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
      <div>
        <h2 className="font-bold text-slate-700">Herd Weight &amp; Body Condition</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Each animal&apos;s latest weight against the weight it should be at for its breed and age, with its latest BCS.
        </p>
      </div>

      {error ? (
        <div className="h-40 flex items-center justify-center text-red-600 text-sm">{error}</div>
      ) : rows == null ? (
        <div className="h-40 flex items-center justify-center text-slate-400">Loading herd weights...</div>
      ) : rows.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-slate-400">No active animals to show.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Below target</div>
              <div className="text-xl font-bold text-slate-800 mt-1">{stats.shortCount} <span className="text-sm font-medium text-slate-500">of {stats.weighed}</span></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total still to gain</div>
              <div className="text-xl font-bold text-slate-800 mt-1">{kg(stats.shortKg)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Above target</div>
              <div className="text-xl font-bold text-slate-800 mt-1">{stats.aboveCount} <span className="text-sm font-medium text-slate-500">of {stats.weighed}</span></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">BCS below 3</div>
              <div className="text-xl font-bold text-slate-800 mt-1">{stats.lowBcs} <span className="text-sm font-medium text-slate-500">of {stats.scored} scored</span></div>
            </div>
          </div>

          {charted.length > 0 && (
            <div>
              <div className="h-80">
                <Bar data={weightData as any} options={weightOptions} plugins={[targetLabels]} />
              </div>
              <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Body condition score (1–5, ideal 3)</div>
              <div className="h-36">
                <Bar data={bcsData as any} options={bcsOptions} />
              </div>
            </div>
          )}

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="px-2 py-2 font-bold">Animal</th>
                  <th className="px-2 py-2 font-bold">BCS</th>
                  <th className="px-2 py-2 font-bold text-right">Current</th>
                  <th className="px-2 py-2 font-bold text-right">Healthy minimum</th>
                  <th className="px-2 py-2 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const s = bcsStyle(r.bcs);
                  return (
                    <tr key={r.herdId} className="border-b border-slate-100 align-top">
                      <td className="px-2 py-2">
                        <div className="font-semibold text-slate-800">{nameOf(r)}</div>
                        <div className="text-[11px] text-slate-500">{[r.breed, age(r.ageMonths), r.animalStatus?.toLowerCase(), r.dim != null ? `${r.dim} DIM` : null].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-2 py-2">
                        {r.bcs != null ? (
                          <>
                            <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-md text-xs font-bold ${s?.bg ?? "bg-slate-100"} ${s?.text ?? "text-slate-700"}`}>
                              {r.bcs} · {r.bcsLabel}
                            </span>
                            {r.bcsDate && <div className="text-[11px] text-slate-500 mt-0.5">{day(r.bcsDate)}</div>}
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">Not scored</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {r.currentWeightKg != null ? (
                          <>
                            <div className="font-semibold text-slate-800">{kg(r.currentWeightKg)}</div>
                            <div className="text-[11px] text-slate-500">
                              {[r.weightMethod ? METHOD[r.weightMethod] ?? r.weightMethod : null, day(r.weightDate)].filter(Boolean).join(", ")}
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">Not weighed</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right" title={r.targetBasis ?? undefined}>
                        {r.targetWeightKg != null ? (
                          <>
                            <div className="font-semibold text-slate-800 whitespace-nowrap">{range(r)}</div>
                            <div className="text-[11px] text-slate-500 whitespace-nowrap">
                              {byFrame(r) ? "her frame at BCS 3" : r.animalStatus && ["CALF", "HEIFER"].includes(r.animalStatus) ? "growth curve" : "breed (no BCS yet)"}
                            </div>
                            {(r.pregnancyKg ?? 0) > 0 && (
                              <div className="text-[11px] text-slate-500 whitespace-nowrap">incl. {kg(r.pregnancyKg!)} pregnancy</div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">No target</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap"><Gap r={r} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">
            <b>Grown cows:</b> her own frame - what she would weigh at BCS 3, from her latest weight and BCS (one BCS point is about
            13.7% of body weight, NRC 2001). Cows of one breed differ in height, so the breed figure is used only until she is scored.
            <b> Calves and heifers:</b> the growth curve towards the breed weight (~7% at birth, 55% at 14 months, 85% at 24 months,
            full at 3 years), raised to her frame figure if she is scored thin. Pregnancy adds the calf and fluids (NRC 2001): a few
            kg at mid-pregnancy, about 70 kg at term. Weight never marks an animal fat; only a BCS of 4 or more does. Keep BCS up to
            date - it is what carries each cow&apos;s frame. Hover a value for its basis.
          </p>
        </>
      )}
    </div>
  );
}

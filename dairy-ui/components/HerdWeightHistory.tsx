"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarController,
  LineController,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import api from "@/lib/api";

ChartJS.register(BarController, LineController, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

/** GET /reports/herd-weights/{id}/history (HerdWeightHistory). */
type Reading = {
  id: number;
  date: string;
  weightKg: number;
  method: string | null;
  heartGirthCm: number | null;
  bcs: number | null;
  bcsDate: string | null;
  changeKg: number | null;
  days: number | null;
  gainGPerDay: number | null;
  /** minimum healthy weight on that day - age, BCS and pregnancy as they were then */
  targetKg: number | null;
  /** target - weight: positive = kg still missing */
  gapKg: number | null;
  targetBasis: string | null;
  ageMonths: number | null;
  daysPregnant: number | null;
  notes: string | null;
};
type MilkMonth = { month: string; litres: number; daysMilked: number; avgPerDay: number | null };
type History = {
  herdId: number;
  tagNumber: string | null;
  animalName: string | null;
  breed: string | null;
  animalStatus: string | null;
  readings: Reading[];
  milk: MilkMonth[];
};

// Same palette as the herd overview above it, plus a quiet neutral for milk so the weight reads first.
const WEIGHT = "#2a78d6";
const SHORT = "#e34948";
const INK = "#0b0b0b";
const INK_2 = "#52514e";
const GRID = "#ececea";
const MILK = "#d6d3cc";

const METHOD: Record<string, string> = { SCALE: "Scale", HEART_GIRTH_TAPE: "Tape" };
const DAY_MS = 86_400_000;

/** Dates as day numbers so readings sit at their real spacing on the x axis. */
const toDay = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS);
const fromDay = (d: number) => new Date(d * DAY_MS);
const fmtDay = (iso: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const fmtMonth = (d: Date) =>
  `${d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })} '${String(d.getUTCFullYear()).slice(2)}`;
const kg = (n: number) => `${Math.round(n).toLocaleString("en-IN")} kg`;
const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(Math.round(n)).toLocaleString("en-IN")} ${unit}`;
const age = (m: number | null) => (m == null ? null : m < 24 ? `${m} mo` : `${Math.floor(m / 12)} y ${m % 12} mo`);

/** Writes the BCS under each weighing that has one, so the chart reads without hovering. */
const bcsLabels = {
  id: "bcsLabels",
  afterDatasetsDraw(chart: any) {
    const index = chart.data.datasets.findIndex((d: any) => d.label === "Weight");
    if (index < 0 || !chart.isDatasetVisible(index)) return;
    const points = chart.data.datasets[index].data as any[];
    const { ctx } = chart;
    ctx.save();
    ctx.font = "600 10px sans-serif";
    ctx.fillStyle = INK_2;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
    chart.getDatasetMeta(index).data.forEach((el: any, i: number) => {
      const bcs = points[i]?.reading?.bcs;
      if (bcs == null) return;
      const text = `BCS ${bcs}`;
      ctx.strokeText(text, el.x, el.y + 8);
      ctx.fillText(text, el.x, el.y + 8);
    });
    ctx.restore();
  },
};

export default function HerdWeightHistory({ herdId }: { herdId: number }) {
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    api.get(`/reports/herd-weights/${herdId}/history`)
      .then(res => { if (live) setData(res.data); })
      .catch(() => { if (live) setError("Could not load this animal's weight history."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [herdId]);

  const readings = useMemo(() => data?.readings ?? [], [data]);
  const milk = useMemo(() => (data?.milk ?? []).filter(m => m.avgPerDay != null), [data]);

  const summary = useMemo(() => {
    if (readings.length === 0) return null;
    const first = readings[0], last = readings[readings.length - 1];
    const days = toDay(last.date) - toDay(first.date);
    return {
      first,
      last,
      totalKg: last.weightKg - first.weightKg,
      days,
      gain: days > 0 ? Math.round(((last.weightKg - first.weightKg) * 1000) / days) : null,
    };
  }, [readings]);

  // x range: first weighing (or first milk month) to the last, padded a little either side.
  const range = useMemo(() => {
    const xs = [...readings.map(r => toDay(r.date)), ...milk.map(m => toDay(m.month) + 14)];
    if (xs.length === 0) return null;
    const min = Math.min(...xs), max = Math.max(...xs);
    const pad = Math.max(7, Math.round((max - min) * 0.04));
    return { min: min - pad, max: max + pad };
  }, [readings, milk]);

  const chartData = {
    datasets: [
      {
        type: "line" as const,
        label: "Weight",
        data: readings.map(r => ({ x: toDay(r.date), y: r.weightKg, reading: r })),
        borderColor: WEIGHT,
        backgroundColor: WEIGHT,
        borderWidth: 2.5,
        tension: 0,
        // Red where she was still short of that day's healthy weight; a square for a scale reading.
        pointBackgroundColor: readings.map(r => ((r.gapKg ?? 0) > 0 ? SHORT : WEIGHT)),
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointStyle: readings.map(r => (r.method === "SCALE" ? "rect" : "circle")),
        pointRadius: 6,
        pointHoverRadius: 8,
        yAxisID: "y",
        order: 1,
      },
      {
        type: "line" as const,
        label: "Minimum healthy weight",
        data: readings.filter(r => r.targetKg != null).map(r => ({ x: toDay(r.date), y: r.targetKg, reading: r })),
        borderColor: INK,
        backgroundColor: INK,
        borderWidth: 1.5,
        borderDash: [6, 4],
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointStyle: "line" as const,
        yAxisID: "y",
        order: 2,
      },
      {
        type: "bar" as const,
        label: "Milk (L/day, monthly avg)",
        data: milk.map(m => ({ x: toDay(m.month) + 14, y: m.avgPerDay, month: m })),
        backgroundColor: MILK,
        borderRadius: 3,
        maxBarThickness: 28,
        yAxisID: "y1",
        order: 3,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: {
        position: "top",
        align: "start",
        labels: {
          color: INK_2,
          usePointStyle: true,
          boxWidth: 10,
          font: { size: 12 },
          // The weight swatch would take the first point's colour (red when short); keep it the line's blue.
          generateLabels: (chart: any) =>
            ChartJS.defaults.plugins.legend.labels.generateLabels(chart).map((l: any) =>
              l.text === "Weight" ? { ...l, fillStyle: WEIGHT, strokeStyle: WEIGHT, pointStyle: "circle" } : l),
        },
      },
      tooltip: {
        callbacks: {
          title: (items: any[]) => {
            const raw = items[0]?.raw;
            if (raw?.reading) return fmtDay(raw.reading.date);
            if (raw?.month) return fmtMonth(new Date(raw.month.month + "T00:00:00Z"));
            return "";
          },
          label: (item: any) => {
            const raw = item.raw;
            if (raw?.month) {
              const m: MilkMonth = raw.month;
              return `Milk: ${m.avgPerDay} L/day over ${m.daysMilked} day${m.daysMilked === 1 ? "" : "s"} (${Math.round(m.litres).toLocaleString("en-IN")} L)`;
            }
            const r: Reading = raw.reading;
            if (item.dataset.label === "Minimum healthy weight") return `Healthy minimum that day: ${kg(r.targetKg!)}`;
            const lines = [`Weight: ${kg(r.weightKg)}${r.method ? ` (${METHOD[r.method] ?? r.method})` : ""}`];
            if (r.changeKg != null && r.days != null) {
              lines.push(`${signed(r.changeKg, "kg")} in ${r.days} day${r.days === 1 ? "" : "s"}${r.gainGPerDay != null ? ` · ${signed(r.gainGPerDay, "g/day")}` : ""}`);
            }
            if (r.gapKg != null) lines.push(r.gapKg > 0 ? `${kg(r.gapKg)} short of healthy minimum` : `At or above healthy minimum`);
            if (r.bcs != null) lines.push(`BCS ${r.bcs}${r.bcsDate && r.bcsDate !== r.date ? ` (scored ${fmtDay(r.bcsDate)})` : ""}`);
            if (r.daysPregnant != null) lines.push(`${r.daysPregnant} days pregnant`);
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        min: range?.min,
        max: range?.max,
        grid: { display: false },
        // One tick per month (every few months on a long history), labelled "Mar 26".
        afterBuildTicks: (scale: any) => {
          const start = fromDay(scale.min), end = fromDay(scale.max);
          const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
          const step = Math.max(1, Math.ceil(months / 10));
          const ticks = [];
          let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1;
          for (; Date.UTC(y, m, 1) / DAY_MS <= scale.max; m += step) {
            const v = Date.UTC(y, m, 1) / DAY_MS;
            if (v >= scale.min) ticks.push({ value: v });
          }
          scale.ticks = ticks;
        },
        ticks: { color: INK_2, font: { size: 11 }, callback: (v: number) => fmtMonth(fromDay(v)) },
      },
      y: {
        position: "left",
        // A bar chart starts its value axes at 0; weight reads better zoomed to its own range.
        beginAtZero: false,
        grace: "10%",
        grid: { color: GRID },
        border: { display: false },
        title: { display: true, text: "Weight (kg)", color: INK_2 },
        ticks: { color: INK_2, callback: (v: number) => `${v}` },
      },
      y1: {
        position: "right",
        display: milk.length > 0,
        beginAtZero: true,
        grace: "40%",
        grid: { drawOnChartArea: false },
        border: { display: false },
        title: { display: true, text: "Milk (L/day)", color: INK_2 },
        ticks: { color: INK_2 },
      },
    },
  };

  const rowsNewestFirst = [...readings].reverse();

  if (loading && !data) {
    return <div className="h-64 flex items-center justify-center text-slate-400">Loading weight history...</div>;
  }
  if (error) return <div className="h-40 flex items-center justify-center text-red-600 text-sm">{error}</div>;
  if (!data) return null;

  return (
    <div className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Latest</div>
            <div className="text-xl font-bold text-slate-800 mt-1">{kg(summary.last.weightKg)}</div>
            <div className="text-[11px] text-slate-500">{fmtDay(summary.last.date)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Since first weighing</div>
            <div className={`text-xl font-bold mt-1 ${summary.totalKg < 0 ? "text-red-700" : "text-slate-800"}`}>
              {readings.length > 1 ? signed(summary.totalKg, "kg") : "—"}
            </div>
            <div className="text-[11px] text-slate-500">{readings.length} weighing{readings.length === 1 ? "" : "s"} since {fmtDay(summary.first.date)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Average daily gain</div>
            <div className={`text-xl font-bold mt-1 ${(summary.gain ?? 0) < 0 ? "text-red-700" : "text-slate-800"}`}>
              {summary.gain != null ? signed(summary.gain, "g/day") : "—"}
            </div>
            <div className="text-[11px] text-slate-500">{summary.days > 0 ? `over ${summary.days} days` : "needs two weighings"}</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Against healthy minimum</div>
            <div className={`text-xl font-bold mt-1 ${(summary.last.gapKg ?? 0) > 0 ? "text-red-700" : "text-green-700"}`}>
              {summary.last.gapKg == null ? "—" : summary.last.gapKg > 0 ? `▼ ${kg(summary.last.gapKg)}` : "✓ Met"}
            </div>
            <div className="text-[11px] text-slate-500">at the latest weighing</div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          This animal has not been weighed yet. Weigh it from the Weight Round or its herd card to start a history.
        </div>
      )}

      {range && (
        <div className="h-80">
          <Bar data={chartData as any} options={options} plugins={[bcsLabels]} />
        </div>
      )}

      {readings.length > 0 && (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-2 py-2 font-bold">Date</th>
                <th className="px-2 py-2 font-bold text-right">Weight</th>
                <th className="px-2 py-2 font-bold text-right">Change</th>
                <th className="px-2 py-2 font-bold text-right">Daily gain</th>
                <th className="px-2 py-2 font-bold text-right">Healthy minimum</th>
                <th className="px-2 py-2 font-bold">BCS</th>
                <th className="px-2 py-2 font-bold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rowsNewestFirst.map(r => (
                <tr key={r.id} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="font-semibold text-slate-800">{fmtDay(r.date)}</div>
                    <div className="text-[11px] text-slate-500">
                      {[age(r.ageMonths), r.daysPregnant != null ? `${r.daysPregnant} d pregnant` : null].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <div className="font-semibold text-slate-800">{kg(r.weightKg)}</div>
                    <div className="text-[11px] text-slate-500">
                      {[r.method ? METHOD[r.method] ?? r.method : null, r.heartGirthCm ? `${Math.round(r.heartGirthCm)} cm girth` : null].filter(Boolean).join(", ")}
                    </div>
                  </td>
                  <td className={`px-2 py-2 text-right whitespace-nowrap ${(r.changeKg ?? 0) < 0 ? "text-red-700 font-semibold" : "text-slate-700"}`}>
                    {r.changeKg != null ? (
                      <>
                        <div>{signed(r.changeKg, "kg")}</div>
                        <div className="text-[11px] text-slate-500 font-normal">in {r.days} day{r.days === 1 ? "" : "s"}</div>
                      </>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className={`px-2 py-2 text-right whitespace-nowrap ${(r.gainGPerDay ?? 0) < 0 ? "text-red-700 font-semibold" : "text-slate-700"}`}>
                    {r.gainGPerDay != null ? signed(r.gainGPerDay, "g/day") : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap" title={r.targetBasis ?? undefined}>
                    {r.targetKg != null ? (
                      <>
                        <div className="text-slate-800">{kg(r.targetKg)}</div>
                        <div className={`text-[11px] ${(r.gapKg ?? 0) > 0 ? "text-red-700 font-semibold" : "text-green-700"}`}>
                          {(r.gapKg ?? 0) > 0 ? `▼ ${kg(r.gapKg!)} short` : "✓ met"}
                        </div>
                      </>
                    ) : <span className="text-slate-400 text-xs">No target</span>}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {r.bcs != null ? (
                      <>
                        <div className="text-slate-800">{r.bcs}</div>
                        {r.bcsDate && r.bcsDate !== r.date && <div className="text-[11px] text-slate-500">scored {fmtDay(r.bcsDate)}</div>}
                      </>
                    ) : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-2 py-2 text-slate-600 text-xs max-w-[16rem]">{r.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Points are each weighing (■ scale, ● tape), red where the animal was below that day&apos;s healthy minimum. The dashed line
        is the healthy minimum for the animal as it was on each weighing day - its age, the BCS in force then, and its pregnancy
        then - so it rises as a calf grows. Grey bars are the animal&apos;s own milk, average litres per milked day each month.
      </p>
    </div>
  );
}

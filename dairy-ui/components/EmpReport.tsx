"use client";

import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Droplets, Info, ChevronDown } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip, Legend);

interface EmpDay { date: string; litres: number; lactating: number; dry: number; fresh: number; heatLoss: number }
interface EmpMonth {
  month: string; from: string; to: string; days: number; litres: number; avgDaily: number; revenue: number;
  recordedLitres: number; recordedDays: number; projectedLitres: number; heatLossLitres: number; heatLossRevenue: number;
  lactating: number; dry: number; fresh: number; calvings: number; dryOffs: number;
}
interface EmpAnimal {
  id: number; tagNumber: string; animalName?: string; breed?: string;
  stateNow: "LACTATING" | "DRY" | "HEIFER"; dim?: number | null; litresToday: number;
  expectedDryOff?: string | null; expectedCalving?: string | null; projectedLitres: number; projectedRevenue: number; heatPeakPct: number; heatLossLitres: number; basis: string;
}
interface EmpResponse {
  from: string; to: string; monthFrom: string; days: number; months: number; monthCount: number;
  recordedThisMonth: number; totalLitres: number; avgDaily: number;
  totalRevenue: number; pricePerLitre: number; priceLitresSold: number;
  priceFrom: string | null; priceTo: string | null; pricePeriod: "THIS_MONTH" | "LAST_MONTH" | "LAST_YEAR" | "NONE";
  daily: EmpDay[]; monthly: EmpMonth[]; animals: EmpAnimal[];
  assumptions: {
    gestationCowDays: number; gestationBuffaloDays: number; dryPeriodDays: number; pdAssumedDays: number;
    firstLactationFactor: number; colostrumDays: number;
  };
  heatStress: {
    source: "MEASURED" | "BREED"; measuredPct: number | null; measuredYear: number | null; measuredCows: number;
    totalLossLitres: number; totalLossRevenue: number;
  };
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "—";
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};
const num = (n: number) => Math.round(n).toLocaleString("en-IN");
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/* Point icons for the highest and lowest month: a rupee coin (broken when lowest) and a milk can
   (full with the lid on when highest, nearly empty with the lid open when lowest). */
const COIN = (fill: string, rim: string, ink: string) =>
  `<circle cx="16" cy="16" r="13.5" fill="${fill}" stroke="${rim}" stroke-width="2"/>`
  + `<circle cx="16" cy="16" r="10" fill="none" stroke="#FFF3C4" stroke-width="1" opacity="0.8"/>`
  + `<text x="16" y="22" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" fill="${ink}">₹</text>`;
const CAN_BODY = "M11 7h10v2.5l4 4V27a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V13.5l4-4z";
const ICON_SVG = {
  rupee: COIN("#F7B731", "#B7791F", "#7B4F0A"),
  rupeeBroken:
    `<defs><clipPath id="l"><polygon points="0,0 17,0 13,8 18,13 13,19 18,25 15,32 0,32"/></clipPath>`
    + `<clipPath id="r"><polygon points="17,0 32,0 32,32 15,32 18,25 13,19 18,13 13,8"/></clipPath></defs>`
    + `<g clip-path="url(#l)" transform="translate(-1.5 0.5) rotate(-7 16 16)">${COIN("#E2B65A", "#9C6B1E", "#7B4F0A")}</g>`
    + `<g clip-path="url(#r)" transform="translate(1.8 1.5) rotate(9 16 16)">${COIN("#E2B65A", "#9C6B1E", "#7B4F0A")}</g>`,
  milkFull:
    `<path d="M6 15h-2.5v6H6M26 15h2.5v6H26" fill="none" stroke="#2D6A4F" stroke-width="1.8"/>`
    + `<path d="${CAN_BODY}" fill="#FFFFFF" stroke="#2D6A4F" stroke-width="2" stroke-linejoin="round"/>`
    + `<rect x="7.5" y="17" width="17" height="4" fill="#52B788"/>`
    + `<rect x="9.5" y="3" width="13" height="4" rx="1.5" fill="#2D6A4F"/>`
    + `<rect x="14" y="1" width="4" height="2.5" rx="1" fill="#2D6A4F"/>`,
  milkOpen:
    `<defs><clipPath id="b"><path d="${CAN_BODY}"/></clipPath></defs>`
    + `<path d="M6 15h-2.5v6H6M26 15h2.5v6H26" fill="none" stroke="#2D6A4F" stroke-width="1.8"/>`
    + `<path d="${CAN_BODY}" fill="#E3EEE8"/>`
    + `<rect x="0" y="25" width="32" height="7" fill="#FFFFFF" clip-path="url(#b)"/>`
    + `<path d="${CAN_BODY}" fill="none" stroke="#2D6A4F" stroke-width="2" stroke-linejoin="round"/>`
    + `<ellipse cx="16" cy="7" rx="5" ry="1.3" fill="#9DBFAE"/>`
    + `<g transform="rotate(-38 10 7)"><rect x="-3" y="3.5" width="13" height="4" rx="1.5" fill="#2D6A4F"/><rect x="1.5" y="1.5" width="4" height="2.5" rx="1" fill="#2D6A4F"/></g>`,
};
type IconName = keyof typeof ICON_SVG;
type Icons = Record<IconName, HTMLImageElement>;

/** Milk cans sit above the milk line, rupee coins below the revenue line, so the two never overlap. */
const ICON_ABOVE: Record<IconName, boolean> = { milkFull: true, milkOpen: true, rupee: false, rupeeBroken: false };

/**
 * Loads the point icons as images. Chart.js centres an image pointStyle on the point, so each icon is
 * drawn in one half of a canvas twice its height (plus a small gap): the top half puts it above the
 * point, the bottom half below.
 */
function useChartIcons(size = 18): Icons | null {
  const [icons, setIcons] = useState<Icons | null>(null);
  useEffect(() => {
    const names = Object.keys(ICON_SVG) as IconName[];
    const loaded = {} as Icons;
    let pending = names.length;
    names.forEach(name => {
      const height = Math.round(size * 72 / 32);
      const img = new Image(size, height);
      img.onload = () => { if (--pending === 0) setIcons(loaded); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 72" width="${size}" height="${height}">`
        + `<g transform="translate(0 ${ICON_ABOVE[name] ? 0 : 40})">${ICON_SVG[name]}</g></svg>`);
      loaded[name] = img;
    });
  }, [size]);
  return icons;
}

/** Index of the highest and lowest value. */
function extremes(values: number[]) {
  let hi = 0, lo = 0;
  values.forEach((v, i) => {
    if (v > values[hi]) hi = i;
    if (v < values[lo]) lo = i;
  });
  return { hi, lo };
}

export default function EmpReport() {
  const [data, setData] = useState<EmpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"daily" | "monthly">("monthly");
  const [showAnimals, setShowAnimals] = useState(false);
  const icons = useChartIcons();

  useEffect(() => {
    api.get("/reports/emp?months=9")
      .then(res => setData(res.data))
      .catch(err => { console.error(err); setError("Could not load the projection."); })
      .finally(() => setLoading(false));
  }, []);

  const chartData = useMemo(() => {
    if (!data) return null;
    const daily = view === "daily";
    const labels = daily
      ? data.daily.map(d => new Date(d.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }))
      : data.monthly.map(m => monthLabel(m.month));
    const milk = daily ? data.daily.map(d => d.litres) : data.monthly.map(m => m.litres);
    const revenue = daily ? data.daily.map(d => Math.round(d.litres * data.pricePerLitre)) : data.monthly.map(m => m.revenue);
    // Icons only on the highest and lowest point of each line; every other point is hidden
    const marked = (values: number[], high: IconName, low: IconName) => {
      const { hi, lo } = extremes(values);
      const pick = <T,>(atHi: T, atLo: T, other: T) => values.map((_, i) => (i === hi ? atHi : i === lo ? atLo : other));
      return icons
        ? { pointStyle: pick<HTMLImageElement | "circle">(icons[high], icons[low], "circle"), pointRadius: pick(6, 6, 0), pointHoverRadius: pick(6, 6, 4), clip: false as const }
        : { pointRadius: 0, pointHoverRadius: 4 };
    };
    return {
      labels,
      datasets: [
        {
          label: daily ? "Est. milk (L/day)" : "Est. milk (L/month)",
          data: milk,
          borderColor: "#2D6A4F",
          backgroundColor: "rgba(45, 106, 79, 0.12)",
          fill: true,
          borderWidth: 2.5,
          tension: 0.3,
          ...marked(milk, "milkFull", "milkOpen"),
          yAxisID: "y",
        },
        {
          label: daily ? "Est. revenue (₹/day)" : "Est. revenue (₹/month)",
          data: revenue,
          borderColor: "#F7B731",
          backgroundColor: "#F7B731",
          borderWidth: 2.5,
          tension: 0.3,
          ...marked(revenue, "rupee", "rupeeBroken"),
          yAxisID: "y1",
        },
        {
          label: "In lactation",
          data: daily ? data.daily.map(d => d.lactating) : data.monthly.map(m => m.lactating),
          borderColor: "#3B82F6",
          backgroundColor: "#3B82F6",
          borderWidth: 1.5,
          borderDash: [4, 3],
          stepped: daily,
          pointRadius: daily ? 0 : 3,
          yAxisID: "y2",
        },
        {
          label: "Dry",
          data: daily ? data.daily.map(d => d.dry) : data.monthly.map(m => m.dry),
          borderColor: "#EF6C57",
          backgroundColor: "#EF6C57",
          borderWidth: 1.5,
          borderDash: [4, 3],
          stepped: daily,
          pointRadius: daily ? 0 : 3,
          yAxisID: "y2",
        },
      ],
    };
  }, [data, view, icons]);

  if (loading) return <div className="h-64 flex items-center justify-center text-text3 text-[13px] italic">Projecting the herd…</div>;
  if (error || !data || !chartData) return <div className="h-64 flex items-center justify-center text-red-500 text-[13px]">{error || "No data."}</div>;

  const a = data.assumptions;
  const span = data.monthly.length
    ? `${monthLabel(data.monthly[0].month)} – ${monthLabel(data.monthly[data.monthly.length - 1].month)}`
    : "";
  const spanDays = data.monthly.reduce((t, m) => t + m.days, 0);
  const current = data.monthly[0];
  const maxCount = Math.max(1, ...data.daily.map(d => Math.max(d.lactating, d.dry)));
  const pricePeriod = data.pricePeriod === "THIS_MONTH"
    ? `this month (${fmtDate(data.priceFrom)} – ${fmtDate(data.priceTo)})`
    : data.pricePeriod === "LAST_MONTH"
      ? `last month (${fmtDate(data.priceFrom)} – ${fmtDate(data.priceTo)}), none sold yet this month`
      : data.pricePeriod === "LAST_YEAR" ? "the last 12 months" : "";
  const lactatingNow = data.daily[0]?.lactating ?? 0;
  const dryNow = data.daily[0]?.dry ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: `Est. revenue, ${span}`, value: rupees(data.totalRevenue), sub: data.heatStress.totalLossRevenue > 0 ? `after −${rupees(data.heatStress.totalLossRevenue)} heat stress` : "" },
          { label: "Avg revenue / month", value: rupees(data.totalRevenue / Math.max(1, data.monthly.length)), sub: `over ${data.monthly.length} months` },
          { label: "Milk price used", value: `${rupees(data.pricePerLitre)} / L`, sub: data.priceLitresSold > 0 ? `avg paid for ${num(data.priceLitresSold)} L, ${pricePeriod}` : "no milk sales recorded" },
          { label: "Average per day", value: `${num(data.avgDaily)} L`, sub: `today about ${num(data.daily[0]?.litres ?? 0)} L` },
          { label: "Milking / dry now", value: `${lactatingNow} / ${dryNow}`, sub: "" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border-custom rounded-xl p-3 card-shadow">
            <div className="text-[9px] font-black uppercase tracking-wider text-text3">{s.label}</div>
            <div className="text-xl font-black text-brand mt-0.5">{s.value}</div>
            {s.sub && <div className="text-[10px] text-text3 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-radius-custom-lg p-5 border border-border-custom card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[14px] font-bold text-text flex items-center gap-2"><Droplets size={15} className="text-brand" /> Estimated Milk &amp; Revenue</h3>
            <p className="text-[11px] text-text3 mt-0.5">
              {view === "monthly"
                ? `${span} · ${monthLabel(current?.month ?? "")} = recorded to ${fmtDate(data.from)} + projected rest`
                : `${fmtDate(data.from)} – ${fmtDate(data.to)} · projected per day`} · revenue at {rupees(data.pricePerLitre)}/L
            </p>
          </div>
          <div className="flex bg-surface rounded-lg p-0.5 border border-border-custom">
            {(["monthly", "daily"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-[11px] font-black uppercase tracking-wider transition-all ${view === v ? "bg-brand text-white" : "text-text3 hover:text-brand"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[320px]">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              layout: { padding: { top: 22, bottom: 4 } },
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: { position: "bottom", labels: { boxWidth: 8, usePointStyle: true, pointStyle: "circle", font: { size: 11 } } },
                tooltip: {
                  footerColor: "#FCA5A5",
                  footerFont: { size: 11, weight: "bold" },
                  callbacks: {
                    footer: items => {
                      const i = items[0]?.dataIndex;
                      if (i == null) return "";
                      const lostL = view === "daily" ? data.daily[i]?.heatLoss ?? 0 : data.monthly[i]?.heatLossLitres ?? 0;
                      if (lostL < 0.5) return "";
                      const lostRs = view === "daily" ? lostL * data.pricePerLitre : data.monthly[i].heatLossRevenue;
                      return `Heat stress: -${num(lostL)} L milk (-${rupees(lostRs)})`;
                    },
                    label: ctx => {
                      const axis = ctx.dataset.yAxisID;
                      if (axis !== "y" && axis !== "y1") return ` ${ctx.dataset.label}: ${ctx.raw} animals`;
                      const { hi, lo } = extremes(ctx.dataset.data as number[]);
                      const tag = ctx.dataIndex === hi ? " (highest)" : ctx.dataIndex === lo ? " (lowest)" : "";
                      return axis === "y" ? ` Milk: ${num(Number(ctx.raw))} L${tag}` : ` Revenue: ${rupees(Number(ctx.raw))}${tag}`;
                    },
                  },
                },
              },
              scales: {
                x: { grid: { display: false }, ticks: view === "daily" ? { maxTicksLimit: 12, font: { size: 10 } } : { autoSkip: false, maxRotation: 0, font: { size: 10 } } },
                y: {
                  min: 0,
                  title: { display: true, text: view === "daily" ? "Litres / day" : "Litres / month", font: { size: 10, weight: "bold" } },
                  grid: { color: "rgba(0, 0, 0, 0.05)" },
                },
                y1: {
                  min: 0,
                  position: "right",
                  title: { display: true, text: "Revenue (₹)", font: { size: 10, weight: "bold" } },
                  ticks: { callback: v => rupees(Number(v)), font: { size: 10 } },
                  grid: { drawOnChartArea: false },
                },
                y2: {
                  min: 0,
                  suggestedMax: maxCount + 1,
                  position: "right",
                  title: { display: true, text: "Animals", font: { size: 10, weight: "bold" } },
                  ticks: { precision: 0, font: { size: 10 } },
                  grid: { drawOnChartArea: false },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="bg-white border border-border-custom rounded-2xl card-shadow overflow-hidden">
        <div className="px-5 py-3 border-b border-border-custom">
          <h3 className="text-[13px] font-black text-text uppercase tracking-[0.15em]">Month by month</h3>
          <p className="text-[11px] text-text3 mt-0.5">{current && current.recordedDays > 0
            ? <>{monthLabel(current.month)} adds the {num(current.recordedLitres)} L already recorded ({current.recordedDays} days) to {num(current.projectedLitres)} L projected for the rest of the month. </>
            : null}Animal counts are taken mid-month (for this month, mid-way through the days still to come).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-surface text-text3 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2 font-black">Month</th>
                <th className="text-right px-4 py-2 font-black">Days</th>
                <th className="text-right px-4 py-2 font-black">Est. litres</th>
                <th className="text-right px-4 py-2 font-black">Avg / day</th>
                <th className="text-right px-4 py-2 font-black">Est. revenue</th>
                <th className="text-right px-4 py-2 font-black text-blue-600">In lactation</th>
                <th className="text-right px-4 py-2 font-black text-red-500">Dry</th>
                <th className="text-right px-4 py-2 font-black">Calvings</th>
                <th className="text-right px-4 py-2 font-black">Dry-offs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-custom">
              {data.monthly.map(m => (
                <tr key={m.month} className="hover:bg-surface/40">
                  <td className="px-4 py-2 font-bold text-text">{monthLabel(m.month)}</td>
                  <td className="px-4 py-2 text-right text-text3">{m.days}</td>
                  <td className="px-4 py-2 text-right font-black text-brand">
                    {num(m.litres)} L
                    {m.recordedLitres > 0 && <div className="text-[9px] font-semibold text-text3">{num(m.recordedLitres)} recorded + {num(m.projectedLitres)} est.</div>}
                  </td>
                  <td className="px-4 py-2 text-right">{num(m.avgDaily)} L</td>
                  <td className="px-4 py-2 text-right font-black text-text">{rupees(m.revenue)}</td>
                  <td className="px-4 py-2 text-right font-bold text-blue-600">{m.lactating}</td>
                  <td className="px-4 py-2 text-right font-bold text-red-500">{m.dry}</td>
                  <td className="px-4 py-2 text-right">{m.calvings || "—"}</td>
                  <td className="px-4 py-2 text-right">{m.dryOffs || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface font-black text-text">
              <tr>
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right text-text3">{spanDays}</td>
                <td className="px-4 py-2 text-right text-brand">{num(data.totalLitres)} L</td>
                <td className="px-4 py-2 text-right">{num(data.totalLitres / Math.max(1, spanDays))} L</td>
                <td className="px-4 py-2 text-right">{rupees(data.totalRevenue)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white border border-border-custom rounded-2xl card-shadow overflow-hidden">
        <button onClick={() => setShowAnimals(s => !s)} className="w-full px-5 py-3 flex items-center justify-between text-left">
          <span className="text-[13px] font-black text-text uppercase tracking-[0.15em]">Per animal ({data.animals.length})</span>
          <ChevronDown size={16} className={`text-text3 transition-transform ${showAnimals ? "rotate-180" : ""}`} />
        </button>
        {showAnimals && (
          <div className="overflow-x-auto border-t border-border-custom">
            <table className="w-full text-[12px]">
              <thead className="bg-surface text-text3 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-black">Animal</th>
                  <th className="text-left px-4 py-2 font-black">Now</th>
                  <th className="text-right px-4 py-2 font-black">L today</th>
                  <th className="text-right px-4 py-2 font-black">Dry-off</th>
                  <th className="text-right px-4 py-2 font-black">Calving</th>
                  <th className="text-right px-4 py-2 font-black">L to {data.monthly.length ? monthLabel(data.monthly[data.monthly.length - 1].month) : ""}</th>
                  <th className="text-right px-4 py-2 font-black">Est. revenue</th>
                  <th className="text-left px-4 py-2 font-black">Based on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom">
                {data.animals.map(an => (
                  <tr key={an.id} className="hover:bg-surface/40">
                    <td className="px-4 py-2 font-bold text-text whitespace-nowrap">{an.tagNumber}{an.animalName ? ` · ${an.animalName}` : ""}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${an.stateNow === "LACTATING" ? "bg-blue-50 text-blue-600" : an.stateNow === "DRY" ? "bg-amber-50 text-amber-600" : "bg-surface text-text3"}`}>
                        {an.stateNow}{an.dim != null ? ` · ${an.dim} DIM` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{an.litresToday ? an.litresToday.toFixed(1) : "—"}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{fmtDate(an.expectedDryOff)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{fmtDate(an.expectedCalving)}</td>
                    <td className="px-4 py-2 text-right font-black text-brand">{num(an.projectedLitres)}</td>
                    <td className="px-4 py-2 text-right font-bold">{rupees(an.projectedRevenue)}</td>
                    <td className="px-4 py-2 text-text3 whitespace-nowrap">{an.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-surface border border-border-custom rounded-xl p-4 text-[11px] text-text2 leading-relaxed">
        <div className="flex items-center gap-1.5 font-black text-text uppercase tracking-wider text-[10px] mb-1.5"><Info size={13} className="text-brand" /> How this is estimated</div>
        <ul className="list-disc pl-4 space-y-0.5">
          <li><b>Lactation curve:</b> Wood&apos;s curve (peak about 50 days after calving), scaled to each animal — her 30-day average at her current days in milk; for a dry cow, her average since the last calving; with no milk records, her breed&apos;s normal yield ({Math.round(a.firstLactationFactor * 100)}% of it for a first lactation).</li>
          <li><b>Gestation:</b> {a.gestationCowDays} days for cows, {a.gestationBuffaloDays} for buffaloes, from the last AI after calving. Pregnancy confirmed without an AI date is taken as {a.pdAssumedDays} days pregnant on the PD date.</li>
          <li><b>After calving:</b> the first {a.colostrumDays} days are colostrum for the calf, so she counts as in lactation (and her milk as saleable) only from day {a.colostrumDays + 1}.</li>
          <li><b>Revenue:</b> estimated litres × {rupees(data.pricePerLitre)} per litre, the average the farm was actually paid (society collections and customer sales) {pricePeriod}. It is worked out again every time the report opens, so revenue follows the price. Milk fed to calves or used at home is not deducted.</li>
          <li><b>Heat stress:</b> milk is cut from 15 Mar, at full strength 1 Apr – 15 May, and back to normal by 31 May (hover a summer month to see the loss).{" "}
            {data.heatStress.source === "MEASURED"
              ? <>The cut is {data.heatStress.measuredPct}%, measured from this farm&apos;s summer {data.heatStress.measuredYear} records ({data.heatStress.measuredCows} cows&apos; Apr–May yield against their Jan–Feb yield, allowing for the lactation curve).</>
              : <>The farm&apos;s records don&apos;t cover a full summer yet, so breed figures are used: HF / high HF cross 15%, HF cross 12%, Jersey 8%, Indian breeds and buffalo 4%. Once a summer is recorded, the farm&apos;s own measured loss replaces them automatically.</>}
            {" "}Over this report: −{num(data.heatStress.totalLossLitres)} L (−{rupees(data.heatStress.totalLossRevenue)}).</li>
          <li><b>Dry period:</b> {a.dryPeriodDays} days before the expected calving. A cow that is not pregnant keeps milking along the curve (she can&apos;t calve within the window).</li>
          <li>After an expected calving she starts a new lactation at the same level. Open heifers and calves are left out.</li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

type BaseStatus = "OK" | "LOW" | "HIGH";

/** One animal from GET /reports/herd-weights (HerdWeightOverviewRow). */
export type Row = {
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
  /** Fixed base minimum (BCS 3, open) for a grown cow; null for young stock or before her first score. */
  baseMinWeightKg: number | null;
  baseMinWeightDate: string | null;
  /** true = set by hand, false = the app's suggestion */
  baseManual: boolean | null;
  /** What her latest BCS says she should weigh on the weighing day, and how far the scale is from it (%). */
  expectedAtBcsKg: number | null;
  bcsMatchPct: number | null;
  /** Latest heart girth (every animal); for grown cows, the base check (OK / LOW = base under what the data says / HIGH) by girth next to the herd, */
  girthCm: number | null;
  girthDate: string | null;
  girthBaseKg: number | null;
  girthCheck: BaseStatus | null;
  /** Set when the girth was taken 6+ months pregnant: the calf widens it, so it is not used. */
  girthPregnantDays: number | null;
  /** ...and her breed's range. */
  breedLowKg: number | null;
  breedHighKg: number | null;
  breedCheck: BaseStatus | null;
  frameTargetKg: number | null;
  pregnancyKg: number | null;
  daysPregnant: number | null;
  verdict: "SHORT" | "HEALTHY" | "LOW_BCS" | "AHEAD" | "OVER_CONDITIONED" | null;
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
/** BCS dots: below 3 is lean (medium red), 2 or less is thin (dark red). */
const BCS_LEAN = "#e34948";
const BCS_THIN = "#9b1c1c";
const bcsDot = (bcs: number | null) => (bcs == null ? CURRENT : bcs <= 2 ? BCS_THIN : bcs < 3 ? BCS_LEAN : CURRENT);
/** Same y-axis width on both charts so the BCS dots sit under their weight bars. */
const Y_AXIS_WIDTH = 78;
/** Phones: shorter tick labels ("700 kg", "3") so the axis takes less of the screen. */
const Y_AXIS_WIDTH_PHONE = 44;
/** On a phone the charts show this many animals at a time and scroll sideways for the rest. */
const VISIBLE_ON_PHONE = 7;

/**
 * While the charts scroll sideways on a phone, the y-axis must stay put. Before the bars are drawn,
 * copy the axis strip (left of the plot area) onto a canvas that is sticky at the left edge.
 */
const stickyAxis = (target: React.RefObject<HTMLCanvasElement | null>) => ({
  id: "stickyAxis",
  beforeDatasetsDraw(chart: any) {
    const out = target.current;
    if (!out) return;
    const dpr = chart.currentDevicePixelRatio || 1;
    const w = Math.ceil(chart.chartArea.left);
    const h = Math.min(chart.height, Math.ceil(chart.chartArea.bottom) + 8); // stop above the rotated names
    if (w <= 0 || h <= 0) return;
    out.width = Math.round(w * dpr);
    out.height = Math.round(h * dpr);
    out.style.width = `${w}px`;
    out.style.height = `${h}px`;
    const c = out.getContext("2d");
    if (!c) return;
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, out.width, out.height);
    c.drawImage(chart.canvas, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
  },
});

function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

/** Writes "−kg" still missing over underweight animals and "+kg" above target over the rest, so it reads without hovering. */
const targetLabels = {
  id: "targetLabels",
  afterDatasetsDraw(chart: any) {
    const index = chart.data.datasets.findIndex((d: any) => d.label === "Minimum healthy weight");
    const missing = chart.data.datasets.find((d: any) => d.label === "Still to gain")?.data ?? [];
    const aboveIndex = chart.data.datasets.findIndex((d: any) => d.label === ABOVE_LABEL);
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

/** Legend names: the bar is her current weight; green is what she carries over the minimum (grown cows only). */
const CURRENT_LABEL = "Current weight";
const ABOVE_LABEL = "Healthy";

const METHOD: Record<string, string> = { SCALE: "Scale", HEART_GIRTH_TAPE: "Tape", GIRTH_ESTIMATE: "Girth est." };

const kg = (n: number) => `${Math.round(n).toLocaleString("en-IN")} kg`;
const day = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
export const nameOf = (r: Row) => r.animalName || r.tagNumber || `#${r.herdId}`;
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
    case "SHORT": return { head: `▼ ${kg(g)} short`, sub: "", tone: "short" };
    case "HEALTHY": return { head: "✓ Healthy", sub: "", tone: "ok" };
    case "LOW_BCS": return { head: "Above min · BCS low", sub: "", tone: "warn" };
    case "AHEAD": return { head: "✓ On track", sub: "", tone: "ok" };
    case "OVER_CONDITIONED": return { head: "▲ Over-conditioned", sub: "", tone: "warn" };
  }
}

/** A short amber warning that opens its explanation on tap (tooltips don't work on phones). */
function Warning({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-0.5" onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => setOpen(o => !o)} className="text-[11px] font-semibold text-amber-700 hover:underline">
        ⚠ {label}
      </button>
      {open && <div className="text-[11px] text-slate-500 whitespace-normal max-w-[220px] ml-auto mt-0.5">{children}</div>}
    </div>
  );
}

/** Sunday check: does the scale agree with her BCS? Outside 5% the score or her base needs a look. */
const BCS_MATCH_TOLERANCE_PCT = 5;
function BcsCheck({ r }: { r: Row }) {
  if (r.bcsMatchPct == null || r.expectedAtBcsKg == null || r.bcs == null) return null;
  const pct = r.bcsMatchPct;
  if (Math.abs(pct) <= BCS_MATCH_TOLERANCE_PCT) return null;
  return (
    <Warning label="weight ≠ BCS">
      At BCS {r.bcs} she should weigh about {kg(r.expectedAtBcsKg)}; she weighs {kg(r.currentWeightKg ?? 0)} ({pct > 0 ? "+" : ""}{Math.round(pct)}%).
      Re-check her BCS, or her base.
    </Warning>
  );
}

/** One line of the base check: what a source suggests, with ✓ when the base agrees and ⚠ when not. */
function CheckLine({ status, label, title }: { status: BaseStatus | null; label: string; title: string }) {
  if (!status) return null;
  const ok = status === "OK";
  return (
    <div className={`text-[11px] md:whitespace-nowrap ${ok ? "text-slate-500" : "text-amber-700 font-semibold"}`} title={title}>
      {ok ? "✓" : "⚠"} {label}{ok ? "" : status === "LOW" ? " · base looks low" : " · base looks high"}
    </div>
  );
}

/** Her base checked against her scale weighings, her girth next to the herd, and her breed (see BaseCheck.java). */
function BaseChecks({ r }: { r: Row }) {
  if (r.baseMinWeightKg == null) return null;
  const band = (lo: number | null, hi: number | null) =>
    lo == null || hi == null ? "" : Math.round(lo) === Math.round(hi) ? kg(lo) : `${Math.round(lo)}–${kg(hi)}`;
  const off = [r.girthCheck, r.breedCheck].filter(c => c === "LOW" || c === "HIGH");
  if (off.length === 0) return null;
  const label = off.every(c => c === "LOW") ? "base looks low" : off.every(c => c === "HIGH") ? "base looks high" : "check base";
  return (
    <Warning label={label}>
      <CheckLine
        status={r.girthCheck}
        label={`girth ${Math.round(r.girthCm ?? 0)} cm → ~${kg(r.girthBaseKg ?? 0)}`}
        title={`Heart girth ${Math.round(r.girthCm ?? 0)} cm${r.girthDate ? ` (${day(r.girthDate)})` : ""}, at the herd's other bases per cm² of girth.`}
      />
      {r.girthPregnantDays != null && (
        <div
          className="text-[11px] text-slate-400 md:whitespace-nowrap"
          title="From about six months pregnant the calf and belly widen her girth, so it no longer shows her frame. Re-measure after calving."
        >
          – girth {Math.round(r.girthCm ?? 0)} cm not used ({Math.floor(r.girthPregnantDays / 30)} months pregnant)
        </div>
      )}
      <CheckLine
        status={r.breedCheck}
        label={`${r.breed ?? "breed"} ${band(r.breedLowKg, r.breedHighKg)}`}
        title="The breed table's range for her breed - frames vary within a breed, so this is the loosest check."
      />
    </Warning>
  );
}

/** A grown cow's fixed base minimum, editable in place. */
function BaseMinimum({ r, onSaved, label }: { r: Row; onSaved: () => void; label: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  if (r.baseMinWeightKg == null) return null;
  const save = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 30 || n > 1500) { setErr("30–1500 kg"); return; }
    setSaving(true); setErr("");
    try {
      await api.patch(`/herds/${r.herdId}/base-weight`, { kg: Math.round(n) });
      setEditing(false);
      onSaved();
    } catch {
      setErr("Could not save");
    } finally {
      setSaving(false);
    }
  };
  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="w-16 px-1.5 py-0.5 text-xs border border-slate-300 rounded-md text-right"
          aria-label="Base minimum weight in kg"
        />
        <span className="text-[11px] text-slate-500">kg</span>
        <button type="button" onClick={save} disabled={saving} className="px-1.5 py-0.5 text-[11px] font-bold rounded-md bg-slate-800 text-white disabled:opacity-50">Save</button>
        <button type="button" onClick={() => setEditing(false)} className="px-1 text-[11px] text-slate-500">✕</button>
        {err && <span className="text-[11px] text-red-600">{err}</span>}
      </div>
    );
  }
  return (
    <div className="font-semibold text-slate-800 whitespace-nowrap">
      {label}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setValue(String(Math.round(r.baseMinWeightKg!))); setEditing(true); }}
        className="ml-1 text-xs text-slate-400 hover:text-slate-800"
        title={`Base ${kg(r.baseMinWeightKg)} (${r.baseManual ? "set by you" : "suggested"}) - tap to change`}
        aria-label={`Change ${nameOf(r)}'s base minimum`}
      >✎</button>
    </div>
  );
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
  r.verdict !== "HEALTHY" || r.currentWeightKg == null || r.targetWeightKg == null
    ? 0 : Math.max(0, Math.round(r.currentWeightKg - r.targetWeightKg));

const range = (r: Row) => kg(r.targetWeightKg!);

/** One reading from GET /reports/herd-weights/{id}/history, with that day's healthy minimum. */
type Reading = {
  date: string; weightKg: number | null; method: string | null; bcs: number | null; bcsDate: string | null;
  targetKg: number | null; gapKg: number | null; targetBasis: string | null;
};

const YOUNG = ["CALF", "HEIFER"];
/** Green / healthy needs her weight at or above the minimum and a BCS of at least this. */
const HEALTHY_MIN_BCS = 3.5;

/**
 * The animal as she stood `back` weighings ago, in the shape the chart draws. Weight, minimum and BCS
 * are as they were that day; with no reading that far back she keeps her place with an empty bar.
 */
function asOf(r: Row, readings: Reading[] | undefined, back: number): Row {
  const x = readings && readings.length > back ? readings[readings.length - 1 - back] : null;
  const gap = x?.gapKg ?? null;
  return {
    ...r,
    currentWeightKg: x?.weightKg ?? null,
    weightDate: x?.date ?? null,
    weightMethod: x?.method ?? null,
    targetWeightKg: x?.targetKg ?? null,
    gapKg: gap,
    targetBasis: x?.targetBasis ?? null,
    bcs: x?.bcs ?? null,
    bcsDate: x?.bcsDate ?? null,
    bcsLabel: x?.bcs != null ? BCS_LEVELS.find(l => l.score === x.bcs)?.label ?? null : null,
    verdict: x == null || gap == null ? null
      : gap > 0 ? "SHORT"
      : r.animalStatus && YOUNG.includes(r.animalStatus) ? "AHEAD"
      : (x.bcs ?? 0) >= 4 ? "OVER_CONDITIONED"
      : (x.bcs ?? 0) >= HEALTHY_MIN_BCS ? "HEALTHY" : "LOW_BCS",
  };
}

/** "12 Nov" or "3 – 12 Nov" for the days the shown weighings were taken. */
function dateSpan(list: Row[]) {
  const dates = list.map(r => r.weightDate).filter((d): d is string => !!d).sort();
  if (!dates.length) return "no weighings";
  const a = day(dates[0]), b = day(dates[dates.length - 1]);
  return a === b ? a : `${a} – ${b}`;
}

type Props = {
  /** Animal whose weight history is open below; its bar and row are highlighted. */
  selectedId?: number | null;
  /** Clicking a bar or a table row picks that animal. */
  onSelect?: (herdId: number) => void;
  /** The rows once loaded, in chart order, so the page can build its picker from them. */
  onRows?: (rows: Row[]) => void;
};

export default function HerdWeightOverview({ selectedId, onSelect, onRows }: Props = {}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const phone = useIsPhone();
  const weightAxisRef = useRef<HTMLCanvasElement>(null);
  const bcsAxisRef = useRef<HTMLCanvasElement>(null);
  const weightPlugins = useMemo(() => [targetLabels, stickyAxis(weightAxisRef)], []);
  const bcsPlugins = useMemo(() => [stickyAxis(bcsAxisRef)], []);
  const weightScrollRef = useRef<HTMLDivElement>(null);
  const bcsScrollRef = useRef<HTMLDivElement>(null);
  /** The two charts scroll as one: whichever is swiped, the other follows. */
  const syncScroll = (from: React.RefObject<HTMLDivElement | null>, to: React.RefObject<HTMLDivElement | null>) => {
    if (from.current && to.current && to.current.scrollLeft !== from.current.scrollLeft) to.current.scrollLeft = from.current.scrollLeft;
  };

  /** 0 = latest weighing; 1 = the one before, and so on. Each animal steps back through her own readings. */
  const [back, setBack] = useState(0);
  const [histories, setHistories] = useState<Record<number, Reading[]> | null>(null);
  const [historyState, setHistoryState] = useState<"idle" | "loading" | "error">("idle");

  const load = () =>
    api.get("/reports/herd-weights")
      .then(res => { setRows(res.data); onRows?.(res.data); })
      .catch(() => setError("Could not load herd weights."));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A base changed: reload, and drop earlier weighings so they are judged against the new base. */
  const baseSaved = () => {
    setHistories(null);
    setBack(0);
    load();
  };

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

  // Readings are fetched the first time someone steps back; the latest view needs only the overview.
  const loadHistories = async () => {
    if (histories || historyState === "loading") return histories;
    setHistoryState("loading");
    try {
      const res = await Promise.all(charted.map(r => api.get(`/reports/herd-weights/${r.herdId}/history`)
        .then(x => [r.herdId, (x.data?.readings ?? []) as Reading[]] as const)
        .catch(() => [r.herdId, [] as Reading[]] as const)));
      const map = Object.fromEntries(res) as Record<number, Reading[]>;
      setHistories(map);
      setHistoryState("idle");
      return map;
    } catch {
      setHistoryState("error");
      return null;
    }
  };
  const maxBack = histories ? Math.max(0, ...charted.map(r => (histories[r.herdId]?.length ?? 1) - 1)) : null;
  const olderWeighing = async () => {
    const h = await loadHistories();
    if (!h) return;
    const most = Math.max(0, ...charted.map(r => (h[r.herdId]?.length ?? 1) - 1));
    setBack(b => Math.min(b + 1, most));
  };

  /** What the charts draw: the latest overview, or every animal as she was `back` weighings ago. */
  const shown = useMemo(
    () => (back === 0 || !histories ? charted : charted.map(r => asOf(r, histories[r.herdId], back))),
    [charted, histories, back],
  );

  const labels = charted.map(nameOf);
  /** Phone with more animals than fit: charts widen and scroll sideways, axis stays sticky. */
  const scroll = phone && charted.length > VISIBLE_ON_PHONE;
  const axisWidth = phone ? Y_AXIS_WIDTH_PHONE : Y_AXIS_WIDTH;
  const fixedWidth = (scale: any) => { scale.width = axisWidth; };
  const plotWidth = scroll
    ? `calc(${axisWidth}px + (100% - ${axisWidth}px) * ${charted.length} / ${VISIBLE_ON_PHONE})`
    : "100%";

  const weightData = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: CURRENT_LABEL,
        data: shown.map(r => (r.currentWeightKg == null || r.targetWeightKg == null ? null : r.verdict === "HEALTHY" ? Math.min(r.currentWeightKg, r.targetWeightKg) : r.currentWeightKg)),
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
        label: ABOVE_LABEL,
        data: shown.map(r => aboveKg(r)),
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
        data: shown.map(r => Math.max(0, Math.round(r.gapKg ?? 0))),
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
        data: shown.map(r => r.targetWeightKg),
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
    const r = shown[i];
    if (!r) return [];
    if (r.currentWeightKg == null) return ["No weighing this far back"];
    const lines = [
      `${back ? "Weight" : "Current"}: ${kg(r.currentWeightKg!)}${r.weightMethod ? ` (${METHOD[r.weightMethod] ?? r.weightMethod}${r.weightDate ? `, ${day(r.weightDate)}` : ""})` : ""}`,
      r.targetWeightKg != null ? `Healthy minimum: ${range(r)}` : "Healthy minimum: —",
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
    onClick: (_e: any, els: any[]) => {
      const r = els[0] ? shown[els[0].index] : null;
      if (r && onSelect) onSelect(r.herdId);
    },
    onHover: (e: any, els: any[]) => {
      if (onSelect && e.native?.target) e.native.target.style.cursor = els.length ? "pointer" : "default";
    },
    plugins: {
      // On a phone the legend is HTML above the chart, so it wraps to the screen and does not scroll away.
      legend: { display: !phone, position: "top", align: "start", labels: { color: INK_2, usePointStyle: true, boxWidth: 10, font: { size: 12 } } },
      tooltip: {
        enabled: !phone,
        filter: (item: any) => item.datasetIndex === 0,
        callbacks: {
          title: (items: any[]) => (items[0] ? `${items[0].label}${shown[items[0].dataIndex]?.breed ? ` · ${shown[items[0].dataIndex].breed}` : ""}` : ""),
          label: (item: any) => tooltipLines(item.dataIndex),
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          autoSkip: false,
          maxRotation: 60,
          // The animal whose history is open below reads in bold.
          color: (c: any) => (shown[c.index]?.herdId === selectedId ? INK : INK_2),
          font: (c: any) => ({ size: 11, weight: shown[c.index]?.herdId === selectedId ? "bold" : "normal" }),
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grace: "8%",
        grid: { color: GRID },
        border: { display: false },
        afterFit: fixedWidth,
        ticks: { color: INK_2, padding: phone ? 4 : 3, font: { size: phone ? 10 : 12 }, callback: (v: number) => `${v} kg` },
      },
    },
  };

  const bcsData = {
    labels,
    datasets: [
      {
        type: "line" as const,
        label: "Body condition score",
        data: shown.map(r => r.bcs),
        showLine: false,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: shown.map(r => bcsDot(r.bcs)),
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
        enabled: !phone,
        callbacks: {
          label: (item: any) => {
            const r = shown[item.dataIndex];
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
          font: { size: phone ? 10 : 11 },
          // The heading names the scale on a phone, so the ticks are just the numbers there.
          callback: (v: number) => phone ? v : ({ 1: "1 Very thin", 2: "2 Thin", 3: "3 Ideal", 4: "4 Fat", 5: "5 Very fat" } as Record<number, string>)[v] ?? v,
        },
      },
    },
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
      <h2 className="font-bold text-slate-700">Herd Weight &amp; Body Condition</h2>

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
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Healthy</div>
              <div className="text-xl font-bold text-slate-800 mt-1">{stats.aboveCount} <span className="text-sm font-medium text-slate-500">of {stats.weighed}</span></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">BCS below 3</div>
              <div className="text-xl font-bold text-slate-800 mt-1">{stats.lowBcs} <span className="text-sm font-medium text-slate-500">of {stats.scored} scored</span></div>
            </div>
          </div>

          {charted.length > 0 && (
            <div className="-mx-4 md:mx-0">
              <div className="px-4 md:px-0 mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={olderWeighing}
                  disabled={historyState === "loading" || (maxBack != null && back >= maxBack)}
                  aria-label="Previous weighing"
                  title="Previous weighing"
                  className="w-9 h-9 shrink-0 rounded-full border border-slate-300 text-slate-700 text-lg leading-none flex items-center justify-center hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed"
                >‹</button>
                <div className="flex-1 min-w-0 text-center leading-tight">
                  <div className="text-sm font-bold text-slate-700">
                    {historyState === "loading" ? "Loading earlier weighings..." : back === 0 ? "Latest weighing" : back === 1 ? "Previous weighing" : `${back} weighings back`}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {historyState === "error" ? "Could not load earlier weighings." : dateSpan(shown)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBack(b => Math.max(0, b - 1))}
                  disabled={back === 0}
                  aria-label="Next weighing"
                  title="Next weighing"
                  className="w-9 h-9 shrink-0 rounded-full border border-slate-300 text-slate-700 text-lg leading-none flex items-center justify-center hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed"
                >›</button>
              </div>
              {phone && (
                <div className="px-4 mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-[3px] bg-[#0b0b0b]" />Minimum healthy weight</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CURRENT }} />{CURRENT_LABEL}</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: ABOVE }} />{ABOVE_LABEL}</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: MISSING }} />Still to gain</span>
                </div>
              )}
              {/* Weight chart carries the scrollbar; the BCS chart below follows it (and can be swiped too) without one. */}
              <div
                ref={weightScrollRef}
                onScroll={() => syncScroll(weightScrollRef, bcsScrollRef)}
                className={scroll ? "overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100" : ""}
                style={scroll ? { scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 #f1f5f9" } : undefined}
              >
                <div className="relative h-80" style={{ width: plotWidth }}>
                  {scroll && (
                    <div className="sticky left-0 z-10 h-0 w-0">
                      <canvas ref={weightAxisRef} className="absolute left-0 top-0 pointer-events-none" />
                    </div>
                  )}
                  <div className="absolute inset-0">
                    <Bar key={scroll ? "scroll" : "fit"} data={weightData as any} options={weightOptions} plugins={weightPlugins} />
                  </div>
                </div>
              </div>
              
              <div className={`mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${phone ? "px-4" : ""}`}>
                Body condition score (1–5, ideal 3)
              </div>
              <div
                ref={bcsScrollRef}
                onScroll={() => syncScroll(bcsScrollRef, weightScrollRef)}
                className={scroll ? "overflow-x-auto [&::-webkit-scrollbar]:hidden" : ""}
                style={scroll ? { scrollbarWidth: "none" } : undefined}
              >
                <div className="relative h-36" style={{ width: plotWidth }}>
                  {scroll && (
                    <div className="sticky left-0 z-10 h-0 w-0">
                      <canvas ref={bcsAxisRef} className="absolute left-0 top-0 pointer-events-none" />
                    </div>
                  )}
                  <div className="absolute inset-0">
                    <Bar key={scroll ? "scroll" : "fit"} data={bcsData as any} options={bcsOptions} plugins={bcsPlugins} />
                  </div>
                </div>
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
                  <th className="px-2 py-2 font-bold text-right">Girth</th>
                  <th className="px-2 py-2 font-bold text-right">Healthy minimum</th>
                  <th className="px-2 py-2 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const s = bcsStyle(r.bcs);
                  return (
                    <tr
                      key={r.herdId}
                      onClick={onSelect ? () => onSelect(r.herdId) : undefined}
                      className={`border-b border-slate-100 align-top ${onSelect ? "cursor-pointer hover:bg-slate-50" : ""} ${r.herdId === selectedId ? "bg-blue-50/60" : ""}`}
                    >
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
                      <td className="px-2 py-2 text-right whitespace-nowrap" title={r.girthDate ? `Heart girth, ${day(r.girthDate)}` : undefined}>
                        {r.girthCm != null ? <span className="font-semibold text-slate-800">{Math.round(r.girthCm)} cm</span> : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-2 py-2 text-right" title={r.targetBasis ?? undefined}>
                        {r.targetWeightKg != null ? (
                          <>
                            {r.baseMinWeightKg != null ? (
                              <BaseMinimum r={r} onSaved={baseSaved} label={range(r)} />
                            ) : (
                              <div className="font-semibold text-slate-800 whitespace-nowrap">{range(r)}</div>
                            )}
                            {(r.pregnancyKg ?? 0) > 0 && (
                              <div className="text-[11px] text-slate-500 whitespace-nowrap">incl. {kg(r.pregnancyKg!)} calf</div>
                            )}
                            <BaseChecks r={r} />
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">No target</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right whitespace-nowrap"><Gap r={r} /><BcsCheck r={r} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

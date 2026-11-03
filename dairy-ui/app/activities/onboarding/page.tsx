"use client";

import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import api from "@/lib/api";
import { useNotification } from "@/components/NotificationContext";
import { CallButton } from "@/components/EmergencyContacts";
import {
  AlertTriangle, ArrowLeft, CalendarDays, Check, ChevronDown, ChevronUp, Home, Pencil, Pill, Plus, RefreshCw, RotateCcw,
  SprayCan, Stethoscope, Syringe, Trash2, Truck, Wheat, X,
} from "lucide-react";

interface Step {
  id: number;
  stepNo?: number | null;
  sortOrder?: number | null;
  stepKey: string;
  title: string;
  detail?: string | null;
  choices?: string | null;
  startDate: string;
  endDate: string;
  feedSharePct?: number | null;
  status: "PENDING" | "DONE" | "SKIPPED";
  doneDate?: string | null;
  notes?: string | null;
  problems?: string | null;
  state: "DONE" | "SKIPPED" | "UPCOMING" | "DUE" | "OVERDUE";
}

interface Onboarding {
  id: number;
  herdId: number;
  arrivalDate: string;
  quarantineDays: number;
  status: "ACTIVE" | "COMPLETED";
  completedDate?: string | null;
  steps: Step[];
  tagNumber?: string;
  animalName?: string;
  animalType?: string;
  dayNumber: number;
  doneCount: number;
  totalCount: number;
  dueCount: number;
  feedSharePct?: number | null;
  calf?: boolean;
  problems?: string | null;
}

interface HerdLite {
  id: number;
  tagNumber: string;
  animalName?: string;
  animalType?: string;
  status?: string;
  procuredDate?: string;
  onboardingDay?: number | null;
}

const ONBOARD_TYPES = ["COW", "BUFFALO", "GOAT"];
const DAY_CHOICES = [7, 14, 21, 30];
/** A calf moves from milk to the calf ration, so its feed stages read better as words than as %. */
const CALF_FEED_LABELS = ["Milk", "Starter", "Greens", "Full"];
const GROUP_TITLES: Record<number, string> = { 1: "Arrival check", 2: "To do", 3: "Vet check", 4: "Vaccination", 5: "Feed" };

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmt = (iso?: string | null) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000);

const name = (o: { animalName?: string; tagNumber?: string }) => o.animalName || o.tagNumber || "Animal";

/** The checklist was removed (or another phone changed it) since this screen loaded. */
const isGone = (err: any) => /not found/i.test(err?.response?.data?.message || "");
const GONE_MESSAGE = "This checklist was changed on another screen. The list is updated.";

/** "!Fever" -> { label: "Fever", problem: true } */
const parseChoices = (raw?: string | null) =>
  (raw ? raw.split("|") : []).map(c => ({ label: c.replace(/^!/, ""), problem: c.startsWith("!") }));

function StepIcon({ stepKey, size = 16 }: { stepKey: string; size?: number }) {
  const Icon = stepKey === "ARRIVAL" ? Truck
    : stepKey === "TICK_TREATMENT" ? SprayCan
    : stepKey === "DEWORMING" ? Pill
    : stepKey === "VET_CHECK" ? Stethoscope
    : stepKey === "VACCINATION" ? Syringe
    : Wheat;
  return <Icon size={size} />;
}

/** When a step is due, in a few words. */
function whenText(step: Step, today: string) {
  if (step.state === "OVERDUE") {
    const late = daysBetween(step.endDate, today);
    return { text: late === 1 ? "1 day late" : `${late} days late`, cls: "text-red-600" };
  }
  if (step.state === "DUE") {
    return step.endDate === today
      ? { text: "Today", cls: "text-amber-700" }
      : { text: `By ${fmt(step.endDate)}`, cls: "text-amber-700" };
  }
  const inDays = daysBetween(today, step.startDate);
  return { text: inDays === 1 ? "Tomorrow" : fmt(step.startDate), cls: "text-slate-400" };
}

type SaveFn = (step: Step, status: Step["status"], date: string, answers: string[], other: string) => void;

/* ─── One thing to record: answers to tap, then Done. The arrival check can be marked again any day. ─── */
function StepAnswer({ o, step, onSave, busy, showTitle }: {
  o: Onboarding;
  step: Step;
  onSave: SaveFn;
  busy: boolean;
  showTitle: boolean;
}) {
  const today = localDate(new Date());
  const choices = parseChoices(step.choices);
  const finished = step.status !== "PENDING";
  const repeatable = step.stepKey === "ARRIVAL";
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [showOther, setShowOther] = useState(false);
  const [other, setOther] = useState("");
  const [date, setDate] = useState(today);
  const [showDate, setShowDate] = useState(false);
  const anyProblem = choices.some(c => c.problem && picked.includes(c.label));
  const when = whenText(step, today);

  const toggle = (label: string) =>
    setPicked(p => p.includes(label) ? p.filter(x => x !== label) : [...p, label]);
  const save = (status: Step["status"]) => {
    onSave(step, status, date, picked, other);
    setEditing(false); setPicked([]); setOther(""); setShowOther(false); setShowDate(false); setDate(today);
  };

  const label = showTitle && (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 w-28 flex-none">
      <StepIcon stepKey={step.stepKey} size={13} /> {step.title}
    </span>
  );

  if (finished && !editing) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        {label}
        <span className={`w-4 h-4 flex-none rounded-full flex items-center justify-center ${step.problems ? "bg-red-50 text-red-600" : step.status === "DONE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
          {step.problems ? <AlertTriangle size={10} /> : <Check size={11} />}
        </span>
        <span className="flex-1 min-w-0 text-xs text-slate-500 truncate">
          {fmt(step.doneDate)}
          {step.status === "SKIPPED" ? " · Not needed" : step.notes ? <> · <span className={step.problems ? "text-red-600 font-semibold" : ""}>{step.notes}</span></> : null}
        </span>
        {step.problems && <CallButton label="Call vet" tone="alert" sheetTitle={`Call for ${name(o)}`} />}
        {repeatable ? (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg px-2.5 py-1 hover:bg-slate-50">
            Update
          </button>
        ) : (
          <button disabled={busy} onClick={() => onSave(step, "PENDING", "", [], "")} aria-label="Undo"
            className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-50"><RotateCcw size={13} /></button>
        )}
      </div>
    );
  }

  return (
    <div className="py-1.5">
      {(showTitle || (step.state !== "DUE" && step.state !== "OVERDUE" && !finished)) && (
        <div className="flex items-center gap-2 mb-1.5">
          {label}
          {!finished && <span className={`text-[11px] font-semibold ${when.cls}`}>{when.text}</span>}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {choices.map(c => {
          const on = picked.includes(c.label);
          // Neutral until picked; a picked problem turns red, anything else picked is just marked
          const cls = !on ? "bg-white border-slate-200 text-slate-600"
            : c.problem ? "bg-red-50 border-red-300 text-red-700" : "bg-slate-100 border-slate-400 text-slate-800";
          return (
            <button key={c.label} type="button" onClick={() => toggle(c.label)}
              className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${cls}`}>
              {on && <Check size={11} className="inline -mt-0.5 mr-0.5" />}{c.label}
            </button>
          );
        })}
        <button type="button" onClick={() => setShowOther(v => !v)}
          className={`px-2.5 py-1 rounded-full border text-xs font-medium ${showOther ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-white border-dashed border-slate-300 text-slate-400"}`}>
          + Other
        </button>
      </div>
      {showOther && (
        <input autoFocus value={other} onChange={e => setOther(e.target.value)}
          className="mt-2 w-full text-sm border border-border rounded-lg px-2.5 py-1.5" />
      )}
      {anyProblem && (
        <div className="mt-2"><CallButton label="Call vet" tone="alert" sheetTitle={`Call for ${name(o)}`} /></div>
      )}
      <div className="mt-2 flex items-center gap-3">
        {showDate ? (
          <input type="date" value={date} max={today} min={o.arrivalDate} onChange={e => setDate(e.target.value)}
            aria-label="Date" className="text-xs border border-border rounded-md px-1.5 py-1" />
        ) : (
          <button type="button" onClick={() => setShowDate(true)} aria-label="Change date"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            <CalendarDays size={13} /> {fmt(date)}
          </button>
        )}
        {repeatable && editing && (
          <>
            <button disabled={busy} onClick={() => { onSave(step, "PENDING", "", [], ""); setEditing(false); }}
              aria-label="Undo last" className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-50"><RotateCcw size={13} /></button>
            <button onClick={() => setEditing(false)} aria-label="Close" className="p-1 text-slate-300 hover:text-slate-600"><X size={14} /></button>
          </>
        )}
        {!repeatable && (
          <button disabled={busy} onClick={() => save("SKIPPED")} className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50">
            Not needed
          </button>
        )}
        <button disabled={busy} onClick={() => save("DONE")}
          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">
          <Check size={13} /> Done
        </button>
      </div>
    </div>
  );
}

/* ─── Step 5: feed stages by day, then join the herd ─── */
function FeedStep({ o, step, onSave, busy }: { o: Onboarding; step?: Step; onSave: SaveFn; busy: boolean }) {
  const q = Math.max(1, o.quarantineDays);
  const stageNow = Math.min(3, Math.max(0, Math.floor((o.dayNumber * 4) / q)));
  const labels = o.calf ? CALF_FEED_LABELS : ["25%", "50%", "75%", "100%"];
  const joined = step && step.status !== "PENDING";
  return (
    <div className="py-1.5">
      <div className="grid grid-cols-4 rounded-md overflow-hidden border border-slate-200 text-[11px]">
        {labels.map((l, i) => (
          <div key={l} title={`Day ${Math.ceil((i * q) / 4)}`}
            className={`py-1 text-center ${i === stageNow && !joined ? "bg-slate-100 text-slate-800 font-semibold" : i < stageNow || joined ? "text-slate-500" : "text-slate-300"}`}>
            {l}
          </div>
        ))}
      </div>
      {step && (
        <div className="mt-2 flex items-center gap-2">
          {joined ? (
            <>
              <span className="w-4 h-4 rounded-full bg-green-100 text-green-700 flex items-center justify-center"><Check size={11} /></span>
              <span className="flex-1 text-xs text-slate-500">{step.title} · {fmt(step.doneDate)}</span>
              <button disabled={busy} onClick={() => onSave(step, "PENDING", "", [], "")} aria-label="Undo"
                className="p-1 text-slate-300 hover:text-slate-600 disabled:opacity-50"><RotateCcw size={13} /></button>
            </>
          ) : (
            <button disabled={busy} onClick={() => onSave(step, "DONE", "", [], "")}
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">
              <Home size={13} /> {step.title}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── A numbered step: header with its state, body when open ─── */
function StepGroup({ no, o, steps, onSave, busy }: { no: number; o: Onboarding; steps: Step[]; onSave: SaveFn; busy: boolean }) {
  const today = localDate(new Date());
  const pending = steps.filter(s => s.status === "PENDING");
  const late = pending.some(s => s.state === "OVERDUE");
  const due = pending.some(s => s.state === "DUE");
  const allDone = steps.length > 0 && pending.length === 0;
  const [open, setOpen] = useState(no === 5 || late || due);
  const next = pending.find(s => s.state === "OVERDUE") || pending.find(s => s.state === "DUE") || pending[0];
  const when = next ? whenText(next, today) : null;
  const lastDone = steps.filter(s => s.doneDate).map(s => s.doneDate!).sort().pop();
  const problem = steps.find(s => s.status === "DONE" && s.problems)?.problems;
  const skippedOnly = allDone && steps.every(s => s.status === "SKIPPED");

  const circle = allDone && problem ? "bg-red-50 text-red-600 border border-red-200"
    : skippedOnly ? "bg-slate-100 text-slate-400"
    : allDone ? "bg-green-100 text-green-700"
    : late ? "bg-red-50 text-red-600 border border-red-200"
    : due ? "bg-amber-50 text-amber-700 border border-amber-200"
    : "bg-slate-50 text-slate-400 border border-slate-200";

  return (
    <div className="py-2">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2.5 text-left">
        <span className={`w-6 h-6 flex-none rounded-full flex items-center justify-center text-xs font-bold ${circle}`}>
          {allDone ? (problem ? <AlertTriangle size={12} /> : skippedOnly ? "–" : <Check size={13} />) : no}
        </span>
        <span className={`flex-1 text-sm font-bold ${allDone ? "text-slate-500" : "text-slate-800"}`}>{GROUP_TITLES[no]}</span>
        {allDone
          ? <span className="text-[11px] text-slate-400">{skippedOnly ? "Not needed" : fmt(lastDone)}{problem && <span className="text-red-600 font-semibold"> · {problem}</span>}</span>
          : when && <span className={`text-[11px] font-semibold ${when.cls}`}>{when.text}</span>}
        {open ? <ChevronUp size={15} className="text-slate-300" /> : <ChevronDown size={15} className="text-slate-300" />}
      </button>
      {open && (
        <div className="pl-[34px] mt-1">
          {no === 5
            ? <FeedStep o={o} step={steps[0]} onSave={onSave} busy={busy} />
            : steps.map(s => <StepAnswer key={s.id} o={o} step={s} onSave={onSave} busy={busy} showTitle={steps.length > 1} />)}
        </div>
      )}
    </div>
  );
}

/* ─── Start / edit ─── */
function OnboardingForm({ herds, editing, onDone, onCancel }: {
  herds: HerdLite[];
  editing?: Onboarding;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useNotification();
  const today = localDate(new Date());
  const [herdId, setHerdId] = useState<string>(editing ? String(editing.herdId) : "");
  const [arrival, setArrival] = useState(editing?.arrivalDate || today);
  const [days, setDays] = useState(editing?.quarantineDays || 14);
  const [saving, setSaving] = useState(false);

  const pickHerd = (id: string) => {
    setHerdId(id);
    const h = herds.find(x => String(x.id) === id);
    if (h?.procuredDate) setArrival(h.procuredDate);
  };

  const save = async () => {
    if (!editing && !herdId) { showToast("Pick the animal.", "error"); return; }
    setSaving(true);
    try {
      const body = { herdId: Number(herdId), arrivalDate: arrival, quarantineDays: days };
      if (editing) await api.put(`/onboarding/${editing.id}`, body);
      else await api.post("/onboarding", body);
      showToast(editing ? "Saved" : "Quarantine started");
      onDone();
    } catch (err: any) {
      if (isGone(err)) { showToast(GONE_MESSAGE, "error"); onDone(); return; }
      showToast(err?.response?.data?.message || "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-border rounded-xl p-3 space-y-3">
      <div className="text-sm font-bold text-slate-800">{editing ? name(editing) : "New animal arrived"}</div>
      {!editing && (
        <select value={herdId} onChange={e => pickHerd(e.target.value)} className="w-full text-sm border border-border rounded-lg px-2.5 py-2 bg-white">
          <option value="">Which animal?</option>
          {herds.map(h => (
            <option key={h.id} value={h.id}>{h.animalName ? `${h.animalName} (${h.tagNumber})` : h.tagNumber}</option>
          ))}
        </select>
      )}
      <label className="flex items-center justify-between gap-2 text-sm text-slate-600">
        Arrived on
        <input type="date" value={arrival} max={today} onChange={e => setArrival(e.target.value)} className="text-sm border border-border rounded-lg px-2 py-1 text-slate-800" />
      </label>
      <div>
        <div className="text-sm text-slate-600 mb-1.5">Keep apart for</div>
        <div className="flex gap-2">
          {DAY_CHOICES.map(d => (
            <button key={d} type="button" onClick={() => setDays(d)}
              className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold ${days === d ? "bg-slate-100 border-slate-400 text-slate-800" : "bg-white border-slate-200 text-slate-600"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="text-xs font-semibold text-slate-500 px-3 py-1.5">Cancel</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-brand rounded-lg px-3 py-1.5 disabled:opacity-50">
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} {editing ? "Save" : "Start quarantine"}
        </button>
      </div>
    </div>
  );
}

/* ─── One animal ─── */
function AnimalCard({ o, focused, startOpen, busy, onSave, onEdit, onRemove }: {
  o: Onboarding;
  focused: boolean;
  startOpen: boolean;
  busy: boolean;
  onSave: SaveFn;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const todo = o.steps.filter(s => s.state === "DUE" || s.state === "OVERDUE");
  const day = Math.max(0, o.dayNumber);
  const pct = o.totalCount ? Math.round((o.doneCount / o.totalCount) * 100) : 0;
  const ordered = [...o.steps].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className={`bg-white px-3 pt-3 ${open ? "pb-1" : "pb-3"} rounded-xl border ${focused ? "border-slate-400" : "border-border"}`}>
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <div className="w-9 h-9 flex-none bg-amber-50 text-amber-700 rounded-full flex items-center justify-center text-sm font-bold">
          {name(o)[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">{name(o)}</span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 uppercase">{o.calf ? "Calf" : (o.animalType || "").toLowerCase()}</span>
          </div>
          <div className="text-xs text-slate-500">
            Day <b className="text-slate-800">{day}</b> of {o.quarantineDays}
            {!open && (todo.length > 0
              ? <span className={todo.some(s => s.state === "OVERDUE") ? "text-red-600" : "text-amber-700"}> · {todo.length} to do</span>
              : <span className="text-green-700"> · <Check size={11} className="inline -mt-0.5" /></span>)}
          </div>
        </div>
        {!open && o.problems && <AlertTriangle size={15} className="text-red-500 flex-none" aria-label={o.problems} />}
        {open && (
          <>
            <button onClick={e => { e.stopPropagation(); onEdit(); }} aria-label="Change arrival date or days" className="p-1.5 text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
            <button onClick={e => { e.stopPropagation(); onRemove(); }} aria-label="Remove" className="p-1.5 text-slate-300 hover:text-red-600"><Trash2 size={14} /></button>
          </>
        )}
        {open ? <ChevronUp size={18} className="text-slate-400 flex-none" /> : <ChevronDown size={18} className="text-slate-400 flex-none" />}
      </div>

      {open && (
        <>
          <div className="mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map(no => {
              const steps = ordered.filter(s => s.stepNo === no);
              return steps.length > 0 && <StepGroup key={no} no={no} o={o} steps={steps} onSave={onSave} busy={busy} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const logId = searchParams.get("logId");
  const focusHerd = searchParams.get("herdId");
  const { showToast, confirm } = useNotification();

  const [list, setList] = useState<Onboarding[]>([]);
  const [herds, setHerds] = useState<HerdLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Onboarding | null>(null);

  const load = useCallback(async () => {
    try {
      const [ob, hr] = await Promise.all([api.get("/onboarding"), api.get("/herds")]);
      setList(ob.data || []);
      setHerds(hr.data?.herds || []);
      setError("");
    } catch {
      setError("Could not load the list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Newest arrivals first; animals already in quarantine are left out
  const candidates = useMemo(() => herds
    .filter(h => h.status === "ACTIVE" && ONBOARD_TYPES.includes((h.animalType || "").toUpperCase()) && h.onboardingDay == null)
    .sort((a, b) => (b.procuredDate || "").localeCompare(a.procuredDate || "") || b.id - a.id), [herds]);

  const saveStep = async (step: Step, status: Step["status"], date: string, answers: string[], other: string) => {
    setBusy(true);
    try {
      const res = await api.patch(`/onboarding/steps/${step.id}${logId ? `?logId=${logId}` : ""}`,
        { status, doneDate: date || null, answers, notes: other });
      setList(prev => prev.map(o => o.id === res.data.id ? res.data : o));
      if (step.stepKey === "RELEASE" && status === "DONE") showToast(`${name(res.data)} has joined the herd`);
    } catch (err: any) {
      if (isGone(err)) { showToast(GONE_MESSAGE, "error"); load(); return; }
      showToast(err?.response?.data?.message || "Could not save.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = (o: Onboarding) =>
    confirm(`Remove the quarantine checklist of ${name(o)}?`, async () => {
      try {
        await api.delete(`/onboarding/${o.id}`);
        load();
      } catch {
        showToast("Could not remove.", "error");
      }
    }, "danger");

  const active = list.filter(o => o.status === "ACTIVE");
  const recent = list.filter(o => o.status === "COMPLETED");
  const dueTotal = active.reduce((n, o) => n + (o.dueCount || 0), 0);
  const ordered = focusHerd ? [...active].sort((a, b) => (String(b.herdId) === focusHerd ? 1 : 0) - (String(a.herdId) === focusHerd ? 1 : 0)) : active;

  return (
    <AppLayout>
      <div className="flex flex-col max-w-2xl mx-auto">
        <button onClick={() => router.push("/activities")} className="flex items-center gap-1 text-text3 hover:text-text text-sm mb-3">
          <ArrowLeft size={16} /> Back to chores
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text">New animals</h1>
            <p className="text-sm text-text3 mt-1">
              {active.length === 0 ? "None in quarantine" : `${active.length} in quarantine · ${dueTotal === 0 ? "nothing to do today" : `${dueTotal} to do`}`}
            </p>
          </div>
          <div className="flex-none flex items-center gap-2">
          <CallButton />
          {!showForm && !editing && (
            <button onClick={() => setShowForm(true)}
              className="flex-none inline-flex items-center gap-1 bg-brand text-white text-xs font-semibold rounded-lg px-3 py-2 hover:bg-brand-dark">
              <Plus size={14} /> New arrival
            </button>
          )}
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>}

        {(showForm || editing) && (
          <div className="mt-4">
            <OnboardingForm
              herds={candidates}
              editing={editing || undefined}
              onCancel={() => { setShowForm(false); setEditing(null); }}
              onDone={() => { setShowForm(false); setEditing(null); load(); }}
            />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-8 text-text3"><RefreshCw className="animate-spin w-5 h-5 mr-2" /> Loading...</div>
        ) : active.length === 0 && recent.length === 0 ? (
          <div className="mt-6 text-center p-8 bg-surface border border-border rounded-radius-custom text-text3 text-sm">
            New cow or calf bought? Tap <b>New arrival</b>. The app tells you what to do each day until it joins the herd.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {ordered.map(o => (
              <AnimalCard key={o.id} o={o} focused={String(o.herdId) === focusHerd} busy={busy} onSave={saveStep}
                startOpen={active.length === 1 || String(o.herdId) === focusHerd}
                onEdit={() => { setEditing(o); setShowForm(false); }} onRemove={() => remove(o)} />
            ))}

            {recent.length > 0 && (
              <div>
                <div className="text-xs font-bold text-text3 uppercase tracking-wide mb-1.5">Joined the herd</div>
                <div className="space-y-1.5">
                  {recent.map(o => (
                    <div key={o.id} className="bg-white border border-green-100 rounded-xl px-3 py-2 flex items-center gap-2.5">
                      <Check size={18} className="flex-none text-green-600 bg-green-100 rounded-md p-0.5" />
                      <div className="flex-1 min-w-0 text-sm">
                        <span className="font-bold text-slate-700">{name(o)}</span>
                        <span className="text-xs text-slate-500"> · joined {fmt(o.completedDate)}</span>
                        {o.problems && <span className="text-xs text-red-600"> · {o.problems}</span>}
                      </div>
                      <button onClick={() => {
                        const release = o.steps.find(s => s.stepKey === "RELEASE");
                        if (release) confirm(`Put ${name(o)} back in quarantine?`, () => saveStep(release, "PENDING", "", [], ""));
                      }} title="Back to quarantine" className="p-1.5 text-slate-400 hover:text-brand"><RotateCcw size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}

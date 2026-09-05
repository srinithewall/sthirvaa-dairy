"use client";

import React, { useEffect, useState } from "react";
import { X, Lock } from "lucide-react";
import api from "@/lib/api";

const WEEKDAYS = [
  { value: "MONDAY", label: "Mon" },
  { value: "TUESDAY", label: "Tue" },
  { value: "WEDNESDAY", label: "Wed" },
  { value: "THURSDAY", label: "Thu" },
  { value: "FRIDAY", label: "Fri" },
  { value: "SATURDAY", label: "Sat" },
  { value: "SUNDAY", label: "Sun" },
];

const FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "BI_WEEKLY", label: "Bi-weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "CUSTOM_DAYS", label: "Every N days" },
  { value: "ONCE", label: "One-off date" },
];

export interface Routine {
  id?: number;
  title?: string;
  description?: string;
  category?: string;
  frequency?: string;
  intervalDays?: number | null;
  dayOfWeek?: string | null;
  daysOfMonth?: string | null;
  anchorDate?: string | null;
  dueTime?: string | null;
  defaultAssignedStaffId?: number | null;
  systemKey?: string | null;
  actionRoute?: string | null;
  reminderEnabled?: boolean;
  reminderIntervalHours?: number;
  reminderStartTime?: string | null;
  reminderEndTime?: string | null;
  reminderMaxPerDay?: number;
  isActive?: boolean;
}

interface Props {
  routine: Routine | null; // null = create
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

/** "08:00:00" from the API, "08:00" from an <input type="time"> - both need to round-trip. */
const toTimeInput = (value?: string | null) => (value ? value.slice(0, 5) : "");
const fromTimeInput = (value: string) => (value ? `${value}:00` : null);

export default function RoutineForm({ routine, isAdmin, onClose, onSaved }: Props) {
  const isEdit = !!routine?.id;
  const isSystem = !!routine?.systemKey;
  const scheduleLocked = isSystem && !isAdmin;

  const [staff, setStaff] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState(routine?.title || "");
  const [description, setDescription] = useState(routine?.description || "");
  const [category, setCategory] = useState(routine?.category || "HYGIENE");
  const [frequency, setFrequency] = useState(routine?.frequency || "DAILY");
  const [weekdays, setWeekdays] = useState<string[]>(
    routine?.dayOfWeek ? routine.dayOfWeek.split(",").map(d => d.trim()).filter(Boolean) : []
  );
  const [daysOfMonth, setDaysOfMonth] = useState(routine?.daysOfMonth || "1,15,30");
  const [intervalDays, setIntervalDays] = useState(String(routine?.intervalDays ?? 2));
  const [anchorDate, setAnchorDate] = useState(routine?.anchorDate || today());
  const [dueTime, setDueTime] = useState(toTimeInput(routine?.dueTime));
  const [assignedStaffId, setAssignedStaffId] = useState(
    routine?.defaultAssignedStaffId ? String(routine.defaultAssignedStaffId) : ""
  );

  const [reminderEnabled, setReminderEnabled] = useState(routine?.reminderEnabled ?? false);
  const [reminderIntervalHours, setReminderIntervalHours] = useState(String(routine?.reminderIntervalHours ?? 2));
  const [reminderStartTime, setReminderStartTime] = useState(toTimeInput(routine?.reminderStartTime) || "06:00");
  const [reminderEndTime, setReminderEndTime] = useState(toTimeInput(routine?.reminderEndTime) || "20:00");
  const [reminderMaxPerDay, setReminderMaxPerDay] = useState(String(routine?.reminderMaxPerDay ?? 6));

  useEffect(() => {
    api.get("/staff").then(res => setStaff(res.data || [])).catch(() => {});
  }, []);

  const toggleWeekday = (day: string) => {
    setWeekdays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
  };

  const validate = (): string => {
    if (!title.trim()) return "Give the routine a title.";
    if (frequency === "WEEKLY" && weekdays.length === 0) return "Pick at least one weekday.";
    if ((frequency === "BI_WEEKLY" || frequency === "MONTHLY")) {
      const days = daysOfMonth.split(",").map(d => parseInt(d.trim(), 10)).filter(n => !isNaN(n));
      if (days.length === 0) return "Enter at least one day of the month.";
      if (days.some(d => d < 1 || d > 31)) return "Days of the month must be between 1 and 31.";
    }
    if (frequency === "CUSTOM_DAYS" && (parseInt(intervalDays, 10) || 0) < 1) return "The interval must be at least 1 day.";
    if (reminderEnabled && (parseInt(reminderIntervalHours, 10) || 0) < 1) return "The reminder interval must be at least 1 hour.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setSaving(true);

    const payload: Routine = {
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      frequency,
      dayOfWeek: frequency === "WEEKLY" ? weekdays.join(",") : null,
      daysOfMonth: frequency === "BI_WEEKLY" || frequency === "MONTHLY" ? daysOfMonth.trim() : null,
      intervalDays: frequency === "CUSTOM_DAYS" ? parseInt(intervalDays, 10) : null,
      anchorDate: frequency === "ONCE" || frequency === "CUSTOM_DAYS" ? anchorDate : null,
      dueTime: fromTimeInput(dueTime),
      defaultAssignedStaffId: assignedStaffId ? parseInt(assignedStaffId, 10) : null,
      reminderEnabled,
      reminderIntervalHours: parseInt(reminderIntervalHours, 10) || 2,
      reminderStartTime: fromTimeInput(reminderStartTime),
      reminderEndTime: fromTimeInput(reminderEndTime),
      reminderMaxPerDay: parseInt(reminderMaxPerDay, 10) || 6,
      isActive: routine?.isActive ?? true,
    };

    try {
      if (isEdit) {
        await api.put(`/activities/templates/${routine!.id}`, payload);
      } else {
        await api.post("/activities/templates", payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not save the routine. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-radius-custom shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-text">{isEdit ? "Edit routine" : "New routine"}</h2>
          <button onClick={onClose} className="text-text3 hover:text-text p-1"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {isSystem && (
            <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-md p-3">
              <Lock size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Built-in routine. It cannot be deleted{scheduleLocked ? ", and only an admin can change its schedule" : ""}.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text3 mb-1">Title</label>
            <input
              required type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-border rounded-md p-2 text-sm"
              placeholder="e.g. Clean the shed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text3 mb-1">Description (optional)</label>
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-border rounded-md p-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text3 mb-1">Category</label>
              <select
                value={category} onChange={e => setCategory(e.target.value)} disabled={isSystem}
                className="w-full border border-border rounded-md p-2 text-sm bg-white disabled:bg-surface disabled:text-text3"
              >
                <option value="HYGIENE">Hygiene</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="HERD_CHECK">Herd check</option>
                <option value="BIOSECURITY">Biosecurity</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text3 mb-1">Repeats</label>
              <select
                value={frequency} onChange={e => setFrequency(e.target.value)} disabled={scheduleLocked}
                className="w-full border border-border rounded-md p-2 text-sm bg-white disabled:bg-surface disabled:text-text3"
              >
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {frequency === "WEEKLY" && (
            <div>
              <label className="block text-xs font-medium text-text3 mb-1">On these days</label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map(day => (
                  <button
                    key={day.value} type="button" disabled={scheduleLocked}
                    onClick={() => toggleWeekday(day.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      weekdays.includes(day.value)
                        ? "bg-brand text-white border-brand"
                        : "bg-white text-text3 border-border hover:border-brand"
                    } disabled:opacity-60`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(frequency === "BI_WEEKLY" || frequency === "MONTHLY") && (
            <div>
              <label className="block text-xs font-medium text-text3 mb-1">Days of the month</label>
              <input
                type="text" value={daysOfMonth} onChange={e => setDaysOfMonth(e.target.value)}
                disabled={scheduleLocked} placeholder="1,15,30"
                className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface disabled:text-text3"
              />
              <p className="text-[11px] text-text3 mt-1">
                Comma separated. A day the month does not have (like 30 in February) falls on the last day instead.
              </p>
            </div>
          )}

          {frequency === "CUSTOM_DAYS" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text3 mb-1">Every N days</label>
                <input
                  type="number" min={1} value={intervalDays} onChange={e => setIntervalDays(e.target.value)}
                  disabled={scheduleLocked}
                  className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text3 mb-1">Starting from</label>
                <input
                  type="date" value={anchorDate} onChange={e => setAnchorDate(e.target.value)}
                  disabled={scheduleLocked}
                  className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface"
                />
              </div>
            </div>
          )}

          {frequency === "ONCE" && (
            <div>
              <label className="block text-xs font-medium text-text3 mb-1">Date</label>
              <input
                type="date" value={anchorDate} onChange={e => setAnchorDate(e.target.value)}
                disabled={scheduleLocked}
                className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text3 mb-1">Due time (optional)</label>
              <input
                type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                disabled={scheduleLocked}
                className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text3 mb-1">Assign to (optional)</label>
              <select
                value={assignedStaffId} onChange={e => setAssignedStaffId(e.target.value)}
                className="w-full border border-border rounded-md p-2 text-sm bg-white"
              >
                <option value="">Anyone on staff</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text">
              <input
                type="checkbox" checked={reminderEnabled}
                onChange={e => setReminderEnabled(e.target.checked)}
                disabled={scheduleLocked}
                className="w-4 h-4 accent-[color:var(--brand,#2F855A)]"
              />
              Remind staff until this is marked done
            </label>

            {reminderEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text3 mb-1">Every (hours)</label>
                  <input
                    type="number" min={1} max={12} value={reminderIntervalHours}
                    onChange={e => setReminderIntervalHours(e.target.value)} disabled={scheduleLocked}
                    className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text3 mb-1">Max per day</label>
                  <input
                    type="number" min={1} max={12} value={reminderMaxPerDay}
                    onChange={e => setReminderMaxPerDay(e.target.value)} disabled={scheduleLocked}
                    className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text3 mb-1">Not before</label>
                  <input
                    type="time" value={reminderStartTime} onChange={e => setReminderStartTime(e.target.value)}
                    disabled={scheduleLocked}
                    className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text3 mb-1">Not after</label>
                  <input
                    type="time" value={reminderEndTime} onChange={e => setReminderEndTime(e.target.value)}
                    disabled={scheduleLocked}
                    className="w-full border border-border rounded-md p-2 text-sm disabled:bg-surface"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm font-medium text-text3 hover:text-text">
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create routine"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

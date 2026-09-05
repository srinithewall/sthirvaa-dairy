"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import RoutineForm, { Routine } from "@/components/RoutineForm";
import {
  Check, Plus, RefreshCw, Trash2, Pencil, ChevronRight, Lock, History, Clock, AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";

const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  BI_WEEKLY: "Bi-weekly",
  MONTHLY: "Monthly",
  CUSTOM_DAYS: "Custom",
  ONCE: "One-off",
};

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const describeSchedule = (r: Routine) => {
  switch (r.frequency) {
    case "WEEKLY":
      return r.dayOfWeek
        ? r.dayOfWeek.split(",").map(d => d.slice(0, 3).toLowerCase()).join(", ")
        : "Weekly";
    case "BI_WEEKLY":
    case "MONTHLY":
      return r.daysOfMonth ? `Day ${r.daysOfMonth} of each month` : FREQUENCY_LABEL[r.frequency];
    case "CUSTOM_DAYS":
      return `Every ${r.intervalDays || 1} days`;
    case "ONCE":
      return r.anchorDate || "One-off";
    default:
      return "Every day";
  }
};

function ActivitiesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightLogId = searchParams.get("logId");

  const [activeTab, setActiveTab] = useState("TODAY");
  const [logs, setLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const [editing, setEditing] = useState<Routine | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [historyFor, setHistoryFor] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isAdmin = userRole === "ADMIN";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try { setUserRole(JSON.parse(userStr).role || ""); } catch {}
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === "TODAY") fetchTodayLogs();
    else fetchTemplates();
  }, [activeTab]);

  const fetchTodayLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/activities/logs?date=${localDate(new Date())}`);
      setLogs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get("/activities/templates");
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openHistory = async (routine: any) => {
    setHistoryFor(routine);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/activities/templates/${routine.id}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await api.patch(`/activities/logs/${id}/status`, { status: "COMPLETED" });
      fetchTodayLogs();
    } catch (err) {
      alert("Failed to complete task");
    }
  };

  const handleOpenTask = (log: any) => {
    const route = log.activityDetails?.actionRoute;
    if (route) router.push(`${route}?logId=${log.id}`);
  };

  const handleDeleteTemplate = async (routine: any) => {
    if (!confirm(`Delete the routine "${routine.title}"?`)) return;
    try {
      await api.delete(`/activities/templates/${routine.id}`);
      fetchTemplates();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete routine");
    }
  };

  const pendingLogs = logs.filter(l => l.status === "PENDING" || l.status === "OVERDUE");
  const completedLogs = logs.filter(l => l.status === "COMPLETED");

  return (
    <AppLayout>
      <div className="flex flex-col h-full max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-text mb-4">Farm Chores</h1>

        <div className="flex bg-surface rounded-radius-custom p-1 mb-6 shadow-sm border border-border">
          <button
            onClick={() => setActiveTab("TODAY")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "TODAY" ? "bg-white text-brand shadow-sm" : "text-text3 hover:text-text"}`}
          >
            Today&apos;s Checklist
          </button>
          <button
            onClick={() => setActiveTab("ROUTINES")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "ROUTINES" ? "bg-white text-brand shadow-sm" : "text-text3 hover:text-text"}`}
          >
            Manage Routines
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-8 text-text3">
            <RefreshCw className="animate-spin w-5 h-5 mr-2" /> Loading...
          </div>
        ) : (
          <>
            {activeTab === "TODAY" && (
              <div className="space-y-6">
                {pendingLogs.length === 0 && logs.length > 0 && (
                  <div className="bg-surface-green text-green-800 p-4 rounded-radius-custom border border-border-green flex items-center gap-3">
                    <Check className="w-5 h-5" />
                    <div>
                      <h3 className="font-semibold">All done for today!</h3>
                      <p className="text-sm opacity-90">Great job completing the chores.</p>
                    </div>
                  </div>
                )}

                {logs.length === 0 && (
                  <div className="bg-white text-text p-6 rounded-radius-custom border border-border text-center">
                    <h3 className="font-semibold mb-1">No special actions today</h3>
                    <p className="text-sm text-text3 mb-4">You only have regular feeding and milking today.</p>
                    <button onClick={() => setActiveTab("ROUTINES")} className="text-brand text-sm font-medium hover:underline">
                      Add a Routine
                    </button>
                  </div>
                )}

                {pendingLogs.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-text3 uppercase mb-3 px-1">To Do ({pendingLogs.length})</h2>
                    <div className="space-y-3">
                      {pendingLogs.map(log => {
                        const hasRoute = !!log.activityDetails?.actionRoute;
                        const highlighted = highlightLogId === String(log.id);
                        return (
                          <div
                            key={log.id}
                            className={`bg-white p-4 rounded-radius-custom border shadow-sm flex items-start gap-4 ${
                              highlighted ? "border-brand ring-2 ring-brand/20" : "border-border"
                            }`}
                          >
                            <button
                              onClick={() => handleComplete(log.id)}
                              aria-label="Mark as done"
                              className="mt-0.5 w-6 h-6 rounded-full border-2 border-border flex items-center justify-center hover:border-brand hover:bg-brand/5 text-transparent hover:text-brand transition-colors flex-shrink-0"
                            >
                              <Check size={16} />
                            </button>
                            <div
                              className={`flex-1 ${hasRoute ? "cursor-pointer" : ""}`}
                              onClick={() => hasRoute && handleOpenTask(log)}
                            >
                              <h3 className="font-medium text-text text-[15px]">{log.activityDetails?.title}</h3>
                              {log.activityDetails?.description && (
                                <p className="text-sm text-text3 mt-1">{log.activityDetails.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text3">
                                {log.dueTime && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock size={11} /> {String(log.dueTime).slice(0, 5)}
                                  </span>
                                )}
                                {log.status === "OVERDUE" && (
                                  <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                    <AlertTriangle size={11} /> Overdue since {log.dueDate}
                                  </span>
                                )}
                                {log.staffDetails?.name && <span>Assigned to {log.staffDetails.name}</span>}
                              </div>
                              {hasRoute && (
                                <span className="inline-flex items-center gap-1 text-brand text-xs font-medium mt-2">
                                  Open task <ChevronRight size={13} />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-surface border border-border text-text3">
                              {FREQUENCY_LABEL[log.activityDetails?.frequency] || log.activityDetails?.frequency}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {completedLogs.length > 0 && (
                  <div className="opacity-70">
                    <h2 className="text-sm font-semibold text-text3 uppercase mb-3 px-1">Completed ({completedLogs.length})</h2>
                    <div className="space-y-3">
                      {completedLogs.map(log => (
                        <div key={log.id} className="bg-surface p-4 rounded-radius-custom border border-border flex items-start gap-4">
                          <div className="mt-0.5 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center flex-shrink-0">
                            <Check size={16} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-text line-through">{log.activityDetails?.title}</h3>
                            {log.staffDetails?.name && (
                              <p className="text-[11px] text-text3 mt-1">Done by {log.staffDetails.name}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "ROUTINES" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold text-text3 uppercase">Active Routines</h2>
                  <button
                    onClick={() => { setEditing(null); setShowForm(true); }}
                    className="text-brand text-sm font-medium flex items-center gap-1 hover:underline"
                  >
                    <Plus size={16} /> Add New
                  </button>
                </div>

                {templates.length === 0 && (
                  <div className="text-center p-8 bg-surface border border-border rounded-radius-custom text-text3 text-sm">
                    No routines defined yet.
                  </div>
                )}

                <div className="space-y-3">
                  {templates.map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-radius-custom border border-border shadow-sm">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium text-text text-[15px] flex items-center gap-1.5">
                            {t.title}
                            {t.systemKey && <Lock size={12} className="text-text3 flex-shrink-0" />}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface border border-border text-text3">
                              {FREQUENCY_LABEL[t.frequency] || t.frequency}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">{t.category}</span>
                            {t.reminderEnabled && (
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                                Reminds every {t.reminderIntervalHours || 2}h
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text3 mt-1.5">
                            {describeSchedule(t)}{t.dueTime ? ` at ${String(t.dueTime).slice(0, 5)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center flex-shrink-0">
                          <button
                            onClick={() => openHistory(t)}
                            aria-label="View history"
                            className="text-text3 hover:text-brand p-2"
                          >
                            <History size={17} />
                          </button>
                          <button
                            onClick={() => { setEditing(t); setShowForm(true); }}
                            aria-label="Edit routine"
                            className="text-text3 hover:text-brand p-2"
                          >
                            <Pencil size={17} />
                          </button>
                          {!t.systemKey && (
                            <button
                              onClick={() => handleDeleteTemplate(t)}
                              aria-label="Delete routine"
                              className="text-text3 hover:text-red-500 p-2"
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <RoutineForm
          routine={editing}
          isAdmin={isAdmin}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={fetchTemplates}
        />
      )}

      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-radius-custom shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-white">
              <div>
                <h2 className="font-semibold text-text">{historyFor.title}</h2>
                <p className="text-xs text-text3">Tracking history</p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="text-text3 hover:text-text text-sm font-medium px-2">
                Close
              </button>
            </div>
            <div className="p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center p-6 text-text3">
                  <RefreshCw className="animate-spin w-4 h-4 mr-2" /> Loading...
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-text3 text-center py-6">Nothing recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center justify-between border border-border rounded-md p-3">
                      <div>
                        <p className="text-sm font-medium text-text">{h.dueDate}</p>
                        {h.staffDetails?.name && <p className="text-[11px] text-text3">{h.staffDetails.name}</p>}
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                          h.status === "COMPLETED"
                            ? "bg-green-50 text-green-700"
                            : h.status === "OVERDUE"
                            ? "bg-red-50 text-red-700"
                            : h.status === "SKIPPED"
                            ? "bg-surface text-text3"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function ActivitiesPage() {
  return (
    <Suspense fallback={null}>
      <ActivitiesPageInner />
    </Suspense>
  );
}

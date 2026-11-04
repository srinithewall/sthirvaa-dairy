import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ClipboardList, AlertCircle, RefreshCw, X } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface FarmActivityLog {
  id: number;
  activityId: number;
  dueDate: string;
  status: string;
  activityDetails: {
    title: string;
    description: string;
    category: string;
    /** The screen where this chore is carried out, e.g. /activities/weight-round. */
    actionRoute?: string;
  };
}

const CATEGORY_LABEL: Record<string, string> = {
  HERD_CHECK: "Herd check",
  HYGIENE: "Hygiene",
  BIOSECURITY: "Biosecurity",
  MAINTENANCE: "Maintenance",
};

/** "Due 18 Oct" for a carried-over chore; today's need no date. */
const overdueLabel = (dueDate: string) => {
  const [y, m, d] = dueDate.split("-").map(Number);
  return `Due ${new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
};

export default function TodayFarmActions() {
  const router = useRouter();
  const [logs, setLogs] = useState<FarmActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  /** The chore open in the pop-up. */
  const [openLog, setOpenLog] = useState<FarmActivityLog | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetchTodayLogs();
  }, []);

  const fetchTodayLogs = async () => {
    try {
      setLoading(true);
      // /today = due today plus anything still open from earlier days, so a chore that is
      // being pushed about is also visible here.
      const res = await api.get("/activities/today");
      setLogs(res.data);
    } catch (error) {
      console.error("Failed to fetch farm actions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (id: number) => {
    try {
      setCompleting(true);
      await api.patch(`/activities/logs/${id}/status`, { status: "COMPLETED" });
      setOpenLog(null);
      fetchTodayLogs();
    } catch (err) {
      alert("Failed to complete task");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-radius-custom p-4 shadow-sm border border-border mb-6 flex items-center justify-center h-20 text-text3">
        <RefreshCw className="animate-spin w-4 h-4 mr-2" /> Loading chores...
      </div>
    );
  }

  const pendingLogs = logs.filter(l => l.status === "PENDING" || l.status === "OVERDUE");
  const completedLogs = logs.filter(l => l.status === "COMPLETED");

  if (logs.length === 0 || pendingLogs.length === 0) {
    // Finishing every chore and having none scheduled are different things - saying "no special
    // actions" after the work was done reads as if the completions had not registered.
    const allDone = completedLogs.length > 0;
    return (
      <div className="bg-surface-green border border-border-green rounded-radius-custom p-4 mb-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-full text-green-700">
            <Check size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-text text-[14px]">
              {allDone ? "All chores done for today" : "No special actions today"}
            </h3>
            <p className="text-[13px] text-text3">
              {allDone
                ? `${completedLogs.length} completed. Just regular feeding and milking left.`
                : "Just regular feeding and milking."}
            </p>
          </div>
        </div>
        <Link href="/activities" className="text-[13px] font-medium text-brand hover:underline">
          Manage routines
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-radius-custom p-4 mb-6 shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text text-[15px] flex items-center gap-2">
          <ClipboardList className="text-brand w-4 h-4" /> Today's Chores
        </h3>
        <Link href="/activities" className="text-[13px] text-brand font-medium hover:underline">
          View all
        </Link>
      </div>
      {/* Pending chores are red buttons; the ones done today stay beside them in green. */}
      {/* Phones: one full-width row per chore (uneven wrapped pills look ragged there). */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {[...pendingLogs, ...completedLogs].map((log) => {
          const done = log.status === "COMPLETED";
          return (
            <button
              key={log.id}
              type="button"
              onClick={() => {
                // A pending chore goes straight to the screen where it is done (same as the
                // banner); finished ones, or ones with no screen, open the details pop-up.
                const route = log.activityDetails.actionRoute;
                if (!done && route) router.push(`${route}?logId=${log.id}`);
                else setOpenLog(log);
              }}
              title={done ? "Done - see the details" : "Pending - open to complete"}
              className={`flex w-full sm:w-auto items-center gap-2 px-3.5 py-2.5 sm:py-2 rounded-xl sm:rounded-full text-[13px] font-semibold text-left border transition-colors ${
                done
                  ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                  : "bg-red-600 border-red-600 text-white hover:bg-red-700 shadow-sm"
              }`}
            >
              {done ? <Check size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
              <span className="flex-1 min-w-0 truncate">{log.activityDetails.title}</span>
              {log.status === "OVERDUE" && (
                <span className="shrink-0 text-[10px] font-black uppercase tracking-wide bg-white/20 rounded px-1.5 py-0.5">Overdue</span>
              )}
            </button>
          );
        })}
      </div>

      {openLog && (
        <ChoreModal
          log={openLog}
          completing={completing}
          onClose={() => setOpenLog(null)}
          onComplete={() => handleComplete(openLog.id)}
        />
      )}
    </div>
  );
}

/** Pop-up for one chore: what it is, when it was due, and the button to mark it done. */
function ChoreModal({ log, completing, onClose, onComplete }: {
  log: FarmActivityLog; completing: boolean; onClose: () => void; onComplete: () => void;
}) {
  const done = log.status === "COMPLETED";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[3000] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="chore-title"
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className={`px-5 py-4 flex items-start justify-between gap-3 ${done ? "bg-green-50" : "bg-red-50"}`}>
          <div className="min-w-0">
            <span className={`inline-block text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full mb-1.5 ${
              done ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {done ? "Done" : log.status === "OVERDUE" ? "Overdue" : "Pending"}
            </span>
            <h2 id="chore-title" className="font-semibold text-[17px] text-text">{log.activityDetails.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-black/5 text-text3">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-[13px]">
          <div className="flex items-center justify-between">
            <span className="text-text3">Type</span>
            <span className="text-[11px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {CATEGORY_LABEL[log.activityDetails.category] || log.activityDetails.category}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text3">Due</span>
            <span className={`font-semibold ${log.status === "OVERDUE" ? "text-red-600" : "text-text"}`}>
              {overdueLabel(log.dueDate).replace("Due ", "")}{log.status === "OVERDUE" ? " · overdue" : ""}
            </span>
          </div>
          {log.activityDetails.description && (
            <p className="text-text2 leading-relaxed bg-surface rounded-lg border border-border px-3 py-2.5">
              {log.activityDetails.description}
            </p>
          )}
        </div>

        <div className="px-5 pb-5 flex items-center justify-between gap-3">
          <Link href="/activities" className="text-[13px] text-brand font-medium hover:underline">
            Manage routines
          </Link>
          {done ? (
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-[13px] font-semibold text-text2 hover:bg-surface">
              Close
            </button>
          ) : (
            <button onClick={onComplete} disabled={completing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-[13px] font-semibold">
              {completing ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Mark as done
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

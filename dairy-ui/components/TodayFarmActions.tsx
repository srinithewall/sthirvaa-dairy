import React, { useState, useEffect } from "react";
import { Check, ClipboardList, AlertCircle, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import Link from "next/link";

interface FarmActivityLog {
  id: number;
  activityId: number;
  dueDate: string;
  status: string;
  activityDetails: {
    title: string;
    description: string;
    category: string;
  };
}

export default function TodayFarmActions() {
  const [logs, setLogs] = useState<FarmActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

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
      await api.patch(`/activities/logs/${id}/status`, { status: "COMPLETED" });
      fetchTodayLogs();
    } catch (err) {
      alert("Failed to complete task");
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
      <div className="space-y-3">
        {pendingLogs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 p-3 bg-surface rounded-radius-custom border border-border hover:border-brand/30 transition-colors">
            <button
              onClick={() => handleComplete(log.id)}
              className="mt-0.5 w-5 h-5 rounded border border-border flex items-center justify-center hover:border-brand hover:bg-brand/5 text-transparent hover:text-brand transition-colors flex-shrink-0"
              title="Mark as completed"
            >
              <Check size={14} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[14px] text-text">{log.activityDetails.title}</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {log.activityDetails.category}
                </span>
              </div>
              {log.activityDetails.description && (
                <p className="text-[12px] text-text3 mt-0.5">{log.activityDetails.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

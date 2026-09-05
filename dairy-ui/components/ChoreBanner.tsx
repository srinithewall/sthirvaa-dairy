"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import api from "@/lib/api";

/**
 * A slim bar surfacing open chores while the app is in the foreground.
 *
 * Push notifications only appear when the app is closed or backgrounded, so without this a
 * staff member using the app would see nothing until they navigated to Farm Chores. It stays
 * a banner rather than the blocking modal it replaces - the old one interrupted whatever you
 * were doing on a fixed hourly schedule, whether or not anything was actually pending.
 */
export default function ChoreBanner() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [dismissedKey, setDismissedKey] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/activities/today");
      const open = (res.data || []).filter(
        (l: any) => l.status === "PENDING" || l.status === "OVERDUE"
      );
      setLogs(open);
    } catch {
      // A failed poll should never break the page it sits on.
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);

    // A push arriving while the app is open is delivered silently by the OS - refresh so the
    // banner reflects it immediately rather than up to five minutes later.
    const onPush = () => load();
    window.addEventListener("chore-push", onPush);
    return () => {
      clearInterval(id);
      window.removeEventListener("chore-push", onPush);
    };
  }, [load]);

  useEffect(() => {
    try {
      setDismissedKey(sessionStorage.getItem("choreBannerDismissed") || "");
    } catch {
      // Private browsing can throw on access; treat as not dismissed.
    }
  }, []);

  if (logs.length === 0) return null;

  // Dismissal only holds while the same chores are outstanding - a new one brings the bar back.
  const currentKey = logs.map(l => l.id).sort().join(",");
  if (dismissedKey === currentKey) return null;

  const overdue = logs.filter(l => l.status === "OVERDUE");
  const lead = overdue[0] || logs[0];
  const isOverdue = overdue.length > 0;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedKey(currentKey);
    try {
      sessionStorage.setItem("choreBannerDismissed", currentKey);
    } catch {
      // Non-fatal - the banner simply reappears on the next load.
    }
  };

  const handleOpen = () => {
    const route = lead.activityDetails?.actionRoute;
    router.push(route ? `${route}?logId=${lead.id}` : "/activities");
  };

  return (
    <div
      onClick={handleOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter") handleOpen(); }}
      className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer border-b text-sm ${
        isOverdue
          ? "bg-red-50 border-red-200 text-red-900"
          : "bg-amber-50 border-amber-200 text-amber-900"
      }`}
    >
      <AlertTriangle size={16} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium">{lead.activityDetails?.title}</span>
        <span className="opacity-80">
          {isOverdue ? ` · overdue since ${lead.dueDate}` : " · due today"}
          {logs.length > 1 ? ` · +${logs.length - 1} more` : ""}
        </span>
      </div>
      <ChevronRight size={16} className="flex-shrink-0 opacity-70" />
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 p-1 -mr-1 opacity-60 hover:opacity-100"
      >
        <X size={15} />
      </button>
    </div>
  );
}

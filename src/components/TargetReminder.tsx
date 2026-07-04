"use client";

import { useEffect, useState, useCallback } from "react";
import { Target, X, PhoneCall, CheckCircle2 } from "lucide-react";
import {
  getReminderIntervalMin,
  setReminderIntervalMin,
  REMINDER_EVENT,
  REMINDER_KEY,
} from "@/lib/reminder";

// How long each toast stays on screen (ms).
const VISIBLE_MS = 9000;
// Delay before the first popup after page load (ms).
const FIRST_DELAY_MS = 8000;

interface TargetProgress {
  targetLeads: number;
  targetConverts: number;
  actualLeads: number;
  actualConverts: number;
}

export default function TargetReminder({ role }: { role: string }) {
  const [progress, setProgress] = useState<TargetProgress | null>(null);
  const [visible, setVisible] = useState(false);
  const [intervalMin, setIntervalMin] = useState<number>(10);

  // Pull the admin-configured global interval from the server and cache it locally.
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.reminderIntervalMin === "number") {
          setReminderIntervalMin(d.reminderIntervalMin);
        }
      })
      .catch(() => {});
  }, []);

  // Read the configured interval, and react to changes (this tab + others).
  useEffect(() => {
    setIntervalMin(getReminderIntervalMin());
    const sync = () => setIntervalMin(getReminderIntervalMin());
    window.addEventListener(REMINDER_EVENT, sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === REMINDER_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(REMINDER_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const fetchAndShow = useCallback(async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    try {
      const res = await fetch(`/api/targets?month=${month}&year=${year}`);
      if (!res.ok) return;
      const list = await res.json();
      const t = Array.isArray(list) ? list[0] : null;
      if (!t) return; // no target set -> nothing to nag about
      setProgress({
        targetLeads: t.targetLeads,
        targetConverts: t.targetConverts,
        actualLeads: t.actualLeads,
        actualConverts: t.actualConverts,
      });
      setVisible(true);
      window.setTimeout(() => setVisible(false), VISIBLE_MS);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Telecallers are the ones with monthly targets; 0 = reminders off.
    if (role !== "TELECALLER" || intervalMin <= 0) return;
    const first = window.setTimeout(fetchAndShow, FIRST_DELAY_MS);
    const interval = window.setInterval(fetchAndShow, intervalMin * 60 * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [role, intervalMin, fetchAndShow]);

  if (!visible || !progress) return null;

  const leadPct = progress.targetLeads
    ? Math.min(100, Math.round((progress.actualLeads / progress.targetLeads) * 100))
    : 0;
  const convPct = progress.targetConverts
    ? Math.min(100, Math.round((progress.actualConverts / progress.targetConverts) * 100))
    : 0;
  const leadsLeft = Math.max(0, progress.targetLeads - progress.actualLeads);

  return (
    <div className="fixed top-5 right-5 z-[60] w-80 animate-slide-right">
      <div className="rounded-2xl bg-white shadow-2xl shadow-black/10 border border-slate-100 overflow-hidden">
        <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-white">
          <Target size={18} />
          <p className="text-sm font-semibold flex-1">Monthly Target</p>
          <button onClick={() => setVisible(false)} className="text-white/80 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {/* Leads */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-slate-600"><PhoneCall size={12} /> Leads</span>
              <span className="font-semibold text-slate-800">{progress.actualLeads}/{progress.targetLeads}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${leadPct}%` }} />
            </div>
          </div>
          {/* Converts */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-slate-600"><CheckCircle2 size={12} /> Conversions</span>
              <span className="font-semibold text-slate-800">{progress.actualConverts}/{progress.targetConverts}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${convPct}%` }} />
            </div>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            {leadsLeft > 0
              ? `${leadsLeft} more lead${leadsLeft === 1 ? "" : "s"} to hit your target. Keep going! 💪`
              : "Lead target reached — great work! 🎉"}
          </p>
        </div>
      </div>
    </div>
  );
}

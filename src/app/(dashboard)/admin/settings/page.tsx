"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { Bell, Loader2, Check } from "lucide-react";
import { REMINDER_OPTIONS, setReminderIntervalMin } from "@/lib/reminder";

export default function AdminSettingsPage() {
  const [interval, setInterval] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.reminderIntervalMin === "number") setInterval(d.reminderIntervalMin);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminderIntervalMin: interval }),
    });
    setSaving(false);
    if (res.ok) {
      // keep the admin's own cache in sync too
      setReminderIntervalMin(interval);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not save settings");
    }
  };

  return (
    <>
      <Header title="Settings" subtitle="System configuration" />
      <div className="p-6 max-w-2xl">
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Target Reminder</h3>
              <p className="text-xs text-slate-400">
                How often telecallers see the target-progress popup. Applies to all telecallers.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Reminder frequency</label>
              <select
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value, 10))}
                className="w-full sm:w-64 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-400">
                Choose “Off” to disable the popup entirely.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/20"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save
                </button>
                {saved && <span className="text-sm text-emerald-600 font-medium animate-fade-in">Saved ✓</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

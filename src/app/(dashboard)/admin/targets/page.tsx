"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Target, IndianRupee, Plus, Loader2, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

interface Telecaller {
  id: string;
  name: string;
  email: string;
}

interface TargetData {
  id: string;
  telecallerId: string;
  month: number;
  year: number;
  targetLeads: number;
  targetConverts: number;
  bonusAmount: number;
  achievedBonus: boolean;
  actualLeads: number;
  actualConverts: number;
  telecaller: { id: string; name: string; email: string };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AdminTargetsPage() {
  const now = new Date();
  const [targets, setTargets] = useState<TargetData[]>([]);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    telecallerId: "",
    targetLeads: 0,
    targetConverts: 0,
    bonusAmount: 0,
  });

  useEffect(() => {
    fetchTargets();
    fetchTelecallers();
  }, [month, year]);

  const fetchTargets = async () => {
    setLoading(true);
    const res = await fetch(`/api/targets?month=${month}&year=${year}`);
    setTargets(await res.json());
    setLoading(false);
  };

  const fetchTelecallers = async () => {
    const res = await fetch("/api/users?role=TELECALLER");
    setTelecallers(await res.json());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, month, year }),
    });
    setSaving(false);
    setShowForm(false);
    setForm({ telecallerId: "", targetLeads: 0, targetConverts: 0, bonusAmount: 0 });
    fetchTargets();
  };

  const getProgress = (actual: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, Math.round((actual / target) * 100));
  };

  return (
    <>
      <Header title="Goals & Bonuses" subtitle="Monthly targets and incentives" />
      <div className="p-6">
        {/* Month/Year Selector */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-medium"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Set Target
          </button>
        </div>

        {/* Targets Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : targets.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Target size={48} className="mx-auto mb-4 opacity-30" />
            <p>No targets set for {MONTHS[month - 1]} {year}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {targets.map((t) => {
              const leadProgress = getProgress(t.actualLeads, t.targetLeads);
              const convertProgress = getProgress(t.actualConverts, t.targetConverts);
              const achieved = leadProgress >= 100 && convertProgress >= 100;

              return (
                <div key={t.id} className="bg-white rounded-2xl border border-slate-100 p-5 card-hover">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold",
                      achieved
                        ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                        : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                    )}>
                      {getInitials(t.telecaller.name)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{t.telecaller.name}</p>
                      <p className="text-xs text-slate-400">{t.telecaller.email}</p>
                    </div>
                  </div>

                  {/* Progress Bars */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Leads</span>
                        <span className="font-medium text-slate-700">{t.actualLeads}/{t.targetLeads}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            leadProgress >= 100 ? "bg-emerald-500" : "bg-indigo-500"
                          )}
                          style={{ width: `${leadProgress}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-500">Conversions</span>
                        <span className="font-medium text-slate-700">{t.actualConverts}/{t.targetConverts}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            convertProgress >= 100 ? "bg-emerald-500" : "bg-purple-500"
                          )}
                          style={{ width: `${convertProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bonus */}
                  <div className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl",
                    achieved ? "bg-emerald-50" : "bg-slate-50"
                  )}>
                    <div className="flex items-center gap-2">
                      <IndianRupee size={16} className={achieved ? "text-emerald-600" : "text-slate-400"} />
                      <span className={cn("text-sm font-semibold", achieved ? "text-emerald-700" : "text-slate-600")}>
                        ₹{t.bonusAmount.toLocaleString()}
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      achieved ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                    )}>
                      {achieved ? "Achieved!" : "Pending"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">
                  Set Target — {MONTHS[month - 1]} {year}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telecaller</label>
                  <select value={form.telecallerId} onChange={(e) => setForm({ ...form, telecallerId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" required>
                    <option value="">Select...</option>
                    {telecallers.map((tc) => (
                      <option key={tc.id} value={tc.id}>{tc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Leads</label>
                    <input type="number" min={0} value={form.targetLeads} onChange={(e) => setForm({ ...form, targetLeads: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Conversions</label>
                    <input type="number" min={0} value={form.targetConverts} onChange={(e) => setForm({ ...form, targetConverts: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bonus Amount (₹)</label>
                  <input type="number" min={0} value={form.bonusAmount} onChange={(e) => setForm({ ...form, bonusAmount: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    Save Target
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

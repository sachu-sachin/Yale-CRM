"use client";

import { useEffect, useState, useCallback } from "react";
import { IndianRupee, Loader2, Filter } from "lucide-react";
import { formatCurrency, leadSourceLabels, adPhaseLabels } from "@/lib/utils";

interface Telecaller { id: string; name: string; }
interface RevenueData { revenue: number; paidDeals: number; pendingRevenue: number; pendingDeals: number; }

export default function RevenuePanel() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [telecaller, setTelecaller] = useState("");
  const [source, setSource] = useState("");
  const [phase, setPhase] = useState("");

  useEffect(() => {
    fetch("/api/users?role=TELECALLER").then((r) => r.json()).then(setTelecallers).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (telecaller) p.set("telecaller", telecaller);
    if (source) p.set("source", source);
    if (phase) p.set("phase", phase);
    const res = await fetch(`/api/revenue?${p.toString()}`);
    setData(await res.json());
    setLoading(false);
  }, [from, to, telecaller, source, phase]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <IndianRupee size={22} />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Revenue (Paid)</p>
            <p className="text-3xl font-bold text-slate-900">
              {loading ? <Loader2 size={24} className="animate-spin text-slate-300" /> : formatCurrency(data?.revenue || 0)}
            </p>
          </div>
        </div>
        {data && !loading && (
          <div className="text-right text-sm">
            <p className="text-slate-500">{data.paidDeals} paid deal{data.paidDeals === 1 ? "" : "s"}</p>
            <p className="text-amber-600">{formatCurrency(data.pendingRevenue)} pending ({data.pendingDeals})</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={15} className="text-slate-400" />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs" />
        <span className="text-slate-300 text-xs">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs" />
        <select value={telecaller} onChange={(e) => setTelecaller(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
          <option value="">All telecallers</option>
          {telecallers.map((tc) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
          <option value="">All sources</option>
          {Object.entries(leadSourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={phase} onChange={(e) => setPhase(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs">
          <option value="">All phases</option>
          {Object.entries(adPhaseLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(from || to || telecaller || source || phase) && (
          <button onClick={() => { setFrom(""); setTo(""); setTelecaller(""); setSource(""); setPhase(""); }} className="text-xs text-slate-400 hover:text-red-500">reset</button>
        )}
      </div>
    </div>
  );
}

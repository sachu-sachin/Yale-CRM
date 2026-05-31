"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  leadStatusLabels,
  adPhaseLabels,
  paymentStatusLabels,
} from "@/lib/utils";

interface Telecaller {
  id: string;
  name: string;
}

const REPORT_TYPES = [
  { key: "leads", label: "Leads" },
  { key: "payments", label: "Payments" },
  { key: "ads", label: "Ads / Clients" },
  { key: "calls", label: "Calls" },
  { key: "targets", label: "Targets" },
];

export default function AdminReportsPage() {
  const [type, setType] = useState("leads");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [telecaller, setTelecaller] = useState("");
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);

  useEffect(() => {
    fetch("/api/users?role=TELECALLER")
      .then((r) => r.json())
      .then(setTelecallers)
      .catch(() => {});
  }, []);

  const download = () => {
    const p = new URLSearchParams();
    p.set("type", type);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (telecaller) p.set("telecaller", telecaller);
    if (type === "leads" && status) p.set("status", status);
    if ((type === "ads" || type === "payments") && phase) p.set("phase", phase);
    if ((type === "ads" || type === "payments") && paymentStatus)
      p.set("paymentStatus", paymentStatus);
    // Triggers a file download via the browser
    window.location.href = `/api/reports/export?${p.toString()}`;
  };

  return (
    <>
      <Header title="Reports" subtitle="Download full or filtered reports as Excel" />
      <div className="p-6 max-w-3xl">
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Export to Excel</h3>
              <p className="text-xs text-slate-400">Pick a report, apply optional filters, and download a .xlsx file.</p>
            </div>
          </div>

          {/* Report type */}
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Report</label>
          <div className="flex flex-wrap gap-2 mb-5">
            {REPORT_TYPES.map((r) => (
              <button
                key={r.key}
                onClick={() => setType(r.key)}
                className={
                  "px-4 py-2 rounded-xl text-sm font-medium transition-colors " +
                  (type === r.key
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100")
                }
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">From date</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">To date</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Telecaller</label>
              <select value={telecaller} onChange={(e) => setTelecaller(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                <option value="">All telecallers</option>
                {telecallers.map((tc) => (<option key={tc.id} value={tc.id}>{tc.name}</option>))}
              </select>
            </div>

            {type === "leads" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Lead status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                  <option value="">All statuses</option>
                  {Object.entries(leadStatusLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                </select>
              </div>
            )}

            {(type === "ads" || type === "payments") && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phase</label>
                  <select value={phase} onChange={(e) => setPhase(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                    <option value="">All phases</option>
                    {Object.entries(adPhaseLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment status</label>
                  <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                    <option value="">All payment statuses</option>
                    {Object.entries(paymentStatusLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
              </>
            )}
          </div>

          <button
            onClick={download}
            className="mt-6 flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Download size={18} />
            Download Excel
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Tip: leave filters empty to export the full report. Date filters apply to created/closed dates depending on the report.
        </p>
      </div>
    </>
  );
}

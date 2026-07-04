"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import Header from "@/components/layout/Header";
import {
  Plus, X, Loader2, Phone, Info, Trash2, Pencil, Search, RotateCw,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from "lucide-react";
import {
  cn, formatDate, formatCurrency, leadSourceLabels,
  dealStatusLabels, dealStatusColors, adPhaseLabels, adPhaseColors,
  countdownColor, isRenewalDue,
} from "@/lib/utils";

interface Deal {
  id: string;
  title: string;
  amount: number;
  status: string;
  source: string;
  phase: string | null;
  seq: number | null;
  closeDate: string;
  endDate: string | null;
  durationDays: number | null;
  notes: string | null;
  city: string | null;
  assignedToId: string | null;
  client: { id: string; name: string; phone: string; email: string | null; city: string | null };
  assignedTo: { id: string; name: string } | null;
}

interface Telecaller { id: string; name: string; }

const TABS = [
  { key: "", label: "All Deals" },
  { key: "FOLLOWUPS", label: "Follow-ups" },
  { key: "CLOSED", label: "Closed" },
  { key: "RENEWAL", label: "Renewal" },
  { key: "REGULAR", label: "Regular Clients" },
];

const emptyForm = {
  phone: "", name: "", email: "", city: "",
  title: "", amount: "", source: "WALKIN", status: "NOT_CLOSED",
  notes: "", startDate: "", endDate: "", durationDays: "", assignedToId: "",
};

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
  return d > 0 ? d : 0;
}

export default function DealsView({ isAdmin }: { isAdmin: boolean }) {
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);

  // filters
  const [phaseTab, setPhaseTab] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [assignedTo, setAssignedTo] = useState(""); // admin: filter by telecaller
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [endOn, setEndOn] = useState(""); // renewal tab: ads ending on this day
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("closeDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [existing, setExisting] = useState<{ name: string; paid: number; total: number } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRenewal = phaseTab === "RENEWAL";
  const isFollowups = phaseTab === "FOLLOWUPS";

  const dealsKey = useMemo(() => {
    const p = new URLSearchParams();
    if (isFollowups) {
      p.set("status", "FOLLOW_UP");
    } else if (isRenewal) {
      // "due for renewal" — no phase filter; handled via dueRenewal/endOn below
    } else if (phaseTab === "CLOSED") {
      // Closed = all paid/won deals (original + renewals), not just phase=CLOSED
      p.set("status", "PAID");
    } else {
      if (phaseTab) p.set("phase", phaseTab);
      if (status) p.set("status", status);
    }
    if (source) p.set("source", source);
    if (isAdmin && assignedTo) p.set("assignedTo", assignedTo);
    if (isRenewal) {
      if (endOn) p.set("endOn", endOn);
      else p.set("dueRenewal", "1");
    } else {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    if (debouncedSearch) p.set("search", debouncedSearch);
    p.set("sortBy", sortBy);
    p.set("sortDir", sortDir);
    return `/api/ads?${p.toString()}`;
  }, [phaseTab, isFollowups, status, source, isAdmin, assignedTo, isRenewal, endOn, from, to, debouncedSearch, sortBy, sortDir]);

  const { data: deals = [], isLoading: loading, mutate } = useSWR<Deal[]>(dealsKey);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/users?role=TELECALLER").then((r) => r.json()).then(setTelecallers).catch(() => {});
    }
  }, [isAdmin]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  };

  const SortHead = ({ col, label }: { col: string; label: string }) => (
    <th className="px-4 py-3 text-left font-semibold text-slate-600">
      <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label}
        {sortBy === col ? (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronsUpDown size={13} className="opacity-40" />}
      </button>
    </th>
  );

  const handlePhoneChange = (phone: string) => {
    setForm((f) => ({ ...f, phone }));
    setExisting(null);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (phone.replace(/\D/g, "").length < 4) { setLookupLoading(false); return; }
    setLookupLoading(true);
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients/lookup?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (data.client) {
          setExisting({ name: data.client.name, paid: data.client.paidDeals, total: data.client.totalDeals });
          setForm((f) => ({
            ...f,
            name: f.name || data.client.name,
            email: f.email || data.client.email || "",
            city: f.city || data.client.city || "",
          }));
        }
      } finally { setLookupLoading(false); }
    }, 450);
  };

  const openCreate = () => { setForm({ ...emptyForm }); setExisting(null); setEditingId(null); setRenewing(false); setShowForm(true); };

  // Renew: prefill a NEW deal from an existing one (same business/client), blank amount + new term.
  const renewFrom = (d: Deal) => {
    setEditingId(null);
    setExisting(null);
    setRenewing(true);
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      ...emptyForm,
      phone: d.client.phone,
      name: d.client.name,
      email: d.client.email || "",
      city: d.city || d.client.city || "",
      title: d.title,
      source: d.source,
      status: "PAID",
      assignedToId: d.assignedToId || "",
      startDate: today,
      durationDays: "30",
      endDate: addDays(today, 30),
    });
    setShowForm(true);
  };

  // Auto-linked start / end / duration (changing one updates the others).
  const setStart = (v: string) => setForm((f) => {
    const nf = { ...f, startDate: v };
    if (f.durationDays && v) nf.endDate = addDays(v, parseInt(f.durationDays) || 0);
    else if (f.endDate && v) nf.durationDays = String(daysBetween(v, f.endDate));
    return nf;
  });
  const setEnd = (v: string) => setForm((f) => {
    const nf = { ...f, endDate: v };
    if (f.startDate && v) nf.durationDays = String(daysBetween(f.startDate, v));
    return nf;
  });
  const setDur = (v: string) => setForm((f) => {
    const nf = { ...f, durationDays: v };
    if (f.startDate && v) nf.endDate = addDays(f.startDate, parseInt(v) || 0);
    return nf;
  });

  const openEdit = (d: Deal) => {
    setEditingId(d.id);
    setExisting(null);
    setRenewing(false);
    setForm({
      phone: d.client.phone, name: d.client.name, email: d.client.email || "", city: d.city || d.client.city || "",
      title: d.title, amount: String(d.amount ?? ""), source: d.source, status: d.status,
      notes: d.notes || "",
      startDate: d.closeDate ? d.closeDate.slice(0, 10) : "",
      endDate: d.endDate ? d.endDate.slice(0, 10) : "",
      durationDays: d.durationDays ? String(d.durationDays) : "",
      assignedToId: d.assignedToId || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Start/End dates only apply to paid deals.
    const dates: Record<string, string> = {};
    if (form.status === "PAID") {
      if (form.startDate) dates.closeDate = form.startDate;
      if (form.endDate) dates.endDate = form.endDate;
    }
    let res: Response;
    if (editingId) {
      res = await fetch(`/api/ads/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, amount: form.amount || 0, status: form.status, source: form.source,
          city: form.city, notes: form.notes, assignedToId: form.assignedToId, ...dates,
        }),
      });
    } else {
      res = await fetch("/api/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone, name: form.name, email: form.email, city: form.city,
          title: form.title, amount: form.amount || 0, status: form.status, source: form.source,
          notes: form.notes, assignedToId: form.assignedToId, ...dates,
        }),
      });
    }
    setSaving(false);
    if (res.ok) { setShowForm(false); mutate(); }
    else { const err = await res.json().catch(() => ({})); alert(err.error || "Could not save"); }
  };

  const quickStatus = async (id: string, newStatus: string) => {
    mutate(deals.map((d) => (d.id === id ? { ...d, status: newStatus } : d)), { revalidate: false });
    await fetch(`/api/ads/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    mutate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this deal? This cannot be undone.")) return;
    mutate(deals.filter((d) => d.id !== id), { revalidate: false });
    await fetch(`/api/ads/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <>
      <Header title={isAdmin ? "Deals & Clients" : "My Deals & Clients"} subtitle="Enquiries, conversions and the client lifecycle" />
      <div className="p-6">
        {/* Phase tabs + add */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setPhaseTab(t.key)}
                className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  phaseTab === t.key
                    ? (isAdmin ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20")
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={openCreate}
            className={cn("flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg",
              isAdmin ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20")}>
            <Plus size={18} /> Add Deal
          </button>
        </div>

        {/* Toolbar: search + filters + date */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, client, phone…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm">
            <option value="">All Status</option>
            {Object.entries(dealStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm">
            <option value="">All Sources</option>
            {Object.entries(leadSourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {isAdmin && (
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm">
              <option value="">All Telecallers</option>
              {telecallers.map((tc) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
            </select>
          )}

          {isRenewal ? (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-slate-400 text-xs">Ending on</span>
              <input type="date" value={endOn} onChange={(e) => setEndOn(e.target.value)} className="px-2 py-2 rounded-lg bg-white border border-slate-200 text-sm" />
              {endOn && <button onClick={() => setEndOn("")} className="text-xs text-slate-400 hover:text-red-500">clear</button>}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-slate-400 text-xs">From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-2 rounded-lg bg-white border border-slate-200 text-sm" />
              <span className="text-slate-400 text-xs">To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-2 rounded-lg bg-white border border-slate-200 text-sm" />
              {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="text-xs text-slate-400 hover:text-red-500">clear</button>}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Phone</th>
                  <SortHead col="title" label="Business Name" />
                  <SortHead col="amount" label="Amount" />
                  <SortHead col="status" label="Status" />
                  <SortHead col="phase" label="Phase" />
                  <SortHead col="closeDate" label="Date" />
                  <SortHead col="endDate" label="Completion" />
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-16 text-center"><Loader2 size={24} className="animate-spin text-slate-400 mx-auto" /></td></tr>
                ) : deals.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-16 text-center text-slate-400">No deals found.</td></tr>
                ) : (
                  deals.map((d) => {
                    const renewalDue = isRenewalDue(d.status, d.endDate);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{d.client.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <a href={`tel:${d.client.phone}`} className="flex items-center gap-1 text-slate-600 hover:text-indigo-600"><Phone size={11} /> {d.client.phone}</a>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700">{d.title}</p>
                          {d.notes && <p className="text-xs text-slate-400 truncate max-w-[220px]" title={d.notes}>📝 {d.notes}</p>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(d.amount)}</td>
                        <td className="px-4 py-3">
                          {renewalDue ? (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700" title="Term ended — renewal payment due">
                              Waiting for Payment
                            </span>
                          ) : (
                            <select value={d.status} onChange={(e) => quickStatus(d.id, e.target.value)}
                              className={cn("text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer", dealStatusColors[d.status])}>
                              {Object.entries(dealStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {d.phase ? (
                            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", adPhaseColors[d.phase])}>
                              {adPhaseLabels[d.phase]}{d.seq && d.seq > 1 ? ` ·${d.seq}` : ""}
                            </span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(d.closeDate)}</td>
                        <td className="px-4 py-3">
                          {d.endDate ? (
                            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", countdownColor(d.endDate))}>
                              {formatDate(d.endDate)}
                            </span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {d.status === "PAID" && (
                              <button onClick={() => renewFrom(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" title="Renew (create new deal)"><RotateCw size={14} /></button>
                            )}
                            <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Edit"><Pencil size={14} /></button>
                            {isAdmin && <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create / Edit modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-scale-in shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">{renewing ? "Renew Deal" : editingId ? "Edit Deal" : "Add Deal"}</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                    <div className="relative">
                      <input type="text" value={form.phone} disabled={!!editingId || renewing}
                        onChange={(e) => handlePhoneChange(e.target.value)} placeholder="Type to auto-fill…"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500" required />
                      {lookupLoading && <Loader2 size={16} className="animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                    <input type="text" value={form.name} disabled={!!editingId || renewing} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500" required />
                  </div>
                </div>

                {/* Renewal: simplified fields only */}
                {renewing && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-xs text-slate-500">
                      Renewing <strong className="text-slate-700">{form.title}</strong> — business, source & other details are carried over.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
                        <input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Duration (days)</label>
                        <input type="number" min="1" value={form.durationDays} onChange={(e) => setDur(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Start date *</label>
                        <input type="date" value={form.startDate} onChange={(e) => setStart(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">End date *</label>
                        <input type="date" value={form.endDate} onChange={(e) => setEnd(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" required />
                      </div>
                    </div>
                  </div>
                )}

                {!renewing && (<>
                {existing && !editingId && (
                  <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800 animate-fade-in">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <p>Existing client <strong>{existing.name}</strong> — {existing.total} deal(s), {existing.paid} paid. If you mark this Paid it becomes #{existing.paid + 1} ({existing.paid === 0 ? "Closed" : existing.paid === 1 ? "Renewal" : "Regular"}).</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                    <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sharma Electronics"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                    <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                      {Object.entries(leadSourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
                    <input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                      {Object.entries(dealStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>

                {/* Start + End date — only for Paid deals */}
                {form.status === "PAID" && (
                  <div className="grid grid-cols-2 gap-4 animate-fade-in">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
                      <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
                      <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                    </div>
                  </div>
                )}

                {/* Remark — for all deals */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Remark</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    placeholder={form.status === "REPEATED" ? "Why is this a repeated lead?" : "Add a remark / note (optional)"}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none" />
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Handled By</label>
                    <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                      <option value="">Unassigned</option>
                      {telecallers.map((tc) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
                    </select>
                  </div>
                )}
                </>)}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={saving}
                    className={cn("flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2", isAdmin ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700")}>
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {renewing ? "Create Renewal" : editingId ? "Save Changes" : "Save Deal"}
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

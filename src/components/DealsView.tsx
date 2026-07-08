"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import Header from "@/components/layout/Header";
import {
  Plus, X, Loader2, Phone, Info, Trash2, Pencil, Search, RotateCw, Clock, BellRing,
  ChevronUp, ChevronDown, ChevronsUpDown, Eye,
} from "lucide-react";
import {
  cn, formatDate, formatDateTime, formatCurrency, leadSourceLabels,
  dealStatusLabels, dealStatusColors, adPhaseLabels, adPhaseColors,
  countdownColor, isRenewalDue, isRenewalExpired, allowedNextStatuses, renewalTag, phaseForSeq,
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
  reminderDate: string | null;
  renewedAt: string | null;
  notes: string | null;
  city: string | null;
  assignedToId: string | null;
  client: { id: string; name: string; phone: string; email: string | null; city: string | null };
  assignedTo: { id: string; name: string } | null;
}

interface StageEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
  changedBy: { name: string } | null;
}

interface Telecaller { id: string; name: string; }

const TABS = [
  { key: "", label: "All Deals" },
  { key: "FOLLOWUPS", label: "Follow-ups" },
  { key: "CLOSED", label: "Closed" },
  { key: "RENEWAL", label: "Renewal" },
  { key: "REGULAR", label: "Regular Clients" },
];

// Renewal & Regular each split into Paid / Waiting-for-payment / Finished (view-only history).
// Closed has no sub-tabs — it only holds first conversions not yet due for renewal.
const RENEWAL_SUBS = [
  { key: "paid", label: "Paid" },
  { key: "waiting", label: "Waiting for payment" },
  { key: "finished", label: "Finished" },
];
const SUB_TABS: Record<string, { key: string; label: string }[]> = {
  FOLLOWUPS: [{ key: "followup", label: "Follow-up" }, { key: "waiting", label: "Waiting for payment" }],
  RENEWAL: RENEWAL_SUBS,
  REGULAR: RENEWAL_SUBS,
};
const defaultSub = (tab: string) => SUB_TABS[tab]?.[0]?.key ?? "";

const emptyForm = {
  phone: "", name: "", email: "", city: "",
  title: "", amount: "0", source: "WALKIN", status: "NOT_CLOSED",
  notes: "", startDate: "", endDate: "", durationDays: "", reminderDate: "", assignedToId: "",
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
  const [subTab, setSubTab] = useState("");
  const [source, setSource] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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
  const [editOrigin, setEditOrigin] = useState("NOT_CLOSED"); // status the deal was in when the popup opened
  const [editFinished, setEditFinished] = useState(false); // is the edited deal superseded/expired (view-only)?
  const [renewing, setRenewing] = useState(false);
  const [renewSourceId, setRenewSourceId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<StageEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [existing, setExisting] = useState<{ name: string; paid: number; total: number } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFollowups = phaseTab === "FOLLOWUPS";
  const isClosed = phaseTab === "CLOSED";
  const isRenewal = phaseTab === "RENEWAL";
  const isRegular = phaseTab === "REGULAR";
  // Closed / Renewal / Regular are the lifecycle (phase) tabs; only Renewal & Regular have sub-tabs.
  const isPaidTab = isClosed || isRenewal || isRegular;
  const hasSubTabs = isFollowups || isRenewal || isRegular;
  const isFinishedSub = (isRenewal || isRegular) && subTab === "finished";

  const dealsKey = useMemo(() => {
    const p = new URLSearchParams();
    if (isFollowups) {
      p.set("view", `followups:${subTab === "waiting" ? "waiting" : "followup"}`);
    } else if (isClosed) {
      p.set("view", "closed");
    } else if (isRenewal) {
      p.set("view", `renewal:${subTab || "paid"}`);
    } else if (isRegular) {
      p.set("view", `regular:${subTab || "paid"}`);
    }
    if (source) p.set("source", source);
    if (isAdmin && assignedTo) p.set("assignedTo", assignedTo);
    // Date range applies only to the non-phase tabs (All Deals, Follow-ups).
    if (!isPaidTab) {
      if (from) p.set("from", from);
      if (to) p.set("to", to);
    }
    if (debouncedSearch) p.set("search", debouncedSearch);
    p.set("sortBy", sortBy);
    p.set("sortDir", sortDir);
    return `/api/ads?${p.toString()}`;
  }, [isFollowups, isClosed, isRenewal, isRegular, isPaidTab, subTab, source, isAdmin, assignedTo, from, to, debouncedSearch, sortBy, sortDir]);

  const { data: deals = [], isLoading: loading, mutate } = useSWR<Deal[]>(dealsKey);

  useEffect(() => {
    if (isAdmin) fetch("/api/users?role=TELECALLER").then((r) => r.json()).then(setTelecallers).catch(() => {});
  }, [isAdmin]);

  const selectTab = (key: string) => { setPhaseTab(key); setSubTab(defaultSub(key)); };

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

  const handlePhoneChange = (raw: string) => {
    const phone = raw.replace(/\D/g, "").slice(0, 10); // digits only, max 10
    setForm((f) => ({ ...f, phone }));
    setExisting(null);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (phone.length < 4) { setLookupLoading(false); return; }
    setLookupLoading(true);
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients/lookup?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (data.client) {
          setExisting({ name: data.client.name, paid: data.client.paidDeals, total: data.client.totalDeals });
          setForm((f) => ({ ...f, name: f.name || data.client.name, email: f.email || data.client.email || "", city: f.city || data.client.city || "" }));
        }
      } finally { setLookupLoading(false); }
    }, 450);
  };

  const openCreate = () => {
    setForm({ ...emptyForm }); setExisting(null); setEditingId(null); setRenewing(false);
    setRenewSourceId(null); setEditOrigin("NOT_CLOSED"); setEditFinished(false);
    setTimeline([]); setShowForm(true);
  };

  const renewFrom = (d: Deal) => {
    setEditingId(null); setExisting(null); setRenewing(true); setRenewSourceId(d.id); setTimeline([]);
    setEditFinished(false);
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      ...emptyForm, phone: d.client.phone, name: d.client.name, email: d.client.email || "",
      city: d.city || d.client.city || "", title: d.title, source: d.source, status: "PAID",
      assignedToId: d.assignedToId || "", startDate: today, durationDays: "30", endDate: addDays(today, 30),
    });
    setShowForm(true);
  };

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

  const openEdit = async (d: Deal) => {
    setEditingId(d.id); setExisting(null); setRenewing(false); setRenewSourceId(null);
    setEditOrigin(d.status);
    setEditFinished(!!d.renewedAt || isRenewalExpired(d.status, d.endDate, d.renewedAt));
    setTimeline([]);
    setForm({
      phone: d.client.phone, name: d.client.name, email: d.client.email || "", city: d.city || d.client.city || "",
      title: d.title, amount: String(d.amount ?? ""), source: d.source, status: d.status, notes: d.notes || "",
      startDate: d.closeDate ? d.closeDate.slice(0, 10) : "",
      endDate: d.endDate ? d.endDate.slice(0, 10) : "",
      durationDays: d.durationDays ? String(d.durationDays) : "",
      reminderDate: d.reminderDate ? d.reminderDate.slice(0, 10) : "",
      assignedToId: d.assignedToId || "",
    });
    setShowForm(true);
    // load the stage timeline
    try {
      const res = await fetch(`/api/ads/${d.id}`);
      if (res.ok) { const full = await res.json(); setTimeline(full.stageEvents || []); }
    } catch { /* ignore */ }
  };

  // Options for the popup status dropdown (forward-only; admin all), based on the ORIGIN status.
  const statusOptions = useMemo(() => {
    const base = renewing ? "PAID" : editOrigin;
    return Array.from(new Set([base, ...allowedNextStatuses(base, isAdmin)]));
  }, [editOrigin, isAdmin, renewing]);

  // Telecaller editing a PAID deal: detail fields are read-only — only the remark is allowed
  // (renewing is a separate action). A PENDING renewal stays editable so it can be finalized to
  // Paid with a term. Admins are never locked.
  const lockLifecycle = !isAdmin && !!editingId && editOrigin === "PAID";
  // A finished (superseded/expired) deal is fully view-only for telecallers.
  const readOnly = !isAdmin && !!editingId && editFinished;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // New deals must have a valid 10-digit mobile (phone is locked on edit/renew).
    if (!editingId && !renewing && form.phone.replace(/\D/g, "").length !== 10) {
      alert("Enter a valid 10-digit mobile number.");
      return;
    }
    // A term can't end before it starts.
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      alert("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    const dates: Record<string, string> = {};
    // Term dates only apply once a deal is Paid; a pending (waiting-for-payment) deal carries none.
    if (form.status === "PAID") {
      if (form.startDate) dates.closeDate = form.startDate;
      if (form.endDate) dates.endDate = form.endDate;
    }
    const reminder = form.status === "PENDING" || form.status === "FOLLOW_UP"
      ? { reminderDate: form.reminderDate || null } : {};
    let res: Response;
    if (editingId) {
      res = await fetch(`/api/ads/${editingId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, amount: form.amount || 0, status: form.status, source: form.source,
          city: form.city, notes: form.notes, assignedToId: form.assignedToId, ...dates, ...reminder,
        }),
      });
    } else {
      res = await fetch("/api/ads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone, name: form.name, email: form.email, city: form.city,
          title: form.title, amount: form.amount || 0, status: form.status, source: form.source,
          notes: form.notes, assignedToId: form.assignedToId,
          // Renewal: server continues the chain and supersedes the source deal atomically.
          renewalOfId: renewing ? renewSourceId : undefined,
          ...dates, ...reminder,
        }),
      });
    }
    if (res.ok) {
      setSaving(false); setShowForm(false); mutate();
    } else {
      setSaving(false);
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not save");
    }
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
              <button key={t.key} onClick={() => selectTab(t.key)}
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

        {/* Sub-tabs */}
        {hasSubTabs && (
          <div className="flex gap-2 mb-4">
            {SUB_TABS[phaseTab].map((s) => (
              <button key={s.key} onClick={() => setSubTab(s.key)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  subTab === s.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50")}>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search business, client, phone…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
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
          {!isPaidTab && (
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
                  <SortHead col="reminderDate" label="Reminder" />
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center"><Loader2 size={24} className="animate-spin text-slate-400 mx-auto" /></td></tr>
                ) : deals.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-16 text-center text-slate-400">No deals found.</td></tr>
                ) : (
                  deals.map((d) => {
                    const renewalDue = isRenewalDue(d.status, d.endDate, d.renewedAt);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3"><p className="font-medium text-slate-900">{d.client.name}</p></td>
                        <td className="px-4 py-3">
                          <a href={`tel:${d.client.phone}`} className="flex items-center gap-1 text-slate-600 hover:text-indigo-600"><Phone size={11} /> {d.client.phone}</a>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700">{d.title}</p>
                          {d.notes && <p className="text-xs text-slate-400 truncate max-w-[200px]" title={d.notes}>📝 {d.notes}</p>}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(d.amount)}</td>
                        <td className="px-4 py-3">
                          {/* Clickable badge → opens edit popup (no inline status change) */}
                          <button onClick={() => openEdit(d)}
                            className={cn("text-xs font-medium px-2.5 py-1 rounded-full hover:ring-2 hover:ring-offset-1 hover:ring-slate-200 transition",
                              renewalDue ? "bg-amber-100 text-amber-700" : dealStatusColors[d.status])}
                            title="Click to change status">
                            {renewalDue ? "Waiting for Payment" : dealStatusLabels[d.status]}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {d.phase ? (
                            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", adPhaseColors[d.phase])}>
                              {adPhaseLabels[d.phase]}{renewalTag(d.seq) ? ` · ${renewalTag(d.seq)}` : ""}
                            </span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(d.closeDate)}</td>
                        <td className="px-4 py-3">
                          {d.endDate ? (
                            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", countdownColor(d.endDate))}>{formatDate(d.endDate)}</span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {d.reminderDate ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500"><BellRing size={11} className="text-amber-500" /> {formatDate(d.reminderDate)}</span>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* Renew only when the deal is actually due (1 day before completion / overdue),
                                so a still-running deal can't be superseded early. */}
                            {!isFinishedSub && renewalDue && (
                              <button onClick={() => renewFrom(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" title="Renew (create new deal)"><RotateCw size={14} /></button>
                            )}
                            <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title={isFinishedSub ? "View" : "Edit"}>{isFinishedSub ? <Eye size={14} /> : <Pencil size={14} />}</button>
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

        {/* Create / Edit / Renew modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-scale-in shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">{renewing ? "Renew Deal" : readOnly ? "View Deal" : editingId ? "Edit Deal" : "Add Deal"}</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={18} /></button>
              </div>

              {/* Stage timeline (edit only) */}
              {editingId && timeline.length > 0 && (
                <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2"><Clock size={13} /> Stage history</p>
                  <ol className="space-y-1.5">
                    {timeline.map((ev) => (
                      <li key={ev.id} className="flex items-center gap-2 text-xs">
                        <span className={cn("px-2 py-0.5 rounded-full font-medium", dealStatusColors[ev.toStatus])}>{dealStatusLabels[ev.toStatus]}</span>
                        <span className="text-slate-400">{formatDateTime(ev.createdAt)}{ev.changedBy ? ` · ${ev.changedBy.name}` : ""}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                    <div className="relative">
                      <input type="tel" inputMode="numeric" maxLength={10} pattern="\d{10}"
                        title="Enter a 10-digit mobile number" value={form.phone} disabled={!!editingId || renewing}
                        onChange={(e) => handlePhoneChange(e.target.value)} placeholder="10-digit mobile"
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
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Renewal status *</label>
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                        <option value="PAID">Paid</option>
                        <option value="PENDING">Waiting for payment</option>
                      </select>
                      <p className="text-xs text-slate-400 mt-1">
                        {form.status === "PAID"
                          ? "Records the renewal payment now."
                          : "Creates a pending renewal — you'll get daily reminders until it's marked Paid."}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
                        <input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" required />
                      </div>
                      {form.status === "PAID" ? (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Duration (days)</label>
                          <input type="number" min="1" value={form.durationDays} onChange={(e) => setDur(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Payment reminder date *</label>
                          <input type="date" value={form.reminderDate} onChange={(e) => setForm({ ...form, reminderDate: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" required />
                        </div>
                      )}
                    </div>
                    {/* Term (start/end) is set only when the renewal is Paid; a pending renewal just needs a chase date. */}
                    {form.status === "PAID" && (
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
                    )}
                  </div>
                )}

                {!renewing && (<>
                {existing && !editingId && (
                  <div className="flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800 animate-fade-in">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <p>Existing client <strong>{existing.name}</strong> — {existing.total} deal(s), {existing.paid} paid. If you mark this Paid it becomes #{existing.paid + 1} ({adPhaseLabels[phaseForSeq(existing.paid + 1)]}).</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <input type="text" value={form.city} disabled={lockLifecycle} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                    <input type="text" value={form.title} disabled={lockLifecycle} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sharma Electronics"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                    <select value={form.source} disabled={lockLifecycle} onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500">
                      {Object.entries(leadSourceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
                    <input type="number" min="0" step="any" value={form.amount} disabled={lockLifecycle} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select value={form.status} disabled={readOnly} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500">
                      {statusOptions.map((k) => <option key={k} value={k}>{dealStatusLabels[k]}</option>)}
                    </select>
                  </div>
                </div>

                {/* Start + End — only for Paid */}
                {form.status === "PAID" && (
                  <div className="grid grid-cols-2 gap-4 animate-fade-in">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
                      <input type="date" value={form.startDate} disabled={lockLifecycle} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">End date</label>
                      <input type="date" value={form.endDate} disabled={lockLifecycle} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500" />
                    </div>
                  </div>
                )}

                {/* Reminder — for Waiting for payment (PENDING) and Follow-up */}
                {(form.status === "PENDING" || form.status === "FOLLOW_UP") && (
                  <div className="animate-fade-in">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {form.status === "PENDING" ? "Payment reminder date" : "Follow-up reminder date"}
                    </label>
                    <input type="date" value={form.reminderDate} disabled={lockLifecycle} onChange={(e) => setForm({ ...form, reminderDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500" />
                    <p className="text-xs text-slate-400 mt-1">
                      {form.status === "PENDING"
                        ? "You'll get a daily reminder from this date until it's paid."
                        : "You'll get a daily reminder from this date until the follow-up moves on."}
                    </p>
                  </div>
                )}

                {/* Remark */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Remark</label>
                  <textarea value={form.notes} disabled={readOnly} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    placeholder="Add a remark / note (optional)"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none disabled:bg-slate-50 disabled:text-slate-500" />
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
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">{readOnly ? "Close" : "Cancel"}</button>
                  {!readOnly && (
                    <button type="submit" disabled={saving}
                      className={cn("flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2", isAdmin ? "bg-indigo-600 hover:bg-indigo-700" : "bg-emerald-600 hover:bg-emerald-700")}>
                      {saving && <Loader2 size={16} className="animate-spin" />}
                      {renewing ? "Create Renewal" : editingId ? "Save Changes" : "Save Deal"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

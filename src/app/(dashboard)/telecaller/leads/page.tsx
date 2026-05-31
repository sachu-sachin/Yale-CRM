"use client";

import { useState, useEffect, useRef } from "react";
import Header from "@/components/layout/Header";
import {
  Plus,
  Search,
  Phone,
  Mail,
  X,
  Loader2,
  ExternalLink,
  Info,
} from "lucide-react";
import { cn, leadStatusColors, leadStatusLabels, leadSourceLabels } from "@/lib/utils";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  source: string;
  status: string;
  city: string | null;
  createdAt: string;
  _count: { callLogs: number };
}

interface PhoneMatch {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    source: string;
    city: string | null;
    status: string;
  } | null;
  client: { id: string; name: string; phone: string; _count: { ads: number } } | null;
}

export default function TelecallerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "WALKIN",
    city: "",
    notes: "",
  });
  const [match, setMatch] = useState<PhoneMatch | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  const handlePhoneChange = (phone: string) => {
    setForm((f) => ({ ...f, phone }));
    setMatch(null);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (phone.replace(/\D/g, "").length < 4) {
      setLookupLoading(false);
      return;
    }
    setLookupLoading(true);
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/leads/lookup?phone=${encodeURIComponent(phone)}`);
        const data: PhoneMatch = await res.json();
        setMatch(data.lead || data.client ? data : null);
      } finally {
        setLookupLoading(false);
      }
    }, 450);
  };

  const applyMatch = () => {
    if (!match?.lead) return;
    const l = match.lead;
    setForm((f) => ({
      ...f,
      name: l.name,
      email: l.email || "",
      phone: l.phone,
      source: l.source,
      city: l.city || "",
    }));
  };

  const openForm = () => {
    setForm({ name: "", email: "", phone: "", source: "WALKIN", city: "", notes: "" });
    setMatch(null);
    setShowForm(true);
  };

  const fetchLeads = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/leads?${params}`);
    setLeads(await res.json());
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowForm(false);
    setMatch(null);
    setForm({ name: "", email: "", phone: "", source: "WALKIN", city: "", notes: "" });
    fetchLeads();
  };

  const handleStatusChange = async (leadId: string, status: string) => {
    await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchLeads();
  };

  return (
    <>
      <Header title="My Leads" subtitle="View and manage your assigned leads" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm"
          >
            <option value="">All Statuses</option>
            {Object.entries(leadStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={openForm}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Plus size={18} />
            Add My Lead
          </button>
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Source</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Calls</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-16 text-center"><Loader2 size={24} className="animate-spin text-slate-400 mx-auto" /></td></tr>
                ) : leads.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-16 text-center text-slate-400">No leads found. Click &quot;Add My Lead&quot; to add your first lead!</td></tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{lead.name}</p>
                        {lead.city && <p className="text-xs text-slate-400">{lead.city}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-1 text-slate-600"><Phone size={12} /> {lead.phone}</p>
                        {lead.email && <p className="flex items-center gap-1 text-xs text-slate-400"><Mail size={10} /> {lead.email}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{leadSourceLabels[lead.source]}</td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className={cn("text-xs font-medium px-2.5 py-1 rounded-full border-0", leadStatusColors[lead.status])}
                        >
                          {Object.entries(leadStatusLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{lead._count.callLogs}</td>
                      <td className="px-4 py-3">
                        <Link href={`/telecaller/leads/${lead.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 inline-flex">
                          <ExternalLink size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Lead Modal — Auto-assigns to self via API */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-scale-in shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Add New Lead</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Will be automatically assigned to you</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                    <div className="relative">
                      <input type="text" value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="Type number to auto-fill…" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" required />
                      {lookupLoading && <Loader2 size={16} className="animate-spin text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" required />
                  </div>
                </div>
                {match && (match.lead || match.client) && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 animate-fade-in">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      {match.lead ? (
                        <>
                          <p>Existing lead: <strong>{match.lead.name}</strong> ({match.lead.phone}).</p>
                          <button type="button" onClick={applyMatch} className="mt-1 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700">Auto-fill from this lead</button>
                        </>
                      ) : match.client ? (
                        <p>Existing client <strong>{match.client.name}</strong> ({match.client._count.ads} ad{match.client._count.ads === 1 ? "" : "s"}).</p>
                      ) : null}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                    <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm">
                      {Object.entries(leadSourceLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    Add Lead
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

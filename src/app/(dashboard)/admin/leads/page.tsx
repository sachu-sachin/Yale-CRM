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
  assignedToId: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  _count: { callLogs: number };
}

interface PhoneMatch {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    altPhone: string | null;
    source: string;
    city: string | null;
    budgetRange: string | null;
    serviceInterest: string[];
    status: string;
    assignedToId: string | null;
  } | null;
  client: {
    id: string;
    name: string;
    phone: string;
    _count: { ads: number };
  } | null;
}

interface Telecaller {
  id: string;
  name: string;
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "WEBSITE",
    city: "",
    notes: "",
    assignedToId: "",
  });
  const [match, setMatch] = useState<PhoneMatch | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchLeads();
    fetchTelecallers();
  }, [statusFilter, sourceFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/leads?${params}`);
    setLeads(await res.json());
    setLoading(false);
  };

  const fetchTelecallers = async () => {
    const res = await fetch("/api/users?role=TELECALLER");
    setTelecallers(await res.json());
  };

  const handleSearch = () => {
    fetchLeads();
  };

  // Debounced auto-fetch of an existing lead/client by phone number
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
      assignedToId: l.assignedToId || "",
    }));
  };

  const openForm = () => {
    setForm({ name: "", email: "", phone: "", source: "WEBSITE", city: "", notes: "", assignedToId: "" });
    setMatch(null);
    setShowForm(true);
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
    setForm({
      name: "",
      email: "",
      phone: "",
      source: "WEBSITE",
      city: "",
      notes: "",
      assignedToId: "",
    });
    fetchLeads();
  };

  const handleAssign = async (leadId: string, telecallerId: string) => {
    await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: telecallerId || null }),
    });
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
      <Header title="All Leads" subtitle="Manage and assign leads" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="">All Statuses</option>
            {Object.entries(leadStatusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          >
            <option value="">All Sources</option>
            {Object.entries(leadSourceLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <button
            onClick={openForm}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Add Lead
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Source</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Assigned To</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Calls</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <Loader2 size={24} className="animate-spin text-slate-400 mx-auto" />
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                      No leads found
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{lead.name}</p>
                          {lead.city && (
                            <p className="text-xs text-slate-400">{lead.city}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="flex items-center gap-1 text-slate-600">
                            <Phone size={12} /> {lead.phone}
                          </p>
                          {lead.email && (
                            <p className="flex items-center gap-1 text-slate-400 text-xs">
                              <Mail size={10} /> {lead.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-slate-500">
                          {leadSourceLabels[lead.source] || lead.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className={cn(
                            "text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer",
                            leadStatusColors[lead.status]
                          )}
                        >
                          {Object.entries(leadStatusLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.assignedToId || ""}
                          onChange={(e) => handleAssign(lead.id, e.target.value)}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="">Unassigned</option>
                          {telecallers.map((tc) => (
                            <option key={tc.id} value={tc.id}>{tc.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{lead._count.callLogs}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-flex"
                        >
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

        {/* Create Lead Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 animate-scale-in shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">Add New Lead</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                  <X size={18} />
                </button>
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

                {/* Existing record banner */}
                {match && (match.lead || match.client) && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 animate-fade-in">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      {match.lead ? (
                        <>
                          <p>Existing lead: <strong>{match.lead.name}</strong> ({match.lead.phone}) — status {leadStatusLabels[match.lead.status] || match.lead.status}.</p>
                          <button type="button" onClick={applyMatch} className="mt-1 font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700">
                            Auto-fill from this lead
                          </button>
                        </>
                      ) : match.client ? (
                        <p>This number belongs to existing client <strong>{match.client.name}</strong> ({match.client._count.ads} ad{match.client._count.ads === 1 ? "" : "s"}).</p>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source *</label>
                    <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                      {Object.entries(leadSourceLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                  <select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30">
                    <option value="">Unassigned</option>
                    {telecallers.map((tc) => (
                      <option key={tc.id} value={tc.id}>{tc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    Create Lead
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

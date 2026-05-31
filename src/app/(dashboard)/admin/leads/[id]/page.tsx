"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Plus,
  X,
  Loader2,
  ArrowLeft,
  User,
} from "lucide-react";
import { cn, formatDateTime, leadStatusColors, leadStatusLabels, leadSourceLabels } from "@/lib/utils";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  altPhone: string | null;
  source: string;
  serviceInterest: string[];
  city: string | null;
  budgetRange: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string };
  callLogs: CallLog[];
}

interface CallLog {
  id: string;
  outcome: string;
  notes: string | null;
  callDate: string;
  followUpDate: string | null;
  telecaller: { id: string; name: string };
}

export default function LeadDetailPage() {
  const params = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCallForm, setShowCallForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [callForm, setCallForm] = useState({
    outcome: "INTERESTED",
    notes: "",
    followUpDate: "",
  });

  useEffect(() => {
    fetchLead();
  }, []);

  const fetchLead = async () => {
    const res = await fetch(`/api/leads/${params.id}`);
    setLead(await res.json());
    setLoading(false);
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: params.id,
        ...callForm,
      }),
    });
    setSaving(false);
    setShowCallForm(false);
    setCallForm({ outcome: "INTERESTED", notes: "", followUpDate: "" });
    fetchLead();
  };

  const outcomeLabels: Record<string, string> = {
    INTERESTED: "Interested",
    NOT_INTERESTED: "Not Interested",
    CALLBACK: "Callback",
    NO_ANSWER: "No Answer",
    WRONG_NUMBER: "Wrong Number",
    CONVERTED: "Converted",
  };

  const outcomeColors: Record<string, string> = {
    INTERESTED: "bg-emerald-100 text-emerald-700",
    NOT_INTERESTED: "bg-red-100 text-red-700",
    CALLBACK: "bg-amber-100 text-amber-700",
    NO_ANSWER: "bg-slate-100 text-slate-600",
    WRONG_NUMBER: "bg-red-100 text-red-600",
    CONVERTED: "bg-indigo-100 text-indigo-700",
  };

  if (loading) {
    return (
      <>
        <Header title="Lead Detail" />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <Header title="Lead Not Found" />
        <div className="p-6 text-center text-slate-400">Lead not found</div>
      </>
    );
  }

  return (
    <>
      <Header title={lead.name} subtitle={`Lead Details`} />
      <div className="p-6">
        <Link
          href={window.location.pathname.includes("/admin") ? "/admin/leads" : "/telecaller/leads"}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Back to leads
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead Info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white">
                  {lead.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">{lead.name}</h2>
                  <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full", leadStatusColors[lead.status])}>
                    {leadStatusLabels[lead.status]}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone size={14} className="text-slate-400" /> {lead.phone}
                </div>
                {lead.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail size={14} className="text-slate-400" /> {lead.email}
                  </div>
                )}
                {lead.city && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin size={14} className="text-slate-400" /> {lead.city}
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar size={14} className="text-slate-400" /> {formatDateTime(lead.createdAt)}
                </div>
              </div>

              <hr className="my-4 border-slate-100" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Source</span>
                  <span className="font-medium">{leadSourceLabels[lead.source]}</span>
                </div>
                {lead.assignedTo && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned To</span>
                    <span className="font-medium">{lead.assignedTo.name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Created By</span>
                  <span className="font-medium">{lead.createdBy.name}</span>
                </div>
              </div>

              {lead.notes && (
                <>
                  <hr className="my-4 border-slate-100" />
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Notes</p>
                    <p className="text-sm text-slate-600">{lead.notes}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Call Logs */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                <h3 className="font-semibold text-slate-900">Call History</h3>
                <button
                  onClick={() => setShowCallForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <Plus size={14} /> Log Call
                </button>
              </div>

              <div className="divide-y divide-slate-50">
                {lead.callLogs.length === 0 ? (
                  <div className="px-5 py-12 text-center text-slate-400 text-sm">
                    No calls logged yet
                  </div>
                ) : (
                  lead.callLogs.map((call) => (
                    <div key={call.id} className="px-5 py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", outcomeColors[call.outcome])}>
                            {outcomeLabels[call.outcome]}
                          </span>
                          <span className="text-xs text-slate-400">
                            by {call.telecaller.name}
                          </span>
                        </div>
                        <span className="text-xs text-slate-400">{formatDateTime(call.callDate)}</span>
                      </div>
                      {call.notes && <p className="text-sm text-slate-600">{call.notes}</p>}
                      {call.followUpDate && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                          <Clock size={12} />
                          Follow-up: {formatDateTime(call.followUpDate)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Log Call Modal */}
        {showCallForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">Log Call</h2>
                <button onClick={() => setShowCallForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleLogCall} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Outcome</label>
                  <select value={callForm.outcome} onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm">
                    {Object.entries(outcomeLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea value={callForm.notes} onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })} rows={4} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm resize-none" placeholder="Call notes..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Follow-up Date</label>
                  <input type="datetime-local" value={callForm.followUpDate} onChange={(e) => setCallForm({ ...callForm, followUpDate: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCallForm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    Save
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

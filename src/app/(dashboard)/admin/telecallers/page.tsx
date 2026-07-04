"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Shield,
  ShieldOff,
  Edit2,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";

interface Telecaller {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { assignedAds: number };
}

export default function TelecallersPage() {
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    fetchTelecallers();
  }, []);

  const fetchTelecallers = async () => {
    try {
      const res = await fetch("/api/users?role=TELECALLER");
      const data = await res.json();
      setTelecallers(data);
    } catch (err) {
      console.error("Failed to fetch telecallers", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingId) {
        await fetch(`/api/users/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, role: "TELECALLER" }),
        });
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: "", email: "", phone: "", password: "" });
      fetchTelecallers();
    } catch (err) {
      console.error("Failed to save telecaller", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setMenuOpen(null);
    fetchTelecallers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this telecaller?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    setMenuOpen(null);
    fetchTelecallers();
  };

  const openEdit = (tc: Telecaller) => {
    setEditingId(tc.id);
    setFormData({
      name: tc.name,
      email: tc.email,
      phone: tc.phone || "",
      password: "",
    });
    setShowModal(true);
    setMenuOpen(null);
  };

  const filtered = telecallers.filter(
    (tc) =>
      tc.name.toLowerCase().includes(search.toLowerCase()) ||
      tc.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header title="Telecallers" subtitle="Manage your team members" />
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search telecallers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-72"
            />
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: "", email: "", phone: "", password: "" });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            Add Telecaller
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p>No telecallers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {filtered.map((tc) => (
              <div
                key={tc.id}
                className={cn(
                  "bg-white rounded-2xl border p-5 card-hover relative",
                  tc.isActive ? "border-slate-100" : "border-red-100 bg-red-50/30"
                )}
              >
                {/* Menu */}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => setMenuOpen(menuOpen === tc.id ? null : tc.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen === tc.id && (
                    <div className="absolute right-0 top-8 bg-white rounded-xl border border-slate-100 shadow-lg py-1 w-44 z-10 animate-scale-in">
                      <button
                        onClick={() => openEdit(tc)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Edit2 size={14} /> Edit Details
                      </button>
                      <button
                        onClick={() => handleToggleActive(tc.id, tc.isActive)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {tc.isActive ? (
                          <>
                            <ShieldOff size={14} /> Deactivate
                          </>
                        ) : (
                          <>
                            <Shield size={14} /> Activate
                          </>
                        )}
                      </button>
                      <hr className="my-1 border-slate-100" />
                      <button
                        onClick={() => handleDelete(tc.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold",
                      tc.isActive
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    )}
                  >
                    {getInitials(tc.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{tc.name}</p>
                      {tc.isActive ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      ) : (
                        <span className="text-[10px] font-medium text-red-500 bg-red-100 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{tc.email}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone size={12} />
                    <span>{tc._count.assignedAds} deals</span>
                  </div>
                  {tc.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail size={12} />
                      <span>{tc.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? "Edit Telecaller" : "Add New Telecaller"}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {editingId ? "New Password (leave blank to keep)" : "Password"}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    required={!editingId}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    {editingId ? "Update" : "Create"}
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

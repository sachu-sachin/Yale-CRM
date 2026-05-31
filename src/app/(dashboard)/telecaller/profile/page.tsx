"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { Lock, Loader2, CheckCircle, Bell } from "lucide-react";
import {
  REMINDER_OPTIONS,
  getReminderIntervalMin,
  setReminderIntervalMin,
} from "@/lib/reminder";

export default function TelecallerProfilePage() {
  const { data: session } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [reminderMin, setReminderMin] = useState(10);

  useEffect(() => {
    setReminderMin(getReminderIntervalMin());
  }, []);

  const handleReminderChange = (min: number) => {
    setReminderMin(min);
    setReminderIntervalMin(min);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`/api/users/${session?.user?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });

      if (res.ok) {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError("Failed to update password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header title="Profile" subtitle="Manage your account" />
      <div className="p-6 max-w-xl">
        {/* User Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white">
              {session?.user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{session?.user?.name}</h2>
              <p className="text-sm text-slate-500">{session?.user?.email}</p>
              <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                Telecaller
              </span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Lock size={18} className="text-slate-400" />
            Change Password
          </h3>

          {success && (
            <div className="bg-emerald-50 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2 animate-fade-in">
              <CheckCircle size={16} />
              Password updated successfully!
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4 animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Update Password
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

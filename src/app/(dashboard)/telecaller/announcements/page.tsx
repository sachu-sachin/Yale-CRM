"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Megaphone, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: { name: string };
}

export default function TelecallerAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/announcements")
      .then((r) => r.json())
      .then(setAnnouncements)
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header title="Notice Board" subtitle="Company announcements" />
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Megaphone size={48} className="mx-auto mb-4 opacity-30" />
            <p>No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-children max-w-3xl">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-slate-100 p-6 card-hover"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Megaphone size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base">{a.title}</h3>
                    <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{a.content}</p>
                    <p className="text-xs text-slate-400 mt-3">
                      {formatDateTime(a.createdAt)} · by {a.createdBy.name}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

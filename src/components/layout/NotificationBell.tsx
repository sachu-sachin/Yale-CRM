"use client";

import useSWR from "swr";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, MessageSquare, Briefcase, Clock, BellRing } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// Short chime using the Web Audio API — no audio file needed.
function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const notes = [880, 1174];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.start(t);
      o.stop(t + 0.26);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* audio not allowed yet — ignore */
  }
}

const typeIcon: Record<string, typeof Bell> = {
  MESSAGE: MessageSquare,
  DEAL: Briefcase,
  DEAL_ENDING: Clock,
  REMINDER: BellRing,
  GENERAL: Bell,
};

export default function NotificationBell() {
  const { data, mutate } = useSWR<{ items: Notif[]; unread: number }>("/api/notifications", {
    refreshInterval: 15000,
  });
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const prevUnread = useRef<number | null>(null);

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  // Chime when unread count rises (skip the very first load).
  useEffect(() => {
    if (prevUnread.current !== null && unread > prevUnread.current) playChime();
    prevUnread.current = unread;
  }, [unread]);

  const markAll = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    mutate();
  };

  const openItem = async (n: Notif) => {
    setOpen(false);
    if (!n.isRead) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
      mutate();
    }
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors relative"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[70vh] overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-black/10 z-50 animate-scale-in flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-10 text-center text-slate-400 text-sm">No notifications yet.</div>
              ) : (
                items.map((n) => {
                  const Icon = typeIcon[n.type] || Bell;
                  return (
                    <button
                      key={n.id}
                      onClick={() => openItem(n)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-50 hover:bg-slate-50 transition-colors",
                        !n.isRead && "bg-indigo-50/50"
                      )}
                    >
                      <div className={cn("mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        n.isRead ? "bg-slate-100 text-slate-400" : "bg-indigo-100 text-indigo-600")}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm truncate", n.isRead ? "text-slate-600" : "font-medium text-slate-900")}>{n.title}</p>
                        {n.body && <p className="text-xs text-slate-400 truncate">{n.body}</p>}
                        <p className="text-[10px] text-slate-300 mt-0.5">{formatDateTime(n.createdAt)}</p>
                      </div>
                      {!n.isRead && <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

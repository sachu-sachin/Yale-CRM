"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import NotificationBell from "@/components/layout/NotificationBell";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="flex items-center justify-between h-16 px-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            {searchOpen && (
              <input
                type="text"
                placeholder="Search..."
                className="absolute right-0 top-1/2 -translate-y-1/2 w-64 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 animate-slide-left"
                autoFocus
                onBlur={() => setSearchOpen(false)}
              />
            )}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Search size={18} />
            </button>
          </div>

          {/* Notifications */}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}

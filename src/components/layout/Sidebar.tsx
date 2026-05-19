"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Phone,
  Target,
  BarChart3,
  MessageSquare,
  Megaphone,
  Settings,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { useState } from "react";
import { signOut } from "next-auth/react";

interface SidebarProps {
  role: string;
  userName: string;
  userEmail: string;
}

const adminLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "All Leads", icon: Phone },
  { href: "/admin/telecallers", label: "Telecallers", icon: Users },
  { href: "/admin/targets", label: "Goals & Bonuses", icon: Target },
  { href: "/admin/chat", label: "Messages", icon: MessageSquare },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const telecallerLinks = [
  { href: "/telecaller", label: "Dashboard", icon: LayoutDashboard },
  { href: "/telecaller/leads", label: "My Leads", icon: Phone },
  { href: "/telecaller/chat", label: "Messages", icon: MessageSquare },
  { href: "/telecaller/announcements", label: "Notice Board", icon: Megaphone },
  { href: "/telecaller/profile", label: "Profile", icon: UserCircle },
];

export default function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const links = role === "ADMIN" ? adminLinks : telecallerLinks;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar flex flex-col transition-all duration-300 ease-in-out z-50",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <span className="text-sm font-bold text-white">Y</span>
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <h2 className="text-sm font-bold text-white leading-tight truncate">
              YALE IT
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Skill Hub CRM
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/admin" &&
              link.href !== "/telecaller" &&
              pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-indigo-600/20 text-indigo-300 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-sidebar-hover"
              )}
              title={collapsed ? link.label : undefined}
            >
              <link.icon
                size={20}
                className={cn(
                  "flex-shrink-0",
                  isActive ? "text-indigo-400" : ""
                )}
              />
              {!collapsed && <span>{link.label}</span>}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-soft" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-3 mb-2 p-2 rounded-lg text-slate-500 hover:text-white hover:bg-sidebar-hover transition-colors flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* User Section */}
      <div className="border-t border-white/5 px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white">
            {getInitials(userName)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sm font-medium text-white truncate">
                {userName}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

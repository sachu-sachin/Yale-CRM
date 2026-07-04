import Header from "@/components/layout/Header";
import StatCard from "@/components/dashboard/StatCard";
import RevenuePanel from "@/components/dashboard/RevenuePanel";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Users, Briefcase, TrendingUp, MessageSquare, Target, Megaphone, Clock } from "lucide-react";
import Link from "next/link";
import { formatDateTime, dealStatusColors, dealStatusLabels } from "@/lib/utils";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalDeals,
    totalTelecallers,
    paidDeals,
    leadsThisMonth,
    recentDeals,
    recentAnnouncements,
    unreadMessages,
  ] = await Promise.all([
    prisma.ad.count(),
    prisma.user.count({ where: { role: "TELECALLER" } }),
    prisma.ad.count({ where: { status: "PAID" } }),
    prisma.ad.count({ where: { closeDate: { gte: monthStart } } }),
    prisma.ad.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true, phone: true } }, assignedTo: { select: { name: true } } },
    }),
    prisma.announcement.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.message.count({ where: { receiverId: session.user?.id, isRead: false } }),
  ]);

  const conversionRate = totalDeals > 0 ? ((paidDeals / totalDeals) * 100).toFixed(1) : "0";

  return (
    <>
      <Header title="Admin Dashboard" subtitle={`Welcome back, ${session.user?.name}`} />
      <div className="p-6 space-y-6">
        {/* Revenue (filterable) */}
        <RevenuePanel />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <StatCard title="Total Deals" value={totalDeals} icon={Briefcase} iconColor="text-indigo-600" iconBg="bg-indigo-50" change={`${leadsThisMonth} this month`} changeType="neutral" />
          <StatCard title="Active Telecallers" value={totalTelecallers} icon={Users} iconColor="text-purple-600" iconBg="bg-purple-50" />
          <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-50" change={`${paidDeals} paid`} changeType="positive" />
          <StatCard title="Unread Messages" value={unreadMessages} icon={MessageSquare} iconColor="text-amber-600" iconBg="bg-amber-50" />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Deals */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                <h3 className="font-semibold text-slate-900">Recent Deals</h3>
              </div>
              <Link href="/admin/ads" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View all →</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {recentDeals.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400 text-sm">No deals yet. They will appear here once created.</div>
              ) : (
                recentDeals.map((d) => (
                  <div key={d.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                        {d.client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{d.client.name}</p>
                        <p className="text-xs text-slate-400">{d.client.phone} · {d.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${dealStatusColors[d.status]}`}>{dealStatusLabels[d.status]}</span>
                      {d.assignedTo && <span className="text-xs text-slate-400">→ {d.assignedTo.name}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link href="/admin/ads" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-medium">
                  <Briefcase size={18} /> Manage Deals
                </Link>
                <Link href="/admin/targets" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium">
                  <Target size={18} /> Set Monthly Goals
                </Link>
                <Link href="/admin/announcements" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-sm font-medium">
                  <Megaphone size={18} /> Post Announcement
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <Megaphone size={16} className="text-slate-400" />
                  <h3 className="font-semibold text-slate-900">Announcements</h3>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {recentAnnouncements.length === 0 ? (
                  <div className="px-5 py-8 text-center text-slate-400 text-sm">No announcements yet.</div>
                ) : (
                  recentAnnouncements.map((a) => (
                    <div key={a.id} className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatDateTime(a.createdAt)} · {a.createdBy.name}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

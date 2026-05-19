import Header from "@/components/layout/Header";
import StatCard from "@/components/dashboard/StatCard";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Users,
  Phone,
  TrendingUp,
  Target,
  MessageSquare,
  Megaphone,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { formatDateTime, leadStatusColors, leadStatusLabels } from "@/lib/utils";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const [
    totalLeads,
    totalTelecallers,
    wonLeads,
    newLeads,
    recentLeads,
    recentAnnouncements,
    unreadMessages,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.user.count({ where: { role: "TELECALLER" } }),
    prisma.lead.count({ where: { status: "WON" } }),
    prisma.lead.count({ where: { status: "NEW_ENQUIRY" } }),
    prisma.lead.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.announcement.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.message.count({
      where: {
        receiverId: session.user?.id,
        isRead: false,
      },
    }),
  ]);

  const conversionRate =
    totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : "0";

  return (
    <>
      <Header
        title="Admin Dashboard"
        subtitle={`Welcome back, ${session.user?.name}`}
      />
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <StatCard
            title="Total Leads"
            value={totalLeads}
            icon={Phone}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            change={`${newLeads} new enquiries`}
            changeType="neutral"
          />
          <StatCard
            title="Active Telecallers"
            value={totalTelecallers}
            icon={Users}
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
          />
          <StatCard
            title="Conversion Rate"
            value={`${conversionRate}%`}
            icon={TrendingUp}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            change={`${wonLeads} won`}
            changeType="positive"
          />
          <StatCard
            title="Unread Messages"
            value={unreadMessages}
            icon={MessageSquare}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Leads */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                <h3 className="font-semibold text-slate-900">Recent Leads</h3>
              </div>
              <Link
                href="/admin/leads"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View all →
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {recentLeads.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400 text-sm">
                  No leads yet. They will appear here once created.
                </div>
              ) : (
                recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {lead.name}
                        </p>
                        <p className="text-xs text-slate-400">{lead.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          leadStatusColors[lead.status]
                        }`}
                      >
                        {leadStatusLabels[lead.status]}
                      </span>
                      {lead.assignedTo && (
                        <span className="text-xs text-slate-400">
                          → {lead.assignedTo.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link
                  href="/admin/telecallers"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-sm font-medium"
                >
                  <Users size={18} />
                  Manage Telecallers
                </Link>
                <Link
                  href="/admin/targets"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-sm font-medium"
                >
                  <Target size={18} />
                  Set Monthly Goals
                </Link>
                <Link
                  href="/admin/announcements"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-sm font-medium"
                >
                  <Megaphone size={18} />
                  Post Announcement
                </Link>
              </div>
            </div>

            {/* Recent Announcements */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                <div className="flex items-center gap-2">
                  <Megaphone size={16} className="text-slate-400" />
                  <h3 className="font-semibold text-slate-900">
                    Announcements
                  </h3>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {recentAnnouncements.length === 0 ? (
                  <div className="px-5 py-8 text-center text-slate-400 text-sm">
                    No announcements yet.
                  </div>
                ) : (
                  recentAnnouncements.map((a) => (
                    <div key={a.id} className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-900">
                        {a.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDateTime(a.createdAt)} · {a.createdBy.name}
                      </p>
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

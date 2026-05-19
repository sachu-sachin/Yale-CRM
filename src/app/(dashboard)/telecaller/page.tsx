import Header from "@/components/layout/Header";
import StatCard from "@/components/dashboard/StatCard";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Phone,
  TrendingUp,
  Target,
  MessageSquare,
  Clock,
  CalendarCheck,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { formatDate, leadStatusColors, leadStatusLabels, cn } from "@/lib/utils";

export default async function TelecallerDashboard() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user?.id as string;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    totalLeads,
    wonLeads,
    followUpLeads,
    todayFollowUps,
    monthlyTarget,
    monthlyCalls,
    monthlyConverts,
    unreadMessages,
  ] = await Promise.all([
    prisma.lead.count({ where: { assignedToId: userId } }),
    prisma.lead.count({ where: { assignedToId: userId, status: "WON" } }),
    prisma.lead.count({ where: { assignedToId: userId, status: "FOLLOW_UP" } }),
    prisma.callLog.findMany({
      where: {
        telecallerId: userId,
        followUpDate: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, status: true } },
      },
    }),
    prisma.target.findFirst({
      where: {
        telecallerId: userId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    }),
    prisma.callLog.count({
      where: {
        telecallerId: userId,
        callDate: { gte: startOfMonth, lte: endOfMonth },
      },
    }),
    prisma.callLog.count({
      where: {
        telecallerId: userId,
        callDate: { gte: startOfMonth, lte: endOfMonth },
        outcome: "CONVERTED",
      },
    }),
    prisma.message.count({
      where: { receiverId: userId, isRead: false },
    }),
  ]);

  const callProgress = monthlyTarget
    ? Math.min(100, Math.round((monthlyCalls / (monthlyTarget.targetCalls || 1)) * 100))
    : 0;
  const convertProgress = monthlyTarget
    ? Math.min(100, Math.round((monthlyConverts / (monthlyTarget.targetConverts || 1)) * 100))
    : 0;

  return (
    <>
      <Header
        title="My Dashboard"
        subtitle={`Welcome, ${session.user?.name}`}
      />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <StatCard
            title="My Leads"
            value={totalLeads}
            icon={Phone}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            change={`${followUpLeads} need follow-up`}
            changeType="neutral"
          />
          <StatCard
            title="Conversions"
            value={wonLeads}
            icon={TrendingUp}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
            change={`${monthlyConverts} this month`}
            changeType="positive"
          />
          <StatCard
            title="Calls This Month"
            value={monthlyCalls}
            icon={Target}
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
            change={monthlyTarget ? `Target: ${monthlyTarget.targetCalls}` : "No target set"}
            changeType="neutral"
          />
          <StatCard
            title="Unread Messages"
            value={unreadMessages}
            icon={MessageSquare}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Target Progress */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Target size={18} className="text-indigo-600" />
              Monthly Target
            </h3>
            {monthlyTarget ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Calls</span>
                    <span className="font-medium">{monthlyCalls}/{monthlyTarget.targetCalls}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", callProgress >= 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${callProgress}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Conversions</span>
                    <span className="font-medium">{monthlyConverts}/{monthlyTarget.targetConverts}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", convertProgress >= 100 ? "bg-emerald-500" : "bg-purple-500")} style={{ width: `${convertProgress}%` }} />
                  </div>
                </div>
                {monthlyTarget.bonusAmount > 0 && (
                  <div className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl mt-2",
                    callProgress >= 100 && convertProgress >= 100 ? "bg-emerald-50" : "bg-slate-50"
                  )}>
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-emerald-600" />
                      <span className="text-sm font-semibold text-slate-700">
                        Bonus: ₹{monthlyTarget.bonusAmount.toLocaleString()}
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      callProgress >= 100 && convertProgress >= 100
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                    )}>
                      {callProgress >= 100 && convertProgress >= 100 ? "Earned!" : "Pending"}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4">No target set for this month.</p>
            )}
          </div>

          {/* Today's Follow-ups */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <CalendarCheck size={16} className="text-slate-400" />
                <h3 className="font-semibold text-slate-900">Today&apos;s Follow-ups</h3>
              </div>
              <Link href="/telecaller/leads" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                All Leads →
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {todayFollowUps.length === 0 ? (
                <div className="px-5 py-12 text-center text-slate-400 text-sm">
                  No follow-ups scheduled for today 🎉
                </div>
              ) : (
                todayFollowUps.map((f) => (
                  <Link
                    key={f.id}
                    href={`/telecaller/leads/${f.lead.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                        <Clock size={16} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{f.lead.name}</p>
                        <p className="text-xs text-slate-400">{f.lead.phone}</p>
                      </div>
                    </div>
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", leadStatusColors[f.lead.status])}>
                      {leadStatusLabels[f.lead.status]}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

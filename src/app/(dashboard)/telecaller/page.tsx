import Header from "@/components/layout/Header";
import StatCard from "@/components/dashboard/StatCard";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Briefcase, TrendingUp, Target, MessageSquare, IndianRupee, Award, Clock } from "lucide-react";
import Link from "next/link";
import { formatCurrency, calcIncentive, dealStatusColors, dealStatusLabels, cn } from "@/lib/utils";

export default async function TelecallerDashboard() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user?.id as string;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    totalDeals,
    paidDeals,
    monthlyLeads,
    monthlyConverts,
    revenueAgg,
    monthlyTarget,
    unreadMessages,
    recentDeals,
  ] = await Promise.all([
    prisma.ad.count({ where: { assignedToId: userId } }),
    prisma.ad.count({ where: { assignedToId: userId, status: "PAID" } }),
    prisma.ad.count({ where: { assignedToId: userId, closeDate: { gte: startOfMonth, lte: endOfMonth } } }),
    prisma.ad.count({ where: { assignedToId: userId, status: "PAID", closeDate: { gte: startOfMonth, lte: endOfMonth } } }),
    prisma.ad.aggregate({
      where: { assignedToId: userId, status: "PAID", closeDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    prisma.target.findFirst({ where: { telecallerId: userId, month: now.getMonth() + 1, year: now.getFullYear() } }),
    prisma.message.count({ where: { receiverId: userId, isRead: false } }),
    prisma.ad.findMany({
      where: { assignedToId: userId },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true, phone: true } } },
    }),
  ]);

  const monthlyRevenue = revenueAgg._sum.amount || 0;
  const incentive = calcIncentive(monthlyRevenue);
  const leadProgress = monthlyTarget ? Math.min(100, Math.round((monthlyLeads / (monthlyTarget.targetLeads || 1)) * 100)) : 0;
  const convertProgress = monthlyTarget ? Math.min(100, Math.round((monthlyConverts / (monthlyTarget.targetConverts || 1)) * 100)) : 0;
  const toNextLakh = 100000 - (((monthlyRevenue - 250000) % 100000 + 100000) % 100000);

  return (
    <>
      <Header title="My Dashboard" subtitle={`Welcome, ${session.user?.name}`} />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <StatCard title="My Deals" value={totalDeals} icon={Briefcase} iconColor="text-indigo-600" iconBg="bg-indigo-50" change={`${monthlyLeads} this month`} changeType="neutral" />
          <StatCard title="Conversions" value={paidDeals} icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-50" change={`${monthlyConverts} this month`} changeType="positive" />
          <StatCard title="Revenue (Month)" value={formatCurrency(monthlyRevenue)} icon={IndianRupee} iconColor="text-purple-600" iconBg="bg-purple-50" change={monthlyTarget ? `Target leads: ${monthlyTarget.targetLeads}` : "No target set"} changeType="neutral" />
          <StatCard title="Unread Messages" value={unreadMessages} icon={MessageSquare} iconColor="text-amber-600" iconBg="bg-amber-50" />
        </div>

        {/* Incentive banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center"><Award size={24} /></div>
            <div>
              <p className="text-sm text-white/70">Incentive earned this month</p>
              <p className="text-3xl font-bold">{formatCurrency(incentive)}</p>
            </div>
          </div>
          <div className="text-sm text-white/80 text-right">
            <p>Paid revenue: <strong>{formatCurrency(monthlyRevenue)}</strong></p>
            {monthlyRevenue < 250000 ? (
              <p>{formatCurrency(250000 - monthlyRevenue)} more to reach base (₹2.5L)</p>
            ) : (
              <p>{formatCurrency(toNextLakh)} more for the next slab</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Target Progress */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Target size={18} className="text-indigo-600" /> Monthly Target</h3>
            {monthlyTarget ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-500">Leads</span>
                    <span className="font-medium">{monthlyLeads}/{monthlyTarget.targetLeads}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", leadProgress >= 100 ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${leadProgress}%` }} />
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
                  <div className={cn("flex items-center justify-between px-4 py-3 rounded-xl mt-2", leadProgress >= 100 && convertProgress >= 100 ? "bg-emerald-50" : "bg-slate-50")}>
                    <div className="flex items-center gap-2">
                      <IndianRupee size={16} className="text-emerald-600" />
                      <span className="text-sm font-semibold text-slate-700">Bonus: {formatCurrency(monthlyTarget.bonusAmount)}</span>
                    </div>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", leadProgress >= 100 && convertProgress >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500")}>
                      {leadProgress >= 100 && convertProgress >= 100 ? "Earned!" : "Pending"}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4">No target set for this month.</p>
            )}
          </div>

          {/* Recent Deals */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <div className="flex items-center gap-2"><Clock size={16} className="text-slate-400" /><h3 className="font-semibold text-slate-900">My Recent Deals</h3></div>
              <Link href="/telecaller/ads" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">All deals →</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {recentDeals.length === 0 ? (
                <div className="px-5 py-12 text-center text-slate-400 text-sm">No deals yet. Add your first deal!</div>
              ) : (
                recentDeals.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">{d.client.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{d.client.name}</p>
                        <p className="text-xs text-slate-400">{d.client.phone} · {d.title}</p>
                      </div>
                    </div>
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", dealStatusColors[d.status])}>{dealStatusLabels[d.status]}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

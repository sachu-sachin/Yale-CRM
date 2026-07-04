import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calcIncentive } from "@/lib/utils";

// GET /api/incentive?month=&year= — monthly incentive from PAID revenue.
// Telecaller: own figure. Admin: all telecallers.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  async function forUser(uid: string) {
    const agg = await prisma.ad.aggregate({
      where: { assignedToId: uid, status: "PAID", closeDate: { gte: start, lte: end } },
      _sum: { amount: true },
      _count: true,
    });
    const revenue = agg._sum.amount || 0;
    return { revenue, paidDeals: agg._count || 0, incentive: calcIncentive(revenue) };
  }

  if (role === "TELECALLER") {
    return NextResponse.json({ month, year, ...(await forUser(userId)) });
  }

  // Admin: every telecaller
  const tellers = await prisma.user.findMany({
    where: { role: "TELECALLER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  const rows = await Promise.all(
    tellers.map(async (t) => ({ telecaller: t, ...(await forUser(t.id)) }))
  );
  return NextResponse.json({ month, year, rows });
}

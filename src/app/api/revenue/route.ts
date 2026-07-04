import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/revenue — total PAID revenue with filters (admin sees all; telecaller sees own)
// params: from, to, telecaller, source, phase
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;
  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const telecaller = searchParams.get("telecaller");
  const source = searchParams.get("source");
  const phase = searchParams.get("phase");

  const where: Record<string, unknown> = { status: "PAID" };
  if (role === "TELECALLER") where.assignedToId = userId;
  else if (telecaller) where.assignedToId = telecaller;
  if (source) where.source = source;
  if (phase) where.phase = phase;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      range.lte = t;
    }
    where.closeDate = range;
  }

  const agg = await prisma.ad.aggregate({
    where,
    _sum: { amount: true },
    _count: true,
  });

  // Pending (waiting for payment) value for context
  const pendingWhere: Record<string, unknown> = { ...where, status: "PENDING" };
  const pending = await prisma.ad.aggregate({
    where: pendingWhere,
    _sum: { amount: true },
    _count: true,
  });

  return NextResponse.json({
    revenue: agg._sum.amount || 0,
    paidDeals: agg._count || 0,
    pendingRevenue: pending._sum.amount || 0,
    pendingDeals: pending._count || 0,
  });
}

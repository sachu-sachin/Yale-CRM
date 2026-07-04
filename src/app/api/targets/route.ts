import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/targets?month=X&year=Y
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = {};
  if (role === "TELECALLER") where.telecallerId = userId;
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);

  const targets = await prisma.target.findMany({
    where,
    include: { telecaller: { select: { id: true, name: true, email: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  // Enrich with actual lead (deal) counts + paid conversions for that month
  const enriched = await Promise.all(
    targets.map(async (target) => {
      const startDate = new Date(target.year, target.month - 1, 1);
      const endDate = new Date(target.year, target.month, 0, 23, 59, 59);

      const actualLeads = await prisma.ad.count({
        where: {
          assignedToId: target.telecallerId,
          closeDate: { gte: startDate, lte: endDate },
        },
      });

      const actualConverts = await prisma.ad.count({
        where: {
          assignedToId: target.telecallerId,
          status: "PAID",
          closeDate: { gte: startDate, lte: endDate },
        },
      });

      return { ...target, actualLeads, actualConverts };
    })
  );

  return NextResponse.json(enriched);
}

// POST /api/targets (admin only)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { telecallerId, month, year, targetLeads, targetConverts, bonusAmount } = body;

  if (!telecallerId || !month || !year) {
    return NextResponse.json(
      { error: "Telecaller, month, and year are required" },
      { status: 400 }
    );
  }

  const target = await prisma.target.upsert({
    where: {
      telecallerId_month_year: {
        telecallerId,
        month: parseInt(month),
        year: parseInt(year),
      },
    },
    create: {
      telecallerId,
      month: parseInt(month),
      year: parseInt(year),
      targetLeads: targetLeads || 0,
      targetConverts: targetConverts || 0,
      bonusAmount: bonusAmount || 0,
      createdBy: session.user?.id as string,
    },
    update: {
      targetLeads: targetLeads || 0,
      targetConverts: targetConverts || 0,
      bonusAmount: bonusAmount || 0,
    },
    include: { telecaller: { select: { id: true, name: true } } },
  });

  return NextResponse.json(target, { status: 201 });
}

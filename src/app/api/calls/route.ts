import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/calls?leadId=xxx
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");

  const where: Record<string, unknown> = {};
  if (leadId) where.leadId = leadId;

  const role = (session.user as { role: string }).role;
  if (role === "TELECALLER") {
    where.telecallerId = session.user?.id;
  }

  const calls = await prisma.callLog.findMany({
    where,
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      telecaller: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(calls);
}

// POST /api/calls
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { leadId, outcome, notes, followUpDate } = body;

  if (!leadId || !outcome) {
    return NextResponse.json(
      { error: "Lead and outcome are required" },
      { status: 400 }
    );
  }

  const call = await prisma.callLog.create({
    data: {
      leadId,
      telecallerId: session.user?.id as string,
      outcome,
      notes: notes || null,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    },
    include: {
      lead: { select: { id: true, name: true } },
      telecaller: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(call, { status: 201 });
}

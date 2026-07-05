import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTransitionAllowed } from "@/lib/utils";
import type { DealStatus } from "@prisma/client";

type AdPhase = "CLOSED" | "RENEWAL" | "REGULAR";
function phaseForSeq(seq: number): AdPhase {
  if (seq <= 1) return "CLOSED";
  if (seq === 2) return "RENEWAL";
  return "REGULAR";
}

// GET /api/ads/[id] — deal + stage-change timeline (for the edit popup)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ad = await prisma.ad.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true, city: true } },
      assignedTo: { select: { id: true, name: true } },
      stageEvents: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { name: true } } },
      },
    },
  });
  if (!ad) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ad);
}

// PUT /api/ads/[id] — edit; enforces forward-only transitions (admins override).
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = (session.user as { role: string }).role === "ADMIN";
  const userId = session.user?.id as string;

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.ad.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const statusChanging = body.status != null && body.status !== existing.status;
  if (statusChanging && !isTransitionAllowed(existing.status, body.status, isAdmin)) {
    return NextResponse.json(
      { error: `Not allowed to move from ${existing.status} to ${body.status}` },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (body.title != null) data.title = body.title;
  if (body.amount != null) data.amount = parseFloat(String(body.amount));
  if (body.source != null) data.source = body.source;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.city !== undefined) data.city = body.city || null;
  if (body.budgetRange !== undefined) data.budgetRange = body.budgetRange || null;
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null;
  if (body.closeDate != null) data.closeDate = new Date(body.closeDate);
  if (body.reminderDate !== undefined) data.reminderDate = body.reminderDate ? new Date(body.reminderDate) : null;
  if (body.renewedAt !== undefined) data.renewedAt = body.renewedAt ? new Date(body.renewedAt) : null;
  if (body.supersededById !== undefined) data.supersededById = body.supersededById || null;

  if (body.endDate !== undefined) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }
  if (body.durationDays !== undefined) {
    const d = body.durationDays ? parseInt(String(body.durationDays), 10) : null;
    data.durationDays = d;
    if (d && d > 0 && body.endDate === undefined) {
      const base = body.closeDate ? new Date(body.closeDate) : existing.closeDate;
      const end = new Date(base);
      end.setDate(end.getDate() + d);
      data.endDate = end;
    }
  }

  if (statusChanging) {
    data.status = body.status;
    if (body.status === "PAID" && !existing.phase) {
      const paidCount = await prisma.ad.count({
        where: { clientId: existing.clientId, status: "PAID", id: { not: id } },
      });
      const seq = paidCount + 1;
      data.seq = seq;
      data.phase = phaseForSeq(seq);
    } else if (body.status !== "PAID" && existing.status === "PAID") {
      // admin override away from Paid → drop the paid-only phase
      data.phase = null;
      data.seq = null;
    }
  }

  const ad = await prisma.$transaction(async (tx) => {
    const updated = await tx.ad.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    if (statusChanging) {
      await tx.dealStageEvent.create({
        data: {
          adId: id,
          fromStatus: existing.status,
          toStatus: body.status as DealStatus,
          changedById: userId,
        },
      });
    }
    return updated;
  });

  return NextResponse.json(ad);
}

// DELETE /api/ads/[id] (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.ad.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

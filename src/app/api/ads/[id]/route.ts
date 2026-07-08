import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isTransitionAllowed, phaseForSeq, MAX_DEAL_AMOUNT } from "@/lib/utils";
import { Prisma, type DealStatus } from "@prisma/client";

// A telecaller "owns" a deal if it's assigned to them or was created by them.
function ownsDeal(ad: { assignedToId: string | null; createdById: string }, userId: string): boolean {
  return ad.assignedToId === userId || ad.createdById === userId;
}

// GET /api/ads/[id] — deal + stage-change timeline (for the edit popup)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = (session.user as { role: string }).role === "ADMIN";
  const userId = session.user?.id as string;

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
  // Ownership guard: a telecaller may only read their own deals.
  if (!isAdmin && !ownsDeal(ad, userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(ad);
}

// PUT /api/ads/[id] — edit; enforces forward-only transitions (PAID is final for all),
// ownership, and field-level role gating (money/assignment fields are admin-only).
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
  // Ownership guard: a telecaller may only edit their own deals.
  if (!isAdmin && !ownsDeal(existing, userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Telecallers may not edit a PAID deal beyond the remark (renewing is a separate action). A PENDING
  // deal — including a pending renewal — stays editable so it can be finalized to Paid with a term.
  const lifecycleLocked = !isAdmin && existing.status === "PAID";

  const statusChanging = body.status != null && body.status !== existing.status;
  if (statusChanging && !isTransitionAllowed(existing.status, body.status, isAdmin)) {
    return NextResponse.json(
      { error: `Not allowed to move from ${existing.status} to ${body.status}` },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  // Fields any owner may edit.
  if (body.title != null) data.title = body.title;
  if (body.source != null) data.source = body.source;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.city !== undefined) data.city = body.city || null;
  if (body.budgetRange !== undefined) data.budgetRange = body.budgetRange || null;
  if (body.reminderDate !== undefined) data.reminderDate = body.reminderDate ? new Date(body.reminderDate) : null;

  // amount — bounded, and frozen once the deal is PAID unless an admin changes it.
  if (body.amount != null) {
    const amt = parseFloat(String(body.amount));
    if (!Number.isFinite(amt) || amt < 0 || amt > MAX_DEAL_AMOUNT) {
      return NextResponse.json({ error: "Amount must be between 0 and 10,00,00,000." }, { status: 400 });
    }
    if (amt !== existing.amount && existing.status === "PAID" && !isAdmin) {
      return NextResponse.json({ error: "A paid deal's amount is locked. Ask an admin to change it." }, { status: 403 });
    }
    data.amount = amt;
  }

  // closeDate — frozen once PAID unless an admin changes it (stops month-shifting of booked revenue).
  // Compare by calendar day so a UI round-trip (date-only string vs stored timestamp) isn't seen as a change.
  if (body.closeDate != null) {
    const newClose = new Date(body.closeDate);
    if (newClose.toDateString() !== existing.closeDate.toDateString()) {
      if (existing.status === "PAID" && !isAdmin) {
        return NextResponse.json({ error: "A paid deal's date is locked. Ask an admin to change it." }, { status: 403 });
      }
      data.closeDate = newClose;
    }
  }

  // assignedToId — admin only (prevents deal/revenue theft via reassignment).
  if (body.assignedToId !== undefined && isAdmin) data.assignedToId = body.assignedToId || null;

  // renew flow: owner may mark their deal renewed; the superseding deal must actually exist.
  if (body.renewedAt !== undefined) data.renewedAt = body.renewedAt ? new Date(body.renewedAt) : null;
  if (body.supersededById !== undefined) {
    if (body.supersededById) {
      const target = await prisma.ad.findUnique({ where: { id: body.supersededById }, select: { id: true } });
      if (!target) return NextResponse.json({ error: "supersededById does not reference a valid deal." }, { status: 400 });
      data.supersededById = body.supersededById;
    } else {
      data.supersededById = null;
    }
  }

  if (body.endDate !== undefined) {
    data.endDate = body.endDate ? new Date(body.endDate) : null;
  }
  if (body.durationDays !== undefined) {
    const d = body.durationDays ? parseInt(String(body.durationDays), 10) : null;
    data.durationDays = d;
    if (d && d > 0 && body.endDate === undefined) {
      const base = data.closeDate ? (data.closeDate as Date) : existing.closeDate;
      const end = new Date(base);
      end.setDate(end.getDate() + d);
      data.endDate = end;
    }
  }

  // A dated term can never end before it starts (this guard was missing on edit).
  const effClose = (data.closeDate as Date | undefined) ?? existing.closeDate;
  const effEnd = data.endDate !== undefined ? (data.endDate as Date | null) : existing.endDate;
  if (effEnd && effClose && effEnd < effClose) {
    return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
  }

  if (statusChanging) data.status = body.status;

  if (lifecycleLocked) {
    // Strip everything a telecaller isn't allowed to touch on a lifecycle deal.
    for (const k of Object.keys(data)) {
      if (k !== "notes" && k !== "status") delete data[k];
    }
  }

  const ad = await prisma.$transaction(async (tx) => {
    // Phase/seq computed INSIDE the transaction (avoids a seq race between concurrent PAID edits).
    if (statusChanging) {
      if (body.status === "PAID" && !existing.phase) {
        const paidCount = await tx.ad.count({
          where: { clientId: existing.clientId, status: "PAID", id: { not: id } },
        });
        const seq = paidCount + 1;
        data.seq = seq;
        data.phase = phaseForSeq(seq);
      } else if (body.status !== "PAID" && existing.status === "PAID") {
        // (unreachable now that PAID is terminal, kept defensively) drop the paid-only phase
        data.phase = null;
        data.seq = null;
      }
    }

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

    // Audit sensitive non-status edits (amount / closeDate / reassignment) — not covered by DealStageEvent.
    const changes: Record<string, unknown> = {};
    if (data.amount !== undefined && data.amount !== existing.amount) {
      changes.amount = { from: existing.amount, to: data.amount };
    }
    if (data.closeDate !== undefined) {
      changes.closeDate = { from: existing.closeDate.toISOString(), to: (data.closeDate as Date).toISOString() };
    }
    if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
      changes.assignedToId = { from: existing.assignedToId, to: data.assignedToId };
    }
    if (Object.keys(changes).length) {
      await tx.activityLog.create({
        data: {
          userId,
          action: "AD_EDIT",
          entityType: "Ad",
          entityId: id,
          metadata: changes as unknown as Prisma.InputJsonObject,
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

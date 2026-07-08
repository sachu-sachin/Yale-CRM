import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { DealStatus, LeadSource } from "@prisma/client";
import { phaseForSeq, MAX_DEAL_AMOUNT, RENEWAL_GRACE_DAYS, type AdPhaseValue } from "@/lib/utils";

const SORTABLE = new Set([
  "closeDate", "endDate", "amount", "status", "phase", "title", "createdAt", "reminderDate",
]);

// GET /api/ads — list deals with filters, sub-tab states, search, dates and sorting
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;
  const { searchParams } = new URL(req.url);

  const phase = searchParams.get("phase");
  const status = searchParams.get("status");
  const view = searchParams.get("view"); // phase-tab view: closed | renewal:paid|waiting|finished | regular:...
  const source = searchParams.get("source");
  const assignedTo = searchParams.get("assignedTo");
  const search = (searchParams.get("search") || "").trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sortBy = searchParams.get("sortBy") || "closeDate";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (role === "TELECALLER") and.push({ OR: [{ assignedToId: userId }, { createdById: userId }] });
  else if (assignedTo) where.assignedToId = assignedTo;
  if (source) where.source = source;

  // Lifecycle date bounds: a deal is renewal-"due" from 1 day before its end (soon) through the
  // grace window; older than graceStart (unrenewed) it is "expired" → Finished.
  const soon = new Date(); soon.setDate(soon.getDate() + 1); soon.setHours(23, 59, 59, 999);
  const graceStart = new Date(); graceStart.setDate(graceStart.getDate() - RENEWAL_GRACE_DAYS); graceStart.setHours(0, 0, 0, 0);

  // Reusable lifecycle-state fragments (for the current, non-superseded deal unless noted).
  const activePaid = { status: "PAID", renewedAt: null, OR: [{ endDate: null }, { endDate: { gt: soon } }] };
  const dueOf = (phases: string[]) => ({ phase: { in: phases }, status: "PAID", renewedAt: null, endDate: { lte: soon, gte: graceStart } });
  const pendingOf = (phases: string[]) => ({ phase: { in: phases }, status: "PENDING", renewedAt: null });
  const expiredOf = (phases: string[]) => ({ phase: { in: phases }, status: "PAID", renewedAt: null, endDate: { lt: graceStart } });
  const supersededOf = (phases: string[]) => ({ phase: { in: phases }, renewedAt: { not: null } });

  if (view === "followups:followup") {
    // Pre-conversion follow-ups only (exclude pending renewals, which carry a phase).
    and.push({ status: "FOLLOW_UP", phase: null });
  } else if (view === "followups:waiting") {
    and.push({ status: "PENDING", phase: null });
  } else if (view === "closed") {
    // First conversion, not yet due for its first renewal.
    and.push({ phase: "CLOSED", ...activePaid });
  } else if (view === "renewal:paid") {
    and.push({ phase: "RENEWAL", ...activePaid });
  } else if (view === "renewal:waiting") {
    // Due first-conversion or renewal deals, plus pending (waiting-for-payment) renewals.
    and.push({ OR: [dueOf(["CLOSED", "RENEWAL"]), pendingOf(["RENEWAL"])] });
  } else if (view === "renewal:finished") {
    and.push({ OR: [supersededOf(["CLOSED", "RENEWAL"]), expiredOf(["CLOSED", "RENEWAL"])] });
  } else if (view === "regular:paid") {
    and.push({ phase: "REGULAR", ...activePaid });
  } else if (view === "regular:waiting") {
    and.push({ OR: [dueOf(["REGULAR"]), pendingOf(["REGULAR"])] });
  } else if (view === "regular:finished") {
    and.push({ OR: [supersededOf(["REGULAR"]), expiredOf(["REGULAR"])] });
  } else {
    // All Deals / Follow-ups: plain phase/status/date-range filters.
    if (phase) where.phase = phase;
    if (status) where.status = status;
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.gte = new Date(from);
      if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); range.lte = t; }
      where.closeDate = range;
    }
  }

  if (search) {
    and.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { client: { name: { contains: search, mode: "insensitive" } } },
        { client: { phone: { contains: search } } },
      ],
    });
  }
  if (and.length) where.AND = and;

  const orderField = SORTABLE.has(sortBy) ? sortBy : "closeDate";

  const ads = await prisma.ad.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, phone: true, email: true, city: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { [orderField]: sortDir },
  });

  return NextResponse.json(ads);
}

// POST /api/ads — create a deal (any enquiry). Find-or-create client; phase only when PAID.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;
  const body = await req.json();

  const {
    phone, name, email, city, title, amount, status, source,
    serviceInterest, budgetRange, closeDate, durationDays, endDate,
    reminderDate, assignedToId, notes, renewalOfId,
  } = body;

  if (!phone || !name || !title) {
    return NextResponse.json({ error: "Phone, name, and title are required" }, { status: 400 });
  }

  const dealStatus = (status || "NOT_CLOSED") as DealStatus;
  const close = closeDate ? new Date(closeDate) : new Date();

  const amt = amount != null ? parseFloat(String(amount)) : 0;
  if (!Number.isFinite(amt) || amt < 0 || amt > MAX_DEAL_AMOUNT) {
    return NextResponse.json({ error: "Amount must be between 0 and 10,00,00,000." }, { status: 400 });
  }

  let end: Date | null = endDate ? new Date(endDate) : null;
  const days = durationDays ? parseInt(String(durationDays), 10) : null;
  if (!end && days && days > 0) {
    end = new Date(close);
    end.setDate(end.getDate() + days);
  }
  // A dated term can never end before it starts (applies to any status, not just PAID).
  if (end && end < close) {
    return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
  }

  // Renewal: the new deal continues the source deal's chain (next position), even if created PENDING.
  let renewalSource: { id: string; clientId: string; seq: number | null } | null = null;
  if (renewalOfId) {
    const src = await prisma.ad.findUnique({
      where: { id: String(renewalOfId) },
      select: { id: true, clientId: true, seq: true, status: true, endDate: true, renewedAt: true },
    });
    if (!src) {
      return NextResponse.json({ error: "renewalOfId does not reference a valid deal." }, { status: 400 });
    }
    // Only a due deal can be renewed — paid, not already renewed, and within 1 day of its end (or overdue).
    // Prevents superseding a still-running deal early (which would wrongly move it to Finished).
    const soon = new Date(); soon.setDate(soon.getDate() + 1); soon.setHours(23, 59, 59, 999);
    const due = src.status === "PAID" && !src.renewedAt && src.endDate != null && src.endDate <= soon;
    if (!due) {
      return NextResponse.json({ error: "This deal isn't due for renewal yet." }, { status: 400 });
    }
    renewalSource = { id: src.id, clientId: src.clientId, seq: src.seq };
  }

  const client = await prisma.client.upsert({
    where: { phone },
    update: { name, email: email || undefined, city: city || undefined },
    create: { name, phone, email: email || null, city: city || null, createdById: userId },
  });

  // Default reminder for a pending (waiting-for-payment) renewal: 1 day before its end date.
  let reminder: Date | null = reminderDate ? new Date(reminderDate) : null;
  if (!reminder && renewalSource && dealStatus === "PENDING" && end) {
    reminder = new Date(end);
    reminder.setDate(reminder.getDate() - 1);
  }

  // Compute phase + create the deal + log the initial stage in one transaction (avoids seq races).
  const ad = await prisma.$transaction(async (tx) => {
    let phase: AdPhaseValue | null = null;
    let seq: number | null = null;
    if (renewalSource) {
      // Renewals continue the chain by position, whether created Paid or Waiting-for-payment.
      seq = (renewalSource.seq ?? 1) + 1;
      phase = phaseForSeq(seq);
    } else if (dealStatus === "PAID") {
      const paidCount = await tx.ad.count({ where: { clientId: client.id, status: "PAID" } });
      seq = paidCount + 1;
      phase = phaseForSeq(seq);
    }
    const created = await tx.ad.create({
      data: {
        clientId: client.id,
        title,
        amount: amt,
        status: dealStatus,
        source: (source || "OTHER") as LeadSource,
        serviceInterest: serviceInterest || [],
        budgetRange: budgetRange || null,
        city: city || null,
        phase,
        seq,
        closeDate: close,
        endDate: end,
        durationDays: days,
        reminderDate: reminder,
        notes: notes || null,
        assignedToId: role === "TELECALLER" ? userId : assignedToId || null,
        createdById: userId,
      },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    await tx.dealStageEvent.create({
      data: { adId: created.id, fromStatus: null, toStatus: dealStatus, changedById: userId },
    });
    // Atomically supersede the source deal → it moves to Finished and leaves the active queue.
    if (renewalSource) {
      await tx.ad.update({
        where: { id: renewalSource.id },
        data: { renewedAt: new Date(), supersededById: created.id },
      });
    }
    return created;
  });

  if (ad.assignedToId && ad.assignedToId !== userId) {
    await prisma.notification.create({
      data: {
        userId: ad.assignedToId,
        type: "DEAL",
        title: "New deal assigned to you",
        body: `${ad.title} — ${ad.client.name}`,
        link: "/telecaller/ads",
      },
    });
  }

  return NextResponse.json(ad, { status: 201 });
}

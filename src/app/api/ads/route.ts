import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { DealStatus, LeadSource } from "@prisma/client";
import { phaseForSeq, MAX_DEAL_AMOUNT, type AdPhaseValue } from "@/lib/utils";

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
  const paidState = searchParams.get("paidState"); // Closed sub-tabs: active | waiting
  const source = searchParams.get("source");
  const assignedTo = searchParams.get("assignedTo");
  const search = (searchParams.get("search") || "").trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const endOn = searchParams.get("endOn"); // ads whose END date is this specific day (Renewal filter)
  const dueRenewal = searchParams.get("dueRenewal"); // PAID deals ending within 1 day / already expired
  const sortBy = searchParams.get("sortBy") || "closeDate";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  if (role === "TELECALLER") and.push({ OR: [{ assignedToId: userId }, { createdById: userId }] });
  else if (assignedTo) where.assignedToId = assignedTo;
  if (phase) where.phase = phase;
  if (source) where.source = source;

  if (paidState === "waiting") {
    // Closed ▸ Waiting = paid, term expired, not yet renewed
    where.status = "PAID";
    where.renewedAt = null;
    where.endDate = { lt: startToday };
  } else if (paidState === "active") {
    // Closed ▸ Active = paid and NOT renewal-due (future/no end, or already renewed)
    where.status = "PAID";
    and.push({ OR: [{ endDate: null }, { endDate: { gte: startToday } }, { renewedAt: { not: null } }] });
  } else if (status) {
    where.status = status;
  }

  if (!paidState) {
    if (endOn) {
      const s = new Date(endOn); s.setHours(0, 0, 0, 0);
      const e = new Date(endOn); e.setHours(23, 59, 59, 999);
      where.endDate = { gte: s, lte: e };
    } else if (dueRenewal) {
      const limit = new Date();
      limit.setDate(limit.getDate() + 1);
      limit.setHours(23, 59, 59, 999);
      where.status = "PAID";
      where.renewedAt = null;
      where.endDate = { lte: limit };
    } else if (from || to) {
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
    reminderDate, assignedToId, notes,
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
  if (dealStatus === "PAID" && end && end < close) {
    return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
  }

  const client = await prisma.client.upsert({
    where: { phone },
    update: { name, email: email || undefined, city: city || undefined },
    create: { name, phone, email: email || null, city: city || null, createdById: userId },
  });

  // Compute phase + create the deal + log the initial stage in one transaction (avoids seq races).
  const ad = await prisma.$transaction(async (tx) => {
    let phase: AdPhaseValue | null = null;
    let seq: number | null = null;
    if (dealStatus === "PAID") {
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
        reminderDate: reminderDate ? new Date(reminderDate) : null,
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { DealStatus, LeadSource } from "@prisma/client";

type AdPhase = "CLOSED" | "RENEWAL" | "REGULAR";

function phaseForSeq(seq: number): AdPhase {
  if (seq <= 1) return "CLOSED";
  if (seq === 2) return "RENEWAL";
  return "REGULAR";
}

const SORTABLE = new Set(["closeDate", "endDate", "amount", "status", "phase", "title", "createdAt"]);

// GET /api/ads — list deals with filters, search, date range and sorting
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;
  const { searchParams } = new URL(req.url);

  const phase = searchParams.get("phase");
  const status = searchParams.get("status");
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
  if (role === "TELECALLER") where.OR = [{ assignedToId: userId }, { createdById: userId }];
  else if (assignedTo) where.assignedToId = assignedTo;
  if (phase) where.phase = phase;
  if (status) where.status = status;
  if (source) where.source = source;
  if (endOn) {
    const start = new Date(endOn);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endOn);
    end.setHours(23, 59, 59, 999);
    where.endDate = { gte: start, lte: end };
  } else if (dueRenewal) {
    // deals whose term ends within the next day (or already passed) → due for renewal
    const limit = new Date();
    limit.setDate(limit.getDate() + 1);
    limit.setHours(23, 59, 59, 999);
    where.status = "PAID";
    where.endDate = { lte: limit };
  } else if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      range.lte = t;
    }
    where.closeDate = range;
  }
  if (search) {
    where.AND = [
      {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { client: { name: { contains: search, mode: "insensitive" } } },
          { client: { phone: { contains: search } } },
        ],
      },
    ];
  }

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
    assignedToId, notes,
  } = body;

  if (!phone || !name || !title) {
    return NextResponse.json({ error: "Phone, name, and title are required" }, { status: 400 });
  }

  const dealStatus = status || "NOT_CLOSED";
  const close = closeDate ? new Date(closeDate) : new Date();

  // Completion only relevant for paid/closed deals; optional otherwise
  let end: Date | null = endDate ? new Date(endDate) : null;
  const days = durationDays ? parseInt(String(durationDays), 10) : null;
  if (!end && days && days > 0) {
    end = new Date(close);
    end.setDate(end.getDate() + days);
  }

  const client = await prisma.client.upsert({
    where: { phone },
    update: { name, email: email || undefined, city: city || undefined },
    create: { name, phone, email: email || null, city: city || null, createdById: userId },
  });

  // Phase derived from the client's existing PAID deals (only paid deals progress the lifecycle)
  let phase: AdPhase | null = null;
  let seq: number | null = null;
  if (dealStatus === "PAID") {
    const paidCount = await prisma.ad.count({ where: { clientId: client.id, status: "PAID" } });
    seq = paidCount + 1;
    phase = phaseForSeq(seq);
  }

  const ad = await prisma.ad.create({
    data: {
      clientId: client.id,
      title,
      amount: amount != null ? parseFloat(String(amount)) : 0,
      status: dealStatus as DealStatus,
      source: (source || "OTHER") as LeadSource,
      serviceInterest: serviceInterest || [],
      budgetRange: budgetRange || null,
      city: city || null,
      phase,
      seq,
      closeDate: close,
      endDate: end,
      durationDays: days,
      notes: notes || null,
      assignedToId: role === "TELECALLER" ? userId : assignedToId || null,
      createdById: userId,
    },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // Notify the assigned telecaller (when assigned by someone else, e.g. an admin)
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

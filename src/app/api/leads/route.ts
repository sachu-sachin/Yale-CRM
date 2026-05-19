import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/leads
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const assignedTo = searchParams.get("assignedTo");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  // Telecallers see only their leads
  if (role === "TELECALLER") {
    where.assignedToId = userId;
  }

  if (status) where.status = status;
  if (source) where.source = source;
  if (assignedTo) where.assignedToId = assignedTo;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { callLogs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}

// POST /api/leads
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;

  const {
    name,
    email,
    phone,
    altPhone,
    source,
    serviceInterest,
    city,
    budgetRange,
    priority,
    notes,
    assignedToId,
  } = body;

  if (!name || !phone || !source) {
    return NextResponse.json(
      { error: "Name, phone, and source are required" },
      { status: 400 }
    );
  }

  // Auto-assign to self if telecaller creates the lead
  const finalAssignedTo =
    role === "TELECALLER" ? userId : assignedToId || null;

  const lead = await prisma.lead.create({
    data: {
      name,
      email: email || null,
      phone,
      altPhone: altPhone || null,
      source,
      serviceInterest: serviceInterest || [],
      city: city || null,
      budgetRange: budgetRange || null,
      priority: priority || "MEDIUM",
      notes: notes || null,
      assignedToId: finalAssignedTo,
      createdById: userId,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(lead, { status: 201 });
}

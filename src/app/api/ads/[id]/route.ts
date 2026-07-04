import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type AdPhase = "CLOSED" | "RENEWAL" | "REGULAR";
function phaseForSeq(seq: number): AdPhase {
  if (seq <= 1) return "CLOSED";
  if (seq === 2) return "RENEWAL";
  return "REGULAR";
}

// PUT /api/ads/[id] — edit status, completion, amount, etc.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.ad.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.title != null) data.title = body.title;
  if (body.amount != null) data.amount = parseFloat(String(body.amount));
  if (body.source != null) data.source = body.source;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.city !== undefined) data.city = body.city || null;
  if (body.budgetRange !== undefined) data.budgetRange = body.budgetRange || null;
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null;
  if (body.closeDate != null) data.closeDate = new Date(body.closeDate);

  // Completion editing: explicit date wins, else duration from (new or existing) close date
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

  // Status change → (re)assign phase when it becomes PAID
  if (body.status != null && body.status !== existing.status) {
    data.status = body.status;
    if (body.status === "PAID" && !existing.phase) {
      const paidCount = await prisma.ad.count({
        where: { clientId: existing.clientId, status: "PAID", id: { not: id } },
      });
      const seq = paidCount + 1;
      data.seq = seq;
      data.phase = phaseForSeq(seq);
    }
  }

  const ad = await prisma.ad.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, name: true } },
    },
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

// GET /api/notifications — list + unread count; also generate "deal ending soon" notifs idempotently.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user?.id as string;
  const role = (session.user as { role: string }).role;
  const adsPath = role === "ADMIN" ? "/admin/ads" : "/telecaller/ads";

  // --- generate DAILY reminders (idempotent per day) ---
  // Nags for: pre-payment waiting (PENDING with reminderDate reached) and
  // renewal-due (PAID, term expired, not renewed). One per deal per day, stops once paid/renewed.
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  const todayStr = new Date().toISOString().slice(0, 10);
  const scope = role === "TELECALLER" ? { OR: [{ assignedToId: userId }, { createdById: userId }] } : {};

  const [pending, renewalDue] = await Promise.all([
    prisma.ad.findMany({
      where: { ...scope, status: "PENDING", reminderDate: { lte: endToday } },
      include: { client: { select: { name: true } } },
    }),
    prisma.ad.findMany({
      where: { ...scope, status: "PAID", renewedAt: null, endDate: { lt: startToday } },
      include: { client: { select: { name: true } } },
    }),
  ]);

  type Cand = { id: string; title: string; clientName: string; kind: "PAYMENT" | "RENEWAL"; end: Date | null };
  const cands: Cand[] = [
    ...pending.map((d) => ({ id: d.id, title: d.title, clientName: d.client.name, kind: "PAYMENT" as const, end: d.endDate })),
    ...renewalDue.map((d) => ({ id: d.id, title: d.title, clientName: d.client.name, kind: "RENEWAL" as const, end: d.endDate })),
  ];

  if (cands.length) {
    const links = cands.map((c) => `${adsPath}?deal=${c.id}&d=${todayStr}`);
    const already = new Set(
      (
        await prisma.notification.findMany({
          where: { userId, type: "REMINDER", link: { in: links } },
          select: { link: true },
        })
      ).map((n) => n.link)
    );
    const toCreate = cands
      .filter((c) => !already.has(`${adsPath}?deal=${c.id}&d=${todayStr}`))
      .map((c) => ({
        userId,
        type: "REMINDER" as const,
        title: c.kind === "PAYMENT" ? `${c.clientName} — payment reminder` : `${c.clientName} — renewal due`,
        body: c.kind === "PAYMENT"
          ? `${c.title}: awaiting payment`
          : `${c.title} ended ${c.end ? formatDate(c.end) : ""}`.trim(),
        link: `${adsPath}?deal=${c.id}&d=${todayStr}`,
      }));
    if (toCreate.length) await prisma.notification.createMany({ data: toCreate });
  }

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return NextResponse.json({ items, unread });
}

// PATCH /api/notifications — mark one ({id}) or all ({all:true}) as read.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user?.id as string;
  const body = await req.json().catch(() => ({}));

  if (body.all) {
    await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  } else if (body.id) {
    await prisma.notification.updateMany({ where: { id: body.id, userId }, data: { isRead: true } });
  }
  return NextResponse.json({ ok: true });
}

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

  // --- generate deal-ending-soon notifications (within 3 days) ---
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  soon.setHours(23, 59, 59, 999);

  const dealWhere: Record<string, unknown> = {
    status: "PAID",
    endDate: { gte: start, lte: soon },
  };
  if (role === "TELECALLER") dealWhere.OR = [{ assignedToId: userId }, { createdById: userId }];

  const ending = await prisma.ad.findMany({
    where: dealWhere,
    include: { client: { select: { name: true } } },
  });

  if (ending.length) {
    const already = new Set(
      (
        await prisma.notification.findMany({
          where: { userId, type: "DEAL_ENDING" },
          select: { link: true },
        })
      ).map((n) => n.link)
    );
    const toCreate = ending
      .filter((d) => d.endDate && !already.has(`${adsPath}?deal=${d.id}`))
      .map((d) => ({
        userId,
        type: "DEAL_ENDING" as const,
        title: `${d.client.name} — deal ending`,
        body: `${d.title} ends ${formatDate(d.endDate as Date)}`,
        link: `${adsPath}?deal=${d.id}`,
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

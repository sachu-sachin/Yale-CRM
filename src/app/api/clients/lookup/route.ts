import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/clients/lookup?phone= -> existing client (for deal-form autofill)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;

  const phone = (new URL(req.url).searchParams.get("phone") || "").trim();
  if (phone.replace(/\D/g, "").length < 4) {
    return NextResponse.json({ client: null });
  }

  // Telecallers can only auto-fill from clients they own (created, or have a deal with) —
  // stops phone-number enumeration of the whole client base.
  const scope =
    role === "TELECALLER"
      ? { OR: [{ createdById: userId }, { ads: { some: { OR: [{ assignedToId: userId }, { createdById: userId }] } } }] }
      : {};

  const client = await prisma.client.findFirst({
    where: { AND: [{ phone: { contains: phone } }, scope] },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      city: true,
      _count: { select: { ads: true } },
      ads: {
        where: { status: "PAID" },
        select: { id: true },
      },
    },
  });

  if (!client) return NextResponse.json({ client: null });

  const { ads, _count, ...rest } = client;
  return NextResponse.json({
    client: { ...rest, totalDeals: _count.ads, paidDeals: ads.length },
  });
}

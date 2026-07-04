import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const REMINDER_KEY = "reminderIntervalMin";
const DEFAULT_REMINDER_MIN = 10;

// GET /api/settings — any authenticated user (telecaller reminders read this)
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.appSetting.findUnique({ where: { key: REMINDER_KEY } });
  const reminderIntervalMin = row ? parseInt(row.value, 10) : DEFAULT_REMINDER_MIN;

  return NextResponse.json({
    reminderIntervalMin: isNaN(reminderIntervalMin) ? DEFAULT_REMINDER_MIN : reminderIntervalMin,
  });
}

// PUT /api/settings — admin only
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const min = parseInt(String(body.reminderIntervalMin), 10);
  if (isNaN(min) || min < 0 || min > 1440) {
    return NextResponse.json({ error: "Interval must be between 0 and 1440 minutes" }, { status: 400 });
  }

  await prisma.appSetting.upsert({
    where: { key: REMINDER_KEY },
    update: { value: String(min) },
    create: { key: REMINDER_KEY, value: String(min) },
  });

  return NextResponse.json({ reminderIntervalMin: min });
}

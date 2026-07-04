import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import ExcelJS from "exceljs";
import {
  leadSourceLabels,
  adPhaseLabels,
  dealStatusLabels,
} from "@/lib/utils";

type Col = { header: string; key: string; width?: number };

function dateRange(from: string | null, to: string | null) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) {
    const t = new Date(to);
    t.setHours(23, 59, 59, 999);
    range.lte = t;
  }
  return Object.keys(range).length ? range : undefined;
}

// GET /api/reports/export?type=deals|payments|clients|targets&from=&to=&...
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role: string }).role;
  const userId = session.user?.id as string;
  const isTele = role === "TELECALLER";

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "deals").toLowerCase();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const phase = searchParams.get("phase");
  const source = searchParams.get("source");
  const telecaller = searchParams.get("telecaller");
  const range = dateRange(from, to);

  const wb = new ExcelJS.Workbook();
  wb.creator = "YALE IT SKILL HUB CRM";
  let columns: Col[] = [];
  let rows: Record<string, unknown>[] = [];
  let sheetName = "Report";

  if (type === "deals" || type === "payments") {
    sheetName = type === "payments" ? "Payments" : "Deals";
    const where: Record<string, unknown> = {};
    if (isTele) where.OR = [{ assignedToId: userId }, { createdById: userId }];
    else if (telecaller) where.assignedToId = telecaller;
    if (type === "payments") where.status = "PAID";
    else if (status) where.status = status;
    if (phase) where.phase = phase;
    if (source) where.source = source;
    if (range) where.closeDate = range;

    const deals = await prisma.ad.findMany({
      where,
      include: {
        client: { select: { name: true, phone: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { closeDate: "desc" },
    });
    columns = [
      { header: "Client", key: "client", width: 22 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Business Name", key: "title", width: 26 },
      { header: "Amount (INR)", key: "amount", width: 14 },
      { header: "Status", key: "status", width: 18 },
      { header: "Source", key: "source", width: 14 },
      { header: "Phase", key: "phase", width: 14 },
      { header: "Date", key: "date", width: 14 },
      { header: "Completes", key: "end", width: 14 },
      { header: "Handled By", key: "assigned", width: 20 },
    ];
    rows = deals.map((d) => ({
      client: d.client.name,
      phone: d.client.phone,
      title: d.title,
      amount: d.amount,
      status: dealStatusLabels[d.status] || d.status,
      source: leadSourceLabels[d.source] || d.source,
      phase: d.phase ? adPhaseLabels[d.phase] : "",
      date: d.closeDate,
      end: d.endDate || "",
      assigned: d.assignedTo?.name || "Unassigned",
    }));
  } else if (type === "clients") {
    sheetName = "Clients";
    const clients = await prisma.client.findMany({
      include: { _count: { select: { ads: true } }, ads: { where: { status: "PAID" }, select: { amount: true } } },
      orderBy: { createdAt: "desc" },
    });
    columns = [
      { header: "Name", key: "name", width: 24 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Email", key: "email", width: 26 },
      { header: "City", key: "city", width: 16 },
      { header: "Total Deals", key: "deals", width: 12 },
      { header: "Paid Revenue (INR)", key: "rev", width: 18 },
    ];
    rows = clients.map((c) => ({
      name: c.name,
      phone: c.phone,
      email: c.email || "",
      city: c.city || "",
      deals: c._count.ads,
      rev: c.ads.reduce((s, a) => s + a.amount, 0),
    }));
  } else if (type === "targets") {
    sheetName = "Targets";
    const where: Record<string, unknown> = {};
    if (isTele) where.telecallerId = userId;
    else if (telecaller) where.telecallerId = telecaller;
    const targets = await prisma.target.findMany({
      where,
      include: { telecaller: { select: { name: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    columns = [
      { header: "Telecaller", key: "tele", width: 22 },
      { header: "Month", key: "month", width: 8 },
      { header: "Year", key: "year", width: 8 },
      { header: "Target Leads", key: "tl", width: 12 },
      { header: "Target Converts", key: "tcv", width: 14 },
      { header: "Bonus (INR)", key: "bonus", width: 12 },
    ];
    rows = targets.map((t) => ({
      tele: t.telecaller?.name || "",
      month: t.month,
      year: t.year,
      tl: t.targetLeads,
      tcv: t.targetConverts,
      bonus: t.bonusAmount,
    }));
  } else {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns;
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  ws.getRow(1).height = 20;
  rows.forEach((r) => ws.addRow(r));

  const buffer = await wb.xlsx.writeBuffer();
  const fname = `${sheetName.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}

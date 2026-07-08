// One-time backfill: recompute seq (chain position) + phase for every deal under the new rule.
//   seq 1 → CLOSED, seq 2–3 → RENEWAL, seq 4+ → REGULAR
// Chains are followed via supersededById (old deal → the renewal that replaced it).
// Idempotent: safe to run more than once. Usage: node prisma/backfill-lifecycle.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function phaseForSeq(seq) {
  if (seq <= 1) return "CLOSED";
  if (seq <= 3) return "RENEWAL";
  return "REGULAR";
}

// A deal belongs to the paid lifecycle if it was ever paid or is part of a renewal chain.
function isLifecycle(a) {
  return a.status === "PAID" || a.renewedAt != null || a.supersededById != null || a.phase != null;
}

async function main() {
  console.log("🔁 Backfilling deal lifecycle (seq/phase)...\n");
  const clients = await prisma.client.findMany({ select: { id: true } });

  let updated = 0;
  let cleared = 0;
  const badDates = [];

  for (const client of clients) {
    const ads = await prisma.ad.findMany({
      where: { clientId: client.id },
      orderBy: { closeDate: "asc" },
    });
    const byId = new Map(ads.map((a) => [a.id, a]));
    const targets = new Set(ads.map((a) => a.supersededById).filter(Boolean)); // ids that are superseded-into
    const assigned = new Set();

    // Walk each chain from its head (oldest deal — not referenced by anyone's supersededById).
    for (const root of ads) {
      if (targets.has(root.id)) continue; // not a chain head
      if (!isLifecycle(root)) continue; // pre-conversion enquiry → no phase
      let seq = 1;
      let cur = root;
      const seen = new Set();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        assigned.add(cur.id);
        const phase = phaseForSeq(seq);
        if (cur.seq !== seq || cur.phase !== phase) {
          await prisma.ad.update({ where: { id: cur.id }, data: { seq, phase } });
          updated++;
        }
        if (cur.endDate && cur.closeDate && cur.endDate < cur.closeDate) {
          badDates.push({ id: cur.id, close: cur.closeDate, end: cur.endDate });
        }
        cur = cur.supersededById ? byId.get(cur.supersededById) || null : null;
        seq++;
      }
    }

    // Clear stale phase/seq on non-lifecycle deals that somehow carry one.
    for (const a of ads) {
      if (!assigned.has(a.id) && (a.phase != null || a.seq != null)) {
        await prisma.ad.update({ where: { id: a.id }, data: { phase: null, seq: null } });
        cleared++;
      }
    }
  }

  console.log(`✅ Updated ${updated} lifecycle deal(s); cleared ${cleared} stale label(s).`);
  if (badDates.length) {
    console.log(`\n⚠️  ${badDates.length} deal(s) have endDate before closeDate (review manually):`);
    badDates.forEach((b) => console.log(`   - ${b.id}: start ${b.close.toISOString().slice(0, 10)} → end ${b.end.toISOString().slice(0, 10)}`));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

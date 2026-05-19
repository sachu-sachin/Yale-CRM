const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Create Admin Users
  const adminPassword = await bcrypt.hash("admin123", 12);

  const admin1 = await prisma.user.upsert({
    where: { email: "admin@yaleitskillhub.com" },
    update: {},
    create: {
      name: "Admin One",
      email: "admin@yaleitskillhub.com",
      password: adminPassword,
      role: "ADMIN",
      phone: "+91 9876543210",
    },
  });

  const admin2 = await prisma.user.upsert({
    where: { email: "admin2@yaleitskillhub.com" },
    update: {},
    create: {
      name: "Admin Two",
      email: "admin2@yaleitskillhub.com",
      password: adminPassword,
      role: "ADMIN",
      phone: "+91 9876543211",
    },
  });

  console.log("✅ Created admins:", admin1.email, admin2.email);

  // Create Telecallers
  const tcPassword = await bcrypt.hash("tc123456", 12);
  const telecallers = [];

  for (let i = 1; i <= 7; i++) {
    const tc = await prisma.user.upsert({
      where: { email: `telecaller${i}@yaleitskillhub.com` },
      update: {},
      create: {
        name: `Telecaller ${i}`,
        email: `telecaller${i}@yaleitskillhub.com`,
        password: tcPassword,
        role: "TELECALLER",
        phone: `+91 98765432${10 + i}`,
        createdBy: admin1.id,
      },
    });
    telecallers.push(tc);
    console.log(`✅ Created telecaller: ${tc.email}`);
  }

  // Create sample leads
  const sources = ["WEBSITE", "WHATSAPP", "FACEBOOK", "INSTAGRAM", "WALKIN", "REFERRAL", "GOOGLE_ADS"];
  const statuses = ["NEW_ENQUIRY", "CONTACTED", "FOLLOW_UP", "PROPOSAL_SENT", "WON", "LOST"];
  const priorities = ["HIGH", "MEDIUM", "LOW"];

  for (let i = 0; i < 20; i++) {
    const tc = telecallers[i % telecallers.length];
    await prisma.lead.create({
      data: {
        name: `Lead ${i + 1}`,
        email: `lead${i + 1}@example.com`,
        phone: `+91 ${9000000000 + i}`,
        source: sources[i % sources.length],
        serviceInterest: ["Digital Marketing", "SEO"],
        city: ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad"][i % 5],
        status: statuses[i % statuses.length],
        priority: priorities[i % priorities.length],
        notes: `Sample lead ${i + 1}`,
        assignedToId: tc.id,
        createdById: i % 3 === 0 ? tc.id : admin1.id,
      },
    });
  }
  console.log("\n✅ Created 20 sample leads");

  // Create sample announcement
  await prisma.announcement.create({
    data: {
      title: "Welcome to YALE IT SKILL HUB CRM!",
      content:
        "Our new CRM platform is live. Please log in with your credentials and start managing your leads. Reach out to admin if you have any questions.",
      createdById: admin1.id,
    },
  });
  console.log("✅ Created sample announcement");

  // Create sample targets
  const now = new Date();
  for (const tc of telecallers.slice(0, 3)) {
    await prisma.target.create({
      data: {
        telecallerId: tc.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        targetCalls: 100,
        targetConverts: 10,
        bonusAmount: 5000,
        createdBy: admin1.id,
      },
    });
  }
  console.log("✅ Created sample targets for 3 telecallers");

  console.log("\n🎉 Seeding complete!\n");
  console.log("Admin login:  admin@yaleitskillhub.com / admin123");
  console.log("TC login:     telecaller1@yaleitskillhub.com / tc123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

# Yale IT Skill Hub - CRM Platform

A full-featured Digital Marketing CRM built for **YALE IT SKILL HUB** to manage leads, track telecaller performance, and streamline communication between Admins and Telecallers.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL)
- **ORM:** Prisma
- **Auth:** NextAuth.js (Auth.js) / Supabase Auth
- **Styling:** Tailwind CSS + shadcn/ui

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory and add the following keys. Make sure to replace `[YOUR-PASSWORD]` with your actual Supabase database password.

```env
# Supabase Database (Connection Pooling for Next.js/Prisma)
DATABASE_URL="postgresql://postgres.riykbqkojexqqhkqvycr:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.riykbqkojexqqhkqvycr:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"

# Supabase Client
NEXT_PUBLIC_SUPABASE_URL=https://riykbqkojexqqhkqvycr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_NFqklBwTxZdvFRWT6FHslA_PCVv3J4f

# Auth.js
AUTH_SECRET="dev-secret-change-in-production"
AUTH_URL="http://localhost:3000"
```

### 3. Database Setup (Prisma)

Once your environment variables are configured, run the following commands to sync the database schema, generate the Prisma client, and seed the database with initial data.

**Sync the schema to Supabase:**
```bash
npm run db:push
```

**Generate the Prisma Client:**
```bash
npm run db:generate
```

**Run the Seed Script (Creates demo users and leads):**
```bash
npm run db:seed
```

### 4. Run the Development Server

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the CRM.

---

## 🔑 Demo Credentials

If you ran the `db:seed` command, the following demo accounts are available for testing:

**Admin Account:**
- **Email:** `admin@yaleitskillhub.com`
- **Password:** `admin123`

**Telecaller Account:**
- **Email:** `telecaller1@yaleitskillhub.com`
- **Password:** `tc123456`

*(The seed script also generates 20 sample leads, sample announcements, and performance targets to help you test the application's features immediately).*

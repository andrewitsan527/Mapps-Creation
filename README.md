# Mapps Creation — RFD Fabric ERP

Operations ERP for grey purchase → mill program → QC → live stock → sale bills → delivery, with WhatsApp hooks.

## Stack

- Next.js + TypeScript + Tailwind
- **PostgreSQL** + Prisma (migrations)
- Cookie session auth
- WhatsApp provider adapter (stub now; Meta/BSP later)
- Vercel-ready (`vercel.json` cron + Blob uploads)

## Local setup (Windows + pgAdmin)

### 1. Create the database in pgAdmin

1. Open pgAdmin → connect to your local server
2. Right-click **Databases** → **Create** → **Database**
3. Name: `Mapps_Creation` → Save

### 2. Set connection string

Copy `.env.example` → `.env` and set:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/Mapps_Creation?schema=public"
AUTH_SECRET="mapps-dev-secret-change-in-production-32chars"
CRON_SECRET="mapps-dev-cron"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
WHATSAPP_PROVIDER="stub"
```

### 3. Migrate, seed, run

```bash
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)  
Login: `owner@mapps.local` / `mapps123`

If this database was previously set up with `db push` (no `_prisma_migrations` history), baseline once then continue with migrations:

```bash
npx prisma migrate resolve --applied 20260722004820_init
```

For new schema changes during development:

```bash
npm run db:migrate
```

## Vercel deploy

1. Hosted Postgres (Neon / Supabase / Vercel Postgres) — use the **pooled** `DATABASE_URL`
2. Set env vars from `.env.example` (`AUTH_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, etc.)
3. Enable **Vercel Blob** (adds `BLOB_READ_WRITE_TOKEN`) for marka photo uploads
4. Build runs `prisma generate && prisma migrate deploy && next build`
5. After first deploy, seed once against the hosted DB:

```bash
# with hosted DATABASE_URL in .env
npm run db:seed
```

Payment reminders run daily via Vercel Cron → `/api/cron/payment-reminders`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js app |
| `npm run db:deploy` | Apply pending migrations (local + Vercel) |
| `npm run db:migrate` | Create/apply a new migration in dev |
| `npm run db:seed` | Demo masters + sample data |
| `npm run db:studio` | Prisma Studio |
| `npm run db:push` | Schema sync without migrations (dev escape hatch only) |

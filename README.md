# Mapps Creation — RFD Fabric ERP

Operations ERP for grey purchase → mill program → QC → live stock → provisional/sale bills → dispatch, with WhatsApp hooks.

## Stack

- Next.js + TypeScript + Tailwind
- **PostgreSQL** + Prisma
- Cookie session auth (roles ready)
- WhatsApp provider adapter (stub now; Meta/BSP later)
- Docker Compose included for **AWS Linux** deploy (optional locally)

## Local setup (Windows + pgAdmin — no Docker Desktop)

Your PostgreSQL service is enough. The Next.js app runs separately with `npm run dev`.

### 1. Create the database in pgAdmin

1. Open pgAdmin → connect to your local server
2. Right-click **Databases** → **Create** → **Database**
3. Name: `Mapps_Creation` → Save

### 2. Set connection string

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mapps?schema=public"
```

Use the same user/password you use in pgAdmin (often user `postgres`).

### 3. Migrate, seed, run the app

```bash
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)  
Login: `owner@mapps.local` / `mapps123`

## Docker later (AWS Linux)

Docker Desktop is **not** required on your Windows machine. On the AWS Linux server (Docker CLI):

```bash
docker compose up -d --build
```

That starts Postgres + the web app. Override `AUTH_SECRET` in the environment for production.

## Modules live

- Masters: fabrics, color families + shades (color picker), parties (terms + interest), godowns/bins, finishes
- Grey PO → Mill programs (WhatsApp) → QC → live stock ledger
- Lot lifecycle trail + bin placement suggestions
- Provisional / direct sale bills (GST + TDS), convert, dispatch stock-out
- Payments, aging, interest, WhatsApp reminders (+ `/api/cron/payment-reminders`)
- Finance: debit/credit notes, agent commission (mill/weaver/party)
- Returns: sales return restock, mill defect WA, low-grade list
- WhatsApp message log (stub until Meta/BSP credentials)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js app only |
| `npm run db:push` | Apply Prisma schema to Postgres |
| `npm run db:seed` | Demo masters + sample stock |
| `npm run db:studio` | Prisma Studio |

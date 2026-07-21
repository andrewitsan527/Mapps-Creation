// Prisma loads this for CLI (generate / migrate / db push).
// `env("DATABASE_URL")` throws if missing — that breaks Vercel `npm install`
// (postinstall generate) before env vars are always available.
// Use a placeholder for generate-only; migrate/deploy still need a real URL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
});

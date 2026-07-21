import { spawnSync } from "node:child_process";

// Prisma 6 validates env("DATABASE_URL") even for `prisma generate`, although
// generation does not connect to a database. Vercel runs postinstall before a
// storage integration may have injected DATABASE_URL, so provide a syntactically
// valid generate-only fallback. `prisma migrate deploy` still runs separately
// during build and requires the real hosted DATABASE_URL.
const placeholder =
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public";

const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL ?? placeholder,
  // Neon direct (unpooled) URL used for migrations; fall back for generate-only.
  DATABASE_URL_UNPOOLED:
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL ??
    placeholder,
};

const executable =
  process.platform === "win32"
    ? "node_modules\\.bin\\prisma.cmd"
    : "node_modules/.bin/prisma";

const result = spawnSync(executable, ["generate", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 keeps connection URLs out of schema.prisma.
 * Everything here comes from .env — swap DATABASE_URL for a hosted link
 * (Neon / Supabase / RDS) and nothing else in the repo changes.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});

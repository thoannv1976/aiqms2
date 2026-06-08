import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL được override bằng TEST_DATABASE_URL trong môi trường test
// (xem tests/helpers/db.ts). Không hard-code secret ở đây.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

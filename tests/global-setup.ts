import "dotenv/config";
import { execSync } from "node:child_process";

/**
 * Áp migration lên TEST_DATABASE_URL trước khi chạy test.
 * Test phải chạy trên Postgres thật (RLS/NOT NULL/unique-theo-tenant là no-op trên SQLite).
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL chưa cấu hình.");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}

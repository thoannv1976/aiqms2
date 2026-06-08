import "dotenv/config";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Test BẮT BUỘC chạy trên PostgreSQL thật (bài học #2), DB riêng TEST_DATABASE_URL.
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL chưa cấu hình (xem .env.example).");
}

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDbUrl,
    },
    pool: "forks",
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
});

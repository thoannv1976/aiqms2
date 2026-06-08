import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/config/env";
import { tenantExtension } from "./tenant-extension";
import { softDeleteExtension } from "./soft-delete";

/**
 * Prisma client (singleton) đã gắn tenant extension.
 *
 * - datasourceUrl truyền tường minh từ env để test có thể override sang
 *   TEST_DATABASE_URL.
 * - Tái sử dụng instance qua globalThis ở dev để tránh cạn connection khi HMR.
 */
function createPrisma() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DB_POOL_SIZE,
  });
  const base = new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  return base.$extends(tenantExtension).$extends(softDeleteExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createPrisma>;

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrismaClient;
};

export const prisma: ExtendedPrismaClient =
  globalForPrisma.prisma ?? createPrisma();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

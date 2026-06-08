import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Seed idempotent. Chạy lại nhiều lần không nhân bản dữ liệu.
 * P0: tạo tenant demo. Các phase sau bổ sung: roles/permissions, super-admin,
 * bộ tiêu chuẩn AUN-QA v4.0 + 8 tiêu chí + thang 7 mức.
 *
 * Dùng PrismaClient gốc (không tenant extension) vì seed thao tác xuyên tenant.
 */
async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const slug = process.env.DEFAULT_TENANT_SLUG ?? "demo";
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: { slug, name: "Trường Đại học Demo", status: "active" },
  });
  console.log(`✔ Tenant demo: ${tenant.slug} (${tenant.id})`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

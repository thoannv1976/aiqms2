import { prisma } from "@/lib/prisma/client";
import { env } from "@/config/env";
import { ok, errorResponse } from "@/lib/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Health check: kiểm tra DB + báo trạng thái cờ cấu hình. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({
      status: "ok",
      db: "up",
      flags: {
        rls: env.RLS_ENABLED,
        ai: env.AI_ENABLED,
        jobMode: env.JOB_MODE,
        storage: env.STORAGE_DRIVER,
      },
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[HEALTH] DB check failed", err);
    return errorResponse(err);
  }
}

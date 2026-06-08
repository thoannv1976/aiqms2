import { z } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { writeAudit } from "@/lib/audit/log";
import { encryptSecret } from "./crypto";

export const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["openai", "azure", "gemini", "claude", "local"]).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(), // sẽ được mã hóa khi lưu (không bao giờ trả ra)
  dailyTokenLimit: z.number().int().positive().optional(),
  enabledModules: z.record(z.string(), z.boolean()).optional(),
});

/** Cấu hình AI của tenant — KHÔNG bao giờ trả khóa API ra ngoài. */
export async function getSettings() {
  const ctx = requireTenantContext();
  const s = await prisma.aiSettings.findFirst({ where: { tenantId: ctx.tenantId } });
  if (!s) return { enabled: false, hasApiKey: false, dailyTokenLimit: 200000, enabledModules: {} };
  return {
    enabled: s.enabled,
    provider: s.provider,
    baseUrl: s.baseUrl,
    model: s.model,
    hasApiKey: !!s.apiKeyEnc,
    dailyTokenLimit: s.dailyTokenLimit,
    enabledModules: s.enabledModules ?? {},
  };
}

export async function updateSettings(input: z.infer<typeof updateSettingsSchema>) {
  const ctx = requireTenantContext();
  const { apiKey, enabledModules, ...rest } = input;

  const data: Record<string, unknown> = { ...rest };
  if (apiKey !== undefined) data.apiKeyEnc = apiKey ? encryptSecret(apiKey) : null;
  if (enabledModules !== undefined) data.enabledModules = enabledModules;

  const existing = await prisma.aiSettings.findFirst({ where: { tenantId: ctx.tenantId } });
  const saved = existing
    ? await prisma.aiSettings.update({ where: { id: existing.id }, data })
    : await prisma.aiSettings.create({ data: withTenantId(data) as never });

  await writeAudit({ action: "ai.settings.update", entity: "AiSettings", entityId: saved.id });
  return getSettings();
}

/** Thống kê token/chi phí AI (trang xem chi phí cho admin). */
export async function usageStats() {
  const agg = await prisma.aiRequest.aggregate({
    _sum: { tokensIn: true, tokensOut: true, costUsd: true },
    _count: true,
  });
  const byModule = await prisma.aiRequest.groupBy({
    by: ["module"],
    _sum: { tokensIn: true, tokensOut: true, costUsd: true },
    _count: true,
  });
  return {
    totalRequests: agg._count,
    totalTokens: (agg._sum.tokensIn ?? 0) + (agg._sum.tokensOut ?? 0),
    totalCostUsd: Number((agg._sum.costUsd ?? 0).toFixed(4)),
    byModule,
  };
}

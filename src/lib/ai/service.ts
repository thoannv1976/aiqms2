import type { ZodType } from "zod";
import { prisma } from "@/lib/prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { withTenantId } from "@/lib/prisma/tenant-create";
import { env } from "@/config/env";
import { forbidden, badRequest, ApiError } from "@/lib/http/responses";
import { decryptSecret } from "./crypto";
import { Semaphore } from "./semaphore";
import { MockProvider } from "./providers/mock";
import { OpenAiProvider } from "./providers/openai";
import type { LlmMessage, LlmProvider } from "./providers/types";

// Concurrency toàn cục (một trường không "ăn" hết quota chung).
const globalSemaphore = new Semaphore(Math.max(1, env.AI_MAX_CONCURRENCY));
// Ước lượng chi phí (USD/1k token) — cấu hình thô cho MVP.
const COST_PER_1K = 0.0005;

interface ResolvedAi {
  provider: LlmProvider;
  model: string;
  dailyTokenLimit: number;
  enabledModules: Record<string, boolean>;
}

async function resolveAi(): Promise<ResolvedAi> {
  const ctx = requireTenantContext();
  const settings = await prisma.aiSettings.findFirst({ where: { tenantId: ctx.tenantId } });

  // Kill-switch toàn cục + bật theo tenant.
  // AI bật/tắt do CẤU HÌNH THEO TRƯỜNG quyết định (admin bật ở menu "AI hỗ trợ").
  // env.AI_ENABLED chỉ là MẶC ĐỊNH cho trường CHƯA có cấu hình; không chặn khi
  // trường đã chủ động bật (tránh trường hợp bật trong UI nhưng vẫn báo tắt do cờ env prod).
  const tenantOn = settings ? settings.enabled : env.AI_ENABLED;
  if (!tenantOn) {
    throw forbidden("AI chưa được bật cho trường này. Vào menu “AI hỗ trợ” để bật.");
  }

  const model = settings?.model ?? env.AI_MODEL;
  const baseUrl = settings?.baseUrl ?? env.AI_BASE_URL;
  // Khóa API: ưu tiên khóa mã hóa theo tenant; fallback env (dev).
  let apiKey: string | undefined;
  if (settings?.apiKeyEnc) {
    try {
      apiKey = decryptSecret(settings.apiKeyEnc);
    } catch {
      // Key mã hóa bằng ENCRYPTION_KEY cũ (đổi env giữa các lần deploy) -> không giải mã được.
      throw badRequest(
        "Không giải mã được API key đã lưu (ENCRYPTION_KEY của server đã thay đổi?). Vào menu “AI hỗ trợ” nhập lại API key.",
        "ai_key_decrypt_failed",
      );
    }
  } else if (env.AI_API_KEY) {
    apiKey = env.AI_API_KEY;
  }

  const provider: LlmProvider = apiKey
    ? new OpenAiProvider(baseUrl, apiKey)
    : new MockProvider(); // không có khóa -> mock (không gửi dữ liệu ra ngoài)

  return {
    provider,
    model,
    dailyTokenLimit: settings?.dailyTokenLimit ?? env.AI_DAILY_TOKEN_LIMIT,
    enabledModules: (settings?.enabledModules as Record<string, boolean>) ?? {},
  };
}

/** Tổng token đã dùng hôm nay của tenant. */
async function tokensUsedToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const agg = await prisma.aiRequest.aggregate({
    where: { createdAt: { gte: start } },
    _sum: { tokensIn: true, tokensOut: true },
  });
  return (agg._sum.tokensIn ?? 0) + (agg._sum.tokensOut ?? 0);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Gọi LLM cho một module: kiểm tra bật/tắt + hạn mức + concurrency + log chi phí. */
export async function aiComplete(
  module: string,
  messages: LlmMessage[],
  opts: { json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const ctx = requireTenantContext();
  const cfg = await resolveAi();

  // Bật/tắt theo module (nếu cấu hình).
  if (cfg.enabledModules[module] === false) {
    throw forbidden(`Module AI '${module}' đang tắt`);
  }

  // Hạn mức token/ngày theo tenant.
  const used = await tokensUsedToday();
  if (used >= cfg.dailyTokenLimit) {
    throw badRequest("Đã vượt hạn mức token AI trong ngày", "ai_quota_exceeded");
  }

  const promptChars = messages.reduce((n, m) => n + m.content.length, 0);
  try {
    const result = await globalSemaphore.run(() =>
      withRetry(() =>
        cfg.provider.complete(messages, { model: cfg.model, json: opts.json, maxTokens: opts.maxTokens }),
      ),
    );
    const cost = ((result.tokensIn + result.tokensOut) / 1000) * COST_PER_1K;
    await prisma.aiRequest.create({
      data: withTenantId({
        module,
        model: cfg.model,
        promptChars,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: cost,
        status: "ok",
        actorId: ctx.actorId,
      }),
    });
    return result.text;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await prisma.aiRequest.create({
      data: withTenantId({
        module,
        model: cfg.model,
        promptChars,
        status: "error",
        error: detail,
        actorId: ctx.actorId,
      }),
    });
    // Lỗi nghiệp vụ (đã có status rõ) giữ nguyên; lỗi gọi LLM (sai key/model/baseUrl,
    // mạng…) chuyển thành 502 kèm chi tiết để người dùng tự xử lý — tránh 500 mù.
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      502,
      `Không gọi được dịch vụ AI (model ${cfg.model}): ${detail.slice(0, 300)}. ` +
        "Kiểm tra API key / Model / Base URL trong menu “AI hỗ trợ”.",
      "ai_upstream_error",
    );
  }
}

/** Gọi LLM và validate output JSON bằng Zod (ép JSON; sai schema -> retry rồi báo lỗi). */
export async function aiCompleteJson<T>(
  module: string,
  messages: LlmMessage[],
  schema: ZodType<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await aiComplete(module, messages, { json: true });
    try {
      const parsed = schema.parse(JSON.parse(text));
      return parsed;
    } catch {
      if (attempt === 1) {
        throw badRequest("Output AI không đúng schema sau khi thử lại", "ai_bad_output");
      }
    }
  }
  throw badRequest("Output AI không hợp lệ", "ai_bad_output");
}

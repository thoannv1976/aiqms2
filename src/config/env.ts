import { z } from "zod";

/**
 * Cấu hình tập trung + cờ bật/tắt nhanh khi sự cố (xem CLAUDE.md).
 * Validate bằng Zod khi khởi động để fail-fast thay vì 500 chập chờn ở prod.
 */

const boolFromEnv = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL là bắt buộc"),
  TEST_DATABASE_URL: z.string().optional(),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(10),
  DB_POOL_TIMEOUT: z.coerce.number().int().positive().default(10),

  // Cờ
  RLS_ENABLED: boolFromEnv,
  AI_ENABLED: boolFromEnv,
  JOB_MODE: z.enum(["inline", "queue"]).default("inline"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),

  // Multi-tenant
  BASE_DOMAIN: z.string().default("localhost"),
  DEFAULT_TENANT_SLUG: z.string().default("demo"),

  // Bảo mật
  JWT_SECRET: z.string().min(32, "JWT_SECRET cần >= 32 ký tự"),
  ENCRYPTION_KEY: z
    .string()
    .min(1)
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "ENCRYPTION_KEY phải là 32 bytes mã hóa base64",
    ),
  CORS_ORIGIN_REGEX: z.string().default("^https?://localhost(:\\d+)?$"),

  // Storage local
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  // Storage s3
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Email + nhắc hạn
  EMAIL_DRIVER: z.enum(["log", "smtp"]).default("log"),
  EMAIL_FROM: z.string().default("AIQMS <no-reply@aiqms.local>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: boolFromEnv,
  REMINDER_DUE_WITHIN_DAYS: z.coerce.number().int().nonnegative().default(3),

  // AI
  AI_PROVIDER: z
    .enum(["openai", "azure", "gemini", "claude", "local"])
    .default("openai"),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  AI_DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(200_000),
  AI_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | null = null;

/** Đọc + validate env (cache lại). Ném lỗi rõ ràng nếu thiếu cấu hình. */
export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Cho test: reset cache khi đổi env. */
export function resetEnvCache() {
  cached = null;
}

export const env = new Proxy({} as AppEnv, {
  get(_t, prop: string) {
    return getEnv()[prop as keyof AppEnv];
  },
});

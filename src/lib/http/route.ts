import { prisma } from "@/lib/prisma/client";
import { runWithTenant, type TenantContext } from "@/lib/tenant/context";
import { resolveTenantSlug } from "@/lib/tenant/resolve";
import { ApiError, errorResponse, notFound, tenantExpired } from "./responses";

/**
 * Bọc một route handler: bắt lỗi tập trung + log traceback (bài học: prod 500 mù
 * vì không log). Mọi lỗi → response JSON có status rõ ràng, không rò traceback ra client.
 */
export function withErrorHandling<A extends unknown[]>(
  fn: (req: Request, ...args: A) => Promise<Response>,
) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      return await fn(req, ...args);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        // Exception handler toàn cục: log traceback đầy đủ kèm URL.
        console.error(`[API ERROR] ${req.method} ${req.url}`, err);
      }
      return errorResponse(err);
    }
  };
}

/**
 * Bọc route cần tenant: phân giải tenant từ request, kiểm tra billing (validUntil)
 * và trạng thái, rồi chạy handler trong runWithTenant().
 *
 * auth (actorId/roles) sẽ được nạp từ JWT ở P1; hiện để trống.
 */
export function tenantRoute<A extends unknown[]>(
  fn: (
    req: Request,
    ctx: { tenant: { id: string; slug: string } },
    ...args: A
  ) => Promise<Response>,
) {
  return withErrorHandling(async (req: Request, ...args: A) => {
    const slug = resolveTenantSlug(req);
    if (!slug) throw notFound("Không xác định được tenant");

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) throw notFound(`Tenant '${slug}' không tồn tại`);
    if (tenant.status !== "active") {
      throw tenantExpired(`Tenant '${slug}' đang bị khóa`);
    }
    if (tenant.validUntil && tenant.validUntil.getTime() < Date.now()) {
      throw tenantExpired();
    }

    const context: TenantContext = { tenantId: tenant.id };
    return runWithTenant(context, () =>
      fn(req, { tenant: { id: tenant.id, slug: tenant.slug } }, ...args),
    );
  });
}

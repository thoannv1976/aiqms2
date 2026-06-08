import { prisma } from "@/lib/prisma/client";
import { runWithTenant, type TenantContext } from "@/lib/tenant/context";
import { resolveTenantSlug } from "@/lib/tenant/resolve";
import { getAuth } from "@/lib/auth/session";
import { permissionsForRoles } from "@/lib/rbac/check";
import {
  ApiError,
  errorResponse,
  forbidden,
  notFound,
  tenantExpired,
  unauthorized,
} from "./responses";

type LoadedTenant = { id: string; slug: string };

/**
 * Bọc một route handler: bắt lỗi tập trung + log traceback (bài học: prod 500 mù
 * vì không log). Mọi lỗi -> response JSON status rõ ràng, không rò traceback ra client.
 */
export function withErrorHandling<A extends unknown[]>(
  fn: (req: Request, ...args: A) => Promise<Response>,
) {
  return async (req: Request, ...args: A): Promise<Response> => {
    try {
      return await fn(req, ...args);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        console.error(`[API ERROR] ${req.method} ${req.url}`, err);
      }
      return errorResponse(err);
    }
  };
}

/** Phân giải + kiểm tra tenant (billing validUntil + status). */
async function loadTenant(req: Request): Promise<LoadedTenant> {
  const slug = resolveTenantSlug(req);
  if (!slug) throw notFound("Không xác định được tenant");
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw notFound(`Tenant '${slug}' không tồn tại`);
  if (tenant.status !== "active") throw tenantExpired(`Tenant '${slug}' đang bị khóa`);
  if (tenant.validUntil && tenant.validUntil.getTime() < Date.now()) {
    throw tenantExpired();
  }
  return { id: tenant.id, slug: tenant.slug };
}

/** Route cần tenant nhưng KHÔNG bắt buộc đăng nhập (ví dụ: login). */
export function tenantRoute<A extends unknown[]>(
  fn: (req: Request, ctx: { tenant: LoadedTenant }, ...args: A) => Promise<Response>,
) {
  return withErrorHandling(async (req: Request, ...args: A) => {
    const tenant = await loadTenant(req);
    return runWithTenant({ tenantId: tenant.id }, () =>
      fn(req, { tenant }, ...args),
    );
  });
}

export interface AuthedCtx {
  tenant: LoadedTenant;
  userId: string;
  roles: string[];
  isSuperAdmin: boolean;
}

/** Route bắt buộc đăng nhập: nạp JWT -> context (actorId, roles, permissions). */
export function authedRoute<A extends unknown[]>(
  fn: (req: Request, ctx: AuthedCtx, ...args: A) => Promise<Response>,
) {
  return withErrorHandling(async (req: Request, ...args: A) => {
    const tenant = await loadTenant(req);
    const auth = await getAuth(req);
    if (!auth) throw unauthorized();

    // Token phải được phát cho đúng tenant (super-admin được xuyên tenant).
    if (!auth.isSuperAdmin && auth.tenantId !== tenant.id) {
      throw forbidden("Token không thuộc tenant này");
    }

    const permissions = await permissionsForRoles(auth.roles);
    const context: TenantContext = {
      tenantId: tenant.id,
      actorId: auth.sub,
      roles: auth.roles,
      isSuperAdmin: auth.isSuperAdmin,
      permissions,
    };
    return runWithTenant(context, () =>
      fn(
        req,
        { tenant, userId: auth.sub, roles: auth.roles, isSuperAdmin: auth.isSuperAdmin },
        ...args,
      ),
    );
  });
}

/** Route quản trị nền tảng: chỉ super-admin, bỏ qua lọc tenant. */
export function superAdminRoute<A extends unknown[]>(
  fn: (req: Request, ctx: { userId: string }, ...args: A) => Promise<Response>,
) {
  return withErrorHandling(async (req: Request, ...args: A) => {
    const auth = await getAuth(req);
    if (!auth) throw unauthorized();
    if (!auth.isSuperAdmin) throw forbidden("Chỉ super-admin truy cập được");
    return runWithTenant(
      { tenantId: auth.tenantId, actorId: auth.sub, isSuperAdmin: true, bypassTenant: true },
      () => fn(req, { userId: auth.sub }, ...args),
    );
  });
}

import { env } from "@/config/env";

/**
 * Phân giải tenant slug từ request (bài học multi-tenant):
 *   1. Header X-Tenant (API client / test)
 *   2. Query ?tenant=  (cơ chế test trường con khi chưa có nhiều subdomain)
 *   3. Subdomain <slug>.BASE_DOMAIN
 *   4. DEFAULT_TENANT_SLUG (dev)
 */
export function resolveTenantSlug(req: Request): string | null {
  const headerTenant = req.headers.get("x-tenant");
  if (headerTenant) return headerTenant.trim().toLowerCase();

  const url = new URL(req.url);
  const queryTenant = url.searchParams.get("tenant");
  if (queryTenant) return queryTenant.trim().toLowerCase();

  const host = (req.headers.get("host") ?? url.host).split(":")[0];
  const base = env.BASE_DOMAIN;
  if (host && host !== base && host.endsWith(`.${base}`)) {
    const sub = host.slice(0, -(`.${base}`.length));
    // bỏ qua subdomain hệ thống
    if (sub && sub !== "www" && sub !== "admin") return sub.toLowerCase();
  }

  return env.DEFAULT_TENANT_SLUG ?? null;
}

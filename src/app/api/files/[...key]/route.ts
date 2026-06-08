import { authedRoute } from "@/lib/http/route";
import { getStorage } from "@/lib/storage";
import { forbidden, notFound } from "@/lib/http/responses";

export const runtime = "nodejs";
type Params = { params: Promise<{ key: string[] }> };

/** Phục vụ file đã lưu (driver local). Kiểm tra key thuộc đúng tenant hiện tại. */
export const GET = authedRoute(async (_req, ctx, { params }: Params) => {
  const key = (await params).key.join("/");
  // Authz: key phải nằm trong prefix của tenant này.
  if (!key.startsWith(`tenants/${ctx.tenant.id}/`)) {
    throw forbidden("File không thuộc tenant này");
  }
  const body = await getStorage().get(key);
  if (!body) throw notFound("File không tồn tại");
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "application/octet-stream" },
  });
});

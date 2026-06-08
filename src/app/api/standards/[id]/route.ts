import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok } from "@/lib/http/responses";
import { getStandard } from "@/lib/standards/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export const GET = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const { id } = await params;
  const versionId = new URL(req.url).searchParams.get("versionId") ?? undefined;
  return ok(await getStandard(id, versionId));
});

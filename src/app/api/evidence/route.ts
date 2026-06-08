import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { parsePagination } from "@/lib/http/pagination";
import { parseBody } from "@/lib/http/validate";
import { ok, created } from "@/lib/http/responses";
import { createEvidence, createEvidenceSchema, listEvidence } from "@/lib/evidence/service";

export const runtime = "nodejs";

export const GET = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.DATA_VIEW);
  const url = new URL(req.url);
  return ok(
    await listEvidence(parsePagination(req), {
      criterionId: url.searchParams.get("criterionId") ?? undefined,
      academicYear: url.searchParams.get("academicYear") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    }),
  );
});

export const POST = authedRoute(async (req) => {
  requirePermission(PERMISSIONS.EVIDENCE_UPLOAD);
  return created(await createEvidence(await parseBody(req, createEvidenceSchema)));
});

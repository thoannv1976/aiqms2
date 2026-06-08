import { authedRoute } from "@/lib/http/route";
import { requirePermission } from "@/lib/rbac/check";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ok, badRequest } from "@/lib/http/responses";
import { addFile } from "@/lib/evidence/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

/** Upload nhiều file (multipart/form-data, field "files"). */
export const POST = authedRoute(async (req, _ctx, { params }: Params) => {
  requirePermission(PERMISSIONS.EVIDENCE_UPLOAD);
  const { id } = await params;

  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Cần multipart/form-data");
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) throw badRequest("Không có file nào (field 'files')");

  const results = [];
  for (const f of files) {
    const body = Buffer.from(await f.arrayBuffer());
    results.push(
      await addFile(id, { fileName: f.name, body, contentType: f.type || undefined }),
    );
  }
  return ok({ uploaded: results.length, files: results });
});

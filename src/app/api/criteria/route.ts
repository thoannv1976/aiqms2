import { superAdminRoute } from "@/lib/http/route";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { createCriterion, createCriterionSchema } from "@/lib/standards/service";

export const runtime = "nodejs";

// Cấu hình tiêu chí (super-admin) — data-driven, không sửa code lõi.
export const POST = superAdminRoute(async (req) => {
  const input = await parseBody(req, createCriterionSchema);
  return created(await createCriterion(input));
});

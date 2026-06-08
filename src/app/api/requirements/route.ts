import { superAdminRoute } from "@/lib/http/route";
import { parseBody } from "@/lib/http/validate";
import { created } from "@/lib/http/responses";
import { createRequirement, createRequirementSchema } from "@/lib/standards/service";

export const runtime = "nodejs";

export const POST = superAdminRoute(async (req) => {
  const input = await parseBody(req, createRequirementSchema);
  return created(await createRequirement(input));
});

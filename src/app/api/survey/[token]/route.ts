import { z } from "zod";
import { tenantRoute } from "@/lib/http/route";
import { parseBody } from "@/lib/http/validate";
import { ok, created } from "@/lib/http/responses";
import { getByToken, submitByToken } from "@/lib/surveys/service";

export const runtime = "nodejs";
type Params = { params: Promise<{ token: string }> };

// Form công khai (không cần đăng nhập) — chỉ cần X-Tenant/subdomain + token hợp lệ.
export const GET = tenantRoute(async (_req, _ctx, { params }: Params) => {
  const survey = await getByToken((await params).token);
  return ok({
    id: survey.id,
    title: survey.title,
    description: survey.description,
    questions: survey.questions,
  });
});

const submitSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  respondent: z.unknown().optional(),
});

export const POST = tenantRoute(async (req, _ctx, { params }: Params) => {
  const { answers, respondent } = await parseBody(req, submitSchema);
  const resp = await submitByToken((await params).token, answers, respondent);
  return created({ id: resp.id, message: "Đã ghi nhận phản hồi" });
});

import { z } from "zod";
import { tenantRoute } from "@/lib/http/route";
import { parseBody } from "@/lib/http/validate";
import { ok } from "@/lib/http/responses";
import { sessionCookie } from "@/lib/auth/session";
import { loginWithCredentials } from "@/lib/auth/login";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = tenantRoute(async (req, { tenant }) => {
  const { email, password } = await parseBody(req, schema);
  const { token, user } = await loginWithCredentials(tenant, email, password);
  const res = ok({ user });
  res.headers.set("Set-Cookie", sessionCookie(token));
  return res;
});

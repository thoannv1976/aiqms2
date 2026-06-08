import type { ZodType } from "zod";
import { badRequest } from "./responses";

/** Parse + validate JSON body bằng Zod; ném 400 với thông điệp rõ ràng nếu sai. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Body không phải JSON hợp lệ", "invalid_json");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join(".") || "(body)"}: ${i.message}`)
      .join("; ");
    throw badRequest(msg, "validation_error");
  }
  return result.data;
}

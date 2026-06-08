import { verifyAuthToken, type AuthTokenPayload } from "./jwt";

export const SESSION_COOKIE = "aiqms_session";

/** Lấy token từ cookie hoặc header Authorization: Bearer. */
export function extractToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

  const cookie = req.headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === SESSION_COOKIE) return decodeURIComponent(v.join("="));
    }
  }
  return null;
}

/** Xác thực request -> payload (null nếu không hợp lệ). */
export async function getAuth(req: Request): Promise<AuthTokenPayload | null> {
  const token = extractToken(req);
  if (!token) return null;
  return verifyAuthToken(token);
}

/** Chuỗi Set-Cookie cho phiên (httpOnly). */
export function sessionCookie(token: string, maxAgeSec = 8 * 3600): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs.join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

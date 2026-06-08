import { SignJWT, jwtVerify } from "jose";
import { env } from "@/config/env";

/** Payload JWT — mang tenantId + roles (đặc tả bảo mật mục 8). */
export interface AuthTokenPayload {
  sub: string; // userId
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  isSuperAdmin: boolean;
}

const ALG = "HS256";
const EXPIRES = "8h";

function secret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signAuthToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRES)
    .sign(secret());
}

export async function verifyAuthToken(
  token: string,
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    return {
      sub: String(payload.sub),
      tenantId: String(payload.tenantId),
      tenantSlug: String(payload.tenantSlug),
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
      isSuperAdmin: payload.isSuperAdmin === true,
    };
  } catch {
    return null;
  }
}

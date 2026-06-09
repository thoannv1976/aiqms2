/**
 * API client phía trình duyệt (bài học #9):
 *  - Trả `null` cho 204/empty body (tránh "Unexpected end of JSON input").
 *  - Bọc lỗi mạng kèm URL để dễ debug.
 *  - Tự gắn X-Tenant từ subdomain hoặc ?tenant= (cơ chế test trường con).
 *  - Authorization (JWT) sẽ được gắn ở P1 khi có auth.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly url?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const TENANT_STORAGE_KEY = "aiqms_tenant";

function tenantHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("tenant");
  if (fromQuery) return { "X-Tenant": fromQuery };
  const stored = window.localStorage.getItem(TENANT_STORAGE_KEY);
  if (stored) return { "X-Tenant": stored };
  const host = window.location.hostname;
  const parts = host.split(".");
  if (parts.length > 1 && parts[0] !== "www" && parts[0] !== "admin") {
    return { "X-Tenant": parts[0] };
  }
  return {};
}

/** Lưu/đọc tenant slug hiện tại (đăng nhập tenant nào dùng tenant đó). */
export function setTenant(slug: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(TENANT_STORAGE_KEY, slug);
}
export function getTenant(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TENANT_STORAGE_KEY) ?? "";
}

export async function apiFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<T | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...tenantHeader(),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    // Lỗi mạng — kèm URL để debug.
    throw new ApiClientError(0, `Lỗi mạng khi gọi ${url}: ${String(err)}`, "network", url);
  }

  // 204 / empty body -> null, KHÔNG gọi res.json().
  if (res.status === 204) return null;
  const text = await res.text();
  const body = text ? safeParse(text) : null;

  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    const code = (body as { code?: string } | null)?.code;
    throw new ApiClientError(res.status, message, code, url);
  }
  return body as T | null;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(url: string) => apiFetch<T>(url),
  post: <T>(url: string, data?: unknown) =>
    apiFetch<T>(url, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(url: string, data?: unknown) =>
    apiFetch<T>(url, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(url: string, data?: unknown) =>
    apiFetch<T>(url, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: "DELETE" }),
};

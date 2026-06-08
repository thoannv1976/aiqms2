import { NextResponse } from "next/server";

/** Lỗi nghiệp vụ có HTTP status rõ ràng (tránh 500 mù). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (msg: string, code?: string) =>
  new ApiError(400, msg, code);
export const unauthorized = (msg = "Chưa đăng nhập") =>
  new ApiError(401, msg, "unauthorized");
export const forbidden = (msg = "Không có quyền") =>
  new ApiError(403, msg, "forbidden");
export const notFound = (msg = "Không tìm thấy") =>
  new ApiError(404, msg, "not_found");
export const tenantExpired = (msg = "Tenant đã hết hạn sử dụng") =>
  new ApiError(403, msg, "tenant_expired");

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

/** 204 — client phải xử lý empty body (trả null), xem apiClient. */
export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status },
    );
  }
  return NextResponse.json(
    { error: "Lỗi hệ thống", code: "internal_error" },
    { status: 500 },
  );
}

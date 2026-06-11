import { describe, expect, it } from "vitest";
import { isDurableStorage, storageStatus, storageMissingError } from "@/lib/storage";
import { ApiError } from "@/lib/http/responses";

describe("Storage status & lỗi file mất", () => {
  it("local (mặc định test) là KHÔNG bền vững", () => {
    const s = storageStatus();
    expect(s.driver).toBe("local");
    expect(s.durable).toBe(false);
    expect(isDurableStorage()).toBe(false);
  });

  it("storageMissingError trả ApiError 404 có thông điệp rõ", () => {
    const e = storageMissingError();
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(404);
    // Ở môi trường test (NODE_ENV=test) trả mã not_found chuẩn.
    expect(e.code).toBe("not_found");
    expect(e.message).toMatch(/không tồn tại/i);
  });
});

# CLAUDE.md — Hệ thống Kiểm định CTĐT (AUN-QA, đa tiêu chuẩn)

> File này là "luật chơi" cho mọi thay đổi code trong repo. **ĐỌC CẢ HAI** tài liệu
> nền trước khi thay đổi nghiệp vụ:
> - Đặc tả ("xây cái gì"): [`docs/Mo_ta_chuc_nang_App.md`](docs/Mo_ta_chuc_nang_App.md)
> - Hướng dẫn thực chiến / bài học ("xây thế nào"): [`docs/HUONG_DAN_XAY_DUNG_APP_KIEM_DINH.md`](docs/HUONG_DAN_XAY_DUNG_APP_KIEM_DINH.md)
>
> Next.js 16: Middleware đã đổi tên thành **Proxy** (`proxy.ts`). Đọc
> `node_modules/next/dist/docs/` khi cần API mới.

## Bối cảnh

Nền tảng kiểm định chương trình đào tạo (CTĐT) đại học, ưu tiên **AUN-QA Programme
Level v4.0** (8 tiêu chí, 53 yêu cầu, thang đánh giá 7 mức), kiến trúc **đa-tiêu-chuẩn**:
thêm bộ tiêu chuẩn của Bộ GD&ĐT (và các chuẩn khác) về sau **chỉ bằng nạp dữ liệu cấu
hình**, không sửa code lõi.

Hệ thống **multi-tenant** (nhiều trường đại học) ngay từ ngày 0.

## Nguyên tắc bắt buộc (không được "làm sau")

1. **Multi-tenant từ ngày 0**: `tenantId` trên **mọi** bảng nghiệp vụ; lọc tenant theo
   **context-per-request** (AsyncLocalStorage) — **KHÔNG** dùng lambda/closure bị ORM
   cache. RLS Postgres bật **sau cờ** `RLS_ENABLED`; **rollback** khi request lỗi để
   không đầu độc connection pool.
2. **Test chạy trên PostgreSQL** (không chỉ SQLite — RLS/NOT NULL/unique-theo-tenant/
   ON DELETE là no-op trên SQLite). Bắt buộc có **test cách ly tenant** ("trường A không
   bao giờ thấy dữ liệu trường B").
3. **Bộ tiêu chuẩn = dữ liệu cấu hình**, không hard-code AUN-QA vào logic.
4. **AI là một lớp service** có kiểm soát: validate output bằng schema (Zod), key mã hóa
   theo tenant, retry/backoff/concurrency/quota, **human-in-the-loop** — nội dung AI luôn
   là **bản nháp** cho tới khi người phụ trách duyệt.
5. **Storage qua abstraction** (local ở dev, S3/GCS ở prod) — không ghi thẳng đĩa container.
6. **Soft-delete + versioning + audit log** cho tài liệu đã ban hành. Không xóa cứng.
7. **List có phân trang + index** cho cột lọc/khóa ngoại (đặc biệt `(tenantId, …)`).
8. **i18n VI/EN** từ đầu (VI là chính). Client **trả `null` cho 204/empty body**, bọc lỗi
   mạng kèm URL.

> Checklist chống lỗi đầy đủ ở `docs/HUONG_DAN_XAY_DUNG_APP_KIEM_DINH.md` mục 12 — đọc trước
> khi viết migration / endpoint mới.

## Kiến trúc

- **Frontend + Backend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS. API qua
  Route Handlers (`src/app/api/**/route.ts`), chạy ở Node runtime.
- **DB**: PostgreSQL + Prisma. Mỗi thay đổi schema = **đúng một migration** (Prisma Migrate);
  không sửa DB tay.
- **Auth**: JWT (jose) mang `tenantId` + roles; mật khẩu hash bcrypt. RBAC khai báo bằng dữ liệu.
- **RAG**: pgvector (đủ cho MVP).
- **Jobs**: BullMQ (có chế độ `inline` ở dev qua cờ `JOB_MODE`).
- **Xuất**: `docx` / ExcelJS / PDF (Playwright).
- **Storage**: interface `Storage` với driver `local` → `s3`.

## Quy ước code

- **Trường chuẩn mọi bảng nghiệp vụ**: `id`, `tenantId`, `createdAt`, `updatedAt`,
  `createdBy`, `updatedBy`, `status`, `deletedAt`.
- Truy vấn dữ liệu nghiệp vụ **luôn** qua Prisma client đã gắn tenant extension
  (`src/lib/prisma/tenant-client.ts`) trong phạm vi một `runWithTenant(...)`.
- Output LLM **validate bằng Zod** trước khi dùng; ép model trả JSON thuần; sai schema →
  retry rồi báo lỗi, không ghi rác vào DB.
- Logic nghiệp vụ có unit test; thao tác quan trọng ghi **audit log**.
- Phản hồi API rỗng dùng helper `noContent()`; client dùng `apiClient` xử lý 204.

## Cấu hình bằng env + cờ (bật/tắt nhanh khi sự cố)

Xem `src/config/env.ts` và `.env.example`. Các cờ chính: `RLS_ENABLED`, `AI_ENABLED`,
`JOB_MODE` (`inline`|`queue`), `STORAGE_DRIVER` (`local`|`s3`), `BASE_DOMAIN`,
`CORS_ORIGIN_REGEX`, `ENCRYPTION_KEY`, `JWT_SECRET`, pool size.

## Quy trình build theo phase

Làm theo **từng phase nhỏ** (xem `docs/HUONG_DAN_XAY_DUNG_APP_KIEM_DINH.md` mục 9). MVP
chạy được trước, AI/RAG cuối cùng. **Mỗi phase phải đạt "Definition of Done" (mục 10)** —
chạy được local + migration + test trên Postgres + phân trang/index + audit log + cập nhật
`CHANGELOG.md` — rồi mới sang phase sau. **Không** sinh nhiều phase một lượt.

Tiến độ phase: xem `CHANGELOG.md`.

## Lệnh thường dùng

```bash
npm run dev               # chạy Next.js dev
npm run db:migrate        # prisma migrate dev
npm run db:seed           # seed idempotent (roles, permissions, AUN-QA v4.0, super-admin)
npm test                  # vitest trên PostgreSQL (TEST_DATABASE_URL)
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
```

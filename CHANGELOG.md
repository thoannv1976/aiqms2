# Changelog

Tiến độ build theo phase (xem `docs/HUONG_DAN_XAY_DUNG_APP_KIEM_DINH.md` mục 9).
Mỗi phase chỉ "xong" khi đạt **Definition of Done** (mục 10).

## [P0] Nền móng — ✅ Done

Hạ tầng đa-tenant + cấu hình, làm đúng từ ngày 0 (tránh bolt-on về sau).

### Added
- Scaffold **Next.js 16 + TypeScript + Tailwind 4** (App Router, `src/`).
- **PostgreSQL + Prisma 7** (driver adapter `@prisma/adapter-pg`); `docker-compose.yml`
  dùng image `pgvector/pgvector:pg16` (sẵn pgvector cho RAG ở P8) + DB test riêng.
- **Cấu hình + cờ** (`src/config/env.ts`, validate Zod): `RLS_ENABLED`, `AI_ENABLED`,
  `JOB_MODE`, `STORAGE_DRIVER`, pool, `BASE_DOMAIN`, CORS regex, khóa mã hóa.
- **Multi-tenant context** theo request bằng `AsyncLocalStorage`
  (`runWithTenant`/`runAsSystem`) — không biến toàn cục, không closure cache.
- **Prisma tenant extension** chèn `where: { tenantId }` / gán `tenantId` khi create,
  hậu-kiểm `findUnique`; bỏ qua khi `bypassTenant` (super-admin/seed). Danh sách model
  tenant-scoped tập trung ở `src/lib/prisma/tenant-models.ts`.
- **Phân giải tenant** từ header `X-Tenant` / `?tenant=` / subdomain (`resolveTenantSlug`).
- **Lớp Storage** trừu tượng (`Storage` interface + driver `local` đầy đủ + `s3` lazy-load),
  key có prefix tenant + chặn path traversal.
- **HTTP layer**: `ApiError` + helper response (kể cả `noContent()` 204), `tenantRoute`
  (kiểm tra billing `validUntil`/status, rollback-safe, log traceback toàn cục).
- **apiClient** trình duyệt: trả `null` cho 204/empty, bọc lỗi mạng kèm URL, tự gắn `X-Tenant`.
- **Audit log** helper `writeAudit()` + bảng `audit_logs` (index `(tenantId, …)`).
- **Health check** `GET /api/health` (kiểm tra DB + trạng thái cờ).
- **Seed idempotent** (P0: tenant demo).
- **Test trên Postgres** (vitest, 18 test): cách ly tenant, storage, resolve, env.

### DoD P0
- [x] Chạy local: `npm run db:migrate && npm run db:seed && npm run dev` (health 200).
- [x] Migration: `20260608135255_p0_tenant_audit`.
- [x] Test cách ly tenant trên Postgres (`tests/tenant/isolation.test.ts`).
- [x] Index `(tenantId, …)` trên `audit_logs`.
- [x] Audit log helper sẵn sàng cho các phase sau.
- [x] Lỗi server log traceback; route bọc error handling.
- [x] Client xử lý 204/empty.
- [x] `npm run build` xanh, `tsc --noEmit` xanh.

## [P1] Auth + RBAC + tenant + seed — ✅ Done

### Added
- **Schema**: `Permission`, `Role`, `RolePermission` (global catalog), `User`,
  `UserRole`, `Faculty`, `Department` (tenant-scoped) — migration `p1_auth_rbac`.
- **Soft-delete extension** (`deletedAt: null` cho reads của User/Faculty/Department)
  + helper `softDeleteData`.
- **Auth**: hash mật khẩu bcrypt, JWT (jose) mang `tenantId`+roles, cookie phiên httpOnly.
  Endpoints `POST /api/auth/login`, `POST /api/auth/logout` (204), `GET /api/auth/me`.
- **RBAC khai báo bằng dữ liệu**: catalog 14 quyền + 8 vai trò (`src/lib/rbac/permissions.ts`);
  `requirePermission()` kiểm tra ở server cho mọi endpoint.
- **Route wrappers**: `authedRoute` (nạp JWT → context: actorId/roles/permissions),
  `superAdminRoute` (platform, bypass tenant), `tenantRoute`.
- **Quản lý user/khoa/bộ môn**: `/api/users` (+`/[id]` GET/PATCH/DELETE soft-delete),
  `/api/faculties`, `/api/departments` — phân trang + validate Zod + audit log.
- **Helper**: phân trang offset (`parsePagination`/`paginated`), `parseBody` (Zod).
- **Seed idempotent mở rộng**: permissions + roles + role-permissions, **system tenant +
  super-admin** (bootstrap được cả trên DB đã có dữ liệu), tenant demo + admin qa_office.

### DoD P1
- [x] Chạy local: seed idempotent (chạy lại không nhân bản), login/me end-to-end OK.
- [x] Migration `20260608140406_p1_auth_rbac`.
- [x] **Test cách ly tenant trên Postgres**: admin A không thấy user B; token tenant
  khác → 403 (`tests/users/isolation.test.ts`). Billing hết hạn/khóa → 403 (không 500).
- [x] List có phân trang; index `(tenantId, …)` trên users/faculties/departments.
- [x] Audit log cho login + tạo/sửa/xóa user/khoa/bộ môn.
- [x] Soft-delete user/khoa/bộ môn (không xóa cứng).
- [x] Kiểm tra quyền ở server (RBAC) — thiếu quyền → 403.
- [x] 32 test xanh, `npm run build` + `tsc` + `lint` xanh.

## [P2] Cấu hình bộ tiêu chuẩn (data-driven) — ✅ Done

Xương sống đa-tiêu-chuẩn: bộ tiêu chuẩn là **dữ liệu cấu hình GLOBAL**, không hard-code.

### Added
- **Schema (global)**: `AccreditationStandard`, `StandardVersion`, `Criterion`,
  `Requirement`, `Indicator`, `RatingScale`, `SuggestedEvidence` — migration `p2_standards`.
- **Dataset AUN-QA v4.0** (`src/lib/standards/aunqa-data.ts`): 8 tiêu chí (VI/EN),
  thang đánh giá **7 mức** (nhãn chính thức AUN-QA), yêu cầu + minh chứng gợi ý đại diện.
- **Hàm seed dùng chung** `seedAunqa()` (idempotent) — gọi từ seed + test.
- **Service** `listStandards`/`getStandard` (đọc; gồm tiêu chí + yêu cầu + thang điểm),
  `createStandard`/`createCriterion`/`createRequirement` (cấu hình super-admin).
- **Endpoints**: `GET /api/standards`, `GET /api/standards/[id]` (đọc, DATA_VIEW);
  `POST /api/standards`, `POST /api/criteria`, `POST /api/requirements` (super-admin).

### DoD P2
- [x] Migration `20260608142108_p2_standards`; seed AUN-QA (8 tiêu chí + 24 yêu cầu + 7 mức).
- [x] Test trên Postgres: seed đúng số lượng; **bộ tiêu chuẩn global dùng chung mọi tenant**;
  **thêm chuẩn mới = nạp dữ liệu, không sửa code lõi**; cấu hình chỉ super-admin (403).
- [x] Audit log cho thao tác cấu hình; build/lint/tsc xanh (36 test).

## [P3] Chương trình đào tạo + OBE — ✅ Done

### Added
- **Schema (tenant-scoped)**: `Programme`, `ProgrammeVersion` (vòng đời trạng thái),
  `ProgrammeObjective` (PEO), `ProgrammeLearningOutcome` (PLO), `Course`,
  `CourseLearningOutcome` (CLO), `PloCourseMapping`, `CloPloMapping` — migration `p3_programme_obe`.
- **Helper** `withTenantId()`: gắn tenantId tường minh (thỏa type Prisma, bỏ cast `as unknown`).
- **Service**: CTĐT (CRUD + đa phiên bản, state machine `draft→active→archived`),
  PEO/PLO, học phần + CLO, ma trận PLO-học phần (mức I/R/M) + CLO-PLO.
- **Cảnh báo độ phủ OBE** (`coverageWarnings`): PLO chưa có học phần, PLO chưa có CLO
  đo lường, CLO mồ côi (chưa liên kết PLO) — tính trực tiếp từ dữ liệu.
- **Endpoints**: `/api/programmes` (+`/[id]`, `/[id]/versions`), `/api/plos`,
  `/api/courses` (+`/[id]/clos`), `/api/matrices/plo-course`, `/api/matrices/clo-plo`,
  `/api/coverage` — phân trang + RBAC + audit.

### DoD P3
- [x] Migration `20260608142735_p3_programme_obe`; soft-delete Programme/Course.
- [x] Test trên Postgres (40 test): vòng đời phiên bản, ma trận, cảnh báo độ phủ,
  **cách ly tenant** (CTĐT A không lọt sang B; trùng mã theo tenant OK).
- [x] List phân trang + index `(tenantId, …)`; audit log; build/lint/tsc xanh.

## [P4] Đợt tự đánh giá + SAR — ✅ Done

### Added
- **Schema (tenant-scoped)**: `AssessmentCycle`, `SelfAssessmentReport`,
  `SarCriterionResponse`, `SarComment`, `InternalReview`, `InternalReviewScore` —
  migration `p4_sar`.
- **SAR state machine** (`src/lib/sar/state.ts`): 11 trạng thái theo đặc tả 4.13,
  chặn chuyển trạng thái không hợp lệ.
- **Service SAR**: tạo đợt; tạo SAR **tự sinh response cho từng tiêu chí** của bộ
  tiêu chuẩn áp dụng; nhập liệu từng tiêu chí (điểm tự đánh giá **validate theo thang
  7 mức**); đổi trạng thái; soft-delete.
- **Đánh giá nội bộ**: mở phiên rà soát, chấm điểm theo tiêu chí, **tổng hợp/so sánh
  điểm giữa các reviewer** (`aggregateScores`).
- **Endpoints**: `/api/cycles`, `/api/sars` (+`/[id]`, `/[id]/status`,
  `/[id]/reviews`), `/api/sar-responses/[id]`, `/api/reviews/[id]/scores`.

### DoD P4
- [x] Migration `20260608143320_p4_sar`.
- [x] Test trên Postgres (45 test): SAR sinh đúng 8 response, validate điểm theo thang,
  state machine, chấm điểm + so sánh reviewer, **cách ly tenant SAR**.
- [x] List phân trang + index; audit log; soft-delete; build/lint/tsc xanh.

## [P5] Minh chứng — ✅ Done

### Added
- **Schema (tenant-scoped)**: `Evidence`, `EvidenceFile`, `EvidenceLink`,
  `EvidenceCriterionMapping`, `EvidenceRequirementMapping`, `EvidenceVerificationLog`
  — migration `p5_evidence`.
- **Kho minh chứng tập trung**: tự đánh mã `MC-XXXX` (đếm theo tenant), upload nhiều
  file **qua lớp Storage** (không ghi đĩa container), **hash sha256 chống trùng**,
  liên kết một minh chứng với **nhiều tiêu chí/yêu cầu**, tìm/lọc theo tiêu chí/năm/
  trạng thái, vòng đời xác minh + log.
- **Endpoints**: `/api/evidence` (+`/[id]`, `/[id]/files` upload multipart,
  `/[id]/verify`), `/api/files/[...key]` (phục vụ file, kiểm tra key thuộc tenant).
- **Fix**: S3 driver import động bằng specifier dựng runtime → Turbopack không cố
  resolve `@aws-sdk` khi build (dep chỉ bắt buộc ở prod dùng S3).

### DoD P5
- [x] Migration `20260608143810_p5_evidence`; soft-delete minh chứng.
- [x] Test trên Postgres (51 test): tự đánh mã, upload + hash chống trùng, liên kết
  nhiều tiêu chí, xác minh + log, lọc theo tiêu chí, **cách ly tenant** (mã đếm riêng).
- [x] List phân trang + index; audit log; build/lint/tsc xanh.

## [P6] Dashboard + Nhiệm vụ + Kế hoạch cải tiến (PDCA) — ⏳ Tiếp theo

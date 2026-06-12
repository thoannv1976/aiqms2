# Changelog

Tiến độ build theo phase (xem `docs/HUONG_DAN_XAY_DUNG_APP_KIEM_DINH.md` mục 9).
Mỗi phase chỉ "xong" khi đạt **Definition of Done** (mục 10).

## [Frontend + Deploy] — ✅ Done

### Giao diện người dùng (Next.js App Router + Tailwind)
- **Trang đăng nhập** (chọn tenant + email/mật khẩu), **app shell** (Sidebar theo đặc tả
  mục 7 + Topbar) có **guard đăng nhập** (gọi `/api/auth/me`, 401 → /login).
- **Dashboard** (thẻ số liệu: CTĐT, SAR, minh chứng, nhiệm vụ quá hạn, SAR/minh chứng theo
  trạng thái). Trang danh sách + phân trang: **Chương trình đào tạo** (có tạo), **Bộ tiêu
  chuẩn** (xem tiêu chí + thang điểm), **SAR**, **Minh chứng** (có tạo), **Nhiệm vụ**, **Kế
  hoạch cải tiến**, **Người dùng**.
- Component dùng chung: `btn/card/badge/input` (Tailwind layer), `DataTable`, `Pagination`,
  `Modal`, `StatusBadge`. `apiClient` gắn `X-Tenant` theo tenant đã đăng nhập, xử lý 204.

### Deploy
- `Dockerfile` + `docker-entrypoint.sh` (tự `migrate deploy`) + `docs/DEPLOY.md` (Cloud Run +
  Cloud SQL + Secret Manager).
- **Lưu trữ GCS**: cài sẵn `@aws-sdk/client-s3` → driver S3 chạy với GCS (S3-compatible) chỉ
  bằng cấu hình env; hướng dẫn HMAC + bucket ở `DEPLOY.md` mục 7b.

## [Kho đề cương: lỗi "file không còn trong kho" — chẩn đoán rõ + cảnh báo lưu trữ tạm] — ✅ Done
- **Nguyên nhân**: trên Cloud Run, driver `local` ghi file vào `/tmp` (tạm) — file bị mất khi máy chủ
  khởi động lại/mở rộng, trong khi bản ghi DB vẫn còn → file cũ hiện trong danh sách nhưng "Trích xuất"/"Tải"
  báo "không tồn tại trong kho lưu trữ". Đây là vấn đề **cấu hình lưu trữ**, không phải lỗi logic.
- **Sửa/cải thiện**: thông báo lỗi mới `storage_file_lost` nêu rõ nguyên nhân + cách xử lý (bật GCS hoặc
  "Tải lên phiên bản mới"); dùng chung cho tải tài liệu, trích xuất đề cương, đưa vào hồ sơ MC. Thêm
  `GET /api/storage/status` + **banner cảnh báo** trong "Kho đề cương" khi lưu trữ chưa bền vững.
  Cách khắc phục triệt để: chạy `scripts/setup-gcs.sh` để bật `STORAGE_DRIVER=s3` (GCS). Test:
  `tests/storage/storage-status.test.ts`.

## [Kho đề cương: làm mới, dọn file đã mất, xóa học phần ở /courses] — ✅ Done
- **Làm mới** kho đề cương (tải lại danh sách mới nhất) + **🧹 Dọn file đã mất** (`cleanupMissingSyllabi`):
  quét từng đề cương bằng `storage.exists`, **xóa mềm bản ghi mồ côi** (file đã mất ở /tmp Cloud Run) →
  danh sách chỉ còn đề cương thực sự đang lưu trữ. API `POST /api/documents/syllabus/cleanup`.
- **Xóa học phần ngay ở màn hình Đề cương học phần** (`/courses`): thêm cột "Xóa" mỗi dòng. Sửa quyền
  xóa học phần: chấp nhận **`DATA_DELETE` hoặc `DATA_UPDATE`** (qa_office/ban CN xóa được). Test:
  `tests/documents/documents.test.ts`.

## [Kho đề cương: sửa Xóa + giao diện quản lý giàu thông tin] — ✅ Done
- **Sửa lỗi Xóa không hoạt động**: route xóa tài liệu trước chỉ chấp nhận `data.delete` (qa_office/ban CN
  KHÔNG có) → nay cho phép **`DATA_DELETE` hoặc `DATA_UPDATE`** (hoặc xóa file do chính mình nộp). Nút
  Xóa cũng **hiện lỗi rõ** thay vì im lặng.
- **Lưu & lọc theo chương trình**: kho đề cương lọc theo CTĐT đang chọn (upload gắn `programmeId`).
- **Giao diện quản lý mới** (`listSyllabusRepo` + `/api/documents/syllabus`): bảng hiển thị **tên đề cương /
  tệp, dung lượng, ngày upload, trạng thái đã-trích-xuất (✓ mã học phần), phiên bản, nơi lưu (GCS/tạm)**,
  kèm tóm tắt "X đã trích xuất · lưu trữ …". Test trên Postgres (`tests/documents/documents.test.ts`).

## [/courses: chọn-xóa nhiều + cột ngày/người tạo/đã trích xuất] — ✅ Done
- Màn hình **Đề cương học phần** (`/courses`): thêm **checkbox chọn nhiều** + nút **🗑 Xóa N học phần
  đã chọn** (API `POST /api/courses/bulk-delete`). Thêm cột **Ngày upload (giờ), Người tạo, Trích xuất**
  (✓ Đã có đề cương nếu có CLO hoặc tài liệu syllabus gắn học phần). `listCourses` làm giàu
  (`createdByName/cloCount/extracted/hasSyllabus`) và **lọc bỏ học phần đã xóa mềm** (trước đây vẫn hiện).
  `Column.header` nay nhận `ReactNode`. Test: `tests/obe/programme.test.ts`.

## [Sửa tiếp: trưởng khoa (faculty) nộp được minh chứng] — ✅ Done
- Endpoint nộp tài liệu nay chấp nhận thêm **`DATA_UPDATE`** (vai trò khoa/trưởng khoa có) bên cạnh
  `DATA_CREATE`/`EVIDENCE_UPLOAD`, giữ luồng "người được giao việc" cho các vai trò không có quyền nào.
  → mọi vai trò trong quy trình kiểm định đều nộp được minh chứng cho việc của mình.

## [Sửa: mọi người được giao việc đều nộp được minh chứng (kể cả hội đồng rà soát)] — ✅ Done
- **Nguyên nhân**: hội đồng rà soát (`internal_reviewer`) và một số vai trò do AI/Admin tạo không có
  `data.create` lẫn `evidence.upload` → bị chặn khi nộp minh chứng cho công việc được giao.
- **Sửa**: endpoint nộp tài liệu nay cho phép **người được giao công việc tự nộp minh chứng cho ĐÚNG
  công việc đó** (kiểm tra `task.assigneeId === người dùng`), bất kể vai trò — bao trùm cả tài khoản AI
  tạo và Admin tạo tay. Xóa: cho phép xóa **tài liệu do chính mình nộp** với mọi vai trò. Test:
  `tests/rbac/lecturer-upload.test.ts`.

## [Sửa: giảng viên không nộp được minh chứng (Thiếu quyền data.create)] — ✅ Done
- **Nguyên nhân**: endpoint nộp tài liệu (`POST /api/documents`) yêu cầu `data.create`, nhưng vai trò
  **lecturer** chỉ có `evidence.upload` (+ `data.update`) → giảng viên nộp minh chứng cho công việc
  được giao bị chặn 403.
- **Sửa**: nộp tài liệu nay chấp nhận **`DATA_CREATE` HOẶC `EVIDENCE_UPLOAD`**; giảng viên cũng được
  **xóa file do chính mình nộp** (createdBy = mình) dù không có `data.delete`. Test:
  `tests/rbac/lecturer-upload.test.ts`.

## [Sửa: áp dụng ma trận AI không hiện I/R/M trong lưới] — ✅ Done
- **Nguyên nhân**: (1) lưới ma trận chỉ lấy 100 học phần đầu của tenant làm cột → học phần do AI
  trích xuất có thể bị cắt khỏi cột nên ô đã ghi không hiển thị; (2) khớp mã học phần khi áp dụng là
  exact + phân biệt hoa thường → dễ trượt.
- **Sửa**: lưới PLO×Học phần nay dựng cột từ **hợp của học phần tải về + học phần đã ánh xạ trong ma
  trận** (ô vừa áp dụng LUÔN có cột; tăng pageSize 100→500). `applyMatrixMappings` khớp mã học phần
  **trim + không phân biệt hoa thường**. Test: `tests/obe/matrix-ai.test.ts`.

## [Xuất công việc TOÀN ĐỘI (mọi thành viên) ra Excel/Word] — ✅ Done
- **Xuất công việc toàn đội kiểm định** (`listAllTasksForExport` + `buildTeamTasksXlsx/Docx`): mọi
  người × mọi đợt, đầy đủ **tên người phụ trách (+email), đợt kiểm định, tiêu chí, công việc, minh
  chứng phải nộp, hạn, ưu tiên, trạng thái**. Excel: sheet "Phân công toàn đội" + sheet "Tổng hợp theo
  người" (số việc·đã xong·ưu tiên cao). Word: **nhóm theo từng người phụ trách**.
- Loại job `team_tasks_xlsx`/`team_tasks_docx` (trang Xuất báo cáo) + nút tải nhanh "⬇ Excel/Word toàn
  đội" ở trang Nhiệm vụ (route `GET /api/exports/team-tasks`, cần REPORT_EXPORT). Test trên Postgres.

## [Xuất "Công việc của tôi" ra Excel/Word] — ✅ Done
- Mỗi thành viên **xuất danh sách công việc của mình** đầy đủ chi tiết (tên người phụ trách, đợt
  kiểm định, tiêu chí, công việc, **minh chứng phải nộp**, hạn, ưu tiên, trạng thái): Excel (bảng
  phẳng) và Word (**nhóm theo từng đợt**). Route tải trực tiếp `GET /api/tasks/mine/export?format=xlsx|docx`
  **chỉ cần DATA_VIEW** nên mọi vai trò (kể cả giảng viên không có quyền xuất báo cáo chung) đều dùng được.
- Nút **⬇ Excel / ⬇ Word** ở góc trang "Công việc của tôi". Test trên Postgres (`tests/export/export.test.ts`).

## [Xuất bảng phân công đợt ra Excel/Word] — ✅ Done
- **Xuất BẢNG PHÂN CÔNG** của một đợt tự đánh giá: `cycle_assignment_xlsx` (Excel — sheet "Phân công"
  đầy đủ STT/Công việc/Tiêu chí/Người phụ trách/Minh chứng phải nộp/Hạn/Trạng thái/MC đã nộp + sheet
  "Theo người" tổng hợp số việc·đã xong·ưu tiên cao) và `cycle_assignment_docx` (Word — tiêu đề đợt +
  chương trình + bảng chi tiết). Thêm tham số `cycleId` cho job xuất.
- Nút **"⬇ Excel/Word phân công"** ngay trong panel Kế hoạch & phân công của đợt; cũng chọn được ở
  trang **Xuất báo cáo** (chọn đợt). Test trên Postgres (`tests/export/export.test.ts`).

## [Công việc của tôi: nhóm theo đợt kiểm định] — ✅ Done
- Trang **"Công việc của tôi"** nay **nhóm công việc theo từng ĐỢT kiểm định** (việc ngoài đợt gom
  vào "Nhiệm vụ khác"): mỗi nhóm có **thanh tiến độ + đếm việc/đã xong/quá hạn**, thu gọn/mở rộng,
  sắp xếp việc chưa xong trước (theo hạn → tiêu chí), đợt có việc quá hạn lên đầu.
- **Bộ lọc theo đợt** + tùy chọn **ẩn việc đã hoàn thành**; cảnh báo hạn quá hạn (đỏ). Dùng dữ liệu
  sẵn có (`/api/tasks/mine`), không đổi backend.

## [AI tạo nhóm kiểm định + Tự động phân công công việc] — ✅ Done
- **AI tạo nhóm kiểm định + tài khoản** (`suggestAccreditationTeam` + `createAccreditationTeam`):
  AI đề xuất nhóm nhân sự đủ vai trò AUN-QA (qa_office, programme_committee, faculty, lecturer×N,
  internal_reviewer×2, leadership) — có **dự phòng nhóm chuẩn** khi AI tắt/lỗi nên luôn dùng được;
  tự sinh email (bỏ dấu tiếng Việt, không trùng). Tạo hàng loạt tài khoản **idempotent theo email**
  (mật khẩu mặc định `Aiqms@12345`). Nút "👥 AI tạo nhóm & tài khoản". API `POST /api/ai/team`,
  `POST /api/users/team`.
- **Tự động phân công công việc** (`autoAssignCycleTasks`): khớp vai trò đề xuất của từng công việc
  (lấy từ mô tả hoặc suy theo từ khóa tiêu đề) với thành viên có vai trò đó, **chia đều round-robin**,
  có vai trò dự phòng khi thiếu người; gửi thông báo tổng hợp. Gán cả công việc đã tạo trước đó.
  Nút "🎯 Tự động phân công". API `POST /api/cycles/[id]/auto-assign`. Test trên Postgres
  (`tests/cycle/team-assign.test.ts`).

## [Chẩn đoán AI tạo kế hoạch: timeout + kiểm tra cấu hình theo bước] — ✅ Done
- **Timeout gọi LLM** (`fetchWithTimeout`, mặc định 120s) cho cả Anthropic và OpenAI provider —
  hết giờ trả lỗi rõ ràng thay vì treo vô hạn ở "Đang xử lý" (model mạnh như Opus rất chậm).
- **Kiểm tra cấu hình AI** trước khi sinh kế hoạch: `aiStatus()` + `GET /api/ai/status` báo
  đã-bật / có-key / giải-mã-được-key / đang-dùng-mock / provider / model (KHÔNG lộ key).
- **CyclePlanPanel** chạy theo bước có thông báo: ① kiểm tra cấu hình → cảnh báo cụ thể (chưa bật,
  key hỏng, chưa có key→mock) kèm bước cần làm; ② lập kế hoạch (nhắc model mạnh mất 30–90s);
  ③ báo số công việc đề xuất. Test: `tests/ai/ai.test.ts` (aiStatus mock/anthropic, không lộ key).

## [Sửa AI tạo kế hoạch đợt trả 0 công việc] — ✅ Done
- **Lỗi**: tenant chưa cấu hình API key AI → `resolveAi()` rơi về `MockProvider`, mà mock không
  trả khóa `tasks` nên "AI tạo kế hoạch" luôn báo "AI đề xuất 0 công việc".
- **Sửa**: `MockProvider` nay sinh sẵn kế hoạch mẫu (deterministic) khi prompt là yêu cầu lập
  kế hoạch (nhận diện qua `dueOffsetDays`): mỗi tiêu chí C1..Cn có công việc thu thập minh chứng +
  viết SAR, kèm các công việc chung (lập kế hoạch, rà soát, đánh giá nội bộ, xuất hồ sơ) với
  vai trò/sản phẩm/độ ưu tiên/hạn. Demo dùng được ngay; có key thật vẫn ưu tiên AI thật.
  Test trên Postgres (`tests/ai/ai.test.ts`: tạo kế hoạch + áp dụng → task gắn đúng tiêu chí).

## [Quản lý phiên bản tài liệu (D10)] — ✅ Done
- **Version chain cho `Document`** (migration `document_versioning`): thêm `version`, `rootId`,
  `isCurrent`. `uploadNewVersion` tạo bản mới cùng chuỗi (tăng version, hạ cờ bản cũ),
  `listDocumentVersions` trả lịch sử đầy đủ; danh sách tài liệu chỉ hiển thị bản hiện hành.
  API `GET/POST /api/documents/[id]/versions`. **UI**: cột "Phiên bản" + nút "Phiên bản" mở
  modal lịch sử (tải từng bản + thêm bản mới). Test trên Postgres (`tests/documents/documents.test.ts`).

## [Đối sánh / benchmarking (D9)] — ✅ Done
- **Báo cáo đối sánh** (`benchmarkReport`): so sánh giá trị chỉ số C8 với mốc đối sánh (CT tham
  chiếu) và chỉ tiêu — tính chênh lệch, xếp trạng thái (vượt/ngang/dưới mốc) và tổng hợp số liệu.
  Trang `/benchmarking` (thẻ tổng hợp + bảng so sánh, tô đỏ chỗ dưới mốc), API `GET /api/benchmarking`.
  Test trên Postgres (`tests/institutional/benchmark.test.ts`).

## [Module Đánh giá ngoài (D8)] — ✅ Done
- **Model `ExternalAssessment` + `ExternalAssessmentScore`** (migration `external_assessment`):
  đợt đánh giá ngoài gắn SAR — thành viên đoàn, lịch khảo sát, trạng thái (planned/onsite/completed),
  điểm tổng thể, kết luận/khuyến nghị. Chấm theo từng tiêu chí (thang 7 mức) kèm điểm mạnh / điều
  cần cải thiện. Thêm vào `TENANT_SCOPED_MODELS`.
- **Service** create/list/get/update/delete + `setExternalScore` (upsert, tự tính điểm TB tổng thể).
  API `/api/sars/[id]/external-assessments` + `/api/external-assessments/[id]` (GET/PATCH/DELETE) +
  `/scores`. **UI**: tab "Đánh giá ngoài" ở chi tiết SAR (danh sách đợt + bảng chấm điểm + kết luận).
  Test trên Postgres (`tests/sar/external-assessment.test.ts`, có test cách ly tenant).

## [Đo lường mức đạt PLO → C8 (D7)] — ✅ Done
- **Model `PloAttainment`** (migration `plo_attainment`): mức đạt PLO theo khóa/kỳ (% đạt, cỡ mẫu,
  chỉ tiêu, phương pháp). Thêm vào `TENANT_SCOPED_MODELS`.
- **Service** `createAttainment/listAttainments/deleteAttainment` + `promoteAttainmentsToOutcomes`
  (tổng hợp trung bình mỗi PLO → `OutcomeMetric` category=plo_attainment, idempotent theo
  `dataSource=plo_attainment:<ploId>`). API `/api/plo-attainments` (GET/POST/DELETE) +
  `/api/plo-attainments/to-outcome`.
- **UI**: tab "Mức đạt PLO → C8" ở trang Hệ ma trận — nhập/đo theo PLO/khóa/kỳ, tô đỏ khi dưới
  chỉ tiêu, nút "Tổng hợp → C8". Test trên Postgres (`tests/obe/plo-attainment.test.ts`).

## [Email + nhắc hạn tự động (D5)] — ✅ Done
- **Mailer abstraction** (`getMailer`): driver `log` (mặc định, không gửi) và `smtp` (nodemailer,
  nạp động — không bắt buộc khi dùng `log`; fallback an toàn nếu thiếu cấu hình). Cấu hình env
  `EMAIL_DRIVER/EMAIL_FROM/SMTP_*`.
- **Nhắc hạn nhiệm vụ tự động** (`dueReminders`): quét nhiệm vụ chưa hoàn thành sắp đến hạn /
  quá hạn (trong `REMINDER_DUE_WITHIN_DAYS` ngày), gộp theo người phụ trách, tạo thông báo
  trong app + gửi email. Nút "Gửi nhắc hạn" ở trang Nhiệm vụ, API `POST /api/reminders/run`
  (có thể gọi định kỳ qua cron). Test trên Postgres (`tests/reminders/reminders.test.ts`).

## [Bảng theo dõi tiến độ đợt (D4)] — ✅ Done
- **Theo dõi tiến độ đợt** (`cycleProgress`): % hoàn thiện theo từng tiêu chí (phân tích 30 /
  điểm 20 / minh chứng 30 / yêu cầu con 20), % chung, số minh chứng đã thu, thống kê nhiệm vụ
  (tổng / hoàn thành / quá hạn) và **danh sách ai đang trễ hạn** (gộp theo người phụ trách).
  Panel `CycleProgressPanel` ở chi tiết đợt, API `GET /api/cycles/[id]/progress`. Test trên
  Postgres (`tests/cycle/progress.test.ts`).

## [Khảo sát → C8 (C4)] — ✅ Done
- **Đưa kết quả khảo sát vào dữ liệu C8** (`promoteSurveyToOutcome`): tổng hợp điểm trung bình
  các câu hỏi rating thành chỉ số `OutcomeMetric` (category=satisfaction, kèm nhóm bên liên quan),
  dùng cho tiêu chí 8 và ma trận PLO–Bên liên quan. **Idempotent** theo `dataSource=survey:<id>`
  (đẩy lại sẽ cập nhật, không trùng). Nút "Đưa vào C8" ở chi tiết khảo sát, API
  `POST /api/surveys/[id]/to-outcome`. Test trên Postgres (`tests/p9/surveys.test.ts`).

## [Tạo cải tiến từ điểm tồn tại SAR (C3/D6)] — ✅ Done
- **Tạo kế hoạch cải tiến từ điểm tồn tại** (`createPlansFromSarWeaknesses`): quét từng tiêu chí
  trong SAR, gộp "điểm tồn tại" người dùng nhập + khoảng trống tự phát hiện (chưa có minh chứng /
  chưa phân tích / chưa chấm điểm) thành "vấn đề" của một kế hoạch PDCA gắn `criterionId`.
  **Idempotent**: bỏ qua tiêu chí đã có kế hoạch. Nút "Tạo cải tiến từ điểm tồn tại" ở chi tiết SAR,
  API `POST /api/sars/[id]/improvement-plans`. Test trên Postgres (`tests/pm/p6.test.ts`).

## [Xuất hồ sơ SAR đầy đủ (D1/C2)] — ✅ Done
- **Xuất hồ sơ tự đánh giá đầy đủ → Word** (`sar_dossier_docx`): gộp toàn bộ phụ lục vào một
  tài liệu — PHẦN I phân tích theo tiêu chí kèm **checklist 53 yêu cầu** (mức đáp ứng + ghi
  chú) và **điểm hội đồng** (TB/min–max); PHẦN II **các ma trận PLO** (PLO×Học phần I/R/M +
  toàn bộ ma trận theo `PLO_DIMENSIONS`); PHẦN III **dữ liệu C5–C8** (giảng viên, người học,
  CSVC, kết quả đầu ra); PHẦN IV **khảo sát các bên liên quan**; PHẦN V **danh mục minh chứng**
  theo mã tiêu chí.
- Nối vào job xuất nền (`createExportJob`), trang **Xuất báo cáo** và nút "Xuất hồ sơ đầy đủ"
  ở chi tiết SAR. Có test trên Postgres (`tests/export/export.test.ts`).

## [Task → hồ sơ minh chứng + AI gợi ý hành động mọi màn hình] — ✅ Done

- **"→ Hồ sơ"** tại mỗi file nộp ở task: `promoteDocumentToEvidence` tạo **Evidence
  (MC-XXXX)**, tự **gắn tiêu chí** của công việc, đính kèm chính file đó → nối task → hồ sơ
  AUN-QA. API `POST /api/documents/[id]/to-evidence` (quyền upload MC / tạo dữ liệu).
- **AI gợi ý việc nên làm tiếp** trên MỌI màn hình: nút **"✨ AI gợi ý việc nên làm tiếp"**
  trong Trợ lý hướng dẫn (nút "?") → `suggestScreenActions` đề xuất 3–6 hành động ưu tiên bám
  ngữ cảnh màn hình. API `POST /api/ai/screen-actions`. 129 test.

## [Nộp minh chứng trực tiếp theo công việc] — ✅ Done

- **Gắn file minh chứng vào đúng công việc** (`Document.taskId`, migration `document_task_link`,
  category `task_evidence`): thành viên ở **"Công việc của tôi"** bấm **"📎 Minh chứng"** để
  upload nhiều file ngay tại task (không cần sang kho Minh chứng chung), xem/gỡ file đã nộp.
- **Đếm minh chứng đã nộp**: "Công việc của tôi" và bảng kế hoạch của QA (chi tiết đợt) hiển
  thị số file đã nộp mỗi việc (`fileCountByTask`) → QA theo dõi tiến độ nộp. API `/api/documents`
  nhận/lọc `taskId`. 127 test.

## [Công việc của tôi + sửa AI kế hoạch đợt + cảnh báo storage] — ✅ Done

- **Sửa AI tạo kế hoạch đợt**: schema kế hoạch khoan dung (item lỗi `.catch`, priority chuẩn
  hóa low/normal/high, `dueOffsetDays` coerce) → không còn fail schema sau khi chờ; UX rõ ràng
  ("⏳ AI đang lập kế hoạch… 30–60 giây") thay vì chỉ "…"; báo lỗi/０-task tường minh.
- **Màn hình "Công việc của tôi"** (`/my-tasks` + `/api/tasks/mine`): thành viên thấy các công
  việc được giao (kèm tên đợt, tiêu chí, **minh chứng phải nộp**, hạn), tự **đổi trạng thái**
  và link **Nộp minh chứng**. Thông báo phân công nay trỏ tới `/my-tasks`. Thêm menu sidebar.
- **Cảnh báo storage**: log cảnh báo khi `STORAGE_DRIVER=local` chạy production (Cloud Run ổ
  đĩa không bền vững) — nhắc dùng GCS (`scripts/setup-gcs.sh`). 126 test.

## [Kho đề cương: trích xuất hàng loạt (chọn nhiều)] — ✅ Done

- Mỗi đề cương trong kho có **"Trích xuất"** riêng (theo đúng documentId của dòng đó) → xem
  trước → ghi học phần.
- **Chọn nhiều đề cương** (checkbox + "Chọn tất cả") → nút **"Trích xuất & ghi đã chọn (N)"**:
  xử lý tuần tự, có tiến độ, mỗi đề cương được trích xuất + tạo/cập nhật học phần + **gắn file
  vào học phần** (`extractAndApplyStored` + `/api/import/courses/doc/extract-apply`). 125 test.

## [Kho đề cương: upload nhiều + trích xuất sau + AI tạo bản chuẩn AUN-QA] — ✅ Done

- **Kho đề cương** (nút "Kho đề cương" ở trang Đề cương): **tải lên NHIỀU file .docx/.pdf** một
  lượt vào kho Tài liệu (gắn CTĐT), không trích xuất ngay. Danh sách đề cương đã upload (lọc
  theo CTĐT) — mỗi cái có **"Trích xuất"** (on-demand) → xem trước → **"Ghi vào hệ thống"**
  (tạo/cập nhật học phần + gắn file), kèm Tải/Xóa.
- `extractStoredSyllabus` + `POST /api/import/courses/doc/extract`: trích xuất đề cương từ file
  đã lưu trong kho (đọc qua Storage), tách khỏi bước upload.
- **AI tạo bản đề cương chuẩn AUN-QA** (`generateCompliantSyllabus` → nút "✨ AI tạo bản chuẩn
  AUN-QA" ở trang chi tiết học phần): viết lại TOÀN BỘ các mục dựa trên nội dung hiện có/đã
  upload, khắc phục điểm chưa đạt (CLO theo Bloom, constructive alignment, học liệu 5 năm,
  trọng số phủ CLO) → bản nháp để duyệt rồi Lưu. 124 test.

## [Đợt kiểm định: chọn CTĐT + AI giao việc theo vai trò + tạo nhanh tài khoản] — ✅ Done

- **Chọn CTĐT được kiểm định** khi tạo đợt (`AssessmentCycle.programmeId`, migration
  `cycle_programme`); hiển thị ở chi tiết đợt; AI lập kế hoạch dùng tên CTĐT làm ngữ cảnh.
- **AI tạo kế hoạch + GIAO VIỆC theo vai trò**: bản nháp kế hoạch hiển thị bảng *vai trò →
  thành viên* (lọc thành viên theo đúng vai trò); `applyCyclePlan(cycleId, plan, assignByRole)`
  tự gán người phụ trách + gửi **thông báo tổng hợp** cho từng người.
- **Admin tạo nhanh tài khoản thành viên** ngay trong bước giao việc ("+ Tạo TK": họ tên/email
  + vai trò, mật khẩu mặc định) rồi gán luôn. `listMembers` trả kèm vai trò. 124 test.

## [Đợt tự đánh giá: kế hoạch AI + phân công + minh chứng + thông báo] — ✅ Done

- **Kế hoạch & phân công** trong đợt tự đánh giá (Task gắn `cycleId` + `deliverables`;
  migration `cycle_plan_notifications`): trang chi tiết đợt có bảng công việc — tiêu chí
  (C1–C8), **người phụ trách** (dropdown), **minh chứng phải nộp**, hạn, trạng thái; thêm
  công việc thủ công. API `/api/cycles/[id]/tasks`.
- **AI tạo kế hoạch đợt** (`generateCyclePlan` → nút "🤖 AI tạo kế hoạch"): đề xuất danh mục
  công việc AUN-QA (thu thập minh chứng + viết SAR theo từng tiêu chí, rà soát, đánh giá nội
  bộ, xuất hồ sơ) kèm vai trò & minh chứng phải nộp → duyệt → tạo hàng loạt (`…/plan`).
- **Thông báo** (model `Notification`): tự gửi khi phân công; nút "🔔 Thông báo thành viên"
  gửi cho mọi người được giao trong đợt; **chuông thông báo** trên thanh tiêu đề (đếm chưa
  đọc, đánh dấu đã đọc). API `/api/notifications`. 122 test (thêm 4 test kế hoạch/thông báo).

## [Ma trận PLO mở rộng (bên liên quan / việc làm / PI-KPI / PDCA)] — ✅ Done

- Thêm 4 chiều ma trận mở rộng vào `PloMatrixCell` (cùng mô hình, không migration mới):
  **PLO–Bên liên quan** (cột cố định: DN/cựu SV/SV/GV/hội đồng), **PLO–Vị trí việc làm** &
  **PLO–PI/KPI** (**cột động** — người dùng/AI tự thêm), **PLO–Cải tiến PDCA** (Plan/Do/Check/Act,
  nhập văn bản). Trang Ma trận thêm 4 tab; lưới hỗ trợ **"+ Thêm cột"** cho chiều động.
- AI gợi ý/nâng cấp (`suggestPloMatrix`) xử lý chiều động: tự đề xuất vị trí việc làm (từ Đề án/
  CTĐT đã upload) hoặc tách PLO thành PI/KPI; `applyPloMatrixCells` chấp nhận cột tự đặt cho
  chiều động, vẫn lọc cột lạ cho chiều cố định. 118 test.

## [Hệ ma trận PLO đầy đủ (6 ma trận) + AI đánh giá/gợi ý/nâng cấp] — ✅ Done

- Bổ sung **4 ma trận PLO** (ngoài PLO–Học phần & CLO–PLO đã có) bằng mô hình data-driven
  `PloMatrixCell` (migration `plo_matrix_cells`): **PEO–PLO** (C1), **PLO–PP dạy học** (C3),
  **PLO–PP đánh giá** (C4), **PLO–Minh chứng đo lường** (C8). Cột PEO lấy động từ CTĐT; cột
  PP dạy/đánh giá theo danh mục chuẩn; measurement nhập văn bản. Trang Ma trận thêm **tab**
  cho từng ma trận, lưới bấm ô (✓) hoặc nhập văn bản, lưu tức thì (`/api/matrices/plo`).
- **AI đánh giá ma trận** (`evaluateMatrices` → nút "✨ AI đánh giá ma trận"): nhận xét theo
  AUN-QA (constructive alignment, độ phủ, tiến trình I→R→M, cân bằng tải, đa dạng PP, minh
  chứng) — kết hợp cảnh báo độ phủ tự động.
- **AI gợi ý/nâng cấp ma trận** (`suggestPloMatrix` → nút "🤖 AI nâng cấp / gợi ý" mỗi tab):
  dùng **dữ liệu thật** (PEO/PLO đã import + phương pháp dạy/đánh giá trong đề cương đã upload)
  đề xuất ô → duyệt → áp dụng (`/api/matrices/plo/apply`). 117 test (thêm 4 test ma trận PLO).

## [AI trích xuất ma trận PLO × Học phần từ Đề án/CTĐT] — ✅ Done

- Đổi trọng tâm chức năng "AI tổng hợp ma trận" sang **trích xuất ma trận PLO × Học phần**
  (mức I/R/M) **trực tiếp từ Đề án mở ngành / CTĐT** đã upload (CTĐT đã có sẵn bảng này),
  thay vì suy luận. `synthesizeMatrixFromDocs` lấy rộng hơn vùng bảng ma trận trong tài liệu
  (dòng có mã PLO / mã học phần / ô mức I-R-M-1-2-3-I-T-U), nhấn mạnh "trích theo bảng, không
  bịa"; CLO–PLO chỉ là phụ (từ đề cương nếu có). Cập nhật tiêu đề/mô tả UI sang "PLO × Học phần".

## [Sửa lỗi AI tổng hợp ma trận PLO-CLO (JSON lớn bị cắt cụt)] — ✅ Done

- **Lỗi**: AI tổng hợp ma trận báo "Output AI không đúng schema" — JSON nhiều dòng (nhiều
  học phần × PLO) bị **cắt cụt** theo token, hoặc có item lỗi làm hỏng cả mảng.
- **Fix**: `aiCompleteJson` thêm `parseLenientJson` — khi JSON cắt cụt thì **cắt lùi tới ranh
  giới `}`/`]` gần nhất và tự đóng ngoặc** để giữ phần đã hoàn chỉnh. `matrixDraftSchema`
  cho item lỗi dùng `.catch` (bỏ qua thay vì hỏng cả mảng). `synthesizeMatrixFromDocs` ưu
  tiên học phần thuộc đúng CTĐT, giới hạn 80 học phần + ép AI trả JSON gọn. 113 test (thêm
  test JSON ma trận cắt cụt vẫn cứu được phần hoàn chỉnh).

## [Sửa lỗi AI JSON "không đúng schema sau khi thử lại"] — ✅ Done

- **Lỗi**: AI điền nhanh đề cương / tổng hợp ma trận báo "Output AI không đúng schema" — JSON
  bị **cắt cụt** do `max_tokens` Anthropic mặc định chỉ 2048 (không đủ cho 6 mục đề cương),
  hoặc Claude bọc JSON trong ```json kèm văn bản thừa.
- **Fix**: nâng `max_tokens` mặc định Anthropic 2048→4096 và `aiCompleteJson` xin **8000
  token**; `extractJson` chịu lỗi tốt hơn (bỏ dấu phẩy thừa, tự đóng nháy/ngoặc còn thiếu khi
  bị cắt cụt). Log 500 ký tự output khi vẫn sai để chẩn đoán. 112 test (thêm test parse JSON
  Claude bọc fence + văn bản thừa).

## [Sửa lỗi lưu đề cương (mục trống = null)] — ✅ Done

- **Lỗi**: lưu đề cương báo `rubric: Invalid input: expected string, received null` — trang
  gửi `null` cho các ô trống nhưng `updateCourseSchema` chỉ nhận `string` (optional, không
  cho `null`).
- **Fix**: các trường đề cương (description/prerequisites/content/teachingMethods/
  assessmentMethods/materials/rubric) đổi sang `z.string().nullable().optional()`. 111 test
  (thêm test lưu đề cương với mục trống = null).

## [Sửa lỗi temperature với model Claude 4.x / reasoning] — ✅ Done

- **Lỗi**: model `claude-opus-4-8` (và các model Claude 4.x / reasoning) trả 400
  "temperature is deprecated for this model". Import CTĐT/đề cương vẫn "chạy" do có fallback
  bộ luật (AI lỗi bị nuốt), nhưng AI điền nhanh/rà soát đề cương (không fallback) thì lộ lỗi.
- **Fix tại provider (áp dụng cho TẤT CẢ tính năng AI)**: OpenAiProvider & AnthropicProvider
  **không gửi `temperature`** trừ khi được chỉ định (trước đây luôn gửi 0.3). JSON vẫn ổn nhờ
  `extractJson` + retry theo Zod. 110 test (assert request Anthropic không kèm temperature).

## [Lấy danh sách model khả dụng từ API key] — ✅ Done

- **Lỗi**: model `claude-3-5-haiku-20241022` trả 404 not_found — key Anthropic hợp lệ nhưng
  tài khoản không có đúng model đó (mỗi tài khoản được cấp model khác nhau).
- **Fix**: thêm `listProviderModels` + `GET /api/ai/models` gọi `/v1/models` của chính nhà
  cung cấp (Anthropic `x-api-key`, OpenAI `Bearer`) bằng key đã lưu → trả danh sách model
  tài khoản được phép dùng. Trang **AI hỗ trợ** thêm nút **"Lấy danh sách model khả dụng"**:
  hiển thị model thật để bấm chọn (tránh đoán sai model → 404). 110 test.

## [Học phần gắn CTĐT + sửa model Claude 404] — ✅ Done

- **Gắn học phần với Chương trình đào tạo**: `Course.programmeId` (migration `course_programme`).
  Danh sách Đề cương thêm **cột "Chương trình đào tạo"** + bộ lọc theo CTĐT (gồm "Chưa gán").
  Form tạo học phần + trang chi tiết có chọn CTĐT; import đề cương (Word/PDF) tự gán CTĐT đã
  chọn ở bước xem trước. `listCourses` lọc `programmeId` ("none" = chưa gán).
- **Sửa lỗi AI 404 model Claude**: auto-default khi dùng key `sk-ant-` đổi từ
  `claude-3-5-haiku-latest` (một số tài khoản trả 404) sang pinned `claude-3-5-haiku-20241022`.
  Trang **AI hỗ trợ** thêm nút chọn nhanh model (gpt-4o-mini/gpt-4o/claude-3-5-haiku/sonnet)
  tự set Base URL tương ứng + ghi chú Base URL cho OpenAI/Anthropic. 108 test.

## [AI điền nhanh toàn bộ đề cương] — ✅ Done

- **AI điền nhanh đề cương** (`draftFullSyllabus`): một lần gọi sinh nháp cho **tất cả mục
  còn trống** (mô tả/tiên quyết/nội dung/PP giảng dạy/đánh giá/học liệu) qua `aiCompleteJson`.
  Nút **"✨ AI điền nhanh đề cương"** ở trang chi tiết học phần → điền nháp vào các ô trống
  để người dùng kiểm tra rồi bấm "Lưu" (human-in-the-loop, không tự ghi). Đề cương đã đủ nội
  dung → bỏ qua, không tốn lượt AI. API `POST /api/ai/draft-course-all`. 107 test.

## [Chỉnh sửa đề cương bằng AI] — ✅ Done

- **AI soạn/cải thiện từng mục đề cương** (`draftCourseField`): mô tả, nội dung/kế hoạch,
  phương pháp giảng dạy, phương pháp+trọng số đánh giá, học liệu, tiên quyết — theo Mẫu 5A/5B
  ĐHNT + AUN-QA (constructive alignment với CLO). Human-in-the-loop: nút **"✨ AI soạn/cải
  thiện"** cạnh từng ô ở trang chi tiết học phần → AI đưa bản nháp vào ô → người dùng kiểm
  tra rồi bấm "Lưu đề cương" (không tự ghi).
- **AI rà soát đề cương** (`reviewCourseSyllabus`): nút **"✨ AI rà soát đề cương"** đối chiếu
  Mẫu 5A/5B + AUN-QA (TC2,3,5), nêu điểm đạt/chưa đạt + đề xuất sửa (tín chỉ, CLO theo Bloom,
  ma trận CLO–PLO, học liệu 5 năm, trọng số phủ CLO…).
- API `POST /api/ai/draft-course-field`, `POST /api/ai/review-syllabus` (quyền `ai.use`).
  106 test (thêm draft mục đề cương không tự lưu + rà soát).

## [Hỗ trợ AI Anthropic (Claude) — sửa lỗi 401 key sk-ant] — ✅ Done

- **Lỗi**: nạp key Anthropic (`sk-ant-…`) nhưng app gọi endpoint OpenAI với
  `gpt-4o-mini` → 401 "Incorrect API key". Tính năng AI tổng hợp ma trận / viết nháp đều fail.
- **Fix**: thêm `AnthropicProvider` (Messages API, tách `system` ra top-level). `resolveAi`
  tự chọn nhà cung cấp theo khóa/model/baseUrl: key `sk-ant-` hoặc model `claude-*` hoặc
  baseUrl `anthropic.com` → gọi Anthropic; nếu key Claude mà model còn để mặc định OpenAI thì
  tự đổi sang `claude-3-5-haiku-latest`. `aiCompleteJson` thêm `extractJson` (bỏ ```json
  fences/văn bản thừa) cho hợp với Claude. 104 test (thêm test định tuyến Anthropic qua mock fetch).

## [Sửa lỗi không nạp được @aws-sdk khi import/upload trên prod] — ✅ Done

- **Lỗi**: "Không ghi được file… Driver S3 cần @aws-sdk/client-s3" dù package đã ở
  `dependencies`. Nguyên nhân: S3 driver import động bằng specifier dựng ở runtime
  (`["@aws-sdk","client-s3"].join("/")`) → Turbopack không trace được → build thành **stub
  "module not found"**, ném lỗi lúc chạy.
- **Fix**: dùng **import literal** `import("@aws-sdk/client-s3")` + khai báo
  `serverExternalPackages` (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`,
  `pdf-parse`) trong `next.config` → các package này được nạp từ `node_modules` lúc chạy
  (cùng cơ chế external `e.x`/`e.y` mà `@prisma/client` đang dùng). Build sinh chunk
  `[externals]_@aws-sdk_client-s3…` thay vì stub.

## [AI tổng hợp ma trận PLO-CLO từ tài liệu] — ✅ Done

- **AI tổng hợp ma trận** (`synthesizeMatrixFromDocs`): đọc **đề án mở ngành/CTĐT** (Document
  category `ctdt_source`) + các **đề cương học phần** (`syllabus`) đã upload, kết hợp danh
  sách PLO/học phần/CLO trong CSDL, gọi LLM (`aiCompleteJson` + Zod) đề xuất **PLO×học phần
  (I/R/M)** và **CLO→PLO**. Human-in-the-loop: chỉ trả **bản nháp** (lọc bỏ mã PLO lạ) để
  duyệt; nút **"🤖 AI tổng hợp ma trận"** trên trang Ma trận → xem trước → **"Áp dụng vào
  ma trận"** (`applyMatrixMappings` upsert theo mã, idempotent, ghi đè mức ô tương ứng).
- API `POST /api/ai/synthesize-matrix?versionId=` (quyền `ai.use`) + `POST /api/matrices/apply`
  (quyền `data.update`). 103 test (thêm apply idempotent + lọc mã + chặn khi thiếu PLO).

## [Sửa lỗi import CTĐT/upload file trên GCS] — ✅ Done

- **Lỗi**: "Lỗi hệ thống" khi Import Word (CTĐT) / upload file trên prod dùng GCS. Nguyên
  nhân: `@aws-sdk/client-s3` từ 3.729+ mặc định gắn checksum `x-amz-checksum-crc32` vào
  PUT — GCS (S3-compatible) không hỗ trợ → ghi file fail → 500 mù.
- **Fix**: S3Client đặt `requestChecksumCalculation`/`responseChecksumValidation =
  WHEN_REQUIRED` (tương thích GCS/MinIO). Thêm `safePut` bọc lỗi storage thành **502
  `storage_put_failed`** kèm nguyên nhân + hướng xử lý (áp dụng cho upload minh chứng +
  kho tài liệu); log `[STORAGE]` chi tiết ra server log.

## [Import đề cương học phần từ Word/PDF + quản lý file đề cương] — ✅ Done

- **Import đề cương từ .docx/.pdf** (`src/lib/import/syllabus.ts`, thêm `pdf-parse` cho PDF):
  trích mã/tên/tín chỉ/tiên quyết/mô tả/nội dung chương/PP giảng dạy/PP đánh giá/học liệu/
  **CLO** + **ma trận CLO–PLO** — ưu tiên AI (`aiCompleteJson` + Zod), fallback bộ luật bám
  Mẫu 5A/5B ĐHNT. Human-in-the-loop: `POST /api/import/courses/doc` (xem trước + lưu file
  gốc) → `…/doc/apply` (upsert học phần + đề cương + CLO + liên kết CLO–PLO; gắn file với
  học phần và CTĐT chọn ở preview). Nút **"Import Word/PDF (đề cương)"** trên trang Đề cương.
  Kiểm thử trên 2 file đề cương TMAE306 thật: đúng mã, tên, 3 TC, tiên quyết, 5 CLO,
  15 liên kết CLO–PLO, 9 học liệu (kể cả khi AI tắt).
- **Quản lý file đề cương**: `Document` thêm `courseId` (migration `document_course_link`) +
  category **`syllabus`**; lọc tài liệu theo học phần (`GET /api/documents?courseId=`);
  panel **"Tệp đề cương đã upload"** trên trang chi tiết học phần (tải về); kho Tài liệu có
  nhóm "Đề cương học phần". 100 test (thêm 3 test syllabus: luật, apply idempotent, PDF).

## [Import CTĐT từ Word + Kho tài liệu] — ✅ Done

- **Import CTĐT từ file Word (.docx)**: `src/lib/import/docx.ts` trích xuất văn bản (không
  cần thư viện nặng), rồi rút mã ngành / tên / PEO / PLO / danh mục học phần — **ưu tiên AI**
  (`aiCompleteJson`, schema Zod) và **fallback bộ luật** khi AI tắt. Quy trình
  human-in-the-loop: `POST /api/import/programmes/docx` trả **bản xem trước** (chưa ghi) +
  lưu file gốc vào kho Tài liệu; người dùng kiểm tra/sửa rồi `POST …/docx/apply` để
  upsert CTĐT + phiên bản + PEO/PLO + học phần. Nút **"Import Word (CTĐT)"** trên trang CTĐT
  (`DocxImportButton`: trích xuất → xem trước số PEO/PLO/học phần + danh sách → xác nhận).
  Kiểm thử trên file CTĐT thật: lấy đúng mã ngành, 8 PLO, 62 mã học phần kể cả khi AI tắt.
- **Kho tài liệu** (model `Document`, migration `documents`): lưu & quản lý mọi file upload
  (CTĐT gốc, quy chế, biểu mẫu, báo cáo). Lưu qua lớp Storage (GCS/S3 ở prod), soft-delete +
  audit + cách ly tenant. Menu **"Tài liệu"**: tải lên (tiêu đề/nhóm/ghi chú), lọc theo nhóm,
  tải về, xóa. API `/api/documents` (+ `/[id]`, `/[id]/download`). 97 test (thêm docx + tài liệu).

## [Script cấu hình GCS cho Cloud Run] — ✅ Done

- `scripts/setup-gcs.sh`: tự động hóa trọn bộ chuyển storage sang GCS (bucket uniform +
  chặn public, SA `aiqms-storage` + objectAdmin, HMAC key, Secret Manager + cấp quyền cho
  SA Cloud Run, set env `STORAGE_DRIVER=s3` + `S3_*`). Idempotent — chạy lại an toàn,
  `FORCE_NEW_KEY=1` để xoay key. `DEPLOY.md` mục 7b trỏ sang script.

## [Sửa lỗi "Hỏi AI" báo Lỗi hệ thống] — ✅ Done

- **Lỗi**: khi gọi LLM thất bại (sai API key/model/Base URL, mạng…) hoặc API key đã lưu
  không giải mã được (đổi `ENCRYPTION_KEY` giữa các lần deploy), provider ném `Error` thường
  → API trả 500 "Lỗi hệ thống" không có manh mối.
- **Fix**: `aiComplete` chuyển lỗi gọi LLM thành **502 `ai_upstream_error`** kèm chi tiết
  upstream + hướng xử lý ("Kiểm tra API key / Model / Base URL trong menu AI hỗ trợ");
  key không giải mã được → **400 `ai_key_decrypt_failed`** yêu cầu nhập lại key. Lỗi vẫn
  được ghi `AiRequest` để theo dõi. Trợ lý màn hình, viết nháp SAR, tóm tắt MC… đều hiển thị
  thông báo rõ thay vì "Lỗi hệ thống". 92 test (thêm 2 test lỗi upstream/giải mã).

## [Sửa lỗi upload minh chứng trên Cloud Run] — ✅ Done

- **Lỗi**: trên Cloud Run (hệ thống file chỉ-đọc, chỉ `/tmp` ghi được), driver storage
  `local` ghi vào `.storage` → `EROFS` → API trả 500 "Lỗi hệ thống" khi upload file minh chứng.
- **Fix storage**: `LocalStorage` tự dò thư mục gốc ghi được — ưu tiên `STORAGE_LOCAL_DIR`,
  nếu không ghi được thì fallback `os.tmpdir()/aiqms-storage`. Upload chạy được ngay cả khi
  chưa cấu hình S3/GCS (lưu tạm; để lưu bền vững dùng `STORAGE_DRIVER=s3` + bucket GCS/S3).
- **Fix UI**: lỗi upload chỉ hiển thị tại chỗ (ô đỏ dưới vùng kéo-thả), KHÔNG xoá trắng cả
  trang chi tiết minh chứng như trước. Thêm test fallback storage (90 test).

## [Import dữ liệu cho test 28 bước SBI] — ✅ Done

- **Nạp ma trận từ Excel** (`POST /api/import/matrix`, sheet `MaTranPLO` + `CLO_PLO`):
  PLO–học phần (mức I/R/M, chấp nhận nhãn tiếng Việt "Giới thiệu/Củng cố/Thành thạo")
  và CLO–PLO. Nút "Nạp ma trận (Excel)" + file mẫu trên trang Ma trận; tự reload bảng.
- **Nạp dữ liệu C5–C8 từ Excel** (`POST /api/import/institutional`, sheet
  `C5_GiangVien`/`C6_NguoiHoc`/`C7_CoSoVatChat`/`C8_KetQua`): map nhãn tiếng Việt → enum
  (hình thức GV, nhóm dịch vụ, loại CSVC, nhóm outcome). Nút "Nạp Excel C5–C8" + file mẫu
  trên cả 4 trang (Đội ngũ GV / Người học / CSVC / Kết quả đầu ra).
- `ResourcePage` nhận `importEndpoint`/`importLabel`; `pickLike` dò tiêu đề cột theo chuỗi
  con để khoan dung với file người dùng tự soạn. 89 test (thêm import ma trận + C5–C8).

## [Hoàn thiện vận hành kiểm định SBI] — ✅ Done

- **Picker người phụ trách (Nhiệm vụ)**: chọn người được giao bằng dropdown (endpoint
  `GET /api/members` — danh sách rút gọn id+tên, quyền `data.view`); thẻ Kanban hiển thị
  tên + avatar chữ cái người phụ trách (`boardView` join tên người dùng).
- **Xuất Kế hoạch cải tiến**: thêm loại xuất `improvement_docx` (một kế hoạch → Word, kèm
  vấn đề/nguyên nhân + hành động PDCA + KPI) và `improvement_xlsx` (tất cả kế hoạch → Excel,
  2 sheet Hành động/KPI). Nút **"Xuất Word"** ngay trên trang chi tiết + lựa chọn ở trang Xuất.
- **Chỉ số AUN-QA phong phú cho C5–C8** (migration `institutional_aunqa_fields`):
  GV thêm FTE/hình thức tuyển dụng/giới tính/năm tuyển dụng/bồi dưỡng; CSVC thêm diện tích/
  tình trạng/tỷ lệ sử dụng/năm sử dụng; Outcomes thêm mục tiêu/đối sánh/khóa/nguồn dữ liệu;
  Hỗ trợ người học thêm đối tượng/đơn vị/số người hưởng lợi. Cập nhật form + cột danh sách.
- **Nhãn trạng thái SAR tiếng Việt dùng chung** (`SAR_STATE_LABELS`/`sarStateLabel` trong
  state machine) — áp dụng nhất quán ở trình soạn SAR, danh sách SAR và bản xuất Word.
  `StatusBadge` nhận `label` để giữ màu theo trạng thái nhưng hiển thị tiếng Việt.
- **AI hỗ trợ cải tiến (human-in-the-loop)**: `POST /api/ai/suggest-improvement` gợi ý hành
  động PDCA + KPI theo vấn đề/nguyên nhân (validate Zod, không tự ghi DB — người dùng bấm
  "Thêm" mới đưa vào kế hoạch). MockProvider trả JSON "superset" để chạy ổn định ở dev/test.
- 87 test (thêm xuất kế hoạch cải tiến, gợi ý cải tiến AI + chặn khi AI tắt, chỉ số C5–C8).

## [Góp ý rà soát SAR] — ✅ Done

- **Nhận xét / góp ý SAR** (`SarComment`): tab **"Nhận xét / Góp ý"** trong trình soạn SAR
  (`/sars/[id]`) cho cấp khoa & cấp trường ghi góp ý (gắn tiêu chí hoặc góp ý chung) trong
  quy trình rà soát hồ sơ. API `GET/POST /api/sars/[id]/comments` (xem cần `data.view`; góp ý
  cần một trong `sar.review`/`content.approve`/`sar.write`), có ghi audit `sar.comment`.
- **Nhãn trạng thái SAR tiếng Việt** (`SAR_STATUS_VI`) hiển thị trên nút chuyển trạng thái.

## [Frontend nâng cao] — ✅ Done (4 nhiệm vụ)

1. **Trình soạn SAR có panel AI** (`/sars/[id]`): nhập liệu từng tiêu chí + đổi trạng
   thái (state machine) + panel AI "viết nháp" → **duyệt mới ghi vào báo cáo** (human-in-the-loop).
   Modal Tạo SAR (CTĐT→phiên bản, đợt có sẵn/mới).
2. **Upload minh chứng kéo‑thả** (`/evidence/[id]`) + cảnh báo trùng + xác minh; **nút Xuất
   báo cáo** (Word/PDF cho SAR, Excel danh mục minh chứng) qua job + tải về.
3. **Ma trận PLO‑CLO** (`/matrices`): ma trận PLO×học phần (mức I/R/M), CLO↔PLO, **cảnh báo độ phủ**.
4. **4 module dữ liệu kiểm định** (C5–C8): Đội ngũ giảng viên, Người học & hỗ trợ, Cơ sở
   vật chất, Kết quả đầu ra — schema + API (list/create) + UI (`ResourcePage` dùng chung).
   Migration `p9b_institutional`. 77 test (thêm test cách ly tenant cho module mới).

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

## [P6] Dashboard + Nhiệm vụ + Kế hoạch cải tiến (PDCA) — ✅ Done

### Added
- **Schema (tenant-scoped)**: `Task`, `TaskComment`, `ImprovementPlan`,
  `ImprovementAction`, `ImprovementKpi`, `ImprovementProgressLog` — migration
  `p6_tasks_improvement`.
- **Nhiệm vụ**: CRUD + bình luận, **Kanban board** (nhóm theo cột trạng thái),
  calendar (sắp theo dueDate), gán việc, lọc theo trạng thái/người phụ trách.
- **Kế hoạch cải tiến PDCA**: plan → action (phase plan/do/check/act) + KPI +
  log tiến độ (tự cập nhật trạng thái action theo %).
- **Dashboard 3 cấp** (đặc tả 4.1): cấp trường (số CTĐT, SAR theo trạng thái,
  minh chứng theo trạng thái, nhiệm vụ quá hạn, kế hoạch cải tiến mở), cấp chương
  trình (trạng thái từng tiêu chí + điểm tự đánh giá TB), cá nhân (việc được giao/quá hạn).
- **Endpoints**: `/api/tasks` (+`/[id]`, `/[id]/comments`, `?view=board`),
  `/api/improvement-plans` (+`/[id]`, `/actions`, `/kpis`),
  `/api/improvement-actions/[id]/progress`, `/api/dashboard` (+`/me`, `/programme`).

### DoD P6
- [x] Migration `20260608144334_p6_tasks_improvement`; soft-delete Task/ImprovementPlan.
- [x] Test trên Postgres (57 test): Kanban, PDCA + KPI + tiến độ, dashboard 3 cấp,
  **cách ly tenant**. Audit log; list phân trang + index; build/lint/tsc xanh.

## [P7] Xuất báo cáo — ✅ Done

### Added
- **Schema**: `ExportJob` (tenant-scoped) theo dõi tiến độ — migration `p7_export_jobs`.
- **Exporters**: SAR → **Word** (`docx`), SAR → **PDF** (`pdf-lib`, không cần browser),
  danh mục minh chứng → **Excel** (`exceljs`), **gói minh chứng .zip theo tiêu chí** (`jszip`,
  lấy file từ lớp Storage).
- **Job runner** (`src/lib/export/jobs.ts`): tạo job → xử lý (inline theo `JOB_MODE`,
  đặt chỗ cho BullMQ/queue) → lưu kết quả vào Storage → polling tiến độ; lỗi ghi vào job.
- **Endpoints**: `POST /api/exports` (tạo job), `GET /api/exports/[id]` (poll),
  `GET /api/exports/[id]/download` (tải file) — quyền `report.export`.

### DoD P7
- [x] Migration `20260608…_p7_export_jobs`.
- [x] Test trên Postgres (62 test): xuất Word/PDF/Excel/zip (kiểm tra magic bytes),
  polling job, **cách ly tenant** (job A không thấy ở B). Tác vụ nặng qua job + Storage.
- [x] Audit log; build/lint/tsc xanh.

## [P8] Lớp AI (cuối cùng) — ✅ Done (MVP AI)

Lớp AI là **service có kiểm soát** (bài học #5, #6), không phải lời gọi rải rác.

### Added
- **Schema (tenant-scoped)**: `AiSettings` (khóa API mã hóa, hạn mức, bật/tắt module),
  `AiRequest` (log token/chi phí), `AiGeneratedDraft` (human-in-the-loop) — migration `p8_ai`.
- **Mã hóa khóa API theo tenant**: AES-256-GCM, prefix phiên bản `v1:` để xoay khóa.
- **Abstraction đa nhà cung cấp**: interface `LlmProvider` + `OpenAiProvider`
  (OpenAI-compatible) + `MockProvider` (dev/test, không gửi dữ liệu ra ngoài).
- **LLM service**: kill-switch toàn cục (`AI_ENABLED`) + bật theo tenant/module,
  **hạn mức token/ngày**, **semaphore concurrency**, retry/backoff, **đo token + chi phí**,
  validate output JSON bằng Zod (`aiCompleteJson`).
- **Tính năng AI MVP** (đặc tả 12): tóm tắt minh chứng, **viết nháp SAR**, kiểm tra
  khoảng trống. **Human-in-the-loop**: nội dung AI = `AiGeneratedDraft` (source=ai,
  status=draft) — chỉ vào SAR chính thức **sau khi duyệt** (`approveDraft`).
- **Endpoints**: `/api/ai/settings` (GET/PUT), `/api/ai/summarize-evidence`,
  `/api/ai/draft-sar`, `/api/ai/drafts/[id]/approve|reject`, `/api/ai/gap-check`,
  `/api/ai/usage` (chi phí/token cho admin).

### DoD P8
- [x] Migration `20260608150112_p8_ai`.
- [x] Test trên Postgres (70 test): mã hóa khóa roundtrip, AI tắt → 403, nháp =
  draft cho tới khi duyệt mới vào SAR, hạn mức token chặn, log token, gap-check chạy
  khi AI tắt, **cách ly tenant** bản nháp. Audit log thao tác AI; build/lint/tsc xanh.

### Hoãn sang P9 (cần thêm hạ tầng)
- Chatbot RAG (pgvector embeddings + lọc quyền) và mock interview — ghi nhận trong P9.

## [P9] Nâng cao — ✅ Done (phần trọng tâm)

### Added
- **Bộ tiêu chuẩn Bộ GD&ĐT (MOET) — thêm bằng NẠP DỮ LIỆU** (chứng minh quyết định
  kiến trúc quan trọng nhất của P2): tổng quát hóa seeder thành `seedStandard(db, dataset)`,
  thêm `StandardDataset` type + `MOET` dataset (11 tiêu chuẩn, thang 7 mức). Seed cùng
  AUN-QA. **SAR chạy với MOET tự sinh 11 response — KHÔNG sửa code lõi.**
- **Module khảo sát bên liên quan** (đặc tả 4.8): schema `StakeholderGroup`, `Survey`,
  `SurveyQuestion`, `SurveyResponse` — migration `p9_surveys`. Vòng đời tạo → câu hỏi →
  mở (token link công khai) → nộp ẩn danh qua token → phân tích kết quả (TB rating). Gắn
  khảo sát với tiêu chí.
- **Endpoints**: `/api/surveys` (+`/[id]`, `/questions`, `/open`, `/results`),
  công khai `/api/survey/[token]` (GET form + POST nộp, không cần đăng nhập).

### DoD P9
- [x] Migration `p9_surveys`; soft-delete Survey.
- [x] Test trên Postgres (75 test): MOET data-driven + SAR dùng MOET; vòng đời khảo
  sát + phân tích + nộp công khai; **cách ly tenant**. Build/lint/tsc xanh.

### Còn lại (advanced — cần hạ tầng/đầu mục riêng, ghi nhận để làm sau)
- Chatbot RAG (pgvector embeddings + lọc quyền) và mock interview phỏng vấn (cần lớp
  embeddings + AI thật).
- Import đề cương học phần từ Word/Excel (parser tài liệu).
- Tích hợp LMS/SIS/HRM (kết nối hệ thống ngoài).


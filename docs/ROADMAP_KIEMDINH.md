# Roadmap hoàn thiện quy trình kiểm định AUN-QA — AIQMS

> Danh sách rà soát ngày 2026-06 (làm lần lượt, commit sau mỗi mục).

## C. Chưa đồng bộ (nối liền)
- [x] C1. SAR tự tổng hợp dữ liệu — workspace tiêu chí (minh chứng đã gắn + gợi ý) + ma trận/C5-C8/khảo sát đưa vào bản xuất (C2/D1)
- [x] C2. Bản xuất SAR đầy đủ phụ lục (10 ma trận, C5–C8, khảo sát, điểm hội đồng)
- [x] C3. Tạo kế hoạch cải tiến từ điểm yếu (gap-check/đánh giá nội bộ) — nút "Tạo cải tiến từ điểm tồn tại" ở SAR (=D6)
- [x] C4. Khảo sát → C8 (nút "Đưa vào C8" tổng hợp rating → OutcomeMetric satisfaction); ma trận PLO–Bên liên quan đã có sẵn (dimension stakeholder)

## D. Chức năng còn thiếu (build)
### Ưu tiên cao
- [x] D1. Xuất hồ sơ SAR đầy đủ (SAR + ma trận + C5–C8 + điểm hội đồng + danh mục MC) → Word
- [x] D2. Workspace theo tiêu chí trong SAR (minh chứng đã gắn + số liệu + checklist 53 yêu cầu)
- [x] D3. Chấm theo 53 yêu cầu (sub-criteria): checklist mức đáp ứng từng yêu cầu

### Ưu tiên trung bình
- [x] D4. Bảng theo dõi tiến độ đợt (% theo tiêu chí, MC đã thu, ai trễ hạn) — panel ở chi tiết đợt
- [x] D5. Email + nhắc hạn tự động (SMTP) — mailer abstraction (log|smtp) + dueReminders + nút "Gửi nhắc hạn"
- [x] D6. Tạo cải tiến từ điểm yếu (= C3)
- [x] D7. Đo lường mức đạt PLO (PLO attainment) theo khóa/kỳ → C8 — tab "Mức đạt PLO → C8" ở Ma trận

### Ưu tiên thấp
- [x] D8. Module Đánh giá ngoài (đoàn ĐGN chấm, lịch khảo sát, khuyến nghị, kết luận) — tab "Đánh giá ngoài" ở SAR
- [x] D9. Đối sánh (benchmarking) với CT tham chiếu — trang "Đối sánh" so sánh C8 với mốc/chỉ tiêu
- [x] D10. Quản lý phiên bản tài liệu (version chain) — tải bản mới + lịch sử phiên bản ở Tài liệu

## Tiến độ
- ✅ HOÀN THÀNH toàn bộ C1–C4 và D1–D10 (xem CHANGELOG.md). Mỗi mục đã có service + API +
  UI + test trên PostgreSQL và được commit riêng.

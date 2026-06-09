/**
 * Sinh tài liệu Word: "Tổng hợp chức năng & Hướng dẫn sử dụng AIQMS".
 * Chạy: npx tsx scripts/gen-userguide.ts
 */
import { promises as fs, readFileSync, existsSync } from "node:fs";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, LevelFormat, ImageRun,
} from "docx";

const ACCENT = "1F4E79";

const h1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 120 }, children: [new TextRun({ text: t, color: ACCENT, bold: true })] });
const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: t, bold: true })] });
const h3 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 140, after: 60 }, children: [new TextRun({ text: t, bold: true, italics: true })] });
const p = (t: string) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun(t)] });
const bullet = (t: string) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 }, children: [new TextRun(t)] });
const step = (t: string) => new Paragraph({ numbering: { reference: "steps", level: 0 }, spacing: { after: 40 }, children: [new TextRun(t)] });
const note = (t: string) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Lưu ý: ", bold: true, color: "B7791F" }), new TextRun({ text: t, italics: true })] });

function cell(text: string, opts: { bold?: boolean; bg?: string; w?: number } = {}) {
  return new TableCell({
    width: opts.w ? { size: opts.w, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.bg ? { fill: opts.bg } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold })] })],
  });
}
function table(headers: string[], rows: string[][], widths?: number[]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((hd, i) => cell(hd, { bold: true, bg: "DCE6F1", w: widths?.[i] })),
  });
  const bodyRows = rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { w: widths?.[i] })) }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
    },
    rows: [headerRow, ...bodyRows],
  });
}

const children: (Paragraph | Table)[] = [];

// Nhúng ảnh chụp màn hình + ghi chú (1-2 dòng) ngay dưới ảnh.
const IMG_W = 600, IMG_H = 375; // 1280x800 -> tỉ lệ 16:10
function img(file: string, caption: string) {
  const path = `docs/screenshots/${file}.png`;
  if (existsSync(path)) {
    children.push(new Paragraph({
      spacing: { before: 100, after: 20 }, alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: "png", data: readFileSync(path), transformation: { width: IMG_W, height: IMG_H } })],
    }));
  }
  children.push(new Paragraph({
    spacing: { after: 140 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "▲ " + caption, italics: true, size: 18, color: "555555" })],
  }));
}

// ─── Trang bìa ───────────────────────────────────────────────────────────────
children.push(
  new Paragraph({ spacing: { before: 1200, after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "HỆ THỐNG AIQMS", bold: true, size: 56, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "Quản lý & Kiểm định Chương trình đào tạo theo chuẩn AUN-QA", size: 30 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "(Kiến trúc đa tiêu chuẩn — hỗ trợ thêm bộ tiêu chuẩn Bộ GD&ĐT)", italics: true, size: 24, color: "666666" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TÀI LIỆU TỔNG HỢP CHỨC NĂNG & HƯỚNG DẪN SỬ DỤNG", bold: true, size: 30 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: "Phục vụ tập huấn cán bộ — dùng cho mọi vai trò người dùng", size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 }, children: [new TextRun({ text: "Phiên bản 1.0", italics: true, size: 22, color: "666666" })] }),
  new Paragraph({ pageBreakBefore: true, children: [] }),
);

// ─── 1. Giới thiệu ───────────────────────────────────────────────────────────
children.push(h1("1. Giới thiệu hệ thống"));
children.push(p("AIQMS là nền tảng web hỗ trợ trường đại học quản lý, tự đánh giá và chuẩn bị kiểm định chương trình đào tạo (CTĐT) theo chuẩn AUN-QA ở cấp chương trình. Hệ thống thiết kế đa tiêu chuẩn: ngoài AUN-QA v4.0 (8 tiêu chí, thang đánh giá 7 mức), có thể bổ sung bộ tiêu chuẩn của Bộ GD&ĐT và các chuẩn khác chỉ bằng nạp dữ liệu cấu hình."));
children.push(p("Hệ thống là multi-tenant (nhiều trường dùng chung nền tảng nhưng dữ liệu cách ly tuyệt đối) và phân quyền theo vai trò (RBAC)."));
children.push(h2("Các nhóm chức năng chính"));
[
  "Quản lý CTĐT đa phiên bản; mục tiêu (PEO), chuẩn đầu ra (PLO), đề cương học phần, chuẩn đầu ra học phần (CLO).",
  "Ma trận liên kết PLO–học phần, CLO–PLO và cảnh báo độ phủ.",
  "Cấu hình bộ tiêu chuẩn kiểm định (AUN-QA, MOET…).",
  "Quản lý đợt tự đánh giá và Báo cáo tự đánh giá (SAR) theo từng tiêu chí, có trợ lý AI.",
  "Đánh giá nội bộ: chấm điểm theo tiêu chí, tổng hợp/so sánh giữa các thành viên hội đồng.",
  "Kho minh chứng số: upload nhiều file, tự đánh mã, chống trùng, liên kết nhiều tiêu chí, xác minh.",
  "Dữ liệu phục vụ tiêu chí: đội ngũ giảng viên, người học & hỗ trợ, cơ sở vật chất, kết quả đầu ra.",
  "Quản lý nhiệm vụ (Kanban), kế hoạch cải tiến (PDCA), khảo sát các bên liên quan.",
  "Xuất báo cáo: SAR ra Word/PDF, danh mục minh chứng ra Excel, gói minh chứng ZIP.",
  "Trợ lý AI: tóm tắt minh chứng, viết nháp SAR (có người duyệt), kiểm tra khoảng trống hồ sơ.",
  "Trợ lý hướng dẫn theo màn hình: nút “?” ở mọi trang chỉ rõ “việc cần làm” + ô Hỏi AI.",
  "Quản trị: người dùng, vai trò, khoa/bộ môn; cấu hình AI; theo dõi chi phí token.",
].forEach((t) => children.push(bullet(t)));

// ─── 2. Đăng nhập & tài khoản ────────────────────────────────────────────────
children.push(h1("2. Đăng nhập và tài khoản"));
children.push(step("Mở địa chỉ hệ thống do nhà trường cung cấp."));
children.push(step("Tại trang đăng nhập, nhập Mã trường (tenant) — ví dụ: demo, mã trường của đơn vị bạn."));
children.push(step("Nhập Email và Mật khẩu được cấp, bấm Đăng nhập."));
children.push(step("Sau khi vào, thanh menu bên trái hiển thị các chức năng theo quyền của bạn."));
children.push(note("Mỗi tài khoản thuộc một trường (tenant). Dữ liệu giữa các trường được cách ly hoàn toàn. Đổi mật khẩu mặc định ngay sau lần đăng nhập đầu tiên."));
img("01-login", "Màn hình đăng nhập: nhập Mã trường (tenant), Email, Mật khẩu rồi bấm Đăng nhập.");
children.push(h2("Tài khoản mẫu (môi trường demo)"));
children.push(table(
  ["Tài khoản", "Email", "Mật khẩu", "Mã trường"],
  [
    ["Quản trị trường (demo)", "admin@demo.local", "Demo1234!", "demo"],
    ["Quản trị hệ thống (super-admin)", "superadmin@aiqms.local", "ChangeMe123!", "system"],
  ],
  [28, 30, 22, 20],
));

// ─── 3. Vai trò người dùng ───────────────────────────────────────────────────
children.push(h1("3. Các vai trò người dùng (RBAC)"));
children.push(p("Hệ thống phân quyền theo vai trò; mỗi người dùng có thể giữ nhiều vai trò. Nút/chức năng tự ẩn hoặc báo lỗi nếu thiếu quyền."));
children.push(table(
  ["Vai trò", "Nhiệm vụ chính", "Quyền tiêu biểu"],
  [
    ["Quản trị hệ thống (Super Admin)", "Quản trị nền tảng, cấu hình bộ tiêu chuẩn, xuyên trường", "Toàn quyền"],
    ["Phòng Khảo thí & ĐBCL (qa_office)", "Điều phối quy trình kiểm định toàn trường, rà soát, duyệt", "Xem/tạo/sửa, xác minh minh chứng, rà soát SAR, duyệt nội dung, xuất báo cáo, quản trị người dùng, dùng AI"],
    ["Ban Chủ nhiệm CTĐT (programme_committee)", "Nhóm làm việc chính của chương trình", "Quản lý CTĐT, viết SAR, upload minh chứng, xuất báo cáo, dùng AI"],
    ["Khoa / Bộ môn (faculty)", "Theo dõi, duyệt nội dung cấp khoa", "Xem, cập nhật, duyệt nội dung, xuất báo cáo, dùng AI"],
    ["Giảng viên (lecturer)", "Cung cấp dữ liệu, minh chứng học phần", "Xem, cập nhật học phần, upload minh chứng, dùng AI"],
    ["Hội đồng rà soát nội bộ (internal_reviewer)", "Rà soát, chấm điểm trước đánh giá ngoài", "Xem, rà soát SAR, chấm điểm nội bộ"],
    ["Lãnh đạo trường (leadership)", "Xem dashboard tổng quan, báo cáo tổng hợp", "Xem dữ liệu, xuất báo cáo"],
    ["Đánh giá viên ngoài / Khách (external_assessor)", "Xem hồ sơ được cấp quyền", "Xem dữ liệu (giới hạn)"],
  ],
  [26, 38, 36],
));

// ─── 4. Tổng quan menu ───────────────────────────────────────────────────────
children.push(h1("4. Tổng quan menu chức năng"));
children.push(table(
  ["Nhóm", "Mục menu", "Công dụng"],
  [
    ["Tổng quan", "Dashboard", "Số liệu tiến độ kiểm định toàn trường + việc của tôi"],
    ["Kiểm định", "Chương trình đào tạo", "Hồ sơ CTĐT, phiên bản, PEO/PLO"],
    ["Kiểm định", "Ma trận PLO-CLO", "Liên kết PLO–học phần, CLO–PLO, cảnh báo độ phủ"],
    ["Kiểm định", "Đề cương học phần", "Học phần, CLO, đề cương chi tiết"],
    ["Kiểm định", "Bộ tiêu chuẩn", "Xem tiêu chí và thang điểm (AUN-QA, MOET)"],
    ["Kiểm định", "Đợt tự đánh giá", "Tạo/đóng đợt, theo dõi SAR trong đợt"],
    ["Kiểm định", "Báo cáo tự đánh giá (SAR)", "Soạn SAR theo tiêu chí, AI hỗ trợ, đánh giá nội bộ"],
    ["Kiểm định", "Minh chứng", "Kho minh chứng, upload, liên kết tiêu chí, xác minh"],
    ["Dữ liệu kiểm định", "Đội ngũ giảng viên", "Dữ liệu cho tiêu chí C5"],
    ["Dữ liệu kiểm định", "Người học & hỗ trợ", "Dữ liệu cho tiêu chí C6"],
    ["Dữ liệu kiểm định", "Cơ sở vật chất", "Dữ liệu cho tiêu chí C7"],
    ["Dữ liệu kiểm định", "Kết quả đầu ra", "Dữ liệu cho tiêu chí C8"],
    ["Theo dõi & cải tiến", "Nhiệm vụ", "Bảng Kanban giao việc, theo dõi tiến độ"],
    ["Theo dõi & cải tiến", "Kế hoạch cải tiến", "Chu trình PDCA, hành động, KPI"],
    ["Theo dõi & cải tiến", "Khảo sát bên liên quan", "Tạo khảo sát, link công khai, phân tích"],
    ["Theo dõi & cải tiến", "Xuất báo cáo", "Tạo yêu cầu xuất và tải file"],
    ["Quản trị", "Người dùng & đơn vị", "Tài khoản, vai trò, khoa/bộ môn"],
    ["Quản trị", "AI hỗ trợ", "Cấu hình AI, chi phí, kiểm tra khoảng trống"],
  ],
  [22, 34, 44],
));

// ─── 5. Hướng dẫn theo module ────────────────────────────────────────────────
children.push(h1("5. Hướng dẫn sử dụng theo chức năng"));

children.push(h2("5.1. Dashboard"));
children.push(p("Hiển thị số liệu tổng quan: số CTĐT, số SAR, minh chứng hợp lệ, nhiệm vụ quá hạn, SAR/minh chứng theo trạng thái, kế hoạch cải tiến đang mở, và mục “Việc của tôi” (nhiệm vụ quá hạn/sắp tới)."));

img("02-dashboard", "Dashboard: số liệu tổng quan toàn trường và mục “Việc của tôi”.");
children.push(h2("5.2. Chương trình đào tạo"));
children.push(step("Vào menu Chương trình đào tạo, bấm “+ Tạo CTĐT”, nhập mã ngành, tên, trình độ."));
children.push(step("Bấm vào tên chương trình để mở trang chi tiết."));
children.push(step("Chọn/khởi tạo Phiên bản; mỗi phiên bản có vòng đời: nháp → áp dụng → lưu trữ."));
children.push(step("Trong phiên bản, thêm Mục tiêu (PEO) và Chuẩn đầu ra (PLO)."));
children.push(note("Quản lý đa phiên bản giúp theo dõi quá trình cải tiến CTĐT qua các năm."));

img("03-programmes-list", "Danh sách CTĐT — bấm “+ Tạo CTĐT” để thêm, bấm tên để mở chi tiết.");
img("04-programme-create", "Hộp thoại tạo CTĐT: nhập mã ngành, tên, trình độ.");
img("05-programme-detail", "Chi tiết CTĐT: chọn phiên bản, đổi trạng thái, quản lý PEO/PLO.");
children.push(h2("5.3. Ma trận PLO-CLO & độ phủ"));
children.push(step("Chọn Chương trình và Phiên bản."));
children.push(step("Thêm PLO và học phần (nếu chưa có)."));
children.push(step("Trong ma trận PLO × học phần, bấm vào ô để gán mức đóng góp I (giới thiệu) → R (củng cố) → M (thành thạo)."));
children.push(step("Liên kết CLO ↔ PLO theo từng học phần."));
children.push(step("Xem bảng Cảnh báo độ phủ để phát hiện PLO chưa có học phần/CLO, CLO chưa liên kết PLO."));

img("06-matrices", "Ma trận PLO×học phần (bấm ô đặt mức I/R/M), CLO↔PLO và cảnh báo độ phủ.");
children.push(h2("5.4. Đề cương học phần"));
children.push(step("Vào menu Đề cương học phần, bấm “+ Thêm học phần” (mã, tên, tín chỉ)."));
children.push(step("Bấm tên học phần để mở chi tiết; nhập đề cương: mô tả, tiên quyết, nội dung, phương pháp giảng dạy, phương pháp đánh giá, tài liệu, rubric."));
children.push(step("Thêm các CLO của học phần ở panel bên phải; bấm Lưu đề cương."));

img("07-courses-list", "Danh sách học phần — bấm tên để mở đề cương.");
img("08-course-detail", "Chi tiết đề cương học phần và quản lý CLO ở panel bên phải.");
children.push(h2("5.5. Bộ tiêu chuẩn"));
children.push(p("Xem danh sách bộ tiêu chuẩn (AUN-QA, MOET…), bấm để xem các tiêu chí và thang đánh giá. Việc thêm/sửa bộ tiêu chuẩn do Quản trị hệ thống thực hiện (nạp dữ liệu, không cần sửa phần mềm)."));

img("09-standards", "Bộ tiêu chuẩn: chọn AUN-QA/MOET để xem tiêu chí và thang đánh giá 7 mức.");
children.push(h2("5.6. Đợt tự đánh giá"));
children.push(step("Vào menu Đợt tự đánh giá, bấm “+ Tạo đợt”, nhập tên, năm, chọn bộ tiêu chuẩn áp dụng."));
children.push(step("Mở chi tiết đợt để tạo SAR cho từng chương trình, theo dõi danh sách SAR."));
children.push(step("Khi hoàn tất, bấm “Đóng đợt”."));

img("10-cycles-list", "Danh sách đợt tự đánh giá kèm số SAR và trạng thái.");
img("11-cycle-detail", "Chi tiết đợt: đóng/mở đợt và tạo SAR cho từng chương trình.");
children.push(h2("5.7. Báo cáo tự đánh giá (SAR) — module trung tâm"));
children.push(h3("a) Tạo SAR"));
children.push(step("Từ menu SAR (hoặc trong chi tiết Đợt), bấm “+ Tạo SAR”."));
children.push(step("Chọn Chương trình → Phiên bản, chọn Đợt (hoặc tạo đợt mới), nhập tiêu đề. Hệ thống tự sinh ô nhập cho từng tiêu chí của bộ tiêu chuẩn."));
children.push(h3("b) Soạn báo cáo (tab “Soạn báo cáo”)"));
children.push(step("Chọn tiêu chí cần viết."));
children.push(step("Nhập: Mô tả hiện trạng, Phân tích mức độ đáp ứng, Điểm mạnh, Điểm tồn tại, Cải tiến đã thực hiện, Kế hoạch cải tiến, Điểm tự đánh giá (1–7), Trạng thái."));
children.push(step("Bấm Lưu."));
children.push(h3("c) Trợ lý AI (panel bên phải)"));
children.push(step("Chọn mục cần viết (Phân tích/Điểm mạnh/Điểm tồn tại), bấm “AI viết nháp”."));
children.push(step("Xem bản nháp do AI tạo; nếu phù hợp bấm “Duyệt & ghi vào báo cáo”, hoặc “Bỏ”."));
children.push(note("Nội dung AI luôn là BẢN NHÁP và chỉ vào báo cáo chính thức sau khi người phụ trách duyệt (human-in-the-loop)."));
children.push(h3("d) Đổi trạng thái & xuất"));
children.push(step("Dùng các nút chuyển trạng thái SAR theo quy trình (thu thập → viết → rà soát khoa → rà soát trường → hoàn thành nội bộ → sẵn sàng đánh giá ngoài…)."));
children.push(step("Bấm Xuất Word/Xuất PDF để tải báo cáo."));
children.push(h3("e) Đánh giá nội bộ (tab “Đánh giá nội bộ”)"));
children.push(step("Thành viên hội đồng bấm “Mở phiên rà soát của tôi”."));
children.push(step("Chấm điểm 1–7 và ghi khuyến nghị cho từng tiêu chí, bấm Lưu."));
children.push(step("Cột “Tổng hợp hội đồng” hiển thị số người chấm, điểm trung bình, thấp nhất–cao nhất."));

img("12-sars-list", "Danh sách SAR — bấm “+ Tạo SAR” hoặc bấm tiêu đề để soạn.");
img("13-sar-create", "Hộp thoại tạo SAR: chọn CTĐT→phiên bản và đợt, nhập tiêu đề.");
img("14-sar-editor", "Trình soạn SAR: nhập liệu từng tiêu chí, chấm điểm, đổi trạng thái.");
img("15-sar-ai", "Panel AI: bấm “AI viết nháp”, xem bản nháp rồi “Duyệt & ghi vào báo cáo”.");
img("16-sar-review", "Tab Đánh giá nội bộ: chấm điểm và tổng hợp/so sánh giữa các thành viên.");
children.push(h2("5.8. Minh chứng"));
children.push(step("Vào menu Minh chứng, bấm “+ Thêm minh chứng” (tên, năm học). Hệ thống tự đánh mã MC-XXXX."));
children.push(step("Bấm tên minh chứng để mở chi tiết."));
children.push(step("Kéo-thả nhiều file vào vùng upload (hệ thống cảnh báo nếu file trùng nội dung)."));
children.push(step("Ở panel “Tiêu chí liên kết”, chọn tiêu chí để gắn — một minh chứng có thể liên kết nhiều tiêu chí."));
children.push(step("Ở panel Xác minh, cập nhật trạng thái: chờ xác minh / hợp lệ / cần bổ sung / không phù hợp."));

img("17-evidence-list", "Kho minh chứng: tự đánh mã MC-XXXX, lọc, bấm tên để mở chi tiết.");
img("18-evidence-detail", "Chi tiết minh chứng: kéo-thả upload file, liên kết tiêu chí, xác minh.");
children.push(h2("5.9. Dữ liệu phục vụ tiêu chí (C5–C8)"));
children.push(p("Bốn menu trong nhóm “Dữ liệu kiểm định” cho phép nhập và tra cứu: Đội ngũ giảng viên (C5), Người học & hỗ trợ (C6), Cơ sở vật chất (C7), Kết quả đầu ra (C8). Mỗi mục có nút “+ Thêm” và bảng danh sách có phân trang."));

img("19-academic-staff", "Đội ngũ giảng viên (tiêu chí C5).");
img("20-students", "Người học & dịch vụ hỗ trợ (tiêu chí C6).");
img("21-facilities", "Cơ sở vật chất (tiêu chí C7).");
img("22-outcomes", "Kết quả đầu ra (tiêu chí C8).");
children.push(h2("5.10. Nhiệm vụ (Kanban)"));
children.push(step("Bấm “+ Tạo nhiệm vụ” (tiêu đề, mô tả, ưu tiên, hạn)."));
children.push(step("Kéo-thả thẻ giữa các cột Cần làm → Đang làm → Rà soát → Hoàn thành để cập nhật trạng thái."));

img("23-tasks", "Bảng Kanban: kéo-thả thẻ giữa các cột để đổi trạng thái nhiệm vụ.");
children.push(h2("5.11. Kế hoạch cải tiến (PDCA)"));
children.push(step("Bấm “+ Tạo kế hoạch” (tiêu đề, vấn đề, nguyên nhân)."));
children.push(step("Mở chi tiết để thêm Hành động theo pha PDCA (Plan/Do/Check/Act) và ghi nhận tiến độ (%)."));
children.push(step("Thêm KPI (mục tiêu/đơn vị) để đo lường kết quả cải tiến."));

img("24-improvement-list", "Danh sách kế hoạch cải tiến — bấm tên để mở chi tiết.");
img("25-improvement-detail", "Chi tiết: hành động theo pha PDCA, log tiến độ và KPI.");
children.push(h2("5.12. Khảo sát bên liên quan"));
children.push(step("Bấm “+ Tạo khảo sát”, mở chi tiết và thêm câu hỏi (thang điểm/tự luận/lựa chọn)."));
children.push(step("Bấm “Mở khảo sát” để sinh link công khai; gửi link cho sinh viên/cựu SV/nhà tuyển dụng."));
children.push(step("Người ngoài mở link điền trực tiếp, không cần tài khoản."));
children.push(step("Theo dõi Kết quả (số phản hồi, điểm trung bình) trong trang chi tiết."));

img("26-surveys-list", "Danh sách khảo sát.");
img("27-survey-detail", "Chi tiết khảo sát: thêm câu hỏi, mở khảo sát (sinh link công khai), xem kết quả.");
img("28-survey-public", "Trang công khai: người ngoài điền khảo sát qua link, không cần đăng nhập.");
children.push(h2("5.13. Xuất báo cáo"));
children.push(step("Vào menu Xuất báo cáo, chọn loại (SAR→Word, SAR→PDF, Danh mục minh chứng→Excel, Gói minh chứng→ZIP)."));
children.push(step("Nếu là SAR, chọn báo cáo cần xuất; bấm “Tạo & xuất”."));
children.push(step("Khi trạng thái là “done”, bấm “Tải” ở dòng tương ứng để tải file."));

img("29-exports", "Xuất báo cáo: chọn loại, tạo yêu cầu và tải file khi hoàn tất.");
children.push(h2("5.14. Người dùng & đơn vị (Quản trị)"));
children.push(step("Tab Người dùng: bấm “+ Tạo người dùng”, nhập họ tên/email/mật khẩu và tích chọn vai trò."));
children.push(step("Tab Khoa/Bộ môn: thêm Khoa, sau đó thêm Bộ môn (chọn khoa)."));

img("30-users", "Quản lý người dùng: tạo tài khoản và gán vai trò (RBAC).");
img("31-users-org", "Quản lý Khoa/Bộ môn.");
children.push(h2("5.15. AI hỗ trợ (Quản trị)"));
children.push(step("Bật/tắt AI cho trường; chọn nhà cung cấp, model, nhập API Key (được mã hóa khi lưu) và hạn mức token/ngày."));
children.push(step("Theo dõi chi phí & token đã dùng."));
children.push(step("Dùng công cụ “Kiểm tra khoảng trống”: chọn SAR để liệt kê tiêu chí còn thiếu minh chứng/phân tích/điểm."));
children.push(note("Nếu không nhập API Key, hệ thống dùng chế độ mô phỏng (mock) để minh họa — không gửi dữ liệu ra ngoài."));

// ─── 6. Hướng dẫn theo vai trò ───────────────────────────────────────────────
img("32-ai-hub", "AI hỗ trợ: cấu hình AI, theo dõi chi phí/token, kiểm tra khoảng trống.");

children.push(h2("5.16. Trợ lý hướng dẫn theo màn hình (AI)"));
children.push(p("Ở MỌI màn hình đều có nút tròn “?” màu tím ở góc dưới bên phải. Bấm vào để mở bảng trợ lý hướng dẫn."));
children.push(step("Bấm nút “?” (góc dưới phải) để mở bảng Trợ lý hướng dẫn."));
children.push(step("Đọc mục “Việc cần làm tại màn hình này” — các bước thao tác cụ thể cho đúng màn hình bạn đang xem."));
children.push(step("Cần hỏi sâu hơn: gõ câu hỏi vào ô “Hỏi AI về màn hình này” rồi bấm “Hỏi AI” để nhận hướng dẫn từng bước."));
children.push(note("Phần hướng dẫn hiển thị ngay cho mọi người dùng (không cần AI). Ô “Hỏi AI” cần Quản trị bật AI cho trường (menu AI hỗ trợ)."));
img("33-help-assistant", "Bảng Trợ lý hướng dẫn: việc cần làm tại màn hình hiện tại + ô Hỏi AI.");

children.push(h1("6. Hướng dẫn theo từng vai trò"));

children.push(h2("6.1. Quản trị hệ thống / Phòng ĐBCL"));
[
  "Khởi tạo dữ liệu nền: tạo Khoa/Bộ môn, tạo người dùng và gán vai trò.",
  "Cấu hình AI (nếu dùng) và kiểm soát hạn mức/chi phí.",
  "Tạo Đợt tự đánh giá và phân công CTĐT tham gia.",
  "Theo dõi tiến độ qua Dashboard; rà soát SAR, xác minh minh chứng, duyệt nội dung.",
  "Tổ chức rà soát nội bộ và xuất báo cáo tổng hợp.",
].forEach((t) => children.push(bullet(t)));

children.push(h2("6.2. Ban Chủ nhiệm chương trình đào tạo"));
[
  "Khai báo hồ sơ CTĐT, phiên bản, PEO/PLO; xây dựng ma trận PLO-CLO.",
  "Tạo SAR cho chương trình, phân công viết từng tiêu chí.",
  "Soạn nội dung SAR (có thể dùng AI viết nháp rồi duyệt).",
  "Upload và liên kết minh chứng cho từng tiêu chí.",
  "Lập kế hoạch cải tiến và theo dõi nhiệm vụ.",
].forEach((t) => children.push(bullet(t)));

children.push(h2("6.3. Giảng viên / Chủ nhiệm học phần"));
[
  "Cập nhật đề cương học phần và khai báo CLO.",
  "Upload minh chứng liên quan đến học phần (đề thi, rubric, kết quả học tập…).",
  "Thực hiện các nhiệm vụ được giao trên bảng Kanban.",
].forEach((t) => children.push(bullet(t)));

children.push(h2("6.4. Hội đồng rà soát nội bộ"));
[
  "Mở SAR ở tab “Đánh giá nội bộ”, mở phiên rà soát của mình.",
  "Chấm điểm từng tiêu chí và ghi điểm mạnh/điểm tồn tại/khuyến nghị.",
  "Tham khảo bảng tổng hợp để thống nhất điểm giữa các thành viên.",
].forEach((t) => children.push(bullet(t)));

children.push(h2("6.5. Lãnh đạo trường"));
[
  "Theo dõi Dashboard: tiến độ chuẩn bị, mức độ đáp ứng, điểm yếu nổi bật.",
  "Xem và xuất các báo cáo tổng hợp phục vụ chỉ đạo.",
].forEach((t) => children.push(bullet(t)));

children.push(h2("6.6. Đánh giá viên ngoài / Khách"));
[
  "Truy cập hồ sơ được cấp quyền: xem SAR, danh mục minh chứng.",
  "Quyền chỉ ở mức xem theo phân quyền của nhà trường.",
].forEach((t) => children.push(bullet(t)));

// ─── 7. Quy trình kiểm định gợi ý ────────────────────────────────────────────
children.push(h1("7. Quy trình kiểm định gợi ý (end-to-end)"));
[
  "Bước 1 — Chuẩn bị nền: tạo người dùng/đơn vị; xác nhận bộ tiêu chuẩn áp dụng.",
  "Bước 2 — Hồ sơ CTĐT: khai báo CTĐT, phiên bản, PEO/PLO, đề cương, ma trận PLO-CLO; xử lý cảnh báo độ phủ.",
  "Bước 3 — Mở Đợt tự đánh giá và tạo SAR cho từng chương trình.",
  "Bước 4 — Thu thập minh chứng: upload, đánh mã, liên kết tiêu chí, xác minh.",
  "Bước 5 — Viết SAR theo tiêu chí (dùng AI hỗ trợ), chấm điểm tự đánh giá.",
  "Bước 6 — Rà soát nội bộ: hội đồng chấm điểm, tổng hợp, thống nhất.",
  "Bước 7 — Hoàn thiện & xuất: chuyển trạng thái SAR, xuất Word/PDF, xuất danh mục/gói minh chứng.",
  "Bước 8 — Sau đánh giá: lập kế hoạch cải tiến (PDCA), theo dõi KPI và nhiệm vụ.",
].forEach((t) => children.push(step(t)));

// ─── 8. Mẹo & câu hỏi thường gặp ─────────────────────────────────────────────
children.push(h1("8. Mẹo và câu hỏi thường gặp"));
children.push(h3("Vì sao tôi không thấy/không bấm được một nút?"));
children.push(p("Do vai trò của bạn không có quyền tương ứng. Liên hệ quản trị để được gán thêm vai trò (menu Người dùng & đơn vị)."));
children.push(h3("AI báo “đang tắt”?"));
children.push(p("Quản trị cần bật AI cho trường trong menu AI hỗ trợ và (tùy chọn) nhập API Key."));
children.push(h3("Tải file/biểu mẫu không được?"));
children.push(p("Hãy đảm bảo đã đăng nhập đúng trường; với link khảo sát công khai, dùng đúng đường dẫn được hệ thống sinh ra (đã kèm mã trường)."));
children.push(h3("Dữ liệu giữa các trường có lẫn nhau không?"));
children.push(p("Không. Hệ thống cách ly dữ liệu theo từng trường (tenant); người dùng chỉ thấy dữ liệu trường mình."));

children.push(new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "— Hết —", italics: true, color: "888888" })] }));

const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
    ],
  },
  styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  sections: [{ properties: {}, children }],
});

async function main() {
  const out = "docs/Huong_dan_su_dung_AIQMS.docx";
  const buf = await Packer.toBuffer(doc);
  await fs.writeFile(out, buf);
  console.log(`✔ Đã tạo ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
}
main();

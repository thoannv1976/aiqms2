/**
 * Hướng dẫn sử dụng theo từng màn hình (route). Dùng chung cho:
 *  - Panel trợ giúp ở giao diện (hiển thị tức thì, không cần AI).
 *  - Ngữ cảnh đưa vào prompt khi người dùng "Hỏi AI" về màn hình đang xem.
 */
export interface ScreenGuide {
  title: string;
  purpose: string; // màn hình này để làm gì
  steps: string[]; // việc cần làm
  tip?: string;
  role?: string; // ai thường dùng
}

// Khai báo theo route. Khi resolve sẽ chọn key khớp DÀI NHẤT với pathname.
export const SCREEN_GUIDES: Record<string, ScreenGuide> = {
  "/dashboard": {
    title: "Dashboard — Tổng quan kiểm định",
    purpose: "Xem nhanh tiến độ chuẩn bị kiểm định toàn trường và việc của bạn.",
    steps: [
      "Đọc các thẻ số liệu: số CTĐT, số SAR, minh chứng hợp lệ, nhiệm vụ quá hạn.",
      "Xem SAR/minh chứng theo trạng thái để biết khâu nào còn nghẽn.",
      "Mục “Việc của tôi”: nhiệm vụ quá hạn và sắp tới của bạn.",
    ],
    role: "Mọi vai trò (Lãnh đạo, ĐBCL theo dõi tổng thể).",
  },
  "/programmes": {
    title: "Chương trình đào tạo (CTĐT)",
    purpose: "Quản lý hồ sơ các CTĐT và phiên bản của chúng.",
    steps: [
      "Bấm “+ Tạo CTĐT” để thêm chương trình (mã ngành, tên, trình độ).",
      "Hoặc bấm “Import Excel” để nạp nhiều CTĐT (tải file mẫu, điền, upload).",
      "Bấm tên chương trình để mở chi tiết và quản lý phiên bản, PEO, PLO.",
    ],
    role: "Ban chủ nhiệm CTĐT, Phòng ĐBCL.",
  },
  "/programmes/[id]": {
    title: "Chi tiết CTĐT",
    purpose: "Quản lý phiên bản chương trình, mục tiêu (PEO) và chuẩn đầu ra (PLO).",
    steps: [
      "Chọn phiên bản; dùng nút trạng thái để chuyển nháp → áp dụng → lưu trữ.",
      "Thêm PEO (mục tiêu) và PLO (chuẩn đầu ra) cho phiên bản.",
      "Bấm “Ma trận PLO-CLO” để liên kết PLO với học phần.",
    ],
    role: "Ban chủ nhiệm CTĐT.",
  },
  "/matrices": {
    title: "Ma trận PLO-CLO & độ phủ",
    purpose: "Liên kết PLO với học phần và CLO, phát hiện khoảng trống thiết kế chương trình.",
    steps: [
      "Chọn Chương trình và Phiên bản ở phía trên.",
      "Thêm PLO/học phần/CLO nếu chưa có.",
      "Bấm vào ô trong ma trận để đặt mức đóng góp I → R → M.",
      "Liên kết CLO ↔ PLO theo từng học phần; xem bảng Cảnh báo độ phủ để xử lý thiếu sót.",
    ],
    role: "Ban chủ nhiệm CTĐT.",
  },
  "/courses": {
    title: "Đề cương học phần",
    purpose: "Quản lý học phần, chuẩn đầu ra học phần (CLO) và đề cương chi tiết.",
    steps: [
      "Bấm “+ Thêm học phần” hoặc “Import Excel” để nạp nhiều học phần.",
      "Bấm tên học phần để mở và soạn đề cương chi tiết.",
    ],
    role: "Giảng viên, Ban chủ nhiệm CTĐT.",
  },
  "/courses/[id]": {
    title: "Chi tiết đề cương học phần",
    purpose: "Nhập đề cương và CLO cho học phần.",
    steps: [
      "Điền: mô tả, tiên quyết, nội dung, phương pháp giảng dạy/đánh giá, tài liệu, rubric.",
      "Thêm các CLO ở panel bên phải.",
      "Bấm “Lưu đề cương”.",
    ],
    role: "Giảng viên phụ trách học phần.",
  },
  "/standards": {
    title: "Bộ tiêu chuẩn kiểm định",
    purpose: "Xem các tiêu chí và thang đánh giá của bộ tiêu chuẩn (AUN-QA, MOET…).",
    steps: [
      "Chọn một bộ tiêu chuẩn ở danh sách bên trái.",
      "Xem các tiêu chí và thang đánh giá 7 mức bên phải.",
    ],
    tip: "Việc thêm/sửa bộ tiêu chuẩn do Quản trị hệ thống thực hiện (nạp dữ liệu).",
    role: "Mọi vai trò (tham khảo).",
  },
  "/cycles": {
    title: "Đợt tự đánh giá",
    purpose: "Quản lý các đợt kiểm định và các SAR thuộc đợt.",
    steps: [
      "Bấm “+ Tạo đợt”, nhập tên/năm và chọn bộ tiêu chuẩn áp dụng.",
      "Bấm tên đợt để mở chi tiết, tạo SAR và theo dõi tiến độ.",
    ],
    role: "Phòng ĐBCL.",
  },
  "/cycles/[id]": {
    title: "Chi tiết đợt tự đánh giá",
    purpose: "Tạo SAR cho từng chương trình và đóng/mở đợt.",
    steps: [
      "Bấm “+ Tạo SAR”, chọn CTĐT → phiên bản, đặt tiêu đề.",
      "Bấm vào tiêu đề SAR để vào trình soạn báo cáo.",
      "Khi hoàn tất, bấm “Đóng đợt”.",
    ],
    role: "Phòng ĐBCL.",
  },
  "/sars/[id]": {
    title: "Trình soạn Báo cáo tự đánh giá (SAR)",
    purpose: "Soạn SAR theo từng tiêu chí (có AI hỗ trợ) và đánh giá nội bộ.",
    steps: [
      "Tab “Soạn báo cáo”: chọn tiêu chí, nhập hiện trạng/điểm mạnh/tồn tại/cải tiến và điểm tự đánh giá, bấm Lưu.",
      "Panel AI bên phải: bấm “AI viết nháp” → xem → “Duyệt & ghi vào báo cáo” (nội dung AI là bản nháp tới khi duyệt).",
      "Dùng nút chuyển trạng thái SAR theo quy trình; bấm “Xuất Word/PDF” khi cần.",
      "Tab “Đánh giá nội bộ”: hội đồng mở phiên rà soát và chấm điểm từng tiêu chí.",
    ],
    role: "Ban chủ nhiệm CTĐT (soạn), Hội đồng rà soát (chấm điểm).",
  },
  "/sars": {
    title: "Báo cáo tự đánh giá (SAR)",
    purpose: "Danh sách SAR — module trung tâm của đợt kiểm định.",
    steps: [
      "Bấm “+ Tạo SAR” (chọn CTĐT, phiên bản, đợt).",
      "Bấm tiêu đề SAR để vào trình soạn báo cáo theo tiêu chí.",
    ],
    role: "Ban chủ nhiệm CTĐT, Phòng ĐBCL.",
  },
  "/evidence/[id]": {
    title: "Chi tiết minh chứng",
    purpose: "Tải file minh chứng, liên kết tiêu chí và xác minh.",
    steps: [
      "Kéo-thả nhiều file vào vùng upload (hệ thống cảnh báo nếu trùng nội dung).",
      "Ở panel “Tiêu chí liên kết”, chọn tiêu chí để gắn (một minh chứng có thể gắn nhiều tiêu chí).",
      "Ở panel Xác minh: cập nhật trạng thái hợp lệ/cần bổ sung/không phù hợp.",
    ],
    role: "Giảng viên (tải lên), Phòng ĐBCL (xác minh).",
  },
  "/evidence": {
    title: "Kho minh chứng",
    purpose: "Quản lý minh chứng số tập trung phục vụ kiểm định.",
    steps: [
      "Bấm “+ Thêm minh chứng” (tên, năm học) — hệ thống tự đánh mã MC-XXXX.",
      "Bấm tên minh chứng để mở chi tiết: tải file, liên kết tiêu chí, xác minh.",
      "Dùng “Xuất Excel danh mục” để xuất bảng minh chứng.",
    ],
    role: "Giảng viên, Phòng ĐBCL.",
  },
  "/academic-staff": {
    title: "Đội ngũ giảng viên (tiêu chí C5)",
    purpose: "Nhập dữ liệu đội ngũ phục vụ tiêu chí Academic Staff.",
    steps: ["Bấm “+ Thêm” để nhập GV (học hàm/học vị/chuyên môn/công bố).", "Dùng tìm kiếm để tra cứu."],
    role: "Khoa, Phòng ĐBCL.",
  },
  "/students": {
    title: "Người học & dịch vụ hỗ trợ (tiêu chí C6)",
    purpose: "Nhập dữ liệu hỗ trợ người học (tuyển sinh, cố vấn, học bổng, việc làm…).",
    steps: ["Bấm “+ Thêm”, chọn nhóm dịch vụ và nhập nội dung/năm học."],
    role: "Phòng Công tác sinh viên, ĐBCL.",
  },
  "/facilities": {
    title: "Cơ sở vật chất (tiêu chí C7)",
    purpose: "Nhập dữ liệu CSVC, phòng lab, thư viện, hạ tầng CNTT.",
    steps: ["Bấm “+ Thêm”, chọn loại và nhập số lượng/sức chứa/vị trí."],
    role: "Phòng Quản trị, ĐBCL.",
  },
  "/outcomes": {
    title: "Kết quả đầu ra (tiêu chí C8)",
    purpose: "Nhập chỉ số đầu ra: tốt nghiệp, việc làm, hài lòng, mức đạt PLO.",
    steps: ["Bấm “+ Thêm”, chọn nhóm chỉ số, nhập giá trị/đơn vị/năm học."],
    role: "Phòng ĐBCL.",
  },
  "/tasks": {
    title: "Nhiệm vụ (Kanban)",
    purpose: "Giao việc và theo dõi tiến độ chuẩn bị kiểm định.",
    steps: [
      "Bấm “+ Tạo nhiệm vụ” (tiêu đề, ưu tiên, hạn).",
      "Kéo-thả thẻ giữa các cột Cần làm → Đang làm → Rà soát → Hoàn thành.",
    ],
    role: "Mọi vai trò trong nhóm kiểm định.",
  },
  "/improvement/[id]": {
    title: "Chi tiết kế hoạch cải tiến (PDCA)",
    purpose: "Quản lý hành động cải tiến và KPI theo chu trình PDCA.",
    steps: [
      "Thêm hành động theo pha Plan/Do/Check/Act; ghi nhận tiến độ (%).",
      "Thêm KPI (mục tiêu, đơn vị) để đo lường kết quả.",
    ],
    role: "Phòng ĐBCL, Khoa.",
  },
  "/improvement": {
    title: "Kế hoạch cải tiến (PDCA)",
    purpose: "Lập và theo dõi kế hoạch cải tiến sau tự đánh giá/đánh giá ngoài.",
    steps: ["Bấm “+ Tạo kế hoạch” (vấn đề, nguyên nhân).", "Bấm tên kế hoạch để thêm hành động và KPI."],
    role: "Phòng ĐBCL, Khoa.",
  },
  "/surveys/[id]": {
    title: "Chi tiết khảo sát",
    purpose: "Soạn câu hỏi, mở khảo sát và xem kết quả.",
    steps: [
      "Thêm câu hỏi (thang điểm/tự luận/lựa chọn) khi còn ở trạng thái nháp.",
      "Bấm “Mở khảo sát” để sinh link công khai; gửi cho người được khảo sát.",
      "Theo dõi Kết quả (số phản hồi, điểm trung bình).",
    ],
    role: "Phòng ĐBCL.",
  },
  "/surveys": {
    title: "Khảo sát bên liên quan",
    purpose: "Thu thập ý kiến sinh viên, cựu SV, nhà tuyển dụng…",
    steps: ["Bấm “+ Tạo khảo sát”.", "Bấm tên khảo sát để soạn câu hỏi và mở khảo sát."],
    role: "Phòng ĐBCL.",
  },
  "/exports": {
    title: "Xuất báo cáo",
    purpose: "Tạo và tải các báo cáo (SAR Word/PDF, danh mục minh chứng Excel, gói ZIP).",
    steps: [
      "Chọn loại báo cáo (nếu là SAR thì chọn SAR cần xuất).",
      "Bấm “Tạo & xuất”; khi trạng thái “done”, bấm “Tải”.",
    ],
    role: "Phòng ĐBCL, Lãnh đạo.",
  },
  "/users": {
    title: "Người dùng & đơn vị",
    purpose: "Quản lý tài khoản, vai trò (RBAC) và khoa/bộ môn.",
    steps: [
      "Tab “Người dùng”: bấm “+ Tạo người dùng”, nhập thông tin và tích chọn vai trò.",
      "Tab “Khoa/Bộ môn”: thêm Khoa rồi thêm Bộ môn (chọn khoa).",
    ],
    role: "Quản trị hệ thống, Phòng ĐBCL.",
  },
  "/ai": {
    title: "AI hỗ trợ",
    purpose: "Cấu hình AI cho trường, theo dõi chi phí và kiểm tra khoảng trống hồ sơ.",
    steps: [
      "Bật AI, chọn provider/model, nhập API Key (mã hóa khi lưu), đặt hạn mức token/ngày.",
      "Dùng “Kiểm tra khoảng trống”: chọn SAR để liệt kê tiêu chí còn thiếu.",
    ],
    role: "Quản trị hệ thống, Phòng ĐBCL.",
  },
};

const DYNAMIC = ["/programmes/[id]", "/courses/[id]", "/cycles/[id]", "/sars/[id]", "/evidence/[id]", "/improvement/[id]", "/surveys/[id]"];

/** Tìm hướng dẫn cho một pathname (ưu tiên trang chi tiết động, rồi khớp prefix dài nhất). */
export function resolveGuide(pathname: string): ScreenGuide | null {
  // trang chi tiết: /xxx/<id> (id không rỗng và không phải route con tĩnh)
  const seg = pathname.split("/").filter(Boolean); // ["sars","<id>"]
  if (seg.length === 2) {
    const dyn = `/${seg[0]}/[id]`;
    if (DYNAMIC.includes(dyn) && SCREEN_GUIDES[dyn]) return SCREEN_GUIDES[dyn];
  }
  const keys = Object.keys(SCREEN_GUIDES)
    .filter((k) => !k.includes("[id]"))
    .sort((a, b) => b.length - a.length);
  for (const k of keys) if (pathname === k || pathname.startsWith(k + "/")) return SCREEN_GUIDES[k];
  return SCREEN_GUIDES["/dashboard"] ?? null;
}

import type { StandardDataset } from "./dataset";

/**
 * Bộ tiêu chuẩn kiểm định CTĐT của Bộ GD&ĐT (mô phỏng theo Thông tư 04/2016 —
 * 11 tiêu chuẩn cấp chương trình, thang 7 mức). ĐÂY CHỈ LÀ DỮ LIỆU: thêm bộ tiêu
 * chuẩn này KHÔNG cần sửa code lõi (chứng minh thiết kế data-driven của P2).
 *
 * Yêu cầu chi tiết có thể nạp/chỉnh thêm qua giao diện cấu hình.
 */
export const MOET: StandardDataset = {
  standard: {
    code: "MOET",
    name: "Tiêu chuẩn kiểm định CTĐT (Bộ GD&ĐT)",
    description: "Bộ tiêu chuẩn đánh giá chất lượng chương trình đào tạo của Bộ GD&ĐT",
    level: "programme",
  },
  version: { version: "2016", name: "Thông tư 04/2016/TT-BGDĐT", isActive: true },
  ratingScale: [
    { level: 1, labelVi: "Hoàn toàn không đáp ứng yêu cầu" },
    { level: 2, labelVi: "Không đáp ứng yêu cầu, cần cải tiến ngay" },
    { level: 3, labelVi: "Chưa đáp ứng đầy đủ, cần cải tiến" },
    { level: 4, labelVi: "Đáp ứng yêu cầu" },
    { level: 5, labelVi: "Đáp ứng tốt hơn yêu cầu" },
    { level: 6, labelVi: "Đáp ứng rất tốt" },
    { level: 7, labelVi: "Xuất sắc" },
  ],
  criteria: [
    { code: "TC1", order: 1, titleVi: "Mục tiêu và chuẩn đầu ra của CTĐT", requirements: [{ code: "1.1", title: "Mục tiêu CTĐT rõ ràng, phù hợp sứ mạng" }, { code: "1.2", title: "Chuẩn đầu ra rõ ràng, đo lường được" }] },
    { code: "TC2", order: 2, titleVi: "Bản mô tả CTĐT", requirements: [{ code: "2.1", title: "Bản mô tả đầy đủ, cập nhật, công bố công khai" }] },
    { code: "TC3", order: 3, titleVi: "Cấu trúc và nội dung chương trình dạy học", requirements: [{ code: "3.1", title: "Cấu trúc chương trình logic, gắn chuẩn đầu ra" }] },
    { code: "TC4", order: 4, titleVi: "Phương pháp tiếp cận dạy và học", requirements: [{ code: "4.1", title: "Phương pháp dạy-học thúc đẩy đạt chuẩn đầu ra" }] },
    { code: "TC5", order: 5, titleVi: "Đánh giá kết quả học tập của người học", requirements: [{ code: "5.1", title: "Đánh giá nhất quán với chuẩn đầu ra" }] },
    { code: "TC6", order: 6, titleVi: "Đội ngũ giảng viên, nghiên cứu viên", requirements: [{ code: "6.1", title: "Đội ngũ đủ về số lượng và năng lực" }] },
    { code: "TC7", order: 7, titleVi: "Đội ngũ nhân viên", requirements: [{ code: "7.1", title: "Nhân viên hỗ trợ đủ năng lực" }] },
    { code: "TC8", order: 8, titleVi: "Người học và hoạt động hỗ trợ người học", requirements: [{ code: "8.1", title: "Chính sách tuyển sinh và hỗ trợ người học rõ ràng" }] },
    { code: "TC9", order: 9, titleVi: "Cơ sở vật chất và trang thiết bị", requirements: [{ code: "9.1", title: "CSVC đáp ứng yêu cầu dạy-học, nghiên cứu" }] },
    { code: "TC10", order: 10, titleVi: "Nâng cao chất lượng", requirements: [{ code: "10.1", title: "Cơ chế thu thập phản hồi và cải tiến liên tục" }] },
    { code: "TC11", order: 11, titleVi: "Kết quả đầu ra", requirements: [{ code: "11.1", title: "Tỷ lệ tốt nghiệp, việc làm, hài lòng các bên" }] },
  ],
};

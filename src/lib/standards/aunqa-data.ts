/**
 * Dữ liệu cấu hình AUN-QA Programme Level v4.0 (data-driven — KHÔNG hard-code trong
 * logic). Gồm: 8 tiêu chí, thang đánh giá 7 mức (nhãn chính thức AUN-QA), và bộ yêu
 * cầu đại diện cho mỗi tiêu chí. Văn bản yêu cầu chi tiết có thể chỉnh/nạp thêm qua
 * giao diện cấu hình mà không cần sửa code (đúng tinh thần đa-tiêu-chuẩn).
 */

export interface RequirementSeed {
  code: string;
  title: string;
  guidance?: string;
}
export interface CriterionSeed {
  code: string;
  order: number;
  titleEn: string;
  titleVi: string;
  requirements: RequirementSeed[];
  suggestedEvidences?: string[];
}

/** Thang đánh giá 7 mức của AUN-QA (nhãn chính thức + dịch VI). */
export const AUNQA_RATING_SCALE: {
  level: number;
  labelEn: string;
  labelVi: string;
}[] = [
  { level: 1, labelEn: "Absolutely Inadequate", labelVi: "Hoàn toàn chưa đạt — cần cải tiến ngay" },
  { level: 2, labelEn: "Inadequate and Improvement Necessary", labelVi: "Chưa đạt, cần cải tiến" },
  { level: 3, labelEn: "Inadequate but Minor Improvement Will Make It Adequate", labelVi: "Chưa đạt nhưng chỉ cần cải tiến nhỏ là đạt" },
  { level: 4, labelEn: "Adequate as Expected", labelVi: "Đạt như kỳ vọng" },
  { level: 5, labelEn: "Better Than Adequate", labelVi: "Tốt hơn mức đạt" },
  { level: 6, labelEn: "Example of Best Practices", labelVi: "Điển hình thực hành tốt" },
  { level: 7, labelEn: "Excellent (World-class or Leading Practices)", labelVi: "Xuất sắc (đẳng cấp quốc tế/dẫn đầu)" },
];

export const AUNQA_CRITERIA: CriterionSeed[] = [
  {
    code: "C1",
    order: 1,
    titleEn: "Expected Learning Outcomes",
    titleVi: "Chuẩn đầu ra mong đợi",
    requirements: [
      { code: "1.1", title: "Chuẩn đầu ra được xây dựng phù hợp tầm nhìn, sứ mạng", guidance: "PLO có phản ánh tầm nhìn/sứ mạng của trường và khoa không?" },
      { code: "1.2", title: "Chuẩn đầu ra bao gồm cả kết quả chuyên môn và tổng quát", guidance: "PLO có cân bằng giữa kiến thức chuyên môn và kỹ năng tổng quát không?" },
      { code: "1.3", title: "Chuẩn đầu ra phản ánh yêu cầu của các bên liên quan", guidance: "PLO có được rà soát theo phản hồi của nhà tuyển dụng, cựu SV không?" },
    ],
    suggestedEvidences: ["Bảng PLO", "Biên bản lấy ý kiến bên liên quan", "Ma trận PLO-sứ mạng"],
  },
  {
    code: "C2",
    order: 2,
    titleEn: "Programme Structure and Content",
    titleVi: "Cấu trúc và nội dung chương trình dạy học",
    requirements: [
      { code: "2.1", title: "Cấu trúc chương trình thể hiện rõ liên kết với chuẩn đầu ra", guidance: "Ma trận PLO-học phần có đảm bảo độ phủ không?" },
      { code: "2.2", title: "Trình tự và tích hợp các học phần hợp lý", guidance: "Học phần có sắp xếp theo trình tự logic, tích hợp không?" },
      { code: "2.3", title: "Nội dung cập nhật và phản ánh xu hướng ngành", guidance: "Nội dung có được rà soát/cập nhật định kỳ không?" },
    ],
    suggestedEvidences: ["Bản mô tả CTĐT", "Ma trận PLO-học phần", "Biên bản rà soát chương trình"],
  },
  {
    code: "C3",
    order: 3,
    titleEn: "Teaching and Learning Approach",
    titleVi: "Phương pháp tiếp cận dạy và học",
    requirements: [
      { code: "3.1", title: "Triết lý giáo dục được tuyên bố rõ ràng", guidance: "Triết lý dạy-học có được công bố và quán triệt không?" },
      { code: "3.2", title: "Hoạt động dạy-học thúc đẩy đạt chuẩn đầu ra", guidance: "Phương pháp dạy-học có gắn với PLO/CLO không?" },
      { code: "3.3", title: "Hoạt động dạy-học thúc đẩy học tập suốt đời", guidance: "Có hoạt động rèn tự học, học tập suốt đời không?" },
    ],
    suggestedEvidences: ["Đề cương học phần", "Kế hoạch giảng dạy", "Ma trận phương pháp dạy-PLO"],
  },
  {
    code: "C4",
    order: 4,
    titleEn: "Student Assessment",
    titleVi: "Đánh giá kết quả học tập của người học",
    requirements: [
      { code: "4.1", title: "Đánh giá nhất quán với chuẩn đầu ra", guidance: "Phương pháp đánh giá có đo được CLO/PLO không?" },
      { code: "4.2", title: "Tiêu chí và rubric đánh giá rõ ràng, công bố cho người học", guidance: "Rubric có công khai và nhất quán không?" },
      { code: "4.3", title: "Phản hồi đánh giá kịp thời và hỗ trợ cải tiến học tập", guidance: "Người học có nhận phản hồi kịp thời không?" },
    ],
    suggestedEvidences: ["Rubric", "Đề thi và đáp án", "Ma trận đề thi-CLO", "Bảng điểm"],
  },
  {
    code: "C5",
    order: 5,
    titleEn: "Academic Staff",
    titleVi: "Đội ngũ giảng viên",
    requirements: [
      { code: "5.1", title: "Quy hoạch đội ngũ đáp ứng nhu cầu chương trình", guidance: "Số lượng/cơ cấu GV có đáp ứng chương trình không?" },
      { code: "5.2", title: "Năng lực và phát triển chuyên môn của giảng viên", guidance: "GV có được bồi dưỡng, phát triển chuyên môn không?" },
      { code: "5.3", title: "Quản lý hiệu quả công việc và ghi nhận giảng viên", guidance: "Có đánh giá, ghi nhận, khen thưởng GV không?" },
    ],
    suggestedEvidences: ["Lý lịch khoa học GV", "Công bố khoa học", "Kế hoạch phát triển đội ngũ"],
  },
  {
    code: "C6",
    order: 6,
    titleEn: "Student Support Services",
    titleVi: "Dịch vụ hỗ trợ người học",
    requirements: [
      { code: "6.1", title: "Chính sách tuyển sinh và nhập học rõ ràng", guidance: "Tiêu chí tuyển sinh có minh bạch không?" },
      { code: "6.2", title: "Hệ thống cố vấn học tập và theo dõi tiến độ", guidance: "Có cố vấn học tập và theo dõi tiến độ người học không?" },
      { code: "6.3", title: "Dịch vụ hỗ trợ và môi trường học tập đầy đủ", guidance: "Dịch vụ hỗ trợ (học bổng, việc làm, tâm lý) có đủ không?" },
    ],
    suggestedEvidences: ["Quy chế tuyển sinh", "Hồ sơ cố vấn học tập", "Khảo sát hài lòng dịch vụ"],
  },
  {
    code: "C7",
    order: 7,
    titleEn: "Facilities and Infrastructure",
    titleVi: "Cơ sở vật chất và hạ tầng",
    requirements: [
      { code: "7.1", title: "Cơ sở vật chất dạy-học đầy đủ và phù hợp", guidance: "Phòng học, phòng thí nghiệm có đáp ứng không?" },
      { code: "7.2", title: "Thư viện và tài nguyên học liệu cập nhật", guidance: "Học liệu (in/số) có đủ và cập nhật không?" },
      { code: "7.3", title: "Hạ tầng CNTT và môi trường an toàn", guidance: "Hạ tầng CNTT, LMS, an toàn có đảm bảo không?" },
    ],
    suggestedEvidences: ["Danh mục CSVC", "Thống kê thư viện", "Kế hoạch bảo trì nâng cấp"],
  },
  {
    code: "C8",
    order: 8,
    titleEn: "Output and Outcomes",
    titleVi: "Kết quả đầu ra",
    requirements: [
      { code: "8.1", title: "Tỷ lệ tốt nghiệp và thôi học được theo dõi", guidance: "Có dữ liệu tỷ lệ tốt nghiệp/thôi học theo khóa không?" },
      { code: "8.2", title: "Tỷ lệ có việc làm và mức độ hài lòng các bên", guidance: "Có khảo sát việc làm và hài lòng nhà tuyển dụng không?" },
      { code: "8.3", title: "Kết quả nghiên cứu, đo lường đạt PLO và xu hướng cải tiến", guidance: "Có đo lường mức đạt PLO và phân tích xu hướng không?" },
    ],
    suggestedEvidences: ["Thống kê tốt nghiệp/việc làm", "Khảo sát cựu SV/nhà tuyển dụng", "Báo cáo đo lường PLO"],
  },
];

export const AUNQA = {
  standard: {
    code: "AUN-QA",
    name: "AUN-QA Programme Level",
    description: "Bộ tiêu chuẩn kiểm định chương trình đào tạo của AUN-QA",
    level: "programme",
  },
  version: { version: "4.0", name: "AUN-QA Programme v4.0", isActive: true },
  criteria: AUNQA_CRITERIA,
  ratingScale: AUNQA_RATING_SCALE,
};

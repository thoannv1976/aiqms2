/**
 * Vòng đời trạng thái SAR (đặc tả 4.13) — model hóa thành state machine, chặn
 * chuyển trạng thái không hợp lệ.
 */
export const SAR_STATES = [
  "not_started",
  "collecting", // đang thu thập dữ liệu
  "drafting", // đang viết báo cáo
  "faculty_review", // chờ rà soát cấp khoa
  "needs_revision", // cần chỉnh sửa
  "university_review", // chờ rà soát cấp trường
  "internal_done", // đã hoàn thành nội bộ
  "ready_external", // sẵn sàng đánh giá ngoài
  "external_done", // đã đánh giá ngoài
  "improving", // đang cải tiến sau đánh giá
  "completed", // hoàn tất chu kỳ
] as const;

export type SarState = (typeof SAR_STATES)[number];

export const SAR_TRANSITIONS: Record<SarState, SarState[]> = {
  not_started: ["collecting"],
  collecting: ["drafting"],
  drafting: ["faculty_review"],
  faculty_review: ["needs_revision", "university_review"],
  needs_revision: ["drafting"],
  university_review: ["needs_revision", "internal_done"],
  internal_done: ["ready_external"],
  ready_external: ["external_done"],
  external_done: ["improving"],
  improving: ["completed"],
  completed: [],
};

export function canTransition(from: string, to: string): boolean {
  return (SAR_TRANSITIONS[from as SarState] ?? []).includes(to as SarState);
}

/**
 * Nhãn tiếng Việt cho từng trạng thái SAR. Tên kỹ thuật giữ nguyên (ổn định cho API/DB),
 * chỉ ánh xạ khi hiển thị — tương thích thuật ngữ kịch bản kiểm định SBI:
 * faculty_review = rà soát cấp khoa, university_review = rà soát cấp trường (QA),
 * internal_done = hoàn thành nội bộ, ready_external = sẵn sàng đánh giá ngoài, completed = lưu hồ sơ.
 */
export const SAR_STATE_LABELS: Record<SarState, string> = {
  not_started: "Chưa bắt đầu",
  collecting: "Đang thu thập dữ liệu",
  drafting: "Đang soạn báo cáo",
  faculty_review: "Rà soát cấp khoa",
  needs_revision: "Cần chỉnh sửa",
  university_review: "Rà soát cấp trường (QA)",
  internal_done: "Hoàn thành nội bộ",
  ready_external: "Sẵn sàng đánh giá ngoài",
  external_done: "Đã đánh giá ngoài",
  improving: "Đang cải tiến sau đánh giá",
  completed: "Hoàn tất chu kỳ",
};

export function sarStateLabel(status: string): string {
  return SAR_STATE_LABELS[status as SarState] ?? status;
}

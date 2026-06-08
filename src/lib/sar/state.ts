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

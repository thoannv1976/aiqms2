import type { CompleteOptions, LlmMessage, LlmProvider, LlmResult } from "./types";

/**
 * Provider giả lập — dùng ở dev/test khi chưa cấu hình khóa thật.
 * Sinh output xác định (deterministic) để test ổn định và demo được kiến trúc
 * mà không phụ thuộc API ngoài. KHÔNG gửi dữ liệu ra ngoài.
 */
export class MockProvider implements LlmProvider {
  readonly name = "mock";

  async complete(messages: LlmMessage[], opts: CompleteOptions): Promise<LlmResult> {
    const user = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
    const tokensIn = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4);

    let text: string;
    if (opts.json) {
      // Trả JSON hợp lệ dạng "superset" cho mọi nhánh structured. Zod (không strict)
      // sẽ bỏ qua khóa thừa, nên một đối tượng duy nhất phục vụ được nhiều tính năng
      // (gợi ý minh chứng, gợi ý cải tiến PDCA, lập kế hoạch đợt…) ổn định cho dev/demo.
      text = JSON.stringify({
        summary: `[AI-nháp] Tóm tắt: ${user.slice(0, 120)}`,
        suggestions: ["Bổ sung minh chứng có chữ ký", "Cập nhật số liệu mới nhất"],
        actions: [
          { action: "[AI-nháp] Xây dựng kế hoạch khắc phục", pdcaPhase: "plan", responsibleUnit: "Ban CN chương trình" },
          { action: "[AI-nháp] Triển khai cải tiến", pdcaPhase: "do", responsibleUnit: "Khoa" },
          { action: "[AI-nháp] Đánh giá kết quả", pdcaPhase: "check" },
        ],
        kpis: [
          { name: "[AI-nháp] Tỷ lệ hoàn thành hành động cải tiến", unit: "%", target: 100 },
        ],
        // Nâng cấp CTĐT (đề xuất PEO/PLO mẫu) — chỉ dùng khi prompt là yêu cầu nâng cấp.
        ...(/upgrade_programme|PEO1|PLO1/.test(user) ? {
          peos: [
            { code: "PEO1", description: "[AI-nháp] Vận dụng kiến thức nền tảng và chuyên ngành để giải quyết vấn đề thực tiễn." },
            { code: "PEO2", description: "[AI-nháp] Phát triển nghề nghiệp, học tập suốt đời và thích ứng môi trường số." },
          ],
          plos: [
            { code: "PLO1", description: "[AI-nháp] Áp dụng kiến thức cơ sở ngành để phân tích và giải quyết vấn đề chuyên môn." },
            { code: "PLO2", description: "[AI-nháp] Thiết kế và triển khai giải pháp đáp ứng yêu cầu thực tế." },
            { code: "PLO3", description: "[AI-nháp] Làm việc nhóm và giao tiếp hiệu quả bằng tiếng Việt và tiếng Anh chuyên ngành." },
            { code: "PLO4", description: "[AI-nháp] Thể hiện đạo đức nghề nghiệp, trách nhiệm xã hội và năng lực số." },
          ],
          notes: "[AI-nháp] Bộ PEO/PLO mẫu — hãy chỉnh sửa cho phù hợp ngành.",
        } : {}),
        // Kế hoạch đợt tự đánh giá: chỉ sinh khi prompt là yêu cầu lập kế hoạch
        // (đặc trưng bởi khóa "dueOffsetDays"). Trích mã tiêu chí C1..Cn từ prompt.
        tasks: /dueOffsetDays/.test(user) ? buildPlanTasks(user) : [],
      });
    } else {
      text = `[AI-nháp] ${user.slice(0, 400)}`.trim();
    }
    const tokensOut = Math.ceil(text.length / 4);
    return { text, tokensIn, tokensOut };
  }
}

/** Sinh kế hoạch đợt mẫu (deterministic) cho MockProvider: mỗi tiêu chí có công việc
 *  thu thập minh chứng + viết SAR, kèm các công việc chung. */
function buildPlanTasks(prompt: string) {
  const codes = [...new Set([...prompt.matchAll(/\bC\d{1,2}\b/g)].map((m) => m[0]))];
  const criteria = codes.length ? codes : ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"];

  const tasks: Record<string, unknown>[] = [
    { title: "[AI-nháp] Thành lập nhóm tự đánh giá & lập kế hoạch đợt", type: "plan", role: "qa_office", deliverables: "Quyết định thành lập nhóm + kế hoạch chi tiết", priority: "high", dueOffsetDays: 7 },
  ];
  let collectDue = 14;
  let sarDue = 30;
  for (const code of criteria) {
    tasks.push({ title: `[AI-nháp] Thu thập minh chứng tiêu chí ${code}`, type: "evidence", criterionCode: code, deliverables: `Danh mục minh chứng + file cho ${code}`, role: "faculty", priority: "normal", dueOffsetDays: collectDue });
    tasks.push({ title: `[AI-nháp] Viết SAR tiêu chí ${code}`, type: "sar", criterionCode: code, deliverables: `Bản thảo phân tích SAR cho ${code}`, role: "programme_committee", priority: "high", dueOffsetDays: sarDue });
    collectDue += 2;
    sarDue += 2;
  }
  tasks.push(
    { title: "[AI-nháp] Rà soát cấp khoa/trường", type: "review", role: "internal_reviewer", deliverables: "Biên bản rà soát + góp ý", priority: "normal", dueOffsetDays: sarDue + 7 },
    { title: "[AI-nháp] Đánh giá nội bộ theo 8 tiêu chí", type: "internal_review", role: "internal_reviewer", deliverables: "Phiếu chấm điểm nội bộ", priority: "high", dueOffsetDays: sarDue + 14 },
    { title: "[AI-nháp] Hoàn thiện & xuất hồ sơ SAR đầy đủ", type: "export", role: "qa_office", deliverables: "Hồ sơ SAR (Word/PDF) + phụ lục minh chứng", priority: "high", dueOffsetDays: sarDue + 21 },
  );
  return tasks;
}

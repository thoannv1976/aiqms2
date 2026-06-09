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
      // (gợi ý minh chứng, gợi ý cải tiến PDCA…) ổn định cho dev/test.
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
      });
    } else {
      text = `[AI-nháp] ${user.slice(0, 400)}`.trim();
    }
    const tokensOut = Math.ceil(text.length / 4);
    return { text, tokensIn, tokensOut };
  }
}

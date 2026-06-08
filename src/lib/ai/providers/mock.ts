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
      // Trả JSON hợp lệ cho nhánh structured (vd: gợi ý minh chứng).
      text = JSON.stringify({
        summary: `[AI-nháp] Tóm tắt: ${user.slice(0, 120)}`,
        suggestions: ["Bổ sung minh chứng có chữ ký", "Cập nhật số liệu mới nhất"],
      });
    } else {
      text = `[AI-nháp] ${user.slice(0, 400)}`.trim();
    }
    const tokensOut = Math.ceil(text.length / 4);
    return { text, tokensIn, tokensOut };
  }
}

import type { CompleteOptions, LlmMessage, LlmProvider, LlmResult } from "./types";
import { fetchWithTimeout } from "./http";

/**
 * Provider Anthropic (Claude) — Messages API.
 * Khác OpenAI: "system" là tham số top-level (không phải role trong messages);
 * messages chỉ gồm user/assistant. Dùng khi key bắt đầu "sk-ant-" / model "claude-*"
 * / baseUrl trỏ api.anthropic.com.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async complete(messages: LlmMessage[], opts: CompleteOptions): Promise<LlmResult> {
    const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    // Ép JSON: thêm chỉ dẫn vào system (Anthropic không có response_format).
    const sys = opts.json ? `${system}\n\nLUÔN trả về JSON thuần hợp lệ, KHÔNG kèm văn bản hay markdown.` : system;

    const base = this.baseUrl.replace(/\/$/, "").replace(/\/v1$/, "");
    const res = await fetchWithTimeout(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4096,
        // KHÔNG gửi temperature mặc định: model Claude 4.x (opus-4-x, sonnet-4-x, fable-5…)
        // trả 400 "temperature is deprecated for this model". Chỉ gửi khi được chỉ định.
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(sys ? { system: sys } : {}),
        messages: turns.length ? turns : [{ role: "user", content: "." }],
      }),
    }, opts.timeoutMs ?? 120_000);
    if (!res.ok) {
      throw new Error(`LLM lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      content: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
    return {
      text,
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
    };
  }
}

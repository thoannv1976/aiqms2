import type { CompleteOptions, LlmMessage, LlmProvider, LlmResult } from "./types";

/**
 * Provider OpenAI-compatible (OpenAI/Azure/local LLM cùng giao thức /chat/completions).
 * Đặc tả chốt "OpenAI-compatible abstraction" — đổi nhà cung cấp bằng baseUrl + key.
 */
export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async complete(messages: LlmMessage[], opts: CompleteOptions): Promise<LlmResult> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`LLM lỗi ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: data.choices[0]?.message?.content ?? "",
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: data.usage?.completion_tokens ?? 0,
    };
  }
}

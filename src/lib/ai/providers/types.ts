export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Ép trả JSON thuần (validate bằng Zod sau đó). */
  json?: boolean;
}

export interface LlmResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

/** Trừu tượng đa nhà cung cấp (OpenAI/Azure/Gemini/Claude/local). */
export interface LlmProvider {
  readonly name: string;
  complete(messages: LlmMessage[], opts: CompleteOptions): Promise<LlmResult>;
}

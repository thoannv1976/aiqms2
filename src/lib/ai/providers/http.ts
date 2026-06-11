/** fetch có giới hạn thời gian: tránh treo vô hạn khi nhà cung cấp AI chậm/không phản hồi
 *  (đặc biệt trên Cloud Run — request nền chạy trong vòng đời của một HTTP request). */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`Hết thời gian chờ AI sau ${Math.round(timeoutMs / 1000)}s — model có thể quá chậm; thử model nhanh hơn (vd claude-3-5-haiku) hoặc giảm khối lượng.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

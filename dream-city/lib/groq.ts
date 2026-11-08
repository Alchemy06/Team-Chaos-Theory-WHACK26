// Minimal Groq client using its OpenAI-compatible endpoint. Server-side only:
// GROQ_API_KEY has no NEXT_PUBLIC_ prefix, so Next.js never sends it to the browser.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export class GroqError extends Error {}

function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/); // models sometimes wrap JSON in prose or code fences
    if (match) return JSON.parse(match[0]);
    throw new GroqError("The model did not return JSON.");
  }
}

export async function groqJSON(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal; model?: string } = {}
): Promise<unknown> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new GroqError("GROQ_API_KEY is not set. Add it to .env.local and restart the dev server.");
  const body = {
    model: opts.model ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1200,
  };

  const send = (extra: object) =>
    fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, ...extra }),
      signal: opts.signal,
    });

  let res = await send({ response_format: { type: "json_object" } });
  if (res.status === 400) res = await send({}); // some models don't support JSON mode; fall back to plain text
  if (!res.ok) throw new GroqError(`Groq returned ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new GroqError("Groq returned an empty response.");
  return parseJSON(content);
}

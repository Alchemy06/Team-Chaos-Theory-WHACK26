// LLM 2a: reads the .md dream entry and returns the fields the city needs.
// POST { markdown: string } -> { entry, extraction, warnings } or { error, details }

import { fromMarkdown } from "@/lib/entry";
import { checkExtraction } from "@/lib/extraction";
import { groqJSON } from "@/lib/groq";
import { EXTRACTION_SYSTEM } from "@/lib/prompts";

export async function POST(request: Request) {
  const { markdown } = (await request.json().catch(() => ({}))) as { markdown?: string };
  if (!markdown?.trim()) return Response.json({ error: "markdown is required" }, { status: 400 });
  const entry = fromMarkdown(markdown);
  if (!entry.transcript) return Response.json({ error: "The entry has no dream text." }, { status: 400 });

  let user = markdown;
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await groqJSON(EXTRACTION_SYSTEM, user, { temperature: 0.1 });
      const result = checkExtraction(raw, entry);
      if (result.ok) return Response.json({ entry, extraction: result.value, warnings: result.warnings });
      lastErrors = result.errors;
      // Retry once, telling the model exactly what was wrong
      user = `${markdown}\n\n---\nYour previous answer was rejected:\n- ${result.errors.join("\n- ")}\nReturn corrected JSON only.`;
    } catch (err) {
      lastErrors = [err instanceof Error ? err.message : String(err)];
      break;
    }
  }
  return Response.json({ error: "Could not extract this dream.", details: lastErrors }, { status: 502 });
}

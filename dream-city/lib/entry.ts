// The .md dream entry: the raw record LLM 1 produces and LLM 2a reads.
// Stored as text in the database (dreams.transcript + dreams.follow_ups), not as a file.
//
// Format:
//   # Dream, 2026-10-22
//
//   My house was flooded up to the second floor...
//
//   ## Follow-ups
//
//   Q1 - How did you feel during the dream?
//   A1 - Peaceful and amazed.
//
//   Q2 - How intense did it feel, from 1 to 10?
//   A2 - 8

export type Entry = {
  date: string; // ISO date
  transcript: string;
  followUps: { q: string; a: string }[];
};

export function toMarkdown(e: Entry): string {
  const qa = e.followUps.map((f, i) => `Q${i + 1} - ${f.q.trim()}\nA${i + 1} - ${f.a.trim() || "(no answer)"}`);
  return [`# Dream, ${e.date}`, "", e.transcript.trim(), "", "## Follow-ups", "", qa.join("\n\n"), ""].join("\n");
}

export function fromMarkdown(md: string): Entry {
  const text = md.replace(/\r\n/g, "\n");
  const date = text.match(/^#\s*Dream,\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? new Date().toISOString().slice(0, 10);
  const [head, tail = ""] = text.split(/^##\s*Follow-ups\s*$/m);
  const transcript = head.replace(/^#.*$/m, "").trim();
  const followUps: Entry["followUps"] = [];
  // An answer runs until the next question or the end of the entry (not just the end of a line)
  const re = /^Q(\d+)\s*-\s*(.+)\nA\1\s*-\s*([\s\S]*?)(?=\n\s*\nQ\d+\s*-|\s*(?![\s\S]))/gm;
  for (const m of tail.matchAll(re)) {
    const a = m[3].trim();
    followUps.push({ q: m[2].trim(), a: a === "(no answer)" ? "" : a });
  }
  return { date, transcript, followUps };
}

// The dreamer's own 1-10 rating, from the fixed intensity question, if they gave one.
export function selfRatedIntensity(e: Entry): number | null {
  const f = e.followUps.find((x) => /intense/i.test(x.q));
  const n = f ? parseInt(f.a.match(/\d+/)?.[0] ?? "", 10) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

// The .md dream entry: the raw record LLM 1 produces and LLM 2a reads.
// Stored as text in journal_sessions.conversation_md, with each message also in journal_messages.
//
// fromMarkdown reads all three formats the app has used:
//
// 1. The journal format written by lib/journalMarkdown.ts (current):
//      # Dream Journal — 22 October 2026
//      ## User
//      My house was flooded up to the second floor...
//      ## Assistant
//      How did you feel during the dream?
//      ## User
//      Peaceful and amazed.
//
// 2. The Q1/A1 format written by toMarkdown below:
//      # Dream, 2026-10-22
//      My house was flooded...
//      ## Follow-ups
//      Q1 - How did you feel during the dream?
//      A1 - Peaceful and amazed.
//
// 3. The seed format in supabase/seed_journal.sql:
//      # Flooded city
//      ## Dream
//      My house was flooded...
//      **Q:** How did you feel during the dream?
//      **A:** Peaceful and amazed.

export type Entry = {
  date: string; // ISO date
  transcript: string;
  followUps: { q: string; a: string }[];
};

export function toMarkdown(e: Entry): string {
  const qa = e.followUps.map((f, i) => `Q${i + 1} - ${f.q.trim()}\nA${i + 1} - ${f.a.trim() || "(no answer)"}`);
  return [`# Dream, ${e.date}`, "", e.transcript.trim(), "", "## Follow-ups", "", qa.join("\n\n"), ""].join("\n");
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const END = String.raw`\s*(?![\s\S])`; // the very end of the text (not just the end of a line)

function dateIn(text: string): string | null {
  const iso = text.match(/^#.*?(\d{4}-\d{2}-\d{2})/m)?.[1];
  if (iso) return iso;
  const long = text.match(/^#.*?(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/m);
  const month = long ? MONTHS.indexOf(long[2].toLowerCase()) : -1;
  if (!long || month < 0) return null;
  return `${long[3]}-${String(month + 1).padStart(2, "0")}-${long[1].padStart(2, "0")}`;
}

function journalFormat(text: string): Omit<Entry, "date"> | null {
  const blocks = [...text.matchAll(/^##\s*(User|Assistant)\s*$\n?([\s\S]*?)(?=^##\s*(?:User|Assistant)\s*$|(?![\s\S]))/gm)].map((m) => ({
    role: m[1].toLowerCase(),
    content: m[2].trim(),
  }));
  if (!blocks.length || blocks[0].role !== "user") return null;
  const followUps: Entry["followUps"] = [];
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i].role !== "assistant") continue;
    const next = blocks[i + 1];
    followUps.push({ q: blocks[i].content, a: next?.role === "user" ? next.content : "" });
  }
  return { transcript: blocks[0].content, followUps };
}

function qaFormat(text: string): Omit<Entry, "date"> {
  const [head, tail = ""] = text.split(/^##\s*Follow-ups\s*$/m);
  const followUps: Entry["followUps"] = [];
  // An answer runs until the next question or the end of the entry
  const re = new RegExp(String.raw`^Q(\d+)\s*-\s*(.+)\nA\1\s*-\s*([\s\S]*?)(?=\n\s*\nQ\d+\s*-|${END})`, "gm");
  for (const m of tail.matchAll(re)) {
    const a = m[3].trim();
    followUps.push({ q: m[2].trim(), a: a === "(no answer)" ? "" : a });
  }
  return { transcript: head.replace(/^#.*$/m, "").trim(), followUps };
}

function seedFormat(text: string): Omit<Entry, "date"> {
  const body = text.replace(/^#\s.*$/m, "").replace(/^##\s*Dream\s*$/m, "");
  const firstQ = body.search(/^\*\*Q:\*\*/m);
  const transcript = (firstQ >= 0 ? body.slice(0, firstQ) : body).trim();
  const followUps: Entry["followUps"] = [];
  const re = new RegExp(String.raw`^\*\*Q:\*\*\s*(.+)\n\*\*A:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Q:\*\*|${END})`, "gm");
  for (const m of body.matchAll(re)) followUps.push({ q: m[1].trim(), a: m[2].trim() });
  return { transcript, followUps };
}

export function fromMarkdown(md: string): Entry {
  const text = md.replace(/\r\n/g, "\n");
  const date = dateIn(text) ?? new Date().toISOString().slice(0, 10);
  if (/^##\s*(User|Assistant)\s*$/m.test(text)) {
    const j = journalFormat(text);
    if (j) return { date, ...j };
  }
  if (/^\*\*Q:\*\*/m.test(text)) return { date, ...seedFormat(text) };
  return { date, ...qaFormat(text) };
}

// The dreamer's own 1-10 rating, if they gave one: the answer to the fixed intensity question,
// or a rating like "7/10" or "8 out of 10" written anywhere in the entry.
export function selfRatedIntensity(e: Entry): number | null {
  const valid = (n: number) => (Number.isFinite(n) && n >= 1 && n <= 10 ? n : null);
  const f = e.followUps.find((x) => /intens/i.test(x.q));
  if (f) {
    const outOf = f.a.match(/\b(10|[1-9])\s*(?:\/|out of)\s*10\b/i);
    const n = valid(parseInt(outOf?.[1] ?? f.a.match(/\b(10|[1-9])\b/)?.[1] ?? "", 10));
    if (n !== null) return n;
  }
  const all = [e.transcript, ...e.followUps.map((x) => x.a)].join("\n");
  return valid(parseInt(all.match(/\b(10|[1-9])\s*(?:\/|out of)\s*10\b/i)?.[1] ?? "", 10));
}

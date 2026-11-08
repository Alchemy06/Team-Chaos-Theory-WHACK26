import { db } from "@/lib/db";
import type { BuildData, JournalMessage, JournalSession } from "@/lib/db";
import { databaseDream } from "@/lib/databaseCity";

// ── (ADDED) Hide known seed fixtures without deleting database rows ──
const SEED_IDS = new Set([
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
]);

// ── (ADDED) Read only buildings with saved database records ──
export async function GET() {
  try {
    const { data: rows, error } = await db().from("build_data").select("*, journal_sessions(*)");
    if (error) throw error;
    const savedRows = (rows ?? []).filter((row) => !SEED_IDS.has(row.journal_id));
    const ids = savedRows.map((row) => row.journal_id);
    if (!ids.length) return Response.json({ dreams: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data: messages, error: messageError } = await db().from("journal_messages").select().in("session_id", ids).order("sequence");
    if (messageError) throw messageError;
    const dreams = savedRows.filter((r) => r.journal_sessions?.status === "completed").map((row) => {
      const build: BuildData = { journalID: row.journal_id, mainEmotion: row.main_emotion, secondaryEmotion: row.secondary_emotion,
        buildHeight: row.build_height, hoverDesc: row.hover_desc, themes: row.themes };
      return databaseDream(build, row.journal_sessions as JournalSession, (messages as JournalMessage[]).filter((m) => m.session_id === row.journal_id));
    });
    return Response.json({ dreams }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load saved buildings. Check database access." }, { status: 500 });
  }
}

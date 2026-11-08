import { db, fromRow, latestInsights } from "@/lib/db";
import type { BuildDataRow, JournalMessage, JournalSession } from "@/lib/db";
import { databaseDream } from "@/lib/databaseCity";
import { cityParam } from "@/lib/cityParam";

// ── (ADDED) Hide known seed fixtures without deleting database rows ──
const SEED_IDS = new Set([
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
]);

type Row = BuildDataRow & { journal_sessions: (JournalSession & { city_id?: string | null }) | null };

// ── (ADDED) Read only buildings with saved database records ──
// Every LLM 2a field comes from build_data (see lib/databaseCity.ts); the journal supplies the entry itself.
// GET /api/city?city=<id> -> that city's buildings; no city (or "mine") = the default "My city".
export async function GET(request: Request) {
  const cityId = cityParam(request.url) ?? null;
  try {
    const { data: rows, error } = await db().from("build_data").select("*, journal_sessions(*)");
    if (error) throw error;
    // Filtered here rather than in SQL, so it also works before migration 005 adds city_id (all "My city")
    const savedRows = ((rows ?? []) as Row[]).filter(
      (row) => !SEED_IDS.has(row.journal_id) && row.journal_sessions?.status === "completed" && (row.journal_sessions.city_id ?? null) === cityId,
    );
    const ids = savedRows.map((row) => row.journal_id);
    if (!ids.length) return Response.json({ dreams: [] }, { headers: { "Cache-Control": "no-store" } });
    const { data: messages, error: messageError } = await db().from("journal_messages").select().in("session_id", ids).order("sequence");
    if (messageError) throw messageError;
    const dreams = savedRows.map((row) =>
      databaseDream(fromRow(row), row.journal_sessions as JournalSession, (messages as JournalMessage[]).filter((m) => m.session_id === row.journal_id)),
    );
    // The newest saved LLM 2b insight for each building (table from migration 004; skipped if missing)
    try {
      const saved = await latestInsights(ids);
      for (const d of dreams) {
        const i = saved.get(d.id);
        if (i) Object.assign(d, { insight: i.text, insightSource: i.source, insightSupport: i.support });
      }
    } catch (err) {
      console.warn("city: insights not loaded:", err instanceof Error ? err.message : err);
    }
    return Response.json({ dreams }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("city:", err);
    return Response.json({ error: "Could not load saved buildings. Check database access." }, { status: 500 });
  }
}

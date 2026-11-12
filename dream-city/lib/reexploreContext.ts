import { db, fromRow, getMessages, type BuildData, type BuildDataRow, type JournalMessage, type JournalSession, type Media } from "@/lib/db";
import { databaseDream } from "@/lib/databaseCity";
import { computeLinks } from "@/lib/link";
import { symbolStats } from "@/lib/honesty";
import baseRates from "@/data/baseRates.json";
import type { InsightRequest } from "@/lib/insight";
import type { Work } from "@/lib/types";

// (added) Build evidence on the server from the saved dream's city, never browser-supplied claims.
export async function reexploreContext(session: JournalSession & { city_id?: string | null }, build: BuildData): Promise<InsightRequest> {
  const [{ data: rows, error }, { data: mediaRows, error: mediaError }, currentMessages] = await Promise.all([
    db().from("build_data").select("*,journal_sessions(*)"),
    db().from("media").select("*"),
    getMessages(session.id),
  ]);
  if (error || mediaError) throw new Error("Could not load the saved city's evidence.");
  type Row = BuildDataRow & { journal_sessions: (JournalSession & { city_id?: string | null }) | null };
  const sameCity = (value: { city_id?: string | null }) => (value.city_id ?? null) === (session.city_id ?? null);
  const seeds = new Set(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"]);
  const savedRows = ((rows ?? []) as Row[]).filter((row) => row.journal_id !== session.id && !seeds.has(row.journal_id) && row.journal_sessions?.status === "completed" && sameCity(row.journal_sessions));
  const ids = savedRows.map((row) => row.journal_id);
  const messages = ids.length ? await db().from("journal_messages").select("*").in("session_id", ids).order("sequence") : { data: [], error: null };
  if (messages.error) throw new Error("Could not load saved conversations.");
  const dream = databaseDream(build, session, currentMessages);
  const dreams = [...savedRows.map((row) => databaseDream(fromRow(row), row.journal_sessions!, (messages.data as JournalMessage[]).filter((message) => message.session_id === row.journal_id))), dream];
  const works: Work[] = ((mediaRows ?? []) as Media[]).filter((media) => sameCity(media) && media.main_emotion).map((media) => ({
    id: `media:${media.id}`, title: media.title, creator: media.creator ?? undefined, kind: media.kind,
    consumedOn: media.consumed_on, userNote: media.user_note ?? undefined,
    primaryEmotion: media.main_emotion!, symbols: media.symbols ?? [], themes: media.themes,
  }));
  return { dream, dreams, works, links: computeLinks(dreams, works).filter((link) => link.from === dream.id), stats: symbolStats(dreams, baseRates.rates) };
}

// Server-only Supabase access for the journal tables (see supabase/schema.sql).
// Uses the service role key, which bypasses RLS, so never import this from a client component.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Emotion, HvdcEmotion, WorkKind } from "./types";

export type SessionStatus = "draft" | "questioning" | "completed";

export type JournalSession = {
  id: string;
  status: SessionStatus;
  conversation_md: string | null;
  created_at: string;
  completed_at: string | null;
};

export type JournalMessage = {
  id: string;
  session_id: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  reply_to_id: string | null;
  created_at: string;
};

// What LLM 2a read from one session (lib/buildData.ts, lib/extraction.ts). One row per building.
export type BuildData = {
  journalID: string; // journal_sessions.id
  mainEmotion: Emotion; // district
  secondaryEmotion: Emotion | null; // a second stated feeling, never the same as mainEmotion
  buildHeight: number; // 1-10
  hoverDesc: string; // one short line: the title and hover label
  themes: string[];
  // Added by migration 003. Null or empty on rows saved before it.
  description: string | null; // up to two sentences
  microEmotion: string | null; // street
  symbols: string[]; // from data/vocab.json: roads, labels and towers depend on these
  newSymbols: string[]; // not in the vocab; kept for review
  places: string[];
  emotionStated: boolean | null; // Hall and Van de Castle: only stated emotions are coded
  hvdcEmotion: HvdcEmotion | null;
  intensitySource: "self" | "ai" | null;
  mentionedWorks: string[]; // titles the dreamer named
  typicalDreams: string[]; // Typical Dreams Questionnaire ids (data/typicalDreams.json)
};

export type BuildDataRow = {
  journal_id: string;
  main_emotion: Emotion;
  secondary_emotion: Emotion | null;
  build_height: number;
  hover_desc: string;
  themes: string[] | null;
  description?: string | null;
  micro_emotion?: string | null;
  symbols?: string[] | null;
  new_symbols?: string[] | null;
  places?: string[] | null;
  emotion_stated?: boolean | null;
  hvdc_emotion?: HvdcEmotion | null;
  intensity_source?: "self" | "ai" | null;
  mentioned_works?: string[] | null;
  typical_dreams?: string[] | null;
};

let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local and restart the dev server.");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---- sessions ----

export async function createSession(): Promise<JournalSession> {
  return must(await db().from("journal_sessions").insert({}).select().single());
}

export async function getSession(id: string): Promise<JournalSession | null> {
  return must(await db().from("journal_sessions").select().eq("id", id).maybeSingle());
}

export async function listSessions(): Promise<JournalSession[]> {
  return must(await db().from("journal_sessions").select().order("created_at"));
}

export async function setSessionStatus(id: string, status: SessionStatus): Promise<void> {
  must(await db().from("journal_sessions").update({ status }).eq("id", id));
}

/** Saves the final markdown and marks the session completed. */
export async function completeSession(id: string, conversationMd: string): Promise<void> {
  must(
    await db()
      .from("journal_sessions")
      .update({ conversation_md: conversationMd, status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id),
  );
}

// ---- messages ----

/** Writes a reserved conversation position, or appends for legacy callers. */
export async function addMessage(
  sessionId: string,
  role: JournalMessage["role"],
  content: string,
  replyToId: string | null = null,
  position?: number,
): Promise<JournalMessage> {
  let sequence = position;
  if (sequence === undefined) {
    const last = must(
      await db()
        .from("journal_messages")
        .select("sequence")
        .eq("session_id", sessionId)
        .order("sequence", { ascending: false })
        .limit(1),
    ) as { sequence: number }[];
    sequence = last.length ? last[0].sequence + 1 : 0;
  }
  return must(
    await db()
      .from("journal_messages")
      .insert({ session_id: sessionId, sequence, role, content, reply_to_id: replyToId })
      .select()
      .single(),
  );
}

export async function getMessages(sessionId: string): Promise<JournalMessage[]> {
  return must(await db().from("journal_messages").select().eq("session_id", sessionId).order("sequence"));
}

// ---- build_data ----

export const fromRow = (r: BuildDataRow): BuildData => ({
  journalID: r.journal_id,
  mainEmotion: r.main_emotion,
  secondaryEmotion: r.secondary_emotion && r.secondary_emotion !== r.main_emotion ? r.secondary_emotion : null,
  buildHeight: r.build_height,
  hoverDesc: r.hover_desc,
  themes: r.themes ?? [],
  description: r.description ?? null,
  microEmotion: r.micro_emotion ?? null,
  symbols: r.symbols ?? [],
  newSymbols: r.new_symbols ?? [],
  places: r.places ?? [],
  emotionStated: r.emotion_stated ?? null,
  hvdcEmotion: r.hvdc_emotion ?? null,
  intensitySource: r.intensity_source ?? null,
  mentionedWorks: r.mentioned_works ?? [],
  typicalDreams: r.typical_dreams ?? [],
});

export async function upsertBuildData(b: BuildData): Promise<void> {
  const row: BuildDataRow = {
    journal_id: b.journalID,
    main_emotion: b.mainEmotion,
    secondary_emotion: b.secondaryEmotion,
    build_height: b.buildHeight,
    hover_desc: b.hoverDesc,
    themes: b.themes,
    description: b.description,
    micro_emotion: b.microEmotion,
    symbols: b.symbols,
    new_symbols: b.newSymbols,
    places: b.places,
    emotion_stated: b.emotionStated ?? false,
    hvdc_emotion: b.hvdcEmotion,
    intensity_source: b.intensitySource ?? "ai",
    mentioned_works: b.mentionedWorks,
    typical_dreams: b.typicalDreams,
  };
  const res = await db().from("build_data").upsert(row);
  // Database not migrated yet (supabase/migrations/003_build_data_llm2a.sql): save the original columns
  // so recording still works, and say what to run.
  if (res.error && /column/i.test(res.error.message) && /could not find|does not exist/i.test(res.error.message)) {
    console.warn(`build_data is missing the LLM 2a columns (${res.error.message}). Run supabase/migrations/003_build_data_llm2a.sql.`);
    const { journal_id, main_emotion, build_height, hover_desc, themes } = row;
    must(await db().from("build_data").upsert({ journal_id, main_emotion, secondary_emotion: b.secondaryEmotion ?? main_emotion, build_height, hover_desc, themes }));
    return;
  }
  must(res);
}

export async function listBuildData(): Promise<BuildData[]> {
  return (must(await db().from("build_data").select()) as BuildDataRow[]).map(fromRow);
}

// ---- media (recently consumed books, films, songs, games) ----

export type Media = {
  id: string;
  kind: WorkKind;
  title: string;
  creator: string | null;
  consumed_on: string; // YYYY-MM-DD
  user_note: string | null;
  themes: string[];
  main_emotion: Emotion | null;
  external_id: string | null;
  created_at: string;
};

export type NewMedia = Pick<Media, "kind" | "title"> &
  Partial<Pick<Media, "creator" | "consumed_on" | "user_note" | "themes" | "main_emotion" | "external_id">>;

export async function addMedia(m: NewMedia): Promise<Media> {
  return must(await db().from("media").insert(m).select().single());
}

// Newest first. Pass a date (YYYY-MM-DD) to get only media consumed on or after it,
// e.g. the week before a dream.
export async function listMedia(opts: { since?: string; limit?: number } = {}): Promise<Media[]> {
  let q = db().from("media").select().order("consumed_on", { ascending: false });
  if (opts.since) q = q.gte("consumed_on", opts.since);
  if (opts.limit) q = q.limit(opts.limit);
  return must(await q);
}

// The same work already saved? Matches on external_id (e.g. tmdb:603) or on kind + title, ignoring case.
export async function findDuplicateMedia(m: { kind: string; title: string; external_id?: string | null }): Promise<Media | null> {
  if (m.external_id) {
    const byId = must(await db().from("media").select().eq("external_id", m.external_id).limit(1)) as Media[];
    if (byId.length) return byId[0];
  }
  const title = m.title.trim().replace(/[%_\\]/g, (c) => "\\" + c); // escape ilike wildcards
  const byTitle = must(await db().from("media").select().eq("kind", m.kind).ilike("title", title).limit(1)) as Media[];
  return byTitle[0] ?? null;
}

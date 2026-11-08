"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toMarkdown, type Entry } from "@/lib/entry";
import type { Dream, Emotion, Extraction, InsightSupport, Selection, Work, WorkKind } from "@/lib/types";
import { ApiError, fetchExtraction, fetchInsight, startJournal, saveJournalAnswer, finishJournal } from "@/services/api";
import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import { computeModel } from "./cityModel";
import { loadSavedDreams } from "@/services/loadSavedDreams";

export type UISelection = Selection | { kind: "plaza" } | { kind: "island"; id: Emotion } | null;

export type Settings = { pixelation: boolean; bloom: boolean; labels: boolean };

/** A small "it's created" popup in the middle of the screen that fades away by itself. */
export type Notice = { id: number; title: string; body?: string; color?: string };
const NOTICE_MS = 2600;

export type StoredInsight = { text: string; source: "ai" | "fallback" | "demo"; support?: InsightSupport };

type RecordState = {
  open: boolean;
  step: "input" | "followups" | "building";
  transcript: string;
  questions: string[];
  answers: string[];
  aiQuestion: boolean;
  busy: boolean;
  error: string | null;
  errorDetails: string[];
  canUseOffline: boolean;
  // ── (ADDED) Journal session and question IDs ──
  sessionId: string | null;
  questionIds: string[];
};

type State = {
  userDreams: Dream[];
  cityLoading: boolean;
  cityError: string | null;
  loadCity: () => Promise<void>;
  userWorks: Work[]; // the city's media (the + Media form): library buildings with roads to dreams
  loadMedia: () => Promise<void>;
  // ── Several dream cities: null = the default "My city"; others are rows in the cities table ──
  cityId: string | null;
  cities: City[];
  loadCities: () => Promise<void>;
  setCity: (id: string | null) => void;
  createCity: (name: string, blurb?: string) => Promise<string | null>;
  insights: Record<string, StoredInsight>;
  insightLoading: Record<string, boolean>;
  selection: UISelection;
  hoverId: string | null;
  timelineDay: number | null; // null = the whole city
  playing: boolean;
  justBuiltId: string | null;
  cameraNonce: number;
  citation: string | null;
  entryOpen: string | null; // dream id whose full journal entry is open
  notice: Notice | null;
  settings: Settings;
  record: RecordState;

  select: (s: UISelection) => void;
  hover: (id: string | null) => void;
  setTimelineDay: (d: number | null) => void;
  setPlaying: (p: boolean) => void;
  resetCamera: () => void;
  toggleSetting: (k: keyof Settings) => void;
  openCitation: (id: string | null) => void;
  openEntry: (dreamId: string | null) => void;
  showNotice: (n: Omit<Notice, "id">) => void;
  requestInsight: (dreamId: string, opts?: { force?: boolean }) => Promise<void>;

  openRecord: () => void;
  closeRecord: () => void;
  setTranscript: (t: string) => void;
  setAnswer: (i: number, a: string) => void;
  submitTranscript: () => Promise<void>;
  buildDream: (opts?: { offline?: boolean }) => Promise<void>;
  removeUserDreams: () => void;
};

const emptyRecord: RecordState = {
  open: false,
  step: "input",
  transcript: "",
  questions: [],
  answers: [],
  aiQuestion: false,
  busy: false,
  error: null,
  errorDetails: [],
  canUseOffline: false,
  // ── (ADDED) Empty IDs until a session starts ──
  sessionId: null,
  questionIds: [],
};

// ── (ADDED) Deduplicate overlapping database refreshes ──
let cityRequestActive = false;

const today = () => new Date().toISOString().slice(0, 10);

type MediaRow = { id: string; kind: WorkKind; title: string; creator: string | null; consumed_on: string; user_note: string | null; themes: string[]; main_emotion: Emotion | null; symbols?: string[] };
export type City = { id: string; name: string; blurb: string | null; is_demo: boolean };
const mediaToWork = (m: MediaRow): Work => ({
  id: `media:${m.id}`,
  title: m.title,
  creator: m.creator ?? undefined,
  kind: m.kind,
  consumedOn: m.consumed_on,
  userNote: m.user_note ?? undefined,
  primaryEmotion: m.main_emotion as Emotion,
  symbols: m.symbols ?? [],
  themes: m.themes,
});

const cityQuery = (id: string | null) => `city=${id ?? "mine"}`;

export const useCityStore = create<State>()(
  persist(
    (set, get) => ({
      userDreams: [],
      userWorks: [],
      loadMedia: async () => {
        try {
          const res = await fetch(`/api/media?${cityQuery(get().cityId)}`, { cache: "no-store" });
          if (!res.ok) return;
          const { media } = (await res.json()) as { media: MediaRow[] };
          const works = media.filter((m) => m.main_emotion).map(mediaToWork);
          // Unchanged media must not rebuild the city's geometry
          if (JSON.stringify(works) !== JSON.stringify(get().userWorks)) set({ userWorks: works });
        } catch {
          // offline or Supabase not set up: the city just shows the demo works
        }
      },
      cityLoading: true,
      cityError: null,
      // ── (ADDED) Database is the sole source of map buildings ──
      loadCity: async () => {
        if (cityRequestActive) return;
        cityRequestActive = true;
        set({ cityLoading: true, cityError: null });
        try {
          const data = { dreams: await loadSavedDreams<Dream>(fetch, 12000, `/api/city?${cityQuery(get().cityId)}`) };
          // ── (ADDED) Unchanged database rows must not rebuild terrain and meshes ──
          const unchanged = JSON.stringify(get().userDreams) === JSON.stringify(data.dreams);
          set({ userDreams: unchanged ? get().userDreams : data.dreams, cityLoading: false,
            ...(unchanged ? {} : { timelineDay: null }) });
        } catch (error) {
          set({ cityLoading: false, cityError: error instanceof Error ? error.message : "Could not load city." });
        } finally {
          cityRequestActive = false;
        }
      },
      cityId: null,
      cities: [],
      loadCities: async () => {
        try {
          const res = await fetch("/api/cities", { cache: "no-store" });
          if (!res.ok) return;
          const { cities } = (await res.json()) as { cities: City[] };
          set({ cities });
          // A remembered city that no longer exists falls back to "My city"
          const id = get().cityId;
          if (id && !cities.some((c) => c.id === id)) get().setCity(null);
        } catch {
          // no database yet: only "My city"
        }
      },
      setCity: (id) => {
        if (id === get().cityId) return;
        set({ cityId: id, userDreams: [], userWorks: [], selection: null, timelineDay: null, justBuiltId: null, entryOpen: null });
        void get().loadCity();
        void get().loadMedia();
      },
      createCity: async (name, blurb) => {
        try {
          const res = await fetch("/api/cities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, blurb }) });
          const data = (await res.json().catch(() => ({}))) as { city?: City; error?: string };
          if (!res.ok || !data.city) {
            get().showNotice({ title: "Could not create the city", body: data.error ?? `Error ${res.status}` });
            return null;
          }
          set((st) => ({ cities: [...st.cities, data.city!] }));
          get().setCity(data.city.id);
          return data.city.id;
        } catch {
          return null;
        }
      },
      insights: {},
      insightLoading: {},
      selection: null,
      hoverId: null,
      timelineDay: null,
      playing: false,
      justBuiltId: null,
      cameraNonce: 0,
      citation: null,
      entryOpen: null,
      notice: null,
      settings: { pixelation: true, bloom: true, labels: true },
      record: emptyRecord,

      select: (selection) => set({ selection }),
      hover: (hoverId) => set({ hoverId }),
      setTimelineDay: (timelineDay) => set({ timelineDay }),
      setPlaying: (playing) => set({ playing }),
      resetCamera: () => set((s) => ({ cameraNonce: s.cameraNonce + 1, selection: null })),
      toggleSetting: (k) => set((s) => ({ settings: { ...s.settings, [k]: !s.settings[k] } })),
      openCitation: (citation) => set({ citation }),
      openEntry: (entryOpen) => set({ entryOpen }),
      showNotice: (n) => {
        const id = Date.now();
        set({ notice: { ...n, id } });
        setTimeout(() => {
          if (get().notice?.id === id) set({ notice: null });
        }, NOTICE_MS);
      },

      // Ask the backend for a grounded insight for one dream (cached).
      requestInsight: async (dreamId, opts) => {
        const s = get();
        if (s.insightLoading[dreamId]) return;
        if (!opts?.force && s.insights[dreamId]) return;
        const model = computeModel(s.userDreams, null, s.insights, s.userWorks);
        const dream = model.dreamById.get(dreamId);
        if (!dream) return;
        set((st) => ({ insightLoading: { ...st.insightLoading, [dreamId]: true } }));
        try {
          // LLM 2b gets the same links the city draws: to the city's media and to earlier dreams
          const { insight: _old, ...plain } = dream;
          void _old;
          const res = await fetchInsight({
            dream: plain,
            links: model.links.filter((l) => l.from === dreamId),
            works: model.allWorks,
            dreams: model.allDreams,
            stats: model.statsList,
          });
          set((st) => ({ insights: { ...st.insights, [dreamId]: { text: res.insight, source: res.source, support: res.support } } }));
        } catch {
          // leave it as it was; the panel offers a retry
        } finally {
          set((st) => ({ insightLoading: { ...st.insightLoading, [dreamId]: false } }));
        }
      },

      openRecord: () => set({ record: { ...emptyRecord, open: true }, selection: null, timelineDay: null, playing: false }),
      closeRecord: () => set({ record: emptyRecord }),
      setTranscript: (transcript) => set((s) => ({ record: { ...s.record, transcript, error: null } })),
      setAnswer: (i, a) =>
        set((s) => {
          const answers = [...s.record.answers];
          answers[i] = a;
          return { record: { ...s.record, answers } };
        }),

      submitTranscript: async () => {
        if (get().record.busy) return;
        const { transcript } = get().record;
        if (transcript.trim().length < 12) {
          set((s) => ({ record: { ...s.record, error: "Tell me a little more about the dream first." } }));
          return;
        }
        set((s) => ({ record: { ...s.record, busy: true, error: null } }));
        try {
          // ── (ADDED) Store IDs returned by the saved journal session ──
          const res = await startJournal(transcript, get().cityId);
          if (!get().record.open || get().record.transcript !== transcript) return;
          set((s) => ({ record: {
            ...s.record, busy: false, step: "followups",
            sessionId: res.sessionId,
            questionIds: res.questions.map((q) => q.id),
            questions: res.questions.map((q) => q.text),
            answers: res.questions.map(() => ""), aiQuestion: res.aiUsed,
          } }));
        } catch (error) {
          set((s) => ({ record: { ...s.record, busy: false, error: error instanceof Error ? error.message : "Could not start journal." } }));
        }
      },

      buildDream: async () => {
        if (get().record.busy) return;
        const { record } = get();
        const entry: Entry = {
          date: today(),
          transcript: record.transcript.trim(),
          followUps: record.questions.map((q, i) => ({ q, a: (record.answers[i] ?? "").trim() })),
        };
        set((s) => ({ record: { ...s.record, busy: true, step: "building", error: null, errorDetails: [] } }));

        // ── (ADDED) Save non-empty answers before processing the building ──
        try {
          if (!record.sessionId) throw new Error("Start a journal session before saving answers.");
          for (let i = 0; i < record.questions.length; i++) {
            const answer = record.answers[i]?.trim();
            if (!answer) continue;
            const questionId = record.questionIds[i];
            if (!questionId) throw new Error("Missing saved question ID.");
            await saveJournalAnswer(record.sessionId, questionId, answer);
          }
          // (added) Save every completed conversation as one Markdown document.
          await finishJournal(record.sessionId);
        } catch (error) {
          set((s) => ({ record: { ...s.record, busy: false, step: "followups", error: error instanceof Error ? error.message : "Could not save answers." } }));
          return;
        }

        let extraction: Extraction;
        let entryOut: Entry = entry;
        let journalMarkdown: string | undefined;
        {
          try {
            // LLM 2a reads LLM 1's saved output (the dream and its Q&A) and stores every field in build_data
            const res = await fetchExtraction(toMarkdown(entry), record.sessionId ?? undefined);
            extraction = res.extraction;
            entryOut = res.entry;
            journalMarkdown = res.markdown;
          } catch (err) {
            set((s) => ({
              record: {
                ...s.record,
                busy: false,
                step: "followups",
                error: err instanceof ApiError ? err.message : "Could not read that dream.",
                errorDetails: err instanceof ApiError ? err.details : [],
                canUseOffline: false,
              },
            }));
            return;
          }
        }

        const { newSymbols: _ignored, ...fields } = extraction;
        void _ignored; // kept server-side for review, not used in the city
        const dream: Dream = {
          id: record.sessionId!,
          date: entryOut.date,
          transcript: entryOut.transcript,
          followUps: entryOut.followUps, // every question, answered or not (same as /api/city)
          ...fields, // includes description, secondaryEmotion, mentionedWorks and typicalDreams
          journalMarkdown,
        };
        set((s) => ({
          userDreams: [...s.userDreams.filter((d) => d.id !== dream.id), dream],
          record: emptyRecord,
          justBuiltId: dream.id,
          selection: { kind: "dream", id: dream.id },
          timelineDay: null,
        }));
        setTimeout(() => {
          if (get().justBuiltId === dream.id) set({ justBuiltId: null });
        }, 4000);
        get().showNotice({
          title: "Dream recorded",
          body: `Rising on the ${EMOTION_LABELS[dream.primaryEmotion]} island`,
          color: EMOTION_COLORS[dream.primaryEmotion],
        });
        void get().requestInsight(dream.id);
      },

      removeUserDreams: () => set({ userDreams: [], selection: null, timelineDay: null, justBuiltId: null }),
    }),
    {
      name: "dream-city-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings, insights: s.insights, cityId: s.cityId }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          userDreams: current.userDreams,
          insights: p.insights && typeof p.insights === "object" ? p.insights : {},
          cityId: typeof p.cityId === "string" ? p.cityId : null,
          // only keep known settings (older saves may still carry the removed "sound" flag)
          settings: {
            pixelation: p.settings?.pixelation ?? current.settings.pixelation,
            bloom: p.settings?.bloom ?? current.settings.bloom,
            labels: p.settings?.labels ?? current.settings.labels,
          },
        };
      },
    },
  ),
);

// Dev-only handle for automated UI checks.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __dreamCity: typeof useCityStore }).__dreamCity = useCityStore;
}

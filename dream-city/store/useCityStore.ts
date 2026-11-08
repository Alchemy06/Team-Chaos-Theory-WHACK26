"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { toMarkdown, type Entry } from "@/lib/entry";
import type { Dream, Extraction, Selection } from "@/lib/types";
import { ApiError, fetchExtraction, fetchInsight, startJournal, saveJournalAnswer, finishJournal } from "@/services/api";
import { offlineExtract } from "@/services/offline";
import { playRiseTone, setAmbient } from "@/services/sound";
import { computeModel } from "./cityModel";

export type UISelection = Selection | { kind: "plaza" } | null;

export type Settings = { pixelation: boolean; bloom: boolean; labels: boolean; sound: boolean };

export type StoredInsight = { text: string; source: "ai" | "fallback" | "demo" };

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
  insights: Record<string, StoredInsight>;
  insightLoading: Record<string, boolean>;
  selection: UISelection;
  hoverId: string | null;
  timelineDay: number | null; // null = the whole city
  playing: boolean;
  justBuiltId: string | null;
  cameraNonce: number;
  citation: string | null;
  settings: Settings;
  record: RecordState;

  select: (s: UISelection) => void;
  hover: (id: string | null) => void;
  setTimelineDay: (d: number | null) => void;
  setPlaying: (p: boolean) => void;
  resetCamera: () => void;
  toggleSetting: (k: keyof Settings) => void;
  openCitation: (id: string | null) => void;
  requestInsight: (dreamId: string) => Promise<void>;

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

const today = () => new Date().toISOString().slice(0, 10);

export const useCityStore = create<State>()(
  persist(
    (set, get) => ({
      userDreams: [],
      insights: {},
      insightLoading: {},
      selection: null,
      hoverId: null,
      timelineDay: null,
      playing: false,
      justBuiltId: null,
      cameraNonce: 0,
      citation: null,
      settings: { pixelation: true, bloom: true, labels: true, sound: false },
      record: emptyRecord,

      select: (selection) => set({ selection }),
      hover: (hoverId) => set({ hoverId }),
      setTimelineDay: (timelineDay) => set({ timelineDay }),
      setPlaying: (playing) => set({ playing }),
      resetCamera: () => set((s) => ({ cameraNonce: s.cameraNonce + 1, selection: null })),
      toggleSetting: (k) =>
        set((s) => {
          const settings = { ...s.settings, [k]: !s.settings[k] };
          if (k === "sound") setAmbient(settings.sound);
          return { settings };
        }),
      openCitation: (citation) => set({ citation }),

      // Ask the backend for a grounded insight for one dream (cached).
      requestInsight: async (dreamId) => {
        const s = get();
        if (s.insights[dreamId] || s.insightLoading[dreamId]) return;
        const model = computeModel(s.userDreams, null, s.insights);
        const dream = model.dreamById.get(dreamId);
        if (!dream) return;
        set((st) => ({ insightLoading: { ...st.insightLoading, [dreamId]: true } }));
        try {
          const res = await fetchInsight({
            dream,
            links: model.links.filter((l) => l.from === dreamId),
            works: model.allWorks,
            dreams: model.allDreams,
            stats: model.statsList,
          });
          set((st) => ({ insights: { ...st.insights, [dreamId]: { text: res.insight, source: res.source } } }));
        } catch {
          // leave it empty; the panel offers a retry
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
          const res = await startJournal(transcript);
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

      buildDream: async (opts) => {
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
        if (opts?.offline) {
          extraction = offlineExtract(entry);
        } else {
          try {
            const res = await fetchExtraction(toMarkdown(entry), record.sessionId ?? undefined);
            extraction = res.extraction;
            entryOut = res.entry;
          } catch (err) {
            set((s) => ({
              record: {
                ...s.record,
                busy: false,
                step: "followups",
                error: err instanceof ApiError ? err.message : "Could not read that dream.",
                errorDetails: err instanceof ApiError ? err.details : [],
                canUseOffline: true,
              },
            }));
            return;
          }
        }

        const { newSymbols: _ignored, ...fields } = extraction;
        void _ignored; // kept server-side for review, not used in the city
        const dream: Dream = {
          id: `u-${Date.now().toString(36)}`,
          date: entryOut.date,
          transcript: entryOut.transcript,
          followUps: entryOut.followUps.filter((f) => f.a),
          ...fields,
        };
        set((s) => ({
          userDreams: [...s.userDreams, dream],
          record: emptyRecord,
          justBuiltId: dream.id,
          selection: { kind: "dream", id: dream.id },
          timelineDay: null,
        }));
        if (get().settings.sound) playRiseTone();
        setTimeout(() => {
          if (get().justBuiltId === dream.id) set({ justBuiltId: null });
        }, 4000);
        void get().requestInsight(dream.id);
      },

      removeUserDreams: () => set({ userDreams: [], selection: null, timelineDay: null, justBuiltId: null }),
    }),
    {
      name: "dream-city-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ userDreams: s.userDreams, settings: s.settings, insights: s.insights }),
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          userDreams: Array.isArray(p.userDreams) ? p.userDreams : [],
          insights: p.insights && typeof p.insights === "object" ? p.insights : {},
          settings: { ...current.settings, ...(p.settings ?? {}), sound: false },
        };
      },
    },
  ),
);

// Dev-only handle for automated UI checks.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __dreamCity: typeof useCityStore }).__dreamCity = useCityStore;
}

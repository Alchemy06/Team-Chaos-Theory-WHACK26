// ------------------ Setup & Imports ------------------ //

"use client";

import { useEffect, useRef, useState } from "react";
import { speechSupported, startDictation } from "@/services/speech";
import { useCityStore } from "@/store/useCityStore";
import { PixelButton, PixelPanel, cx } from "./ui/Pixel";
import { VoiceQuestionAnswer } from "./VoiceQuestionAnswer";
import { QuestionSpeech } from "./QuestionSpeech";

// ------------------ Example Dreams ------------------ //

const EXAMPLES = [
  "I was running down a corridor in my old school because I was late for an exam, and every door I opened led to the sea.",
  "I was flying over a city at night and my friend kept pointing at the stars. The sky felt enormous.",
  "I was lost in a forest where the trees kept moving, and a stranger with a light wouldn't tell me the way out.",
];

// ------------------ Displaying Building Process ------------------ //

const BUILD_STEPS = ["Writing the dream entry", "Extracting emotion, symbols & intensity", "Finding your district and street", "Scoring roads to your library"];

function BuildingProgress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(BUILD_STEPS.length - 1, s + 1)), 700);
    return () => clearInterval(id);
  }, []);
  return (
    <ul className="space-y-2 py-2" aria-live="polite">
      {BUILD_STEPS.map((s, i) => (
        <li key={s} className={cx("flex items-center gap-3 text-[15px]", i <= step ? "text-ink" : "text-ink-faint")}>
          <span className={cx("h-3 w-3 shrink-0", i < step ? "bg-[var(--emo-confusion)]" : i === step ? "animate-pulse bg-gold" : "bg-line")} />
          {s}
        </li>
      ))}
    </ul>
  );
}

// ------------------ An Open/Close wrapper For Dialogue ------------------ //

export function RecordDreamSheet() {
  const open = useCityStore((s) => s.record.open);
  // Mounting the dialog only while open resets its local state on close.
  return open ? <RecordDreamDialog /> : null;
}

// ------------------ Sets Up States & Actions ------------------ //

function RecordDreamDialog() {
  const record = useCityStore((s) => s.record);
  const close = useCityStore((s) => s.closeRecord);
  const setTranscript = useCityStore((s) => s.setTranscript);
  const submit = useCityStore((s) => s.submitTranscript);
  const build = useCityStore((s) => s.buildDream);
  // ── (ADDED) Keep each question on screen until Next is clicked ──
  const [questionIndex, setQuestionIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [canSpeak] = useState(() => speechSupported());
  // ── (ADDED) Voice-first mode shares the same transcript with typing ──
  const [inputMode, setInputMode] = useState<"voice" | "keyboard">(() => speechSupported() ? "voice" : "keyboard");
  const interimRef = useRef("");
  const speechRun = useRef(0);
  const stopRef = useRef<() => void>(() => {});
  const baseRef = useRef("");

// ------------------ Microphone Controls ------------------ //

  useEffect(() => () => {
    speechRun.current += 1;
    stopRef.current();
  }, []);

  // ── (ADDED) Preserve visible speech and ignore late events when switching ──
  const stopMic = () => {
    speechRun.current += 1;
    if (interimRef.current) {
      const current = useCityStore.getState().record.transcript;
      setTranscript([current, interimRef.current].filter(Boolean).join(" "));
    }
    interimRef.current = "";
    setInterim("");
    stopRef.current();
    stopRef.current = () => {};
    setListening(false);
  };

  const switchToKeyboard = () => {
    stopMic();
    setInputMode("keyboard");
  };

  const toggleMic = () => {
    if (listening) return stopMic();
    setMicError(null);
    baseRef.current = record.transcript ? record.transcript.trim() + " " : "";
    const run = ++speechRun.current;
    setListening(true);
    try {
      stopRef.current = startDictation({
        onText: (finalText, interimText) => {
          if (run !== speechRun.current) return;
          setTranscript(baseRef.current + finalText);
          interimRef.current = interimText;
          setInterim(interimText);
        },
        onEnd: () => {
          if (run !== speechRun.current) return;
          stopMic();
        },
        onError: (msg) => {
          if (run !== speechRun.current) return;
          switchToKeyboard();
          setMicError(msg + " You can type your dream instead.");
        },
      });
    } catch {
      switchToKeyboard();
      setMicError("Could not start the microphone. You can type your dream instead.");
    }
  };

  // ------------------ Dialogue Title ------------------ //
  const title = record.step === "input" ? "What did you dream?" : record.step === "followups" ? (record.questions[questionIndex] ?? "Your dream") : "Your building is rising…";

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-end bg-(--overlay)/55 sm:place-items-center sm:p-4">
      <PixelPanel className="anim-rise w-full max-w-xl">
        <div role="dialog" aria-modal="true" aria-labelledby="record-title" className="flex max-h-[88dvh] flex-col">
          {/* ------------------ Header & Close Button ------------------ */}
          <div className="flex items-center justify-between border-b-2 border-line px-4 py-3">
            <div>
              <div className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--emo-wonder)]">
                {record.step === "input" ? "Step 1 of 2" : record.step === "followups" ? "Step 2 of 2" : "Building"}
              </div>
              <h2 id="record-title" className="text-xl text-ink">
                {title}
              </h2>
            </div>
            <button type="button" onClick={close} className="pixel-btn grid h-8 w-8 place-items-center font-display text-xs" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="pixel-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {/* ------------------ Initial Dream Input ------------------ */}
            {record.step === "input" && (
              <div className="space-y-3">
                {/* ── (ADDED) Read the opening question before listening ── */}
                {inputMode === "voice" && !record.busy && (
                  <QuestionSpeech question="What did you dream?" onBeforeSpeak={stopMic} onFinished={toggleMic} />
                )}
                {/* ── (ADDED) Voice capture with a visible transcript ── */}
                {inputMode === "voice" ? (
                  <div className="space-y-4 rounded-md border-2 border-line bg-(--well) p-4">
                    <div className="flex flex-col items-center gap-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={toggleMic}
                        disabled={record.busy}
                        className={cx("pixel-btn grid h-20 w-20 place-items-center text-3xl", listening && "rec-pulse !border-[var(--emo-anger)] !text-[var(--emo-anger)]")}
                        aria-label={listening ? "Stop dictation" : "Speak your dream"}
                        aria-pressed={listening}
                      >
                        {listening ? "■" : "🎙"}
                      </button>
                      <p className="text-[16px] text-ink">{listening ? "Listening… tap to stop" : "Tap to describe your dream"}</p>
                      <p className="text-[12px] text-ink-faint">{listening ? "Your words will appear below." : "Tell it in your own words. Start wherever you remember."}</p>
                    </div>
                    <div className="min-h-20 whitespace-pre-wrap border-t-2 border-line pt-3 text-[15px] leading-relaxed text-ink" role="status" aria-live="polite" aria-label="Dream transcript">
                      {record.transcript || interim ? <>{record.transcript}{interim && <span className="text-ink-faint">{record.transcript ? " " : ""}{interim}</span>}</> : <span className="text-ink-faint">Your dream will appear here…</span>}
                    </div>

                  </div>
                ) : (
                  /* ── (ADDED) Keyboard editing keeps all previously spoken text ── */
                  <div className="space-y-2">
                    <label htmlFor="dream-transcript" className="block text-[14px] text-ink">Describe your dream</label>
                    <textarea
                      id="dream-transcript"
                      autoFocus
                      value={record.transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={5}
                      placeholder="Type what you remember…"
                      className="pixel-input w-full resize-none px-3 py-2 text-[16px] leading-relaxed"
                    />
                    <p className="text-[12px] text-ink-faint">Edit anything the microphone misheard, or write your dream here.</p>

                  </div>
                )}
                {/* ── (ADDED) Match the follow-up Voice / Type switch ── */}
                {canSpeak && (
                  <div className="inline-flex rounded-md border-2 border-line bg-(--well) p-0.5" role="group" aria-label="Dream input mode">
                    {(["voice", "keyboard"] as const).map((option) => (
                      <button key={option} type="button" aria-pressed={inputMode === option}
                        className={cx("px-3 py-1 font-display text-[10px] uppercase tracking-wider pixel-focus", inputMode === option ? "bg-line text-ink" : "text-ink-faint hover:text-ink")}
                        onClick={() => {
                          if (option === inputMode) return;
                          if (option === "keyboard") switchToKeyboard();
                          else { setMicError(null); setInputMode("voice"); }
                        }}>
                        {option === "voice" ? "Voice" : "Type"}
                      </button>
                    ))}
                  </div>
                )}
                {/* ------------------ Microphone Error ------------------ */}
                {micError && <p className="text-[13px] text-[var(--emo-anger)]">{micError}</p>}
                <div>
                  <div className="mb-1.5 font-display text-[10px] uppercase tracking-[0.14em] text-ink-faint">Or try an example</div>
                  <div className="flex flex-col gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => { stopMic(); setTranscript(ex); setInputMode("keyboard"); }}
                        className="pixel-focus rounded-md border-2 border-line bg-(--well) px-2 py-1.5 text-left text-[13px] leading-snug text-ink-dim hover:border-line-hi hover:text-ink"
                      >
                        “{ex}”
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ------------------ Follow-Up Questions & Answers ------------------ */}
            {record.step === "followups" && (
              <div className="space-y-3">
                <p className="border-l-2 border-line pl-3 text-[13px] italic text-ink-faint">“{record.transcript}”</p>
                {/* ── (ADDED) Speak assistant questions without reading the dream or answers ── */}
                <p className="font-display text-[11px] text-ink-faint">Question {questionIndex + 1} of {record.questions.length}</p>
                {/* ── (ADDED) One spoken question followed by voice or typed input ── */}
                {!record.busy && record.questions[questionIndex] && (
                  <VoiceQuestionAnswer key={questionIndex} question={record.questions[questionIndex]} index={questionIndex} aiQuestion={questionIndex === 2 && record.aiQuestion} />
                )}
              </div>
            )}

            {/* ------------------ Building Progress Display ------------------ */}
            {record.step === "building" && <BuildingProgress />}

            {/* ------------------ Processing Errors ------------------ */}
            {record.error && (
              <div className="mt-3 border-2 border-[var(--emo-anger)]/60 bg-[#2a0d12] p-2 text-[13px] text-[var(--emo-anger)]">
                <p>{record.error}</p>
                {record.errorDetails.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-[12px] text-ink-dim">
                    {record.errorDetails.slice(0, 3).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* ------------------ Footer & Submission Controls ------------------ */}
          {record.step !== "building" && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-line px-4 py-3">
              <p className="hidden text-[11px] leading-snug text-ink-faint sm:block">Your journal is saved to the team’s database.</p>
              <div className="ml-auto flex flex-wrap gap-2">
                {/* ------------------ Offline Fallback ------------------ */}
                {record.step === "followups" && record.canUseOffline && (
                  <PixelButton className="px-3 py-2" onClick={() => void build({ offline: true })} disabled={record.busy}>
                    Use offline estimate
                  </PixelButton>
                )}
                {/* ------------------ Continue / Build / Retry ------------------ */}
                <PixelButton
                  variant="primary"
                  className="px-4 py-2"
                  disabled={record.busy || record.transcript.trim().length === 0}
                  onClick={() => {
                    if (listening) stopMic();
                    // ── (ADDED) Advance manually; build only after the last question ──
                    if (record.step === "input") {
                      setQuestionIndex(0);
                      void submit();
                    } else if (questionIndex < record.questions.length - 1) {
                      setQuestionIndex((i) => i + 1);
                    } else {
                      void build();
                    }
                  }}
                >
                  {record.busy ? "Thinking…" : record.step === "input" ? "Continue ▸" : questionIndex < record.questions.length - 1 ? "Next question ▸" : record.canUseOffline ? "Try again ▸" : "Build it ▸"}
                </PixelButton>
              </div>
            </div>
          )}
        </div>
      </PixelPanel>
    </div>
  );
}

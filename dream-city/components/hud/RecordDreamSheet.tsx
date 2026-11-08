// ------------------ Setup & Imports ------------------ //

"use client";

import { useEffect, useRef, useState } from "react";
import { speechSupported, startDictation } from "@/services/speech";
import { useCityStore } from "@/store/useCityStore";
import { PixelButton, PixelPanel, cx } from "./ui/Pixel";

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
  const setAnswer = useCityStore((s) => s.setAnswer);
  const submit = useCityStore((s) => s.submitTranscript);
  const build = useCityStore((s) => s.buildDream);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [canSpeak] = useState(() => speechSupported());
  const stopRef = useRef<() => void>(() => {});
  const baseRef = useRef("");

// ------------------ Microphone Controls ------------------ //

  useEffect(() => () => stopRef.current(), []);

  const stopMic = () => {
    stopRef.current();
    setListening(false);
  };

  const toggleMic = () => {
    if (listening) return stopMic();
    setMicError(null);
    baseRef.current = record.transcript ? record.transcript.trim() + " " : "";
    setListening(true);
    stopRef.current = startDictation({
      onText: (finalText, interimText) => {
        setTranscript(baseRef.current + finalText);
        setInterim(interimText);
      },
      onEnd: () => {
        setListening(false);
        setInterim("");
      },
      onError: (msg) => {
        setMicError(msg);
        setListening(false);
      },
    });
  };

  // ------------------ Dialogue Title ------------------ //
  const title = record.step === "input" ? "What did you dream?" : record.step === "followups" ? "A few quick questions" : "Your building is rising…";

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-end bg-(--overlay)/55 sm:place-items-center sm:p-4">
      <PixelPanel className="anim-rise w-full max-w-xl">
        <div role="dialog" aria-modal="true" aria-labelledby="record-title" className="flex max-h-[88dvh] flex-col">
          {/* ------------------ Header & Close Button ------------------ */}
          <div className="flex items-center justify-between border-b-2 border-line px-4 py-3">
            <div>
              <div className="font-display text-[10px] uppercase tracking-[0.16em] text-[var(--emo-wonder)]">
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
                <div className="flex gap-3">
                  {/* ------------------ Microphone Button ------------------ */}
                  {canSpeak && (
                    <button
                      type="button"
                      onClick={toggleMic}
                      className={cx("pixel-btn grid h-14 w-14 shrink-0 place-items-center text-xl", listening && "rec-pulse !border-[var(--emo-anger)] !text-[var(--emo-anger)]")}
                      aria-label={listening ? "Stop dictation" : "Speak your dream"}
                      aria-pressed={listening}
                    >
                      {listening ? "■" : "🎙"}
                    </button>
                  )}
                  {/* ------------------ Editable Dream Transcript ------------------ */}
                  <div className="flex-1">
                    <textarea
                      autoFocus
                      value={record.transcript + (interim ? (record.transcript ? " " : "") + interim : "")}
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={5}
                      placeholder={canSpeak ? "Tap the mic and speak, or type here…" : "Type your dream here…"}
                      className="pixel-input w-full resize-none px-3 py-2 text-[16px] leading-relaxed"
                      aria-label="Dream transcript"
                    />
                    <p className="mt-1 text-[12px] text-ink-faint">{listening ? "Listening. You can edit the transcript afterwards." : "Edit anything the microphone misheard."}</p>
                  </div>
                </div>
                {/* ------------------ Microphone Error ------------------ */}
                {micError && <p className="text-[13px] text-[var(--emo-anger)]">{micError}</p>}
                <div>
                  <div className="mb-1.5 font-display text-[9px] uppercase tracking-[0.14em] text-ink-faint">Or try an example</div>
                  <div className="flex flex-col gap-1.5">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setTranscript(ex)}
                        className="pixel-focus border-2 border-line bg-(--well) px-2 py-1.5 text-left text-[13px] leading-snug text-ink-dim hover:border-line-hi hover:text-ink"
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
                {record.questions.map((q, i) => {
                  const isIntensity = /intense/i.test(q);
                  return (
                    <label key={q} className="block">
                      <span className="mb-1 flex items-baseline justify-between gap-2 text-[14px] text-ink">
                        {q}
                        {i === 2 && record.aiQuestion && <span className="font-display text-[8px] uppercase tracking-wider text-ink-faint">AI question</span>}
                      </span>
                      {isIntensity ? (
                        <div className="flex flex-wrap gap-1">
                          {Array.from({ length: 10 }, (_, n) => String(n + 1)).map((n) => (
                            <button
                              key={n}
                              type="button"
                              aria-pressed={record.answers[i] === n}
                              onClick={() => setAnswer(i, record.answers[i] === n ? "" : n)}
                              className="pixel-btn h-8 w-8 font-display text-[11px]"
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <input
                          autoFocus={i === 0}
                          value={record.answers[i] ?? ""}
                          onChange={(e) => setAnswer(i, e.target.value)}
                          className="pixel-input w-full px-3 py-2 text-[15px]"
                          placeholder="Optional"
                        />
                      )}
                    </label>
                  );
                })}
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
              <p className="hidden text-[11px] leading-snug text-ink-faint sm:block">Your dream stays in this browser.</p>
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
                    void (record.step === "input" ? submit() : build());
                  }}
                >
                  {record.busy ? "Thinking…" : record.step === "input" ? "Continue ▸" : record.canUseOffline ? "Try again ▸" : "Build it ▸"}
                </PixelButton>
              </div>
            </div>
          )}
        </div>
      </PixelPanel>
    </div>
  );
}

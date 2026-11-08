"use client";

import { useEffect, useRef, useState } from "react";
import { speechSupported, startDictation } from "@/services/speech";
import { useCityStore } from "@/store/useCityStore";
import { QuestionSpeech } from "./QuestionSpeech";
import { cx } from "./ui/Pixel";

// ── (ADDED) Question playback → voice answer, with a shared editable value ──
export function VoiceQuestionAnswer({ question, index, aiQuestion }: {
  question: string; index: number; aiQuestion: boolean;
}) {
  const answer = useCityStore((s) => s.record.answers[index] ?? "");
  const setAnswer = useCityStore((s) => s.setAnswer);
  const [supported] = useState(speechSupported);
  const [mode, setMode] = useState<"voice" | "type">(() => speechSupported() ? "voice" : "type");
  const modeRef = useRef(mode);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [spokenNumber, setSpokenNumber] = useState("");
  const stop = useRef<() => void>(() => {});
  const run = useRef(0);
  const handoffRetries = useRef(0);
  // ── (ADDED) Cancel pending automatic listening when changing mode or question ──
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIntensity = /intens|rate|rating|out of (?:10|ten)/i.test(question);
  // ── (ADDED) Rating follows the same speak → listen handoff as every question ──
  const spokenQuestion = question;

  useEffect(() => () => {
    if (handoff.current) clearTimeout(handoff.current);
    run.current += 1;
    stop.current();
  }, []);

  function stopListening() {
    if (handoff.current) clearTimeout(handoff.current);
    handoff.current = null;
    run.current += 1;
    stop.current();
    stop.current = () => {};
    setListening(false);
    setStarting(false);
  }

  // ── (ADDED) Start automatically after spoken audio releases the microphone ──
  function listenAfterQuestion() {
    if (!supported || modeRef.current !== "voice") return;
    stopListening();
    setStarting(true);
    handoff.current = setTimeout(() => {
      handoff.current = null;
      startListening();
    }, 150);
  }

  function startListening() {
    if (!supported || modeRef.current !== "voice") return;
    stopListening();
    setError("");
    const token = ++run.current;
    const base = useCityStore.getState().record.answers[index]?.trim() ?? "";
    setStarting(true);
    try {
      stop.current = startDictation({
        // ── (ADDED) Show listening only when the browser actually opens the mic ──
        onStart: () => {
          if (token !== run.current) return;
          setStarting(false);
          setListening(true);
        },
        onText: (finalText, interim) => {
          if (token !== run.current) return;
          const spoken = [finalText, interim].filter(Boolean).join(" ");
          if (isIntensity) {
            setSpokenNumber(spoken);
            const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
            const number = spoken.toLowerCase().match(/\b(10|[1-9]|one|two|three|four|five|six|seven|eight|nine|ten)\b/)?.[0];
            if (number) setAnswer(index, words.includes(number) ? String(words.indexOf(number) + 1) : number);
          } else {
            setAnswer(index, [base, spoken].filter(Boolean).join(" "));
          }
        },
        onEnd: () => { if (token === run.current) { run.current += 1; setListening(false); setStarting(false); } },
        onError: (message) => {
          if (token !== run.current) return;
          stopListening();
          if (message === "aborted" && handoffRetries.current < 1) {
            handoffRetries.current += 1;
            listenAfterQuestion();
            return;
          }
          if (message === "no-speech") {
            setError("No speech detected. Replay the question to listen again, or choose Type.");
            return;
          }
          modeRef.current = "type";
          setMode("type");
          setError(message + " You can type or select an answer instead.");
        },
      });
    } catch {
      stopListening();
      modeRef.current = "type";
      setMode("type");
      setError("Microphone unavailable. You can type or select an answer instead.");
    }
  }

  return (
    <div className="space-y-3">
      {mode === "voice" && <QuestionSpeech question={spokenQuestion} onBeforeSpeak={() => { handoffRetries.current = 0; stopListening(); }} onFinished={listenAfterQuestion} />}
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={`answer-${index}`} className="text-[14px] text-ink">{question}</label>
        {aiQuestion && <span className="shrink-0 font-display text-[8px] text-ink-faint">AI QUESTION</span>}
      </div>
      {/* ── (ADDED) Compact mode switch follows the existing pixel theme ── */}
      {supported && <div className="inline-flex rounded-md border-2 border-line bg-(--well) p-0.5" role="group" aria-label="Answer input mode">
        {(["voice", "type"] as const).map((option) => <button key={option} type="button" aria-pressed={mode === option}
          className={cx("px-3 py-1 font-display text-[10px] uppercase tracking-wider pixel-focus", mode === option ? "bg-line text-ink" : "text-ink-faint hover:text-ink")}
          onClick={() => { stopListening(); modeRef.current = option; setMode(option); setError(""); }}>
          {option === "voice" ? "Voice" : "Type"}
        </button>)}
      </div>}
      {isIntensity && mode === "voice" ? (
        <div className="rounded-md border-2 border-line bg-(--well) px-3 py-4" aria-live="polite">
          <p className="font-display text-[11px] text-ink-faint">SAY A NUMBER FROM 1 TO 10</p>
          <p className="mt-2 text-xl text-ink">{answer ? `${answer} / 10` : "Waiting for your rating…"}</p>
        </div>
      ) : isIntensity ? <div id={`answer-${index}`} className="flex flex-wrap gap-1" role="group" aria-label="Intensity from 1 to 10">
        {Array.from({ length: 10 }, (_, n) => String(n + 1)).map((n) => <button key={n} type="button" aria-pressed={answer === n} onClick={() => { stopListening(); setAnswer(index, answer === n ? "" : n); }} className="pixel-btn h-8 w-8 font-display text-[11px]">{n}</button>)}
      </div> : <textarea id={`answer-${index}`} value={answer} readOnly={mode === "voice"} rows={3}
        onChange={(e) => setAnswer(index, e.target.value)} className="pixel-input w-full resize-none px-3 py-2 text-[15px]"
        placeholder={mode === "voice" ? "Your spoken answer appears here…" : "Type your answer…"} />}
      {mode === "voice" && <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-[12px] text-ink-faint">{starting ? "Opening microphone… allow access if prompted." : listening ? (isIntensity ? "Listening… say a number from 1 to 10." : "Listening… tell me your answer.") : "The microphone starts when the question finishes. Tap Mic to retry."}{isIntensity && spokenNumber ? ` Heard: ${spokenNumber}` : ""}</p>
        <button type="button" className={cx("pixel-btn shrink-0 px-3 py-1.5 text-[12px]", listening && "rec-pulse !text-[var(--emo-anger)]")}
          aria-label={listening ? "Stop answer microphone" : "Start answer microphone"} aria-pressed={listening}
          onClick={() => { if (listening || starting) stopListening(); else { window.speechSynthesis?.cancel(); startListening(); } }}>
          {listening || starting ? "Stop mic" : "Mic"}
        </button>
      </div>}
      {error && <p role="alert" className="text-[12px] text-ink-faint">{error}</p>}
    </div>
  );
}

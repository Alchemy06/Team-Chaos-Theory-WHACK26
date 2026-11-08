"use client";

import { useEffect, useRef, useState } from "react";

// ── (ADDED) Read one question, then wait for the user's answer ──
export function QuestionSpeech({ question, onFinished, onBeforeSpeak }: {
  question: string;
  onFinished?: () => void;
  onBeforeSpeak?: () => void;
}) {
  // ── (ADDED) Keep answer callbacks current without restarting playback ──
  const callbacks = useRef({ onFinished, onBeforeSpeak });
  useEffect(() => { callbacks.current = { onFinished, onBeforeSpeak }; }, [onFinished, onBeforeSpeak]);
  const [supported] = useState(() => typeof window !== "undefined" && "speechSynthesis" in window);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [replay, setReplay] = useState(0);
  const active = useRef<SpeechSynthesisUtterance | null>(null);
  const cancelPlayback = useRef<() => void>(() => {});

  useEffect(() => {
    if (!supported || !question) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(question);
    // ── (ADDED) Calm British documentary narration using available device voices ──
    utterance.lang = "en-GB";
    utterance.rate = 0.88;
    utterance.pitch = 0.95;
    const chooseVoice = () => {
      const voices = synth.getVoices().filter((voice) => /^en[-_]GB$/i.test(voice.lang));
      const voice = voices.find((voice) => /Microsoft (Ryan|George)|Google UK English Male|Daniel/i.test(voice.name))
        ?? voices.find((voice) => voice.default)
        ?? voices[0];
      if (voice) utterance.voice = voice;
    };
    chooseVoice();
    active.current = utterance;
    // ── (ADDED) One handoff even when the browser misses its speech-end event ──
    let finished = false;
    let started = false;
    let idleChecks = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(watchdog);
      active.current = null;
      setSpeaking(false);
      callbacks.current.onFinished?.();
    };
    const watchdog = window.setInterval(() => {
      if (!started || synth.paused) return;
      idleChecks = !synth.speaking && !synth.pending ? idleChecks + 1 : 0;
      if (idleChecks >= 2) finish();
    }, 100);
    cancelPlayback.current = () => { finished = true; clearInterval(watchdog); };
    utterance.onstart = () => { started = true; setSpeaking(true); setError(""); };
    utterance.onend = finish;
    utterance.onerror = (event) => {
      finished = true;
      clearInterval(watchdog);
      active.current = null;
      setSpeaking(false);
      if (event.error !== "canceled" && event.error !== "interrupted") {
        setError("Audio is unavailable. Read the question below or try Replay.");
      }
    };
    try {
      callbacks.current.onBeforeSpeak?.();
      synth.cancel();
      synth.speak(utterance);
    } catch {
      finished = true;
      clearInterval(watchdog);
      active.current = null;
      // Report asynchronous browser playback failures through the same handler.
      queueMicrotask(() => setError("Audio is unavailable. You can still answer below."));
    }
    return () => {
      finished = true;
      clearInterval(watchdog);
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
      active.current = null;
      synth.cancel();
    };
  }, [question, replay, supported]);

  if (!supported || !question) return null;
  return (
    <div className="space-y-1">
      <button type="button" aria-pressed={speaking} className="pixel-btn px-3 py-1.5 text-[12px]" onClick={() => {
        if (active.current) {
          cancelPlayback.current();
          active.current.onstart = null;
          active.current.onend = null;
          active.current.onerror = null;
          active.current = null;
          window.speechSynthesis.cancel();
          setSpeaking(false);
        } else {
          setError("");
          setReplay((n) => n + 1);
        }
      }}>
        {speaking ? "Stop reading" : "Replay question"}
      </button>
      {error && <p role="status" className="text-[12px] text-ink-faint">{error}</p>}
    </div>
  );
}

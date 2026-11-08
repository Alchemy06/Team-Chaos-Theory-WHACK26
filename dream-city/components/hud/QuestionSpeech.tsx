"use client";

import { useEffect, useRef, useState } from "react";

// ── (ADDED) Shared ElevenLabs voice for the opening and three follow-ups ──
export function QuestionSpeech({ question, onFinished, onBeforeSpeak }: {
  question: string; onFinished?: () => void; onBeforeSpeak?: () => void;
}) {
  const callbacks = useRef({ onFinished, onBeforeSpeak });
  useEffect(() => { callbacks.current = { onFinished, onBeforeSpeak }; }, [onFinished, onBeforeSpeak]);
  const [status, setStatus] = useState<"idle" | "loading" | "speaking">("loading");
  const [error, setError] = useState("");
  const [replay, setReplay] = useState(0);
  const cancel = useRef<() => void>(() => {});

  useEffect(() => {
    if (!question) return;
    const controller = new AbortController();
    let disposed = false;
    let audio: HTMLAudioElement | null = null;
    let url: string | null = null;
    const cleanup = () => {
      disposed = true;
      controller.abort();
      if (audio) {
        audio.onended = null;
        audio.onplaying = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      if (url) URL.revokeObjectURL(url);
    };
    cancel.current = cleanup;
    callbacks.current.onBeforeSpeak?.();
    async function playQuestion() {
      try {
        const response = await fetch("/api/speech", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question }), signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not generate question audio.");
        }
        const blob = await response.blob();
        if (disposed) return;
        url = URL.createObjectURL(blob);
        audio = new Audio(url);
        audio.onplaying = () => { if (!disposed) setStatus("speaking"); };
        // ── (ADDED) Actual audio completion starts the answer microphone ──
        audio.onended = () => {
          if (disposed) return;
          setStatus("idle");
          callbacks.current.onFinished?.();
        };
        audio.onerror = () => {
          if (!disposed) { setStatus("idle"); setError("Audio playback failed. Try Replay question."); }
        };
        await audio.play();
      } catch (failure) {
        if (disposed) return;
        setStatus("idle");
        setError(failure instanceof DOMException && failure.name === "NotAllowedError"
          ? "Your browser needs a click to play audio. Press Replay question."
          : failure instanceof Error ? failure.message : "Question audio is unavailable.");
      }
    }
    void playQuestion();
    return cleanup;
  }, [question, replay]);

  return (
    <div className="space-y-1">
      <button type="button" aria-pressed={status === "speaking"} className="pixel-btn px-3 py-1.5 text-[12px]" onClick={() => {
        if (status !== "idle") { cancel.current(); setStatus("idle"); }
        else { setError(""); setStatus("loading"); setReplay((n) => n + 1); }
      }}>
        {status === "loading" ? "Preparing voice… · Cancel" : status === "speaking" ? "Stop reading" : "Replay question"}
      </button>
      {error && <p role="status" className="text-[12px] text-ink-faint">{error}</p>}
    </div>
  );
}

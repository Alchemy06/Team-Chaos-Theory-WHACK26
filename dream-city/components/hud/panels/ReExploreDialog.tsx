"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PixelButton, PixelPanel } from "../ui/Pixel";
import { VoiceAnswerInput } from "../VoiceQuestionAnswer";

// (added) Match the original journal popup without sharing its recording state.
export function ReExploreDialog({ questions, answers, busy, error, color, onAnswer, onClose, onSave }: {
  questions: string[];
  answers: string[];
  busy: boolean;
  error: string;
  color: string;
  onAnswer: (index: number, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onClose, busy });
  useEffect(() => { callbacks.current = { onClose, busy }; }, [onClose, busy]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!callbacks.current.busy) callbacks.current.onClose();
      }
      if (event.key === "Tab") {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)") ?? []);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => { dialog.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus(); }, [index]);

  function next() {
    if (busy || !answers[index]?.trim()) return;
    if (index < questions.length - 1) setIndex(index + 1);
    else if (answers.every((answer) => answer.trim())) onSave();
  }

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-end bg-(--overlay)/55 sm:place-items-center sm:p-4">
      <PixelPanel className="anim-rise w-full max-w-xl">
        <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="reexplore-title" aria-busy={busy} className="flex max-h-[88dvh] flex-col">
          <header className="flex items-start justify-between gap-3 border-b-2 border-line px-4 py-3">
            <div className="min-w-0">
              <p className="font-display text-[10px] uppercase tracking-[0.16em]" style={{ color }}>Re-explore · Question {index + 1} of {questions.length}</p>
              <h2 id="reexplore-title" className="mt-1 text-xl leading-snug text-ink">{busy ? "Adding to your dream…" : questions[index]}</h2>
            </div>
            <button type="button" disabled={busy} onClick={onClose} className="pixel-btn grid h-8 w-8 shrink-0 place-items-center font-display text-xs disabled:opacity-50" aria-label="Close re-exploration">✕</button>
          </header>
          <form onSubmit={(event) => { event.preventDefault(); next(); }} className="flex min-h-0 flex-col">
            <div className="pixel-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <p className="border-l-2 border-line pl-3 text-[13px] italic text-ink-faint">A second look at the same dream. Your earlier journal stays unchanged.</p>
              {!busy && <VoiceAnswerInput key={index} question={questions[index]} index={index} aiQuestion
                value={answers[index]} onChange={(value) => onAnswer(index, value)} maxLength={4000} allowRating={false} />}
              {busy && <p role="status" className="animate-pulse text-[14px] text-ink-dim">Saving your answers and refreshing this dream…</p>}
              {error && <div role="alert" className="border-2 border-[var(--emo-anger)]/60 bg-[#2a0d12] p-2 text-[13px] text-[var(--emo-anger)]">{error}</div>}
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-line px-4 py-3">
              <p className="hidden text-[11px] leading-snug text-ink-faint sm:block">Your answers join this dream’s journal.</p>
              <div className="ml-auto flex flex-wrap gap-2">
                <PixelButton className="px-3 py-2" disabled={busy} onClick={() => index > 0 ? setIndex(index - 1) : onClose()}>{index > 0 ? "Back" : "Later"}</PixelButton>
                <PixelButton type="submit" variant="primary" className="px-4 py-2" disabled={busy || !answers[index]?.trim()}>
                  {busy ? "Saving…" : index < questions.length - 1 ? "Next question ▸" : "Save & refresh dream ▸"}
                </PixelButton>
              </div>
            </footer>
          </form>
        </div>
      </PixelPanel>
    </div>, document.body,
  );
}

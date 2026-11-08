"use client";

import { useEffect, useRef } from "react";
import { EMOTION_COLORS, EMOTION_LABELS } from "@/lib/theme";
import { useCity } from "@/store/useCity";
import { useCityStore } from "@/store/useCityStore";
import { fmtDate } from "./panels/PanelFrame";
import { CitedText } from "./ui/CitedText";
import { PixelPanel, SectionTitle } from "./ui/Pixel";

/**
 * The whole journal entry behind a building: LLM 1's record (the dream and every question
 * and answer), what LLM 2a read from it, the insight, and the saved Markdown.
 * Opened by clicking a dream's title or its insight in the dream panel.
 */
export function JournalEntryModal() {
  const id = useCityStore((s) => s.entryOpen);
  const close = useCityStore((s) => s.openEntry);
  const { dreamById } = useCity();
  const dream = id ? dreamById.get(id) : undefined;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (dream) closeRef.current?.focus();
  }, [dream]);

  if (!dream) return null;
  const color = EMOTION_COLORS[dream.primaryEmotion];

  return (
    <div className="pointer-events-auto fixed inset-0 z-[45] grid place-items-center bg-(--overlay)/60 p-3 sm:p-4" onClick={() => close(null)}>
      <PixelPanel className="anim-rise flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden">
        <div role="dialog" aria-modal="true" aria-labelledby="entry-title" className="flex min-h-0 flex-1 flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="h-2 shrink-0" style={{ background: `repeating-linear-gradient(90deg, ${color} 0 12px, transparent 12px 16px)` }} />
          <header className="flex shrink-0 items-start gap-3 border-b-2 border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-display text-[10px] uppercase tracking-[0.16em]" style={{ color }}>
                Journal entry · {fmtDate(dream.date)}
              </div>
              <h2 id="entry-title" className="mt-1 text-xl leading-tight text-ink">
                {dream.summary}
              </h2>
              <p className="mt-1.5 text-[13px] text-ink-dim">
                {EMOTION_LABELS[dream.primaryEmotion]} · {dream.microEmotion}
                {dream.secondaryEmotion && <> · also {EMOTION_LABELS[dream.secondaryEmotion].toLowerCase()}</>} · intensity {dream.intensity}/10
                {dream.intensitySource === "self" ? " (self-rated)" : " (AI estimate)"}
              </p>
            </div>
            <button ref={closeRef} type="button" onClick={() => close(null)} className="pixel-btn grid h-8 w-8 shrink-0 place-items-center font-display text-xs" aria-label="Close journal entry">
              ✕
            </button>
          </header>

          <div className="pixel-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <section>
              <SectionTitle>The dream</SectionTitle>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{dream.transcript}</p>
            </section>

            {dream.followUps.length > 0 && (
              <section>
                <SectionTitle>Questions and answers</SectionTitle>
                <ol className="space-y-3">
                  {dream.followUps.map((f, i) => (
                    <li key={i} className="border-l-2 border-line pl-3">
                      <p className="text-[13px] text-ink-faint">
                        <span className="font-display text-[9px] uppercase tracking-wider">Q{i + 1}</span> {f.q}
                      </p>
                      <p className={f.a ? "mt-0.5 whitespace-pre-wrap text-[15px] text-ink" : "mt-0.5 text-[14px] italic text-ink-faint"}>{f.a || "No answer"}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {dream.description && dream.description !== dream.summary && (
              <section>
                <SectionTitle>What the AI read from it</SectionTitle>
                <p className="text-[14px] leading-relaxed text-ink-dim">{dream.description}</p>
              </section>
            )}

            {dream.insight && (
              <section>
                <SectionTitle>Insight</SectionTitle>
                <div className="border-2 border-line bg-(--well) p-3">
                  <CitedText text={dream.insight} />
                </div>
              </section>
            )}

            {dream.journalMarkdown && (
              <details className="border-2 border-line bg-(--well)">
                <summary className="pixel-focus cursor-pointer px-3 py-2 font-display text-[10px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink">
                  Saved Markdown
                </summary>
                <pre className="pixel-scroll max-h-72 overflow-auto whitespace-pre-wrap border-t-2 border-line px-3 py-2 text-[12px] leading-snug text-ink-dim">
                  {dream.journalMarkdown}
                </pre>
              </details>
            )}
          </div>
        </div>
      </PixelPanel>
    </div>
  );
}

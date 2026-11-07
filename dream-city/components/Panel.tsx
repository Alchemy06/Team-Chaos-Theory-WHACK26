"use client";

// The side panel: what you see when you click a building, landmark or construction site.

import type { ReactNode } from "react";
import { LABEL_TEXT, explainStat } from "@/lib/honesty";
import { EMOTION_COLORS, EMOTION_LABELS, LABEL_COLORS } from "@/lib/theme";
import type { Dream, Link, Recommendation, ResearchCard, Selection, SymbolStat, Work } from "@/lib/types";

type Props = {
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  persona: { name: string; blurb: string };
  dreams: Map<string, Dream>;
  works: Map<string, Work>;
  recommendations: Map<string, Recommendation>;
  links: Link[];
  stats: Map<string, SymbolStat>;
  cards: Map<string, ResearchCard>;
  baselinePlaceholder: boolean;
  baselineNote: string;
};

const fmtDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

function SymbolChip({ symbol, stats, onSelect }: { symbol: string; stats: Map<string, SymbolStat>; onSelect: Props["onSelect"] }) {
  const s = stats.get(symbol);
  const color = s ? LABEL_COLORS[s.label] : LABEL_COLORS.too_early;
  return (
    <button
      title={s ? explainStat(s) : "Not enough data"}
      onClick={() => s?.label === "yours" && onSelect({ kind: "landmark", id: symbol })}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-slate-200"
      style={{ borderColor: `${color}66`, background: `${color}14` }}
    >
      {symbol}
      {s && (
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
          {LABEL_TEXT[s.label]}
        </span>
      )}
    </button>
  );
}

function Insight({
  text,
  cards,
  works,
  onSelect,
}: {
  text: string;
  cards: Map<string, ResearchCard>;
  works: Map<string, Work>;
  onSelect: Props["onSelect"];
}) {
  // Citations look like [card:media-2018], [road:w01], [label:water], [db:water] or [dream]
  const parts = text.split(/(\[[^\]]+\])/g);
  const citedCards = [...new Set([...text.matchAll(/\[card:([a-z0-9-]+)\]/g)].map((m) => m[1]))]
    .map((id) => cards.get(id))
    .filter((c): c is ResearchCard => Boolean(c));
  const chip = "mx-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium";
  return (
    <div>
      <p className="text-sm leading-relaxed text-slate-200">
        {parts.map((part, i) => {
          const m = part.match(/^\[(card|road|label|db|dream)(?::([a-z0-9_-]+))?\]$/);
          if (!m) return <span key={i}>{part}</span>;
          const [, kind, id = ""] = m;
          if (kind === "dream") return null;
          if (kind === "card") {
            const card = cards.get(id);
            return (
              <a key={i} href={card?.url} target="_blank" rel="noreferrer" title={card ? `${card.claim} (${card.citation})` : id}
                className={`${chip} bg-sky-400/15 text-sky-300 hover:bg-sky-400/25`}>
                {id}
              </a>
            );
          }
          if (kind === "road") {
            const w = works.get(id);
            return (
              <button key={i} onClick={() => onSelect(w ? { kind: "work", id } : { kind: "dream", id })}
                className={`${chip} bg-white/10 text-slate-200 hover:bg-white/20`}>
                road: {w?.title ?? "earlier dream"}
              </button>
            );
          }
          if (kind === "label") {
            return (
              <button key={i} onClick={() => onSelect({ kind: "landmark", id })} className={`${chip} bg-amber-300/15 text-amber-200`}>
                label: {id}
              </button>
            );
          }
          return (
            <span key={i} title="Approximate rate from DreamBank reports" className={`${chip} bg-violet-400/15 text-violet-200`}>
              DreamBank: {id}
            </span>
          );
        })}
      </p>
      {citedCards.length > 0 && (
        <ul className="mt-3 space-y-2">
          {citedCards.map((c) => (
            <li key={c.id} className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 text-xs text-slate-400">
              <span className="text-slate-300">{c.claim}</span>
              <br />
              <a href={c.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                {c.citation}
              </a>
              <span className="block text-slate-500">Confidence: {c.confidence}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RoadRow({ link, label, onClick }: { link: Link; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-md border border-white/10 bg-white/[0.03] p-2.5 text-left hover:bg-white/[0.07]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-100">{label}</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          {link.strength >= 0.6 ? "Strong" : link.toType === "dream" ? "Recurring" : "Possible"}
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full rounded bg-white/10">
        <div className="h-1 rounded bg-sky-300" style={{ width: `${Math.round(link.strength * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{link.explanation}</p>
    </button>
  );
}

function EmotionChips({ emotion, micro }: { emotion: Dream["primaryEmotion"]; micro?: string }) {
  const c = EMOTION_COLORS[emotion];
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: `${c}22`, color: c }}>
        {EMOTION_LABELS[emotion]} district
      </span>
      {micro && <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300">{micro.charAt(0).toUpperCase() + micro.slice(1)} Street</span>}
    </div>
  );
}

export default function Panel(props: Props) {
  const { selection, onSelect, dreams, works, recommendations, links, stats, cards } = props;

  const body = (() => {
    if (!selection) {
      const top = [...stats.values()].slice(0, 10);
      return (
        <>
          <h2 className="text-xl font-semibold text-white">{props.persona.name}&apos;s city</h2>
          <p className="mt-1 text-sm text-slate-400">{props.persona.blurb}</p>
          <Section title="How to read it">
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li><b className="text-slate-100">District</b> is the dream&apos;s main emotion.</li>
              <li><b className="text-slate-100">Street</b> is the finer feeling within it.</li>
              <li><b className="text-slate-100">Height</b> is intensity; <b className="text-slate-100">lit windows</b> mean recent.</li>
              <li><b className="text-slate-100">Glowing roofs</b> are the books, films, songs and games you logged.</li>
              <li><b className="text-slate-100">Roads</b> link dreams to works that share their symbols.</li>
              <li><b className="text-slate-100">Towers</b> mark symbols that are noticeably yours.</li>
              <li><b className="text-slate-100">Dashed outlines in the fog</b> are places to explore next.</li>
            </ul>
          </Section>
          <Section title="Recurring symbols">
            <div className="flex flex-wrap gap-1.5">
              {top.map((s) => (
                <SymbolChip key={s.symbol} symbol={s.symbol} stats={stats} onSelect={onSelect} />
              ))}
            </div>
          </Section>
        </>
      );
    }

    if (selection.kind === "dream") {
      const d = dreams.get(selection.id);
      if (!d) return null;
      const outgoing = links.filter((l) => l.from === d.id);
      const incoming = links.filter((l) => l.to === d.id);
      return (
        <>
          <p className="text-xs text-slate-400">
            Dream · {fmtDate(d.date)} · intensity {d.intensity}/10{d.intensitySource === "self" ? " (self-rated)" : " (AI estimate)"}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug text-white">{d.summary}</h2>
          <EmotionChips emotion={d.primaryEmotion} micro={d.microEmotion} />
          <p className="mt-2 text-[11px] text-slate-500">
            {d.hvdcEmotion
              ? `Research category (Hall and Van de Castle): ${d.hvdcEmotion}${d.emotionStated ? ", as stated by the dreamer" : ""}`
              : "No emotion stated, so no research category"}
          </p>
          <blockquote className="mt-4 border-l-2 border-white/20 pl-3 text-sm italic leading-relaxed text-slate-300">
            &ldquo;{d.transcript}&rdquo;
          </blockquote>
          {d.followUps.length > 0 && (
            <div className="mt-3 space-y-1.5 text-xs text-slate-400">
              {d.followUps.map((f, i) => (
                <p key={i}>
                  <span className="text-slate-500">{f.q}</span> {f.a}
                </p>
              ))}
            </div>
          )}
          <Section title="Symbols">
            <div className="flex flex-wrap gap-1.5">
              {d.symbols.map((s) => (
                <SymbolChip key={s} symbol={s} stats={stats} onSelect={onSelect} />
              ))}
            </div>
          </Section>
          {(outgoing.length > 0 || incoming.length > 0) && (
            <Section title="Roads">
              <div className="space-y-2">
                {outgoing.map((l) => {
                  const label = l.toType === "work" ? works.get(l.to)?.title : dreams.get(l.to)?.summary;
                  return (
                    <RoadRow
                      key={l.to}
                      link={l}
                      label={label ?? l.to}
                      onClick={() => onSelect({ kind: l.toType, id: l.to })}
                    />
                  );
                })}
                {incoming.map((l) => (
                  <RoadRow
                    key={`in-${l.from}`}
                    link={{ ...l, explanation: `Recurs later: shares ${l.shared.join(", ")} with this dream.` }}
                    label={dreams.get(l.from)?.summary ?? l.from}
                    onClick={() => onSelect({ kind: "dream", id: l.from })}
                  />
                ))}
              </div>
            </Section>
          )}
          <Section title="Insight">
            {d.insight ? (
              <Insight text={d.insight} cards={cards} works={works} onSelect={onSelect} />
            ) : (
              <p className="text-sm text-slate-500">No insight generated yet for this dream.</p>
            )}
          </Section>
        </>
      );
    }

    if (selection.kind === "work") {
      const w = works.get(selection.id);
      if (!w) return null;
      const fed = links.filter((l) => l.to === w.id).sort((a, b) => b.strength - a.strength);
      return (
        <>
          <p className="text-xs capitalize text-slate-400">
            {w.kind}
            {w.consumedOn ? ` · ${fmtDate(w.consumedOn)}` : ""}
            {w.rating ? ` · ${"★".repeat(w.rating)}${"☆".repeat(5 - w.rating)}` : ""}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">{w.title}</h2>
          {w.creator && <p className="text-sm text-slate-400">{w.creator}</p>}
          <EmotionChips emotion={w.primaryEmotion} />
          {w.userNote && (
            <blockquote className="mt-4 border-l-2 border-white/20 pl-3 text-sm italic text-slate-300">&ldquo;{w.userNote}&rdquo;</blockquote>
          )}
          <Section title="Symbols">
            <div className="flex flex-wrap gap-1.5">
              {w.symbols.map((s) => (
                <SymbolChip key={s} symbol={s} stats={stats} onSelect={onSelect} />
              ))}
            </div>
          </Section>
          <Section title={`Dreams it may have fed (${fed.length})`}>
            {fed.length === 0 ? (
              <p className="text-sm text-slate-500">No dreams share enough symbols with this yet.</p>
            ) : (
              <div className="space-y-2">
                {fed.map((l) => (
                  <RoadRow
                    key={l.from}
                    link={l}
                    label={dreams.get(l.from)?.summary ?? l.from}
                    onClick={() => onSelect({ kind: "dream", id: l.from })}
                  />
                ))}
              </div>
            )}
          </Section>
        </>
      );
    }

    if (selection.kind === "construction") {
      const r = recommendations.get(selection.id);
      if (!r) return null;
      const weak = r.viaSymbols.filter((s) => stats.get(s)?.label !== "yours");
      return (
        <>
          <p className="text-xs uppercase tracking-wide text-slate-400">Unexplored territory · {r.kind}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{r.title}</h2>
          {r.creator && <p className="text-sm text-slate-400">{r.creator}</p>}
          <p className="mt-4 text-sm leading-relaxed text-slate-200">{r.reason}</p>
          <Section title="Built from these symbols">
            <div className="flex flex-wrap gap-1.5">
              {r.viaSymbols.map((s) => (
                <SymbolChip key={s} symbol={s} stats={stats} onSelect={onSelect} />
              ))}
            </div>
            {weak.length > 0 && (
              <p className="mt-2 text-xs text-amber-300/80">
                {weak.join(", ")} {weak.length === 1 ? "is" : "are"} not labelled Yours yet, so this is a weaker lead.
              </p>
            )}
          </Section>
        </>
      );
    }

    const s = stats.get(selection.id);
    const containing = [...dreams.values()].filter((d) => d.symbols.includes(selection.id));
    return (
      <>
        <p className="text-xs uppercase tracking-wide text-slate-400">Landmark</p>
        <h2 className="mt-1 text-lg font-semibold capitalize text-white">{selection.id}</h2>
        {s && <p className="mt-2 text-sm text-slate-300">{explainStat(s)}</p>}
        <Section title={`Dreams with this symbol (${containing.length})`}>
          <div className="space-y-1.5">
            {containing.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelect({ kind: "dream", id: d.id })}
                className="block w-full rounded-md border border-white/10 bg-white/[0.03] p-2 text-left text-sm text-slate-200 hover:bg-white/[0.07]"
              >
                <span className="text-xs text-slate-500">{fmtDate(d.date)} · </span>
                {d.summary}
              </button>
            ))}
          </div>
        </Section>
      </>
    );
  })();

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l border-white/10 bg-[#0a1022]/95">
      <div className="flex-1 overflow-y-auto p-5">
        {selection && (
          <button onClick={() => onSelect(null)} className="mb-3 text-xs text-slate-400 hover:text-slate-200">
            ← Back to city overview
          </button>
        )}
        {body}
      </div>
      <footer className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-slate-500">
        Patterns, not meanings. Insights cite dream research and never diagnose.
        {props.baselinePlaceholder ? (
          <span className="mt-1 block font-medium text-amber-300/90">
            Baseline is a placeholder. Run scripts/base_rates.py before presenting any Yours or Common labels.
          </span>
        ) : (
          <span className="mt-1 block">{props.baselineNote}</span>
        )}
      </footer>
    </aside>
  );
}

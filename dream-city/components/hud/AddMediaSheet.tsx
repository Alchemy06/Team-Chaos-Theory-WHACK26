"use client";

import { useEffect, useRef, useState } from "react";
import { PixelButton, PixelPanel, cx } from "./ui/Pixel";

type Kind = "book" | "film" | "song" | "game";
type Suggestion = { externalId: string; title: string; subtitle: string | null; imageUrl: string | null };
type Saved = { title: string; main_emotion: string | null; themes: string[] };

const KINDS: { kind: Kind; label: string; icon: string }[] = [
  { kind: "film", label: "Film", icon: "🎬" },
  { kind: "book", label: "Book", icon: "📖" },
  { kind: "song", label: "Song", icon: "♪" },
  { kind: "game", label: "Game", icon: "🎮" },
];

const today = () => new Date().toISOString().slice(0, 10);

// The "+ Media" button that sits next to the name in the top bar, plus its dialog.
export function AddMediaButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PixelButton className="pointer-events-auto shrink-0 self-stretch px-3 text-[12px]" onClick={() => setOpen(true)} disabled={open}>
        + Media
      </PixelButton>
      {open && <AddMediaDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AddMediaDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("film");
  const [title, setTitle] = useState("");
  const [externalId, setExternalId] = useState<string | null>(null);
  const [consumedOn, setConsumedOn] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  // ---- film title dropdown (TMDB) ----
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    if (externalId || title.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/media/search?kind=${kind}&q=${encodeURIComponent(title.trim())}`);
        const data = (await res.json()) as { results: Suggestion[] };
        if (id === reqId.current) {
          setSuggestions(data.results ?? []);
          setActive(0);
        }
      } catch {
        if (id === reqId.current) setSuggestions([]);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [title, kind, externalId]);

  const pick = (s: Suggestion) => {
    setTitle(s.title);
    setExternalId(s.externalId);
    setListOpen(false);
  };

  const onTitleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!listOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setListOpen(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, title, consumed_on: consumedOn, user_note: note, external_id: externalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      setSaved(data as Saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSaved(null);
    setTitle("");
    setExternalId(null);
    setNote("");
    setConsumedOn(today());
  };

  const showList = listOpen && !externalId && (suggestions.length > 0 || searching);

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-end bg-(--overlay)/55 sm:place-items-center sm:p-4">
      <PixelPanel className="anim-rise w-full max-w-xl">
        <div role="dialog" aria-modal="true" aria-labelledby="media-title" className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between border-b-2 border-line px-4 py-3">
            <div>
              <div className="font-display text-[10px] uppercase tracking-[0.16em] text-[var(--emo-wonder)]">Your library</div>
              <h2 id="media-title" className="text-xl text-ink">
                {saved ? "Added to your library" : "What have you been into?"}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="pixel-btn grid h-8 w-8 place-items-center font-display text-xs" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="pixel-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {saved ? (
              <div className="space-y-2 text-[15px]">
                <p className="text-ink">“{saved.title}”</p>
                <p className="text-ink-dim">
                  Main feeling: <span className="text-ink">{saved.main_emotion ?? "unknown"}</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {saved.themes.map((t) => (
                    <span key={t} className="border-2 border-line bg-(--well) px-2 py-0.5 text-[12px] text-ink-dim">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 font-display text-[9px] uppercase tracking-[0.14em] text-ink-faint">Kind</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {KINDS.map((k) => (
                      <button
                        key={k.kind}
                        type="button"
                        aria-pressed={kind === k.kind}
                        onClick={() => {
                          setKind(k.kind);
                          setExternalId(null);
                        }}
                        className="pixel-btn px-2 py-2 text-[13px]"
                      >
                        {k.icon} {k.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="relative block">
                  <span className="mb-1 block text-[14px] text-ink">Title</span>
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setExternalId(null);
                      setListOpen(true);
                    }}
                    onFocus={() => setListOpen(true)}
                    onBlur={() => setTimeout(() => setListOpen(false), 150)}
                    onKeyDown={onTitleKey}
                    role="combobox"
                    aria-expanded={showList}
                    aria-controls="media-suggestions"
                    aria-autocomplete="list"
                    placeholder={`Start typing a ${kind}…`}
                    className="pixel-input w-full px-3 py-2 text-[15px]"
                  />
                  {externalId && <span className="mt-1 block text-[11px] text-[var(--emo-confusion)]">✓ Matched</span>}
                  {showList && (
                    <ul id="media-suggestions" role="listbox" className="pixel-scroll absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto border-2 border-line-hi bg-(--input)">
                      {searching && suggestions.length === 0 && <li className="px-3 py-2 text-[13px] text-ink-faint">Searching…</li>}
                      {suggestions.map((s, i) => (
                        <li
                          key={s.externalId}
                          role="option"
                          aria-selected={i === active}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pick(s);
                          }}
                          onMouseEnter={() => setActive(i)}
                          className={cx("flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[14px]", i === active ? "bg-(--hover) text-ink" : "text-ink-dim")}
                        >
                          {s.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.imageUrl} alt="" className="h-10 w-7 shrink-0 object-cover" />
                          ) : (
                            <span className="h-10 w-7 shrink-0 bg-line" />
                          )}
                          <span className="truncate">{s.title}</span>
                          {s.subtitle && <span className="ml-auto shrink-0 truncate pl-2 text-[12px] text-ink-faint">{s.subtitle}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1 block text-[14px] text-ink">When</span>
                  <input type="date" value={consumedOn} max={today()} onChange={(e) => setConsumedOn(e.target.value)} className="pixel-input w-full px-3 py-2 text-[15px]" />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[14px] text-ink">How did it make you feel?</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Optional. A line or two helps the AI pick the right feeling and themes."
                    className="pixel-input w-full resize-none px-3 py-2 text-[15px] leading-relaxed"
                  />
                </label>
              </div>
            )}

            {error && <div className="mt-3 border-2 border-[var(--emo-anger)]/60 bg-[#2a0d12] p-2 text-[13px] text-[var(--emo-anger)]">{error}</div>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-line px-4 py-3">
            <p className="hidden text-[11px] leading-snug text-ink-faint sm:block">The AI picks the feeling and themes for you.</p>
            <div className="ml-auto flex flex-wrap gap-2">
              {saved ? (
                <>
                  <PixelButton className="px-3 py-2" onClick={reset}>
                    Add another
                  </PixelButton>
                  <PixelButton variant="primary" className="px-4 py-2" onClick={onClose}>
                    Done
                  </PixelButton>
                </>
              ) : (
                <PixelButton variant="primary" className="px-4 py-2" disabled={busy || title.trim().length === 0} onClick={() => void submit()}>
                  {busy ? "Thinking…" : "Add it ▸"}
                </PixelButton>
              )}
            </div>
          </div>
        </div>
      </PixelPanel>
    </div>
  );
}

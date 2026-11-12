"use client";

import { useEffect, useRef, useState } from "react";
import type { Exploration } from "@/lib/reexplore";
import { useCityStore } from "@/store/useCityStore";
import { PixelButton, SectionTitle } from "../ui/Pixel";
import { ReExploreDialog } from "./ReExploreDialog";
import { CitedText } from "../ui/CitedText";

type SaveResult = { saved: boolean; updated: boolean; message?: string };

async function request<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method, cache: "no-store", signal: AbortSignal.timeout(method === "PATCH" ? 140000 : 60000),
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Re-explore is unavailable. Please retry.");
  return data as T;
}

// (added) Revisit the same building; previous entries are never replaced or deleted.
export function ReExplore({ dreamId, color }: { dreamId: string; color: string }) {
  const [rounds, setRounds] = useState<Exploration[]>([]);
  const [round, setRound] = useState<Exploration | null>(null);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryRound, setRetryRound] = useState<Exploration | null>(null);
  const active = useRef(false);
  const url = `/api/journal/${dreamId}/reexplore`;

  useEffect(() => {
    let disposed = false;
    request<{ rounds: Exploration[] }>(url, "GET").then(({ rounds: history }) => {
      if (disposed) return;
      setRounds(history);
      const draft = history.find((item) => item.status === "draft");
      if (draft) setRound(draft);
      const last = history.filter((item) => item.status === "completed").at(-1);
      if (last && (!last.build_updated || !last.insight_snapshot)) setRetryRound(last);
    }).catch(() => { /* (added) An unavailable history does not hide the original dream. */ });
    return () => { disposed = true; };
  }, [url]);


  async function start() {
    if (active.current) return;
    active.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const { round: next } = await request<{ round: Exploration }>(url, "POST");
      setRound(next);
      let draft = ["", "", ""];
      try {
        const stored: unknown = JSON.parse(sessionStorage.getItem(`reexplore:${next.id}`) ?? "null");
        if (Array.isArray(stored) && stored.length === 3 && stored.every((a) => typeof a === "string")) draft = stored;
      } catch { /* (added) Storage may be disabled; the form still works. */ }
      setAnswers(draft);
      setOpen(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not prepare questions."); }
    finally { active.current = false; setBusy(false); }
  }

  function updateAnswer(index: number, value: string) {
    const next = answers.map((answer, i) => i === index ? value : answer);
    setAnswers(next);
    try { if (round) sessionStorage.setItem(`reexplore:${round.id}`, JSON.stringify(next)); } catch { /* (added) Optional draft storage. */ }
  }

  async function refresh(target: Exploration) {
    setNotice("Answers saved. Updating your building and reflection…");
    const result = await request<SaveResult>(url, "PATCH", { roundId: target.id });
    if (!result.updated) {
      setRetryRound(target);
      setNotice(result.message ?? "Answers saved. Retry the update when ready.");
      return;
    }
    const { rounds: history } = await request<{ rounds: Exploration[] }>(url, "GET");
    setRounds(history); setRetryRound(null);
    useCityStore.setState((state) => ({ insights: Object.fromEntries(Object.entries(state.insights).filter(([id]) => id !== dreamId)) }));
    await useCityStore.getState().loadCity();
    setNotice(useCityStore.getState().cityError ? "Your building and reflection are saved. Refresh the map to see them." : "Saved. Your building, reflection and exploration history are up to date.");
  }

  async function save(target: Exploration, values: string[]) {
    if (active.current) return;
    active.current = true;
    setBusy(true); setError(""); setNotice("");
    let saved = false;
    try {
      await request<SaveResult>(url, "PUT", { roundId: target.id, answers: values });
      saved = true;
      try { sessionStorage.removeItem(`reexplore:${target.id}`); } catch { /* (added) Optional draft storage. */ }
      setOpen(false); setRound(null);
      const completed = { ...target, answers: values, status: "completed" as const, build_updated: false };
      setRounds((history) => [...history.filter((item) => item.id !== target.id), completed]);
      setRetryRound(completed);
      await refresh(completed);
    } catch (failure) {
      setError(saved ? "Your answers are saved. Retry the building and reflection update below." : failure instanceof Error ? failure.message : "Could not save your answers. They remain in the form.");
    } finally { active.current = false; setBusy(false); }
  }

  async function retry(target: Exploration) {
    if (active.current) return;
    active.current = true; setBusy(true); setError("");
    try { await refresh(target); }
    catch { setError("Your answers are saved. The update is unavailable or still running; please retry shortly."); }
    finally { active.current = false; setBusy(false); }
  }

  const completed = rounds.filter((item) => item.status === "completed");
  return (
    <section className="dream-reexplore">
      <SectionTitle aside={<span className="font-display text-[9px]" style={{ color }}>3 questions</span>}>Continue your exploration</SectionTitle>
      <p className="dream-reading mb-4 text-ink-dim">Return to a detail. Notice what comes back. Your original dream stays in its history.</p>
      {<PixelButton className="w-full border px-3 py-3 text-[10px]" style={{ color, borderColor: color }} disabled={busy || open || !!retryRound} onClick={() => void start()}>
        {busy ? "Preparing questions…" : round ? "Continue re-exploring ↗" : "Re-explore this dream ↗"}
      </PixelButton>}
      {open && round && <ReExploreDialog questions={round.questions} answers={answers} busy={busy} error={error}
        color={color} onAnswer={updateAnswer} onClose={() => setOpen(false)} onSave={() => void save(round, answers)} />}
      {error && !open && <p role="alert" className="mt-3 text-[13px] text-[var(--emo-anger)]">{error}</p>}
      {notice && <p role="status" className="mt-3 text-[13px] text-ink-dim">{notice}</p>}
      {retryRound && <div className="mt-3 space-y-2">
        {!notice && <p className="text-[13px] text-ink-dim">Your last answers are saved. The building and reflection still need to refresh.</p>}
        <PixelButton className="px-3 py-2" disabled={busy} onClick={() => void retry(retryRound)}>
          {busy ? "Refreshing…" : "Retry update"}
        </PixelButton>
      </div>}
      {completed.length > 0 && <details className="dream-disclosure mt-4 border-t border-line pt-4">
        <summary>Previous explorations · {completed.length}<span aria-hidden>+</span></summary>
        <div className="mt-3 space-y-4">{completed.map((item, index) => <div key={item.id}>
          <p className="mb-2 font-display text-[9px] uppercase tracking-wider" style={{ color }}>Second look {index + 1} · {new Date(item.created_at).toLocaleDateString("en-GB")}</p>
          <dl className="space-y-2 border-l-2 border-line pl-3">{item.questions.map((question, i) => <div key={i}>
            <dt className="font-sans text-[12px] leading-relaxed text-ink-faint">{question}</dt>
            <dd className="dream-reading mt-1 whitespace-pre-wrap text-ink">{item.answers?.[i]}</dd>
          </div>)}</dl>
          {item.insight_snapshot && <div className="dream-reflection mt-3" style={{ borderLeftColor: color }}>
            <p className="mb-2 font-display text-[9px] uppercase tracking-wider text-ink-faint">Saved reflection · {item.insight_snapshot.source === "ai" ? "AI" : "Evidence template"}</p>
            <CitedText text={item.insight_snapshot.text} className="dream-reading text-ink" />
          </div>}
          {item.previous_insight && <details className="dream-disclosure mt-3">
            <summary>Reflection before this round<span aria-hidden>+</span></summary>
            <p className="dream-reading mt-2 text-ink-dim">{item.previous_insight.text}</p>
          </details>}
          {item.building_snapshot?.description && <p className="dream-reading mt-3 text-ink-dim">{item.building_snapshot.description}</p>}
        </div>)}</div>
      </details>}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useCityStore } from "@/store/useCityStore";

// ── (ADDED) Quiet map music, paused during voice journaling ──
export function BackgroundMusic() {
  const audio = useRef<HTMLAudioElement>(null);
  const journalOpen = useCityStore(s => s.record.open);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [track, setTrack] = useState<{ src: string | null; name: string | null }>({ src: null, name: null });

  // ── (ADDED) Discover replacements automatically without rebuilding the app ──
  useEffect(() => {
    let active = true;
    let fetching = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const response = await fetch("/api/background-music", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const next = await response.json() as { src: string | null; name: string | null };
        if (active) setTrack(current => current.src === next.src ? current : next);
      } catch { /* Keep the current track during a temporary refresh failure. */ }
      finally { fetching = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, []);

  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    player.volume = 0.15;
    if (!enabled || journalOpen || !track.src) player.pause();
    else void player.play().catch(() => setError(true));
    return () => player.pause();
  }, [enabled, journalOpen, track.src]);

  return (
    <>
      <audio ref={audio} src={track.src ?? undefined} loop preload="none"
        onPlaying={() => { setPlaying(true); setError(false); }} onPause={() => setPlaying(false)} onError={() => setError(true)} />
      <button type="button" className="pixel-btn pointer-events-auto px-2 py-1 text-[11px]"
        disabled={!track.src}
        aria-label={enabled ? "Turn background music off" : "Turn background music on"} aria-pressed={enabled}
        title={error ? "Playback failed. Turn off and on to retry." : journalOpen && enabled ? "Music pauses during journaling" : track.name ?? "Add an audio file to public/audio"}
        onClick={() => { setError(false); setEnabled(value => !value); }}>
        ♪ {!track.src ? "Music: no file" : error ? "Music: retry" : enabled ? playing ? "Music: On" : "Music: Paused" : "Music: Off"}
      </button>
    </>
  );
}

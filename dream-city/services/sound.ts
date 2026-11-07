// Tiny synthesised soundscape (no audio assets): a soft ambient pad and a
// low tone when a building rises. Off by default; browsers require a user
// gesture before audio can start.

let ctx: AudioContext | null = null;
let pad: { gain: GainNode; nodes: OscillatorNode[] } | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setAmbient(on: boolean) {
  const a = audio();
  if (!a) return;
  if (on && !pad) {
    const gain = a.createGain();
    gain.gain.value = 0;
    const filter = a.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520;
    filter.connect(gain).connect(a.destination);
    const nodes = [110, 164.81, 220.5, 277.18].map((f, i) => {
      const o = a.createOscillator();
      o.type = i % 2 ? "triangle" : "sine";
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 6;
      const g = a.createGain();
      g.gain.value = 0.18 / (i + 1);
      o.connect(g).connect(filter);
      o.start();
      return o;
    });
    gain.gain.linearRampToValueAtTime(0.12, a.currentTime + 2.5);
    pad = { gain, nodes };
  } else if (!on && pad) {
    const p = pad;
    pad = null;
    p.gain.gain.cancelScheduledValues(a.currentTime);
    p.gain.gain.linearRampToValueAtTime(0, a.currentTime + 0.8);
    setTimeout(() => p.nodes.forEach((n) => n.stop()), 900);
  }
}

export function playRiseTone() {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(98, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(196, a.currentTime + 1.2);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.22, a.currentTime + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 1.8);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 1.9);
}

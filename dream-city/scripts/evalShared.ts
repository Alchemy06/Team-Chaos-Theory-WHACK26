// Shared helpers for the evaluation scripts (scripts/eval_*.ts). Not imported by the app.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(__dirname, "..");
export const EVAL_DIR = path.join(ROOT, "data", "eval");
export const evalPath = (name: string) => path.join(EVAL_DIR, name);

// Load .env.local (GROQ_API_KEY, GROQ_MODEL...) the way Next.js does, without overriding real env vars.
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  mkdirSync(EVAL_DIR, { recursive: true });
}

export const num = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retries a model call when Groq rate-limits it (HTTP 429), waiting a little longer each time.
export async function withRateLimit<T>(fn: () => Promise<T>, label = "call"): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const details = (err as { details?: unknown }).details;
      const msg = `${err instanceof Error ? err.message : String(err)} ${Array.isArray(details) ? details.join(" ") : ""}`;
      const limited = /\b429\b|rate.?limit/i.test(msg);
      if (!limited || attempt >= 6) throw err;
      const wait = Math.min(120, 10 * 2 ** attempt);
      console.log(`  rate-limited on ${label}; waiting ${wait}s`);
      await sleep(wait * 1000);
    }
  }
}

// ---- files ----
export function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}
export const appendJsonl = (file: string, row: unknown) => appendFileSync(file, JSON.stringify(row) + "\n");
export const writeJson = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
export const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;

// A minimal CSV reader/writer (quoted fields, commas and newlines inside quotes).
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x !== "")) rows.push(row);
  const [head = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}
const cell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (cols: string[], rows: Record<string, unknown>[]) =>
  [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
export const splitList = (s: string | undefined) =>
  (s ?? "").split(/[;,|]/).map((x) => x.trim().toLowerCase()).filter(Boolean);

// ---- seeded randomness, so every run picks the same sample ----
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- statistics ----
// 95% Wilson interval for a proportion k/n.
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

export type Confusion = { tp: number; fp: number; fn: number; tn: number };
// NaN when neither side ever used the class: leave it out of averages rather than count it as perfect
export const f1 = ({ tp, fp, fn }: Confusion) => (tp + fp + fn === 0 ? NaN : (2 * tp) / (2 * tp + fp + fn));
export const precision = ({ tp, fp }: Confusion) => (tp + fp === 0 ? NaN : tp / (tp + fp));
export const recall = ({ tp, fn }: Confusion) => (tp + fn === 0 ? NaN : tp / (tp + fn));
// Cohen's kappa for two binary raters.
export function kappa({ tp, fp, fn, tn }: Confusion): number {
  const n = tp + fp + fn + tn;
  if (n === 0) return NaN;
  const po = (tp + tn) / n;
  const pe = ((tp + fp) / n) * ((tp + fn) / n) + ((fn + tn) / n) * ((fp + tn) / n);
  return pe === 1 ? NaN : (po - pe) / (1 - pe);
}
export function confusion(pairs: [boolean, boolean][]): Confusion {
  // [predicted, reference]
  const c = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const [p, r] of pairs) {
    if (p && r) c.tp++;
    else if (p && !r) c.fp++;
    else if (!p && r) c.fn++;
    else c.tn++;
  }
  return c;
}
// Bootstrap 95% interval for any statistic of a list of items.
export function bootstrap<T>(items: T[], stat: (xs: T[]) => number, reps = 1000, seed = 7): [number, number] {
  if (!items.length) return [NaN, NaN];
  const rand = rng(seed);
  const vals: number[] = [];
  for (let r = 0; r < reps; r++) {
    const s = Array.from({ length: items.length }, () => items[Math.floor(rand() * items.length)]);
    const v = stat(s);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  return [vals[Math.floor(0.025 * vals.length)], vals[Math.floor(0.975 * vals.length) - 1]];
}
export const pct = (x: number, dp = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(dp)}%` : "n/a");
export const fix = (x: number, dp = 2) => (Number.isFinite(x) ? x.toFixed(dp) : "n/a");
// Mean of the finite values (classes that occur at all)
export const meanFinite = (xs: number[]) => {
  const f = xs.filter(Number.isFinite);
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : NaN;
};
export const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 1 : inter / union;
};

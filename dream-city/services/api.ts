// Typed client for the backend API routes (app/api/*). The frontend only talks
// to the backend through these functions.

import type { Entry } from "@/lib/entry";
import type { Dream, Extraction, Link, SymbolStat, Work } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public details: string[] = [],
  ) {
    super(message);
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("Can't reach the server.");
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; details?: string[] };
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, json.details ?? []);
  return json;
}

/** LLM 1: Q1/Q2 fixed, Q3 written by the AI (falls back to a generic question server-side). */
export function fetchFollowUps(transcript: string) {
  return post<{ questions: string[]; aiUsed: boolean }>("/api/followup", { transcript });
}

/** LLM 2a: reads the .md entry and returns the fields the city needs. */
export function fetchExtraction(markdown: string) {
  return post<{ entry: Entry; extraction: Extraction; warnings: string[] }>("/api/extract", { markdown });
}

/** LLM 2b: grounded insight; the route returns a checked template if the model fails. */
export function fetchInsight(body: { dream: Dream; links: Link[]; works: Work[]; dreams: Dream[]; stats: SymbolStat[] }) {
  return post<{ insight: string; cited: string[]; source: "ai" | "fallback"; problems: string[] }>("/api/insight", body);
}

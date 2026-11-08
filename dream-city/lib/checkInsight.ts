// Code checks on LLM 2b's insight. Prompts can't guarantee honesty; these checks can.
// An insight that fails is regenerated once, then replaced with a plain template.

import type { EvidencePack } from "./evidence";
import type { Dream, Work } from "./types";
import { TYPICAL_BY_ID } from "./typicalDreams";

export const CITATION = /\[(dream|road|label|db|card|typical)(?::([a-z0-9_-]+))?\]/g;
const ANY_BRACKET = /\[([^\]]+)\]/g;
const BANNED =
  /\b(means?|meaning|symboli[sz](?:e|es|ed|ing)|symbol of|represents?|indicates? that|signif(?:y|ies)|subconscious(?:ly)?|repress(?:ed|ing|ion)?|diagnos\w*|disorder|trauma\w*|depress\w*|ptsd|you are clearly|this proves)\b/i;
const MAX_WORDS = 90;

export type InsightCheck = { ok: boolean; problems: string[]; cited: string[] };

export function checkInsight(text: string, pack: EvidencePack): InsightCheck {
  const problems: string[] = [];
  const cited: string[] = [];

  for (const m of text.matchAll(ANY_BRACKET)) {
    const id = m[1].trim();
    if (pack.ids.has(id)) cited.push(id);
    else problems.push(`Cites [${id}], which is not in the evidence.`);
  }
  if (cited.length === 0) problems.push("Cites no evidence.");

  const banned = text.match(BANNED);
  if (banned) problems.push(`Uses the banned phrase "${banned[0]}". Describe patterns, not meanings.`);

  const prose = text.replace(ANY_BRACKET, "");
  for (const m of prose.matchAll(/\d+(?:\.\d+)?%?/g)) {
    if (!pack.numbers.has(m[0])) problems.push(`Uses the number ${m[0]}, which is not in the evidence.`);
  }

  const words = prose.split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS) problems.push(`Is ${words} words; the limit is ${MAX_WORDS}.`);
  if (!prose.trim().endsWith("?")) problems.push("Does not end with a question to the dreamer.");

  return { ok: problems.length === 0, problems, cited: [...new Set(cited)] };
}

// Plain fallback built only from evidence, so there is always something honest to show.
export function fallbackInsight(dream: Dream, pack: EvidencePack, works: Map<string, Work>): string {
  const road = pack.roads.find((r) => r.toType === "work");
  const parts: string[] = [];
  if (road) {
    const w = works.get(road.to);
    parts.push(`This dream shares ${road.shared.join(", ")} with ${w?.title ?? "a work you logged"} [road:${road.to}].`);
  }
  const yours = dream.symbols.find((s) => pack.ids.has(`label:${s}`) && pack.items.find((i) => i.id === `label:${s}`)?.text.includes("labelled yours"));
  if (yours) parts.push(`${yours.charAt(0).toUpperCase() + yours.slice(1)} appears more often in your dreams than in most people's [label:${yours}].`);
  const typical = pack.items.find((i) => i.id.startsWith("typical:"));
  if (typical) {
    const t = TYPICAL_BY_ID.get(typical.id.slice("typical:".length));
    if (t) parts.push(`Dreams about ${t.label.charAt(0).toLowerCase() + t.label.slice(1)} are typical: ${t.prevalence}% of students in one survey had ever had one [${typical.id}].`);
  }
  if (parts.length === 0) parts.push(`Not enough evidence yet to link this dream to anything you logged [dream].`);
  parts.push("What does it remind you of?");
  return parts.join(" ");
}

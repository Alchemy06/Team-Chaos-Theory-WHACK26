import { db, getSession, toBuildRow } from "@/lib/db";
import { runExtraction, sessionEntry, toBuildData } from "@/lib/buildData";
import { generateInsight } from "@/lib/insight";
import { reexploreContext } from "@/lib/reexploreContext";
import { ExplorationError } from "@/lib/reexploreError";

// (added) One leased refresh per dream; save the building, reflection and round snapshot atomically.
export async function refreshExploration(sessionId: string, roundId: string) {
  const { data: claim, error } = await db().rpc("claim_exploration_refresh", { p_session_id: sessionId, p_round_id: roundId });
  if (error) throw new ExplorationError(error.code === "P0001" ? "This dream is already updating or its history has changed. Please retry shortly." : "Could not start the saved dream update.", error.code === "P0001" ? 409 : 500);
  if (claim?.done) return { saved: true, updated: true };
  if (!claim?.token) throw new ExplorationError("Could not reserve this dream update.");
  try {
    const signal = AbortSignal.timeout(110000);
    const session = await getSession(sessionId);
    if (!session) throw new Error("Dream not found.");
    const { entry, markdown } = await sessionEntry(sessionId);
    const { extraction } = await runExtraction(markdown, entry, signal);
    const build = toBuildData(sessionId, extraction);
    const context = await reexploreContext(session, build);
    const insight = await generateInsight(context, signal);
    if (signal.aborted) throw new Error("The update took too long. Your answers are saved.");
    const { error: finishError } = await db().rpc("finish_exploration_refresh", {
      p_session_id: sessionId, p_round_id: roundId, p_token: claim.token,
      p_build: toBuildRow(build),
      p_insight: { journal_id: sessionId, text: insight.insight, source: insight.source, cited: insight.cited,
        problems: insight.problems, support: insight.support, attempts: insight.attempts, evidence: insight.evidence, writer_model: insight.writerModel },
    });
    if (finishError) throw new Error("Could not store the refreshed building and reflection.");
    return { saved: true, updated: true };
  } catch (failure) {
    console.error("re-explore refresh:", failure instanceof Error ? failure.message : failure);
    return { saved: true, updated: false, message: "Your answers are saved. We could not finish the building and reflection update. Please retry." };
  } finally {
    // (added) A stale worker can release only its own lease.
    await db().rpc("release_exploration_refresh", { p_session_id: sessionId, p_round_id: roundId, p_token: claim.token });
  }
}

import { z } from "zod";
import { ExplorationError, explorationAnswers, explorationRound, explorationHistory, saveExploration, startExploration } from "@/lib/reexplore";

import { refreshExploration } from "@/lib/reexploreRefresh";

function failure(error: unknown) {
  if (error instanceof ExplorationError) return Response.json({ error: error.message }, { status: error.status });
  console.error("re-explore:", error);
  return Response.json({ error: "Could not re-explore this dream. Please retry." }, { status: 500 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid dream ID." }, { status: 400 });
  try {
    return Response.json({ rounds: await explorationHistory(id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid dream ID." }, { status: 400 });
  try {
    return Response.json({ round: await startExploration(id) });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = explorationAnswers.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return Response.json({ error: "Please answer all three questions (up to 4,000 characters each)." }, { status: 400 });
  try {
    return Response.json(await saveExploration(id, parsed.data.roundId, parsed.data.answers));
  } catch (error) { return failure(error); }
}

// (added) Refresh only after the answers have been durably saved.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = explorationRound.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return Response.json({ error: "Invalid dream or round ID." }, { status: 400 });
  try { return Response.json(await refreshExploration(id, parsed.data.roundId)); }
  catch (error) { return failure(error); }
}

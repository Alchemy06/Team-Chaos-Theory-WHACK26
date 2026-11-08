// GET /api/media/search?kind=film&q=matrix -> suggestions for the media form's dropdown.
import { searchMedia, type Kind } from "@/lib/mediaSearch";

const KINDS = ["book", "film", "song", "game"];

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const kind = (KINDS.includes(params.get("kind") ?? "") ? params.get("kind") : "film") as Kind;
  if (q.length < 2) return Response.json({ results: [] });
  try {
    return Response.json({ results: await searchMedia(kind, q) });
  } catch (err) {
    return Response.json({ results: [], error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

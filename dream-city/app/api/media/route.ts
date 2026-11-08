// GET /api/media -> recent media, newest first.
// POST /api/media { kind, title, creator?, consumed_on?, user_note?, external_id? }
//   -> Groq fills main_emotion + themes, then the row is saved.
import { z } from "zod";
import { listMedia } from "@/lib/db";
import { addMediaTagged } from "@/lib/mediaTags";

const Body = z.object({
  kind: z.enum(["book", "film", "song", "game"]),
  title: z.string().trim().min(1).max(200),
  creator: z.string().trim().max(200).nullish(),
  consumed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  user_note: z.string().trim().max(2000).nullish(),
  external_id: z.string().max(100).nullish(),
});

export async function GET() {
  try {
    return Response.json({ media: await listMedia({ limit: 50 }) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  const b = parsed.data;
  try {
    const row = await addMediaTagged({
      kind: b.kind,
      title: b.title,
      creator: b.creator || null,
      consumed_on: b.consumed_on || undefined,
      user_note: b.user_note || null,
      external_id: b.external_id || null,
    });
    return Response.json(row);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

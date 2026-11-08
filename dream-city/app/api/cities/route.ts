// GET /api/cities -> every city (the default "My city" is not a row: it is sessions with no city).
// POST /api/cities { name, blurb? } -> a new, empty city.
import { z } from "zod";
import { createCity, listCities, notMigrated } from "@/lib/db";

export async function GET() {
  try {
    return Response.json({ cities: await listCities() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

const Body = z.object({ name: z.string().trim().min(1).max(60), blurb: z.string().trim().max(300).nullish() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "A city needs a name of 1-60 characters." }, { status: 400 });
  try {
    return Response.json({ city: await createCity(parsed.data.name, parsed.data.blurb ?? null) }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (notMigrated({ message: msg })) return Response.json({ error: "Run supabase/migrations/005_cities_media_symbols.sql first." }, { status: 409 });
    return Response.json({ error: msg }, { status: 502 });
  }
}

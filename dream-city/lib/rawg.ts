// Server-only RAWG (video games) lookups. Needs RAWG_KEY in .env.local (free key from rawg.io/apidocs).
const BASE = "https://api.rawg.io/api";

export type RawgGame = { id: number; name: string; year: string | null; imageUrl: string | null };
export type RawgGameDetail = RawgGame & { description: string; genres: string[] };

function key(): string {
  const k = process.env.RAWG_KEY;
  if (!k) throw new Error("Set RAWG_KEY in .env.local (free key from rawg.io/apidocs) and restart the dev server.");
  return k;
}

async function getJSON<T>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}${path}${sep}key=${key()}`);
  if (!res.ok) throw new Error(`RAWG ${res.status}`);
  return (await res.json()) as T;
}

export async function searchGames(query: string, limit = 8): Promise<RawgGame[]> {
  const d = await getJSON<{ results: { id: number; name: string; released?: string | null; background_image?: string | null }[] }>(
    `/games?search=${encodeURIComponent(query)}&page_size=${limit}`,
  );
  return d.results.map((g) => ({ id: g.id, name: g.name, year: g.released ? g.released.slice(0, 4) : null, imageUrl: g.background_image ?? null }));
}

/** One game by RAWG id (from a picked suggestion, "rawg:<id>"), with its description and genres. */
export async function getGame(id: number): Promise<RawgGameDetail> {
  const g = await getJSON<{
    id: number;
    name: string;
    released?: string | null;
    background_image?: string | null;
    description_raw?: string;
    genres?: { name: string }[];
  }>(`/games/${id}`);
  const description = (g.description_raw ?? "").replace(/\s+/g, " ").trim();
  return {
    id: g.id,
    name: g.name,
    year: g.released ? g.released.slice(0, 4) : null,
    imageUrl: g.background_image ?? null,
    description: description.length > 800 ? description.slice(0, 800) + "…" : description,
    genres: (g.genres ?? []).map((x) => x.name),
  };
}

// Server-only game search on the public Steam store, which needs no API key. Used when RAWG_KEY is
// not set or RAWG fails. Steam does not document these endpoints, so every field is treated as optional.
const STORE = "https://store.steampowered.com/api";

export type SteamGame = { id: number; name: string; imageUrl: string | null };

export async function searchSteam(query: string, limit = 8): Promise<SteamGame[]> {
  const res = await fetch(`${STORE}/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=GB`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Steam ${res.status}`);
  const data = (await res.json()) as { items?: { id?: number; name?: string; tiny_image?: string; type?: string }[] };
  return (data.items ?? [])
    .filter((g) => typeof g.id === "number" && typeof g.name === "string" && (g.type ?? "app") === "app")
    .slice(0, limit)
    .map((g) => ({ id: g.id!, name: g.name!, imageUrl: g.tiny_image ?? null }));
}

// A short description, so the media tagger can pick symbols for the game. Null if Steam has none.
export async function steamDescription(appId: string | number): Promise<string | null> {
  try {
    const res = await fetch(`${STORE}/appdetails?appids=${appId}&l=english`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, { success?: boolean; data?: { short_description?: string } }>;
    const text = data[String(appId)]?.data?.short_description;
    return text ? text.replace(/<[^>]+>/g, "").trim().slice(0, 600) : null;
  } catch {
    return null;
  }
}

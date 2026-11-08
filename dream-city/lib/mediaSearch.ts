// Server-only title search for the media form dropdown, one source per kind.
//   film -> TMDB        (TMDB_TOKEN)
//   book -> Open Library (no key)
//   song -> iTunes Search (no key)
//   game -> RAWG        (RAWG_KEY, free at rawg.io/apidocs)
import { searchGames } from "./rawg";
import { searchFilms } from "./tmdb";

export type Kind = "book" | "film" | "song" | "game";

export type Suggestion = {
  externalId: string; // e.g. "tmdb:603", "ol:OL82563W", "itunes:1440857781", "rawg:3328"
  title: string;
  subtitle: string | null; // author / artist / year
  imageUrl: string | null;
  description?: string | null;
};

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

async function books(q: string, limit: number): Promise<Suggestion[]> {
  const d = await getJSON<{ docs: { key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number }[] }>(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i`
  );
  return d.docs.map((b) => ({
    externalId: `ol:${b.key.replace("/works/", "")}`,
    title: b.title,
    subtitle: [b.author_name?.[0], b.first_publish_year].filter(Boolean).join(" · ") || null,
    imageUrl: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-S.jpg` : null,
  }));
}

async function songs(q: string, limit: number): Promise<Suggestion[]> {
  const d = await getJSON<{ results: { trackId: number; trackName: string; artistName: string; artworkUrl60?: string }[] }>(
    `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limit}`
  );
  return d.results.map((s) => ({
    externalId: `itunes:${s.trackId}`,
    title: s.trackName,
    subtitle: s.artistName,
    imageUrl: s.artworkUrl60 ?? null,
  }));
}

async function games(q: string, limit: number): Promise<Suggestion[]> {
  return (await searchGames(q, limit)).map((g) => ({
    externalId: `rawg:${g.id}`,
    title: g.name,
    subtitle: g.year,
    imageUrl: g.imageUrl,
  }));
}

async function films(q: string, limit: number): Promise<Suggestion[]> {
  return (await searchFilms(q, limit)).map((f) => ({
    externalId: `tmdb:${f.id}`,
    title: f.title,
    subtitle: f.year,
    imageUrl: f.posterUrl,
    description: f.overview,
  }));
}

export function searchMedia(kind: Kind, q: string, limit = 8): Promise<Suggestion[]> {
  return { film: films, book: books, song: songs, game: games }[kind](q, limit);
}

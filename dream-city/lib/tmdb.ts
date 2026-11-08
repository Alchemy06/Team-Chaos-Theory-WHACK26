// Server-only TMDB search. Needs TMDB_TOKEN (the "API Read Access Token", v4) in .env.local.
const BASE = "https://api.themoviedb.org/3";

export type TmdbFilm = {
  id: number;
  title: string;
  year: string | null;
  overview: string;
  posterUrl: string | null;
};

export async function searchFilms(query: string, limit = 5): Promise<TmdbFilm[]> {
  const token = process.env.TMDB_TOKEN;
  if (!token) throw new Error("Set TMDB_TOKEN in .env.local and restart the dev server.");
  const url = `${BASE}/search/movie?query=${encodeURIComponent(query)}&include_adult=false`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    results: { id: number; title: string; release_date?: string; overview?: string; poster_path?: string | null }[];
  };
  return data.results.slice(0, limit).map((r) => ({
    id: r.id,
    title: r.title,
    year: r.release_date ? r.release_date.slice(0, 4) : null,
    overview: r.overview ?? "",
    posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
  }));
}

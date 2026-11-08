import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// ── (ADDED) Use the newest supported file; its timestamp also refreshes replacements ──
export async function GET() {
  const directory = path.join(process.cwd(), "public", "audio");
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.filter(entry => entry.isFile() && /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(entry.name)).map(async entry => {
      const info = await stat(path.join(directory, entry.name));
      return { name: entry.name, modified: info.mtimeMs, size: info.size };
    }));
    const file = files.filter(file => file.size > 0).sort((a,b) => b.modified - a.modified || a.name.localeCompare(b.name))[0];
    return Response.json({ src: file ? `/audio/${encodeURIComponent(file.name)}?v=${file.modified}-${file.size}` : null,
      name: file?.name ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Response.json({ src: null, name: null }, { headers: { "Cache-Control": "no-store" } });
    return Response.json({ error: "Could not read the background music folder" }, { status: 500 });
  }
}

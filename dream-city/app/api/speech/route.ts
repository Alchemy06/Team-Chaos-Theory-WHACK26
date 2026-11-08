import { z } from "zod";

// ── (ADDED) Reuse question audio, including concurrent requests ──
const audioCache = new Map<string, Promise<ArrayBuffer>>();
const schema = z.object({ text: z.string().trim().min(1).max(1000) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Question must contain 1–1,000 characters" }, { status: 400 });
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) return Response.json({ error: "Configure ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID, then restart the server." }, { status: 503 });
  const cacheKey = `${voice}:${parsed.data.text}`;
  try {
    let audio = audioCache.get(cacheKey);
    if (!audio) {
      audio = (async () => {
        // ── (ADDED) API key stays on the server; only question text is sent ──
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
          body: JSON.stringify({ text: parsed.data.text, model_id: "eleven_multilingual_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, speed: 0.9, use_speaker_boost: true } }),
          signal: AbortSignal.timeout(30000),
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(response.status === 401 ? "ElevenLabs rejected the API key." : response.status === 402 || response.status === 403 ? "Check ElevenLabs credits and API access for this voice." : response.status === 404 ? "ElevenLabs voice was not found." : response.status === 429 ? "ElevenLabs request limit reached. Try again shortly." : "ElevenLabs could not generate the question audio.");
        }
        return response.arrayBuffer();
      })();
      if (audioCache.size >= 100) audioCache.delete(audioCache.keys().next().value!);
      audioCache.set(cacheKey, audio);
    }
    const bytes = await audio;
    return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch (error) {
    audioCache.delete(cacheKey);
    return Response.json({ error: error instanceof Error && error.name !== "TimeoutError" ? error.message : "Speech generation timed out. Try Replay question." }, { status: 502 });
  }
}

// (added) Bound the entire request, including reading its body, so Retry stays available.
export async function loadSavedDreams<T>(request: typeof fetch = fetch, timeoutMs = 12000): Promise<T[]> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Loading saved dreams timed out. Please retry."));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await request("/api/city", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Could not load saved dreams. Please retry.");
        const data = await response.json();
        if (!data || !Array.isArray(data.dreams)) throw new Error("Invalid saved dreams response. Please retry.");
        return data.dreams as T[];
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

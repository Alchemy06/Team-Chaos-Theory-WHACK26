// Reads ?city= from a request URL. Route files may only export route handlers, so this lives here.
// "mine" or empty = the default city (null); a uuid = that city; no parameter = every city (undefined).
import { z } from "zod";

export function cityParam(url: string): string | null | undefined {
  const v = new URL(url).searchParams.get("city");
  if (v === null) return undefined;
  if (v === "" || v === "mine") return null;
  return z.uuid().safeParse(v).success ? v : null;
}

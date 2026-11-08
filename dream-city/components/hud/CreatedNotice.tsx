"use client";

import { useCityStore } from "@/store/useCityStore";
import { PixelPanel } from "./ui/Pixel";

/**
 * Small centred popup confirming that something was created (a dream, a work).
 * It pops in, holds for a moment and fades away by itself; it never blocks clicks.
 */
export function CreatedNotice() {
  const notice = useCityStore((s) => s.notice);
  const color = notice?.color ?? "var(--gold)";
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
      {notice && (
        <PixelPanel key={notice.id} className="notice-pop w-[min(300px,100%)] px-5 py-4 text-center">
          <div
            className="mx-auto mb-2 grid h-10 w-10 place-items-center border-2 font-display text-lg"
            style={{ borderColor: color, color, boxShadow: `0 0 18px -4px ${color}` }}
            aria-hidden
          >
            ✓
          </div>
          <div className="text-[17px] leading-tight text-ink">{notice.title}</div>
          {notice.body && <div className="mt-1 truncate text-[13px] text-ink-dim">{notice.body}</div>}
        </PixelPanel>
      )}
    </div>
  );
}

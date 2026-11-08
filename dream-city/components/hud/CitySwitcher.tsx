"use client";

import { useState, type FormEvent } from "react";
import { useCityStore } from "@/store/useCityStore";
import { PixelButton, PixelPanel, cx } from "./ui/Pixel";

/** Pick which dream city to show ("My city", a demo person such as Maya, or one you made), or make a new one. */
export function CitySwitcher() {
  const cityId = useCityStore((s) => s.cityId);
  const cities = useCityStore((s) => s.cities);
  const setCity = useCityStore((s) => s.setCity);
  const createCity = useCityStore((s) => s.createCity);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const current = cities.find((c) => c.id === cityId);
  const options = [{ id: null as string | null, name: "My city", blurb: "Your own dreams", is_demo: false }, ...cities];

  const pick = (id: string | null) => {
    setCity(id);
    setOpen(false);
  };
  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const id = await createCity(name.trim());
    setBusy(false);
    if (id) {
      setName("");
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="pixel-focus flex max-w-[220px] items-center gap-1.5 text-left text-[14px] leading-tight text-ink hover:text-gold"
      >
        <span className="truncate">{current?.name ?? "My city"}</span>
        {current?.is_demo && <span className="pixel-chip px-1 font-display text-[8px] uppercase leading-[14px] tracking-wider text-ink-faint">demo</span>}
        <span aria-hidden className="text-[10px] text-ink-faint">▾</span>
      </button>
      {open && (
        <PixelPanel className="anim-rise absolute left-0 top-7 z-40 w-72 p-2">
          <ul role="listbox" aria-label="Dream cities" className="pixel-scroll max-h-72 space-y-1 overflow-y-auto">
            {options.map((c) => (
              <li key={c.id ?? "mine"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.id === cityId}
                  onClick={() => pick(c.id)}
                  className={cx(
                    "pixel-focus w-full border-2 px-2 py-1.5 text-left hover:bg-(--hover)",
                    c.id === cityId ? "border-gold" : "border-transparent",
                  )}
                >
                  <span className="flex items-baseline gap-1.5 text-[14px] text-ink">
                    {c.name}
                    {c.is_demo && <span className="font-display text-[8px] uppercase tracking-wider text-ink-faint">demo</span>}
                  </span>
                  {c.blurb && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-ink-dim">{c.blurb}</span>}
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={create} className="mt-2 flex gap-1.5 border-t-2 border-line pt-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="New city name"
              aria-label="New city name"
              className="pixel-input min-w-0 flex-1 px-2 py-1 text-[13px]"
            />
            <PixelButton type="submit" disabled={!name.trim() || busy} className="px-2 py-1">
              {busy ? "…" : "Create"}
            </PixelButton>
          </form>
        </PixelPanel>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

export default function DreamJournal() {

    // Data
  const [dream, setDream] = useState("");

    // Journal Interface

    return (
        <main className="mx-auto max-w-xl space-y-4 p-6">
            {/* ── Heading ──────────────────────────────────── */}
            <h1 className="text-2xl font-bold">Dream Journal</h1>

            <p>Write down whatever you remember from your dream.</p>

            {/* ── Dream input ──────────────────────────────── */}
            <label htmlFor="dream" className="block">
                What did you dream?
            </label>

            <textarea
                id="dream"
                value={dream}
                onChange={(event) => setDream(event.target.value)}
                placeholder="My dream started..."
                rows={6}
                className="w-full rounded-lg border p-3"
            />

            {/* ── Submit button ────────────────────────────── */}
            <button
                type="button"
                disabled={!dream.trim()}
                className="rounded-lg bg-purple-700 px-4 py-2 text-white disabled:opacity-50"
            >
                Submit dream
            </button>
        </main>
    );
}
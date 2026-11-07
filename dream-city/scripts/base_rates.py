"""Compute approximate DreamBank base rates for each symbol in data/vocab.json.

Run once from the dream-city folder:
    pip install datasets pandas
    python scripts/base_rates.py

Writes data/baseRates.json. Each rate is the share of sampled DreamBank reports
that mention one of the symbol's keywords. Keyword matching is crude, so call
these "approximate base rates" in the demo.
"""

import json
import re
from pathlib import Path

from datasets import load_dataset

ROOT = Path(__file__).resolve().parent.parent
PER_SERIES_CAP = 50  # stops a few prolific dreamers dominating the baseline
SEED = 42

vocab = json.loads((ROOT / "data" / "vocab.json").read_text(encoding="utf-8"))
df = load_dataset("DReAMy-lib/DreamBank-dreams-en", split="train").to_pandas()
df = df.dropna(subset=["dreams"])
df = df.groupby("series", group_keys=False).apply(
    lambda g: g.sample(n=min(len(g), PER_SERIES_CAP), random_state=SEED)
)
texts = df["dreams"].str.lower()

rates = {}
for symbol, words in vocab["symbols"].items():
    pattern = r"\b(?:" + "|".join(re.escape(w.lower()) for w in words) + r")(?:s|es|ed|ing)?\b"
    rates[symbol] = round(float(texts.str.contains(pattern, regex=True).mean()), 4)

out = {
    "placeholder": False,
    "note": f"Approximate: keyword matches in {len(df)} DreamBank reports, capped at {PER_SERIES_CAP} per series.",
    "n": int(len(df)),
    "series": int(df["series"].nunique()),
    "rates": rates,
}
(ROOT / "data" / "baseRates.json").write_text(json.dumps(out, indent=2), encoding="utf-8")

print(f"Wrote {len(rates)} base rates from {len(df)} reports across {out['series']} series.")
for symbol, rate in sorted(rates.items(), key=lambda kv: -kv[1])[:10]:
    print(f"  {symbol:12s} {rate:.1%}")

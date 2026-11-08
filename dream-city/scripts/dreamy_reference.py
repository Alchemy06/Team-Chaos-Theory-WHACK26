"""Step 3: run DReAMy's published emotion model on the same DreamBank sample, as the reference coder.

The model (DReAMy-lib/xlm-roberta-large-DreamBank-emotion-presence) was trained on expert Hall and
Van de Castle emotion codes and reports F1 0.86 against them (Bertolini et al., 2024). It is a stand-in
for the experts, not the experts: about 1 label in 7 it gives is wrong.

Run once from the dream-city folder (downloads about 2 GB of model weights the first time):
    pip install transformers torch
    python scripts/dreamy_reference.py

Writes data/eval/dreamy_emotions.jsonl: one line per report, {"id", "scores": {"AN": 0.03, "AP": 0.91, ...}}.
Labels: AN anger, AP apprehension, SD sadness, CO confusion, HA happiness.
"""

import json
from pathlib import Path

from transformers import pipeline

ROOT = Path(__file__).resolve().parent.parent
EVAL = ROOT / "data" / "eval"
MODEL = "DReAMy-lib/xlm-roberta-large-DreamBank-emotion-presence"
KNOWN = {"AN", "AP", "SD", "CO", "HA"}

items = json.loads((EVAL / "sample.json").read_text(encoding="utf-8"))["items"]
out_path = EVAL / "dreamy_emotions.jsonl"
done = set()
if out_path.exists():
    done = {json.loads(line)["id"] for line in out_path.read_text(encoding="utf-8").splitlines() if line.strip()}
todo = [it for it in items if it["id"] not in done]
print(f"{len(todo)} reports to score ({len(done)} already done).")

clf = pipeline("text-classification", model=MODEL, top_k=None, function_to_apply="sigmoid", truncation=True, max_length=512)
id2label = clf.model.config.id2label
if not set(id2label.values()) & KNOWN:
    print(f"Warning: unexpected label names {id2label}. Check the model card and map them to AN/AP/SD/CO/HA.")

with out_path.open("a", encoding="utf-8") as f:
    for start in range(0, len(todo), 16):
        batch = todo[start : start + 16]
        preds = clf([it["text"] for it in batch], batch_size=16)
        for it, scores in zip(batch, preds):
            f.write(json.dumps({"id": it["id"], "scores": {s["label"]: round(float(s["score"]), 4) for s in scores}}) + "\n")
        print(f"  {min(start + 16, len(todo))} / {len(todo)}")

print(f"Wrote {out_path.relative_to(ROOT)}")

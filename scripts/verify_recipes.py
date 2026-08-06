"""Run the recipes the lab prints and compare them with what the browser rendered.

The lab claims its synth is a faithful port of blip8 and prints Python to prove
it. This is the proof: tests/port-fidelity.test.ts renders each sound in
TypeScript, dumps it as a wav next to the recipe, and calls this to render the
same recipe through the real library and diff the samples.

Noise is excluded: blip8 draws from numpy's PCG64 and the lab from mulberry32, so
the same seed gives different noise on purpose.

Run: uv run scripts/verify_recipes.py <dir with manifest.json>
Exits non-zero if anything diverges by more than int16 rounding.
"""

# /// script
# requires-python = ">=3.12"
# dependencies = ["blip8>=0.1.0", "numpy>=2.0"]
# ///

import json
import sys
import wave
from pathlib import Path

import numpy as np

INT16_STEP = 1 / 32767
TOLERANCE = 1.5 * INT16_STEP
# trim() fades the tail of a crunched sound; the Python recipe has no such fade.
FADE_SAMPLES = int(0.006 * 44100) + 2


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as handle:
        raw = handle.readframes(handle.getnframes())
    return np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32767.0


def main() -> int:
    folder = Path(sys.argv[1])
    manifest = json.loads((folder / "manifest.json").read_text())

    worst = 0.0
    failures = []
    checked = 0

    for entry in manifest:
        if entry["usesNoise"]:
            continue
        code = "\n".join(
            line for line in entry["python"].splitlines() if not line.startswith("save(")
        )
        scope: dict[str, object] = {}
        try:
            exec(compile(code, entry["name"], "exec"), scope)
        except Exception as exc:
            failures.append(f"{entry['name']}: recipe does not run: {exc}")
            continue

        python_side = np.clip(np.asarray(scope["sound"], dtype=np.float64), -1, 1)
        browser_side = read_wav(folder / f"{entry['name']}.wav")

        shared = min(len(python_side), len(browser_side))
        if entry["crunch"]:
            shared -= FADE_SAMPLES
        if shared <= 0:
            failures.append(f"{entry['name']}: nothing to compare")
            continue

        diff = float(np.max(np.abs(python_side[:shared] - browser_side[:shared])))
        worst = max(worst, diff)
        checked += 1
        if diff > TOLERANCE:
            failures.append(f"{entry['name']}: diverges by {diff:.6f}")

    for line in failures:
        print(f"FAIL {line}")
    print(f"{checked} recipes checked, worst divergence {worst:.8f} (int16 step {INT16_STEP:.8f})")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

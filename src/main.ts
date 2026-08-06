import "./styles.css";

import { buildControls } from "./controls";
import { el } from "./dom";
import { fromHash, writeHash } from "./link";
import { filename, toPython } from "./recipe";
import { attachScope } from "./scope";
import { CATEGORIES, describe, mutate, randomize, render, type Category, type Params } from "./sfx";
import { play, toWavBlob } from "./synth";

const pads = el("pads");
const readout = el("readout");
const recipe = el("recipe");
const crunchBox = el<HTMLInputElement>("crunch");
const scope = attachScope(el<HTMLCanvasElement>("scope"));
const echo = el("echo");

const shared = fromHash(window.location.hash);
let current: Params = shared ?? randomize("blip");
let last: Float32Array | null = null;

const controls = buildControls(el("knobs"), {
  onPreview(patch) {
    show({ ...current, ...patch }, { play: false, sync: false });
  },
  onCommit() {
    show(current);
  },
  onReseed(seed) {
    show(randomize(current.category, seed));
  },
});

function playSound(samples: Float32Array): void {
  play(samples);
  echo.classList.remove("perk");
  void echo.offsetWidth; // reflow, so the animation restarts on every sound
  echo.classList.add("perk");
}

function show(params: Params, options: { play?: boolean; sync?: boolean } = {}): void {
  current = { ...params, crunch: crunchBox.checked };
  last = render(current);
  readout.textContent = describe(current);
  recipe.textContent = toPython(current);
  scope.draw(last);
  writeHash(current);
  if (options.sync !== false) controls.sync(current);
  if (options.play !== false) playSound(last);
}

for (const category of CATEGORIES) {
  const pad = document.createElement("button");
  pad.className = "pad";
  pad.textContent = category;
  pad.addEventListener("click", () => show(randomize(category)));
  pads.append(pad);
}

el("mutate").addEventListener("click", () => show(mutate(current)));
el("replay").addEventListener("click", () => last && playSound(last));

crunchBox.addEventListener("change", () => show(current));

el("download").addEventListener("click", () => {
  if (!last) return;
  const url = URL.createObjectURL(toWavBlob(last));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename(current);
  link.click();
  URL.revokeObjectURL(url);
});

copyButton("copy-link", () => window.location.href);
copyButton("copy-recipe", () => toPython(current));

function copyButton(id: string, text: () => string): void {
  const button = el(id);
  const label = button.textContent ?? "";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text());
      button.textContent = "copied";
    } catch {
      button.textContent = "copy failed";
    }
    window.setTimeout(() => (button.textContent = label), 1200);
  });
}

document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = (event.target as HTMLElement | null)?.tagName ?? "";
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;

  const category: Category | undefined = CATEGORIES[Number(event.key) - 1];
  if (category) {
    show(randomize(category));
  } else if (event.key === "m") {
    show(mutate(current));
  } else if (event.key === " ") {
    if (tag === "BUTTON") return;
    event.preventDefault();
    if (last) playSound(last);
  }
});

window.addEventListener("hashchange", () => {
  const params = fromHash(window.location.hash);
  if (params) show(params, { play: false });
});

// Draw but do not play: browsers block audio before a gesture.
crunchBox.checked = current.crunch;
show(current, { play: false });

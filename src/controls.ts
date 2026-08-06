import { LIMITS, NUMERIC_KEYS, uses, type NumericKey, type Params, type Voice } from "./sfx";

const VOICES: Voice[] = ["square", "triangle", "sine", "bell", "noise"];

const AS_MS: NumericKey[] = ["length", "attack", "release"];

export interface Controls {
  sync(params: Params): void;
}

export interface Handlers {
  onPreview(patch: Partial<Params>): void;
  onCommit(): void;
  onReseed(seed: number): void;
}

export function buildControls(root: HTMLElement, handlers: Handlers): Controls {
  const rows = new Map<NumericKey | "voice", HTMLElement>();
  const inputs = new Map<NumericKey, HTMLInputElement>();
  const values = new Map<NumericKey, HTMLElement>();

  for (const key of NUMERIC_KEYS) {
    const limit = LIMITS[key];
    const row = document.createElement("label");
    row.className = "knob";

    const name = document.createElement("span");
    name.className = "knob-name";
    name.textContent = limit.label;

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(limit.min);
    input.max = String(limit.max);
    input.step = String(limit.step);

    const readout = document.createElement("span");
    readout.className = "knob-value";

    input.addEventListener("input", () => {
      const value = Number(input.value);
      readout.textContent = format(key, value);
      handlers.onPreview({ [key]: value } as Partial<Params>);
    });
    input.addEventListener("change", handlers.onCommit);

    row.append(name, input, readout);
    root.append(row);
    rows.set(key, row);
    inputs.set(key, input);
    values.set(key, readout);
  }

  const voiceRow = document.createElement("label");
  voiceRow.className = "knob";
  const voiceName = document.createElement("span");
  voiceName.className = "knob-name";
  voiceName.textContent = "voice";
  const voiceSelect = document.createElement("select");
  for (const voice of VOICES) {
    const option = document.createElement("option");
    option.value = voice;
    option.textContent = voice;
    voiceSelect.append(option);
  }
  voiceSelect.addEventListener("change", () => {
    handlers.onPreview({ voice: voiceSelect.value as Voice });
    handlers.onCommit();
  });
  voiceRow.append(voiceName, voiceSelect);
  root.append(voiceRow);
  rows.set("voice", voiceRow);

  const seedRow = document.createElement("label");
  seedRow.className = "knob";
  const seedName = document.createElement("span");
  seedName.className = "knob-name";
  seedName.textContent = "seed";
  const seedInput = document.createElement("input");
  seedInput.type = "number";
  seedInput.min = "0";
  seedInput.step = "1";
  const seedNote = document.createElement("span");
  seedNote.className = "knob-value knob-note";
  seedNote.textContent = "re-rolls";
  seedInput.addEventListener("change", () => {
    const seed = Math.max(0, Math.floor(Number(seedInput.value) || 0));
    seedInput.value = String(seed);
    handlers.onReseed(seed);
  });
  seedRow.append(seedName, seedInput, seedNote);
  root.append(seedRow);

  return {
    sync(params) {
      for (const key of NUMERIC_KEYS) {
        const input = inputs.get(key)!;
        const active = uses(params, key);
        input.value = String(params[key]);
        input.disabled = !active;
        values.get(key)!.textContent = format(key, params[key]);
        rows.get(key)!.classList.toggle("unused", !active);
      }
      voiceSelect.value = params.voice;
      const voiceActive = uses(params, "voice");
      voiceSelect.disabled = !voiceActive;
      rows.get("voice")!.classList.toggle("unused", !voiceActive);
      seedInput.value = String(params.seed);
    },
  };
}

function format(key: NumericKey, value: number): string {
  if (AS_MS.includes(key)) return `${Math.round(value * 1000)} ms`;
  if (key === "freq") return `${Math.round(value)} Hz`;
  if (key === "glide" || key === "interval") return `x${value.toFixed(2)}`;
  return value.toFixed(3);
}

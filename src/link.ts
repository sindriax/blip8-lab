import {
  CATEGORIES,
  LIMITS,
  NUMERIC_KEYS,
  randomize,
  type NumericKey,
  type Params,
  type Voice,
} from "./sfx";

const VOICES: Voice[] = ["square", "triangle", "sine", "bell", "noise"];

const KEYS: Record<NumericKey, string> = {
  freq: "f",
  glide: "g",
  duty: "d",
  length: "l",
  volume: "v",
  attack: "a",
  release: "r",
  interval: "i",
};

// #coin.4819 while the sound is still what its seed rolls, then
// #coin.4819~voice~f974_g1_... once a knob has moved.
export function toHash(p: Params): string {
  const tail = p.crunch ? "!" : "";
  if (isPlainRoll(p)) return `${p.category}.${p.seed}${tail}`;

  const fields = NUMERIC_KEYS.map((key) => `${KEYS[key]}${trimNumber(p[key])}`);
  return `${p.category}.${p.seed}${tail}~${p.voice}~${fields.join("_")}`;
}

function isPlainRoll(p: Params): boolean {
  const rolled = randomize(p.category, p.seed);
  if (rolled.voice !== p.voice) return false;
  return NUMERIC_KEYS.every((key) => rolled[key] === p[key]);
}

export function fromHash(hash: string): Params | null {
  const text = hash.replace(/^#/, "").trim();
  if (!text) return null;

  const [head, voice, fields] = text.split("~");
  const crunch = head.endsWith("!");
  const [name, seedText] = (crunch ? head.slice(0, -1) : head).split(".");

  const category = CATEGORIES.find((c) => c === name);
  if (!category) return null;
  const seed = Number(seedText);
  if (!Number.isFinite(seed) || seed < 0) return null;

  const p: Params = { ...randomize(category, Math.floor(seed)), crunch };

  if (voice && VOICES.includes(voice as Voice)) p.voice = voice as Voice;
  if (fields) {
    for (const field of fields.split("_")) {
      const key = NUMERIC_KEYS.find((candidate) => KEYS[candidate] === field[0]);
      if (!key) continue;
      const value = Number(field.slice(1));
      if (!Number.isFinite(value)) continue;
      const { min, max } = LIMITS[key];
      p[key] = Math.min(max, Math.max(min, value));
    }
  }
  return p;
}

export function writeHash(p: Params): void {
  const hash = `#${toHash(p)}`;
  if (hash !== window.location.hash) {
    window.history.replaceState(null, "", hash);
  }
}

function trimNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

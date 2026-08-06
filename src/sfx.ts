import {
  BELL_TABLE,
  concat,
  crunch,
  envelope,
  mix,
  noise,
  rng,
  SINE_TABLE,
  square,
  triangle,
  trim,
  wavetable,
  type Pitch,
} from "./synth";

export type Category = "blip" | "coin" | "jump" | "laser" | "hurt" | "powerup" | "explosion";
export type Voice = "square" | "triangle" | "sine" | "bell" | "noise";

export const CATEGORIES: Category[] = [
  "blip",
  "coin",
  "jump",
  "laser",
  "hurt",
  "powerup",
  "explosion",
];

export interface Params {
  category: Category;
  voice: Voice;
  seed: number;
  freq: number;
  glide: number;
  duty: number;
  length: number;
  volume: number;
  attack: number;
  release: number;
  interval: number;
  crunch: boolean;
}

export type NumericKey =
  "freq" | "glide" | "duty" | "length" | "volume" | "attack" | "release" | "interval";

export const NUMERIC_KEYS: NumericKey[] = [
  "freq",
  "glide",
  "duty",
  "length",
  "volume",
  "attack",
  "release",
  "interval",
];

export const LIMITS: Record<NumericKey, { min: number; max: number; step: number; label: string }> =
  {
    freq: { min: 40, max: 3000, step: 1, label: "pitch" },
    glide: { min: 0.05, max: 4, step: 0.01, label: "glide" },
    duty: { min: 0.05, max: 0.95, step: 0.005, label: "duty" },
    length: { min: 0.02, max: 2, step: 0.005, label: "length" },
    volume: { min: 0.05, max: 1, step: 0.01, label: "volume" },
    attack: { min: 0, max: 0.4, step: 0.001, label: "attack" },
    release: { min: 0, max: 0.8, step: 0.005, label: "release" },
    interval: { min: 1, max: 3, step: 0.005, label: "interval" },
  };

const USES: Record<Category, (NumericKey | "voice")[]> = {
  blip: ["freq", "duty", "length", "volume", "attack", "release", "voice"],
  coin: ["freq", "interval", "duty", "length", "volume", "release", "voice"],
  jump: ["freq", "glide", "duty", "length", "volume", "attack", "release", "voice"],
  laser: ["freq", "glide", "duty", "length", "volume", "attack", "release", "voice"],
  hurt: ["freq", "glide", "duty", "length", "volume", "attack", "release", "voice"],
  powerup: ["freq", "interval", "length", "volume", "release", "voice"],
  explosion: ["freq", "length", "volume"],
};

export function uses(p: Params, key: NumericKey | "voice"): boolean {
  if (!USES[p.category].includes(key)) return false;
  return !(key === "duty" && p.voice !== "square");
}

const COIN_INTERVALS = [1.335, 1.5];
const POWERUP_INTERVALS = [1.19, 1.26, 1.335, 2.0];
const DUTIES = [0.125, 0.25, 0.5];

export function randomize(category: Category, seed = Math.floor(Math.random() * 1e9)): Params {
  const r = rng(seed);
  const range = (lo: number, hi: number) => lo + r() * (hi - lo);
  const pick = <T>(options: T[]) => options[Math.floor(r() * options.length)];
  const chance = (odds: number) => r() < odds;

  const p: Params = {
    category,
    seed,
    voice: "square",
    freq: 440,
    glide: 1,
    duty: 0.5,
    length: 0.1,
    volume: 0.4,
    attack: 0.001,
    release: 0.03,
    interval: 1.5,
    crunch: false,
  };

  switch (category) {
    case "blip":
      p.freq = range(440, 1568);
      p.duty = pick([0.125, 0.25, 0.5]);
      p.length = range(0.04, 0.09);
      p.release = range(0.015, 0.03);
      if (chance(0.2)) p.voice = pick<Voice>(["sine", "bell"]);
      break;

    case "coin":
      p.freq = range(659, 1319);
      p.interval = pick(COIN_INTERVALS);
      p.duty = pick([0.25, 0.5]);
      p.length = range(0.25, 0.4);
      p.release = range(0.15, 0.25);
      if (chance(0.25)) p.voice = "bell";
      break;

    case "jump":
      p.freq = range(300, 520);
      p.glide = range(1.9, 2.4);
      p.duty = chance(0.8) ? 0.125 : 0.25;
      p.length = range(0.11, 0.16);
      break;

    case "laser": {
      p.freq = range(900, 2200);
      p.glide = range(100, 500) / p.freq;
      p.duty = pick([0.125, 0.25, 0.5]);
      p.length = range(0.14, 0.3);
      p.volume = 0.45;
      p.release = 0.05;
      if (chance(0.15)) p.voice = "sine";
      break;
    }

    case "hurt": {
      p.freq = range(390, 540);
      p.glide = range(82, 120) / p.freq;
      p.duty = chance(0.8) ? 0.125 : 0.25;
      p.length = range(0.17, 0.32);
      p.volume = 0.45;
      p.release = 0.06;
      if (chance(0.2)) p.voice = "triangle";
      break;
    }

    case "powerup":
      p.freq = range(490, 660);
      p.interval = pick(POWERUP_INTERVALS);
      p.length = range(0.04, 0.075);
      p.release = 0.015;
      if (chance(0.2)) p.voice = "bell";
      break;

    case "explosion":
      p.voice = "noise";
      p.freq = range(100, 175);
      p.length = range(0.4, 1.4);
      p.volume = 0.35;
      break;
  }

  return snapAll(p);
}

function snapAll(p: Params): Params {
  for (const key of NUMERIC_KEYS) p[key] = snap(p[key], LIMITS[key].step);
  return p;
}

export function snap(value: number, step: number): number {
  // toFixed first: Math.round(0.125 / 0.005) * 0.005 gives 0.12500000000000003.
  return Number((Math.round(value / step) * step).toFixed(6));
}

export function mutate(p: Params, amount = 0.18): Params {
  const next: Params = { ...p, seed: Math.floor(Math.random() * 1e9) };
  const nudge = () => 1 + (Math.random() * 2 - 1) * amount;

  for (const key of ["freq", "glide", "length", "attack", "release"] as NumericKey[]) {
    if (!uses(p, key)) continue;
    const { min, max } = LIMITS[key];
    next[key] = snap(clamp(p[key] * nudge(), min, max), LIMITS[key].step);
  }

  if (uses(p, "duty") && Math.random() < 0.25) next.duty = other(DUTIES, p.duty);
  if (uses(p, "interval") && Math.random() < 0.25) {
    next.interval = other(p.category === "coin" ? COIN_INTERVALS : POWERUP_INTERVALS, p.interval);
  }
  return next;
}

function other(options: number[], current: number): number {
  const rest = options.filter((value) => value !== current);
  return rest.length ? rest[Math.floor(Math.random() * rest.length)] : current;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function render(p: Params): Float32Array {
  const samples = build(p);
  return p.crunch ? trim(crunch(samples, 4)) : samples;
}

function build(p: Params): Float32Array {
  switch (p.category) {
    case "blip":
      return shape(p, voice(p, pitch(p), p.length, p.volume));

    case "coin":
      return concat(
        envelope(voice(p, p.freq, 0.07, p.volume), 0.001, 0, 1, 0.01),
        envelope(voice(p, p.freq * p.interval, p.length, p.volume), 0.001, 0, 1, p.release),
      );

    case "jump":
    case "laser":
    case "hurt":
      return shape(p, voice(p, pitch(p), p.length, p.volume));

    case "powerup":
      return concat(
        ...ladder(p.interval).map((step) =>
          envelope(voice(p, p.freq * step, p.length, p.volume), 0.001, 0, 1, p.release),
        ),
      );

    case "explosion": {
      const debris = hit(noise(p.length, p.volume, p.seed), p.length);
      const thump = hit(triangle([p.freq, 30], p.length, thumpVolume(p)), thumpDecay(p));
      return mix(debris, thump);
    }
  }
}

export function thumpVolume(p: Params): number {
  return snap(p.volume * 0.85, LIMITS.volume.step);
}

export function thumpDecay(p: Params): number {
  return snap(p.length * 0.6, LIMITS.length.step);
}

export function ladder(interval: number): number[] {
  // An octave has no room for a chord under it, so it becomes a two-note bounce.
  return interval >= 1.9 ? [1, 2, 1, 2] : [1, interval, 1.5, 2];
}

function pitch(p: Params): Pitch {
  return p.glide === 1 ? p.freq : [p.freq, p.freq * p.glide];
}

function voice(p: Params, freq: Pitch, length: number, volume: number): Float32Array {
  switch (p.voice) {
    case "triangle":
      return triangle(freq, length, volume);
    case "sine":
      return wavetable(SINE_TABLE, freq, length, volume);
    case "bell":
      return wavetable(BELL_TABLE, freq, length, volume);
    case "noise":
      return noise(length, volume, p.seed);
    default:
      return square(freq, length, p.duty, volume);
  }
}

function shape(p: Params, samples: Float32Array): Float32Array {
  return envelope(samples, p.attack, 0, 1, p.release);
}

function hit(samples: Float32Array, length: number): Float32Array {
  return envelope(samples, 0.001, length, 0, 0);
}

export function describe(p: Params): string {
  const parts = [p.category, p.voice, `${Math.round(p.freq)} Hz`];
  if (uses(p, "glide")) parts.push(`glide x${p.glide.toFixed(2)}`);
  if (uses(p, "duty")) parts.push(`duty ${p.duty.toFixed(3)}`);
  parts.push(`${Math.round(p.length * 1000)} ms`);
  if (p.crunch) parts.push("4-bit");
  return parts.join(" · ");
}

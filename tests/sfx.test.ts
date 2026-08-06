import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  LIMITS,
  NUMERIC_KEYS,
  mutate,
  randomize,
  render,
  snap,
  uses,
  type Category,
} from "../src/sfx";

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 977 + 1);

function peak(samples: Float32Array): number {
  let loudest = 0;
  for (const sample of samples) loudest = Math.max(loudest, Math.abs(sample));
  return loudest;
}

describe("randomize", () => {
  it("is reproducible from the seed", () => {
    for (const category of CATEGORIES) {
      expect(randomize(category, 4242)).toEqual(randomize(category, 4242));
    }
  });

  it("lands every number on its slider step and inside its bounds", () => {
    for (const category of CATEGORIES) {
      for (const seed of SEEDS) {
        const params = randomize(category, seed);
        for (const key of NUMERIC_KEYS) {
          const { min, max, step } = LIMITS[key];
          expect(params[key]).toBe(snap(params[key], step));
          expect(params[key]).toBeGreaterThanOrEqual(min);
          expect(params[key]).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it("picks a voice each category can actually use", () => {
    for (const seed of SEEDS) {
      expect(randomize("explosion", seed).voice).toBe("noise");
      expect(randomize("jump", seed).voice).toBe("square");
    }
  });
});

describe("render", () => {
  it("never clips and never comes out silent", () => {
    for (const category of CATEGORIES) {
      for (const seed of SEEDS) {
        for (const crunch of [false, true]) {
          const params = { ...randomize(category, seed), crunch };
          const loudest = peak(render(params));
          expect(loudest).toBeLessThanOrEqual(1);
          expect(loudest).toBeGreaterThan(0.05);
        }
      }
    }
  });

  it("produces only finite samples", () => {
    for (const category of CATEGORIES) {
      for (const sample of render(randomize(category, 7))) {
        expect(Number.isFinite(sample)).toBe(true);
      }
    }
  });

  it("is deterministic for the same params", () => {
    const params = randomize("explosion", 99);
    expect(Array.from(render(params))).toEqual(Array.from(render(params)));
  });
});

describe("mutate", () => {
  it("stays clean over long chains", () => {
    for (const category of CATEGORIES) {
      let params = randomize(category, 31);
      for (let generation = 0; generation < 25; generation++) {
        params = mutate(params);
        const loudest = peak(render(params));
        expect(loudest).toBeLessThanOrEqual(1);
        expect(loudest).toBeGreaterThan(0.05);
        for (const key of NUMERIC_KEYS) {
          expect(params[key]).toBeGreaterThanOrEqual(LIMITS[key].min);
          expect(params[key]).toBeLessThanOrEqual(LIMITS[key].max);
        }
      }
    }
  });

  it("leaves volume and category alone", () => {
    for (const category of CATEGORIES) {
      const before = randomize(category, 12);
      const after = mutate(before);
      expect(after.volume).toBe(before.volume);
      expect(after.category).toBe(before.category);
    }
  });

  it("only touches params the category reads", () => {
    const before = randomize("explosion", 5);
    const after = mutate(before);
    for (const key of NUMERIC_KEYS) {
      if (!uses(before, key)) expect(after[key]).toBe(before[key]);
    }
  });
});

describe("uses", () => {
  it("retires duty when the voice is not a square", () => {
    const square = randomize("jump", 3);
    expect(uses(square, "duty")).toBe(true);
    expect(uses({ ...square, voice: "sine" }, "duty")).toBe(false);
  });

  it("leaves every category with something to drag", () => {
    for (const category of CATEGORIES as Category[]) {
      const params = randomize(category, 3);
      expect(NUMERIC_KEYS.filter((key) => uses(params, key)).length).toBeGreaterThan(2);
    }
  });
});

import { describe, expect, it } from "vitest";

import { fromHash, toHash } from "../src/link";
import { CATEGORIES, LIMITS, mutate, randomize, render } from "../src/sfx";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 1013 + 1);

describe("toHash", () => {
  it("keeps a plain roll down to its category and seed", () => {
    expect(toHash(randomize("coin", 481920371))).toBe("coin.481920371");
    expect(toHash({ ...randomize("coin", 481920371), crunch: true })).toBe("coin.481920371!");
  });

  it("spells out every number once a knob has moved", () => {
    const tweaked = { ...randomize("coin", 12), freq: 900 };
    const hash = toHash(tweaked);
    expect(hash).toContain("~");
    expect(hash).toContain("f900");
  });
});

describe("round trip", () => {
  it("survives both shapes, params and samples alike", () => {
    for (const category of CATEGORIES) {
      for (const seed of SEEDS) {
        for (const tweak of [false, true]) {
          const params = {
            ...(tweak ? mutate(randomize(category, seed)) : randomize(category, seed)),
          };
          params.crunch = seed % 3 === 0;
          const back = fromHash(`#${toHash(params)}`);
          expect(back).toEqual(params);
          expect(Array.from(render(back!))).toEqual(Array.from(render(params)));
        }
      }
    }
  });
});

describe("fromHash", () => {
  it("refuses what it cannot trust", () => {
    expect(fromHash("")).toBeNull();
    expect(fromHash("#")).toBeNull();
    expect(fromHash("#nonsense.5")).toBeNull();
    expect(fromHash("#coin.x")).toBeNull();
    expect(fromHash("#coin.-5")).toBeNull();
  });

  it("clamps a hand-edited link instead of refusing it", () => {
    const params = fromHash("#laser.5~square~f999999_l99");
    expect(params?.freq).toBe(LIMITS.freq.max);
    expect(params?.length).toBe(LIMITS.length.max);
  });

  it("ignores an unknown voice and unknown fields", () => {
    const params = fromHash("#coin.5~trombone~f900_zzz9");
    expect(params?.voice).toBe(randomize("coin", 5).voice);
    expect(params?.freq).toBe(900);
  });
});

import { describe, expect, it } from "vitest";

import { toPython } from "../src/recipe";
import { CATEGORIES, randomize } from "../src/sfx";

const SEEDS = [7, 42, 1234, 99999];

describe("toPython", () => {
  it("imports exactly the names it uses, and no others", () => {
    for (const category of CATEGORIES) {
      for (const seed of SEEDS) {
        const code = toPython(randomize(category, seed));
        const [line] = code.split("\n");
        const imported = line.replace("from blip8 import ", "").split(", ");
        const body = code.split("\n").slice(1).join("\n");
        for (const name of imported) {
          expect(body, `${category}: imports ${name} without using it`).toContain(name);
        }
        for (const name of ["square", "triangle", "noise", "wavetable", "sequence", "layer"]) {
          const used = new RegExp(`\\b${name}\\(`).test(body);
          if (used)
            expect(imported, `${category}: uses ${name} without importing it`).toContain(name);
        }
      }
    }
  });

  it("keeps every line inside the width the block can show", () => {
    for (const category of CATEGORIES) {
      for (const seed of SEEDS) {
        for (const crunch of [false, true]) {
          for (const line of toPython({ ...randomize(category, seed), crunch }).split("\n")) {
            expect(line.length, line).toBeLessThanOrEqual(76);
          }
        }
      }
    }
  });

  it("warns that noise cannot come out identical", () => {
    expect(toPython(randomize("explosion", 7))).toContain("same kind of noise");
    expect(toPython(randomize("jump", 7))).not.toContain("same kind of noise");
  });

  it("wraps a crunched sound and names the file to match", () => {
    const code = toPython({ ...randomize("coin", 42), crunch: true });
    expect(code).toContain("crunch(sound, bits=4)");
    expect(code).toContain('save(sound, "blip8-coin-42-4bit.wav")');
  });

  it("quotes no number finer than the knob that produced it", () => {
    for (const seed of SEEDS) {
      const code = toPython(randomize("explosion", seed));
      for (const value of code.match(/volume=([\d.]+)/g) ?? []) {
        const decimals = (value.split(".")[1] ?? "").length;
        expect(decimals, value).toBeLessThanOrEqual(2);
      }
    }
  });
});

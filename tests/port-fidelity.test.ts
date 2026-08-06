import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { toPython } from "../src/recipe";
import { CATEGORIES, randomize, render, type Params, type Voice } from "../src/sfx";
import { toWavBlob } from "../src/synth";

const SEEDS = [7, 42, 1234];
const VOICES: Voice[] = ["triangle", "sine", "bell"];

const hasUv = spawnSync("uv", ["--version"], { stdio: "ignore" }).status === 0;

function cases(): { name: string; params: Params }[] {
  const out: { name: string; params: Params }[] = [];
  for (const category of CATEGORIES) {
    for (const seed of SEEDS) {
      out.push({ name: `${category}-${seed}`, params: randomize(category, seed) });
      out.push({
        name: `${category}-${seed}-crunch`,
        params: { ...randomize(category, seed), crunch: true },
      });
    }
    if (category === "explosion") continue;
    for (const voice of VOICES) {
      out.push({ name: `${category}-${voice}`, params: { ...randomize(category, 99), voice } });
    }
  }
  return out;
}

describe("the port matches blip8 itself", () => {
  it.skipIf(!hasUv)(
    "renders every printed recipe in Python and diffs the samples",
    async () => {
      const folder = mkdtempSync(join(tmpdir(), "blip8-lab-fidelity-"));
      const manifest = [];

      for (const { name, params } of cases()) {
        const wav = await toWavBlob(render(params)).arrayBuffer();
        writeFileSync(join(folder, `${name}.wav`), Buffer.from(wav));
        manifest.push({
          name,
          python: toPython(params),
          crunch: params.crunch,
          usesNoise: params.category === "explosion" || params.voice === "noise",
        });
      }
      writeFileSync(join(folder, "manifest.json"), JSON.stringify(manifest));

      const check = spawnSync("uv", ["run", "scripts/verify_recipes.py", folder], {
        encoding: "utf8",
      });
      const output = `${check.stdout}${check.stderr}`;
      const checked = Number(output.match(/(\d+) recipes checked/)?.[1] ?? 0);
      expect(checked, output).toBeGreaterThan(30);
      expect(check.status, output).toBe(0);
    },
    120_000,
  );
});

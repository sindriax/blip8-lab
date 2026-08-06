// Mirrors build() in sfx.ts. Change one without the other and the lab prints
// recipes that do not reproduce what it just played.
import { ladder, thumpDecay, thumpVolume, type Params } from "./sfx";

export function toPython(p: Params): string {
  const lines: string[] = [`from blip8 import ${imports(p).join(", ")}`, ""];
  if (usesNoise(p)) {
    lines.push(
      "# The seed gives you the same kind of noise, not the identical noise you",
      "# just heard: the browser and numpy draw from different generators.",
    );
  }
  lines.push(...body(p));
  if (p.crunch) {
    lines.push(
      "",
      "# The lab also fades the dead tail crunch leaves behind: see trim() in",
      "# the pack's generate.py if you want that part too.",
      "sound = crunch(sound, bits=4)",
    );
  }
  lines.push("", `save(sound, "${filename(p)}")`);
  return lines.join("\n");
}

const WIDTH = 76;
const ASSIGN = "sound = ".length;

function body(p: Params): string[] {
  switch (p.category) {
    case "blip":
    case "jump":
    case "laser":
    case "hurt":
      return assign(shaped(p, pitch(p), p.length, p.volume, p.attack, p.release, ASSIGN));

    case "coin":
      return group("sequence", [
        shaped(p, num(p.freq), 0.07, p.volume, 0.001, 0.01, 4),
        shaped(p, num(p.freq * p.interval), p.length, p.volume, 0.001, p.release, 4),
      ]);

    case "powerup":
      return group(
        "sequence",
        ladder(p.interval).map((step) =>
          shaped(p, num(p.freq * step), p.length, p.volume, 0.001, p.release, 4),
        ),
      );

    case "explosion":
      return group("layer", [
        hit(`noise(length=${num(p.length)}, volume=${num(p.volume)}, seed=${p.seed})`, p.length, 4),
        hit(
          `triangle(freq=(${num(p.freq)}, 30), length=${num(p.length)}, volume=${num(thumpVolume(p))})`,
          thumpDecay(p),
          4,
        ),
      ]);
  }
}

function shaped(
  p: Params,
  freq: string,
  length: number,
  volume: number,
  attack: number,
  release: number,
  indent: number,
): string[] {
  return call(
    voice(p, freq, length, volume),
    `attack=${num(attack)}, release=${num(release)}`,
    indent,
  );
}

function hit(inner: string, decay: number, indent: number): string[] {
  return call(inner, `attack=0.001, decay=${num(decay)}, sustain=0.0, release=0.0`, indent);
}

function call(inner: string, args: string, indent: number): string[] {
  const single = `envelope(${inner}, ${args})`;
  if (indent + single.length <= WIDTH) return [single];
  return ["envelope(", `    ${inner},`, `    ${args},`, ")"];
}

function assign(lines: string[]): string[] {
  return [`sound = ${lines[0]}`, ...lines.slice(1)];
}

function group(name: string, members: string[][]): string[] {
  const inner = members.flatMap((lines) =>
    lines.map((line, i) => `    ${line}${i === lines.length - 1 ? "," : ""}`),
  );
  return [`sound = ${name}(`, ...inner, ")"];
}

function voice(p: Params, freq: string, length: number, volume: number): string {
  const tail = `freq=${freq}, length=${num(length)}, volume=${num(volume)}`;
  switch (p.voice) {
    case "triangle":
      return `triangle(${tail})`;
    case "sine":
      return `wavetable(SINE_TABLE, ${tail})`;
    case "bell":
      return `wavetable(BELL_TABLE, ${tail})`;
    case "noise":
      return `noise(length=${num(length)}, volume=${num(volume)}, seed=${p.seed})`;
    default:
      return p.duty === 0.5
        ? `square(${tail})`
        : `square(freq=${freq}, length=${num(length)}, duty=${num(p.duty)}, volume=${num(volume)})`;
  }
}

function pitch(p: Params): string {
  return p.glide === 1 ? num(p.freq) : `(${num(p.freq)}, ${num(p.freq * p.glide)})`;
}

function imports(p: Params): string[] {
  const names = new Set<string>(["envelope", "save"]);
  if (p.category === "coin" || p.category === "powerup") names.add("sequence");
  if (p.category === "explosion") {
    names.add("layer").add("noise").add("triangle");
  } else {
    switch (p.voice) {
      case "triangle":
        names.add("triangle");
        break;
      case "noise":
        names.add("noise");
        break;
      case "sine":
        names.add("wavetable").add("SINE_TABLE");
        break;
      case "bell":
        names.add("wavetable").add("BELL_TABLE");
        break;
      default:
        names.add("square");
    }
  }
  if (p.crunch) names.add("crunch");
  return [...names].sort((a, b) => Number(isTable(a)) - Number(isTable(b)) || a.localeCompare(b));
}

function isTable(name: string): boolean {
  return name.endsWith("_TABLE");
}

function usesNoise(p: Params): boolean {
  return p.category === "explosion" || p.voice === "noise";
}

function num(value: number): string {
  return String(Number(value.toFixed(6)));
}

export function filename(p: Params): string {
  return `blip8-${p.category}-${p.seed}${p.crunch ? "-4bit" : ""}.wav`;
}

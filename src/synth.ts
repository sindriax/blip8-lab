export const SAMPLE_RATE = 44100;

export type Pitch = number | [number, number];

function phase(freq: Pitch, length: number): Float32Array {
  const count = Math.floor(SAMPLE_RATE * length);
  const out = new Float32Array(count);
  if (Array.isArray(freq)) {
    const [start, end] = freq;
    let acc = 0;
    for (let i = 0; i < count; i++) {
      acc += (start + (end - start) * ramp(i, count)) / SAMPLE_RATE;
      out[i] = acc % 1.0;
    }
  } else {
    for (let i = 0; i < count; i++) {
      out[i] = ((i / SAMPLE_RATE) * freq) % 1.0;
    }
  }
  return out;
}

function ramp(i: number, count: number): number {
  return i / count;
}

export function square(freq: Pitch, length: number, duty = 0.5, volume = 0.5): Float32Array {
  const p = phase(freq, length);
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = (p[i] < duty ? 1 : -1) * volume;
  return out;
}

export function triangle(freq: Pitch, length: number, volume = 0.5): Float32Array {
  const p = phase(freq, length);
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) out[i] = (4 * Math.abs(p[i] - 0.5) - 1) * volume;
  return out;
}

const table = (f: (t: number) => number) => Float32Array.from({ length: 32 }, (_, i) => f(i / 32));

export const SINE_TABLE = table((t) => Math.sin(2 * Math.PI * t));
export const BELL_TABLE = table(
  (t) => 0.7 * Math.sin(2 * Math.PI * t) + 0.3 * Math.sin(4 * Math.PI * t),
);

export function wavetable(
  shape: Float32Array,
  freq: Pitch,
  length: number,
  volume = 0.5,
): Float32Array {
  const p = phase(freq, length);
  const out = new Float32Array(p.length);
  const slots = shape.length;
  for (let i = 0; i < p.length; i++) out[i] = shape[Math.floor(p[i] * slots) % slots] * volume;
  return out;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function noise(length: number, volume = 0.5, seed = 1): Float32Array {
  const rand = rng(seed);
  const count = Math.floor(SAMPLE_RATE * length);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = (rand() * 2 - 1) * volume;
  return out;
}

export function envelope(
  samples: Float32Array,
  attack = 0.01,
  decay = 0.0,
  sustain = 1.0,
  release = 0.05,
): Float32Array {
  const count = samples.length;
  let a = Math.floor(attack * SAMPLE_RATE);
  let d = Math.floor(decay * SAMPLE_RATE);
  let r = Math.floor(release * SAMPLE_RATE);
  const total = a + d + r;
  if (total > count) {
    const squeeze = count / total;
    a = Math.floor(a * squeeze);
    d = Math.floor(d * squeeze);
    r = Math.floor(r * squeeze);
  }
  const s = count - a - d - r;
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let gain: number;
    if (i < a) gain = ramp(i, a);
    else if (i < a + d) gain = 1 + (sustain - 1) * ramp(i - a, d);
    else if (i < a + d + s) gain = sustain;
    else gain = sustain * (1 - ramp(i - a - d - s, r));
    out[i] = samples[i] * gain;
  }
  return out;
}

export function crunch(samples: Float32Array, bits = 4): Float32Array {
  const half = 2 ** bits / 2;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = Math.round(samples[i] * half) / half;
  return out;
}


// crunch leaves the tail a quantisation step above zero, so cutting alone
// clicks: the fade is what lands it on silence.
export function trim(samples: Float32Array, fade = 0.006): Float32Array {
  let end = samples.length - 1;
  while (end >= 0 && samples[end] === 0) end--;
  if (end < 0) return samples;
  const cut = samples.slice(0, end + 1);
  const ramp = Math.min(Math.floor(fade * SAMPLE_RATE), cut.length);
  for (let i = 0; i < ramp; i++) {
    cut[cut.length - ramp + i] *= 1 - i / Math.max(ramp - 1, 1);
  }
  return cut;
}

export function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function mix(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(Math.max(...parts.map((p) => p.length)));
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

let ctx: AudioContext | undefined;

export function play(samples: Float32Array): void {
  ctx ??= new AudioContext();
  const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
  buffer.getChannelData(0).set(samples);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}

export function toWavBlob(samples: Float32Array): Blob {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
  }
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const write = (off: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)));
  write(0, "RIFF");
  v.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, "data");
  v.setUint32(40, pcm.byteLength, true);
  return new Blob([header, pcm], { type: "audio/wav" });
}

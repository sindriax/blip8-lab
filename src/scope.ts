const GRID = "#1d4210";
const AXIS = "#3d6b1f";
const TRACE = "#d2e360";

export interface Scope {
  draw(samples: Float32Array | null): void;
}

export function attachScope(canvas: HTMLCanvasElement): Scope {
  let current: Float32Array | null = null;

  const paint = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (ctx) render(ctx, width, height, ratio, current);
  };

  new ResizeObserver(paint).observe(canvas);
  paint();

  return {
    draw(samples) {
      current = samples;
      paint();
    },
  };
}

function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ratio: number,
  samples: Float32Array | null,
): void {
  const mid = height / 2;
  ctx.clearRect(0, 0, width, height);

  ctx.lineWidth = Math.max(1, Math.round(ratio));
  ctx.strokeStyle = GRID;
  ctx.beginPath();
  for (let i = 1; i < 8; i++) {
    const x = Math.round((width * i) / 8) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let i = 1; i < 4; i++) {
    const y = Math.round((height * i) / 4) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.strokeStyle = AXIS;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(mid) + 0.5);
  ctx.lineTo(width, Math.round(mid) + 0.5);
  ctx.stroke();

  if (!samples || !samples.length) return;

  // Min/max per pixel column. Plotting every nth sample instead would alias.
  const scale = mid * 0.92;
  ctx.fillStyle = TRACE;
  ctx.shadowColor = TRACE;
  ctx.shadowBlur = 6 * ratio;
  const thickness = Math.max(1, Math.round(ratio * 1.5));
  for (let x = 0; x < width; x++) {
    const from = Math.floor((x / width) * samples.length);
    const to = Math.max(from + 1, Math.floor(((x + 1) / width) * samples.length));
    let low = 1;
    let high = -1;
    for (let i = from; i < to; i++) {
      if (samples[i] < low) low = samples[i];
      if (samples[i] > high) high = samples[i];
    }
    const top = mid - high * scale;
    ctx.fillRect(x, top, 1, Math.max(thickness, mid - low * scale - top));
  }
  ctx.shadowBlur = 0;
}

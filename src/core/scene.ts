/**
 * Original voxel-style landscapes, painted in code at a small size and scaled up with hard pixel edges.
 * Nothing here is Minecraft artwork: the shapes, colours and layout are generated from a seed, so
 * every Minecraft version gets its own picture and no image has to be downloaded or shipped.
 */

export type SceneKind = "meadow" | "cherry" | "desert" | "ocean" | "night" | "ember";

export const SCENE_KINDS: readonly SceneKind[] = ["meadow", "cherry", "desert", "ocean", "night", "ember"];

type RGB = [number, number, number];

interface Palette {
  skyTop: RGB;
  skyMid: RGB;
  skyBottom: RGB;
  glow: RGB;
  far: RGB;
  mid: RGB;
  near: RGB;
  ground: RGB;
  leaf: RGB;
  trunk: RGB;
  cloud: RGB;
  cloudAlpha: number;
  stars: number;
  /** "sun" and "moon" are one square block in the sky, "none" leaves the sky empty. */
  body: "sun" | "moon" | "none";
  bodyColor: RGB;
}

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const PALETTES: Record<SceneKind, Palette> = {
  meadow: {
    skyTop: hex("#1d4fd8"), skyMid: hex("#4f9bff"), skyBottom: hex("#ffd9a8"), glow: hex("#ffe8bd"),
    far: hex("#5b78b8"), mid: hex("#3c8a6a"), near: hex("#1f5b3f"), ground: hex("#2c7a45"),
    leaf: hex("#2f8f4e"), trunk: hex("#5a3a22"), cloud: hex("#ffffff"), cloudAlpha: 0.85, stars: 0,
    body: "sun", bodyColor: hex("#fff3c9"),
  },
  cherry: {
    skyTop: hex("#4a3fa8"), skyMid: hex("#d27fc9"), skyBottom: hex("#ffd1c2"), glow: hex("#ffe1e6"),
    far: hex("#8a63a8"), mid: hex("#6a8f5f"), near: hex("#3b6a43"), ground: hex("#4d8a4e"),
    leaf: hex("#f29bc1"), trunk: hex("#6b4130"), cloud: hex("#fff0f4"), cloudAlpha: 0.8, stars: 0,
    body: "sun", bodyColor: hex("#fff0d6"),
  },
  desert: {
    skyTop: hex("#2a64c9"), skyMid: hex("#79b7ee"), skyBottom: hex("#ffe2a6"), glow: hex("#fff1c4"),
    far: hex("#c79a6d"), mid: hex("#d9a95e"), near: hex("#b8823d"), ground: hex("#d8b46a"),
    leaf: hex("#3d8a3d"), trunk: hex("#3d8a3d"), cloud: hex("#ffffff"), cloudAlpha: 0.7, stars: 0,
    body: "sun", bodyColor: hex("#fffbe0"),
  },
  ocean: {
    skyTop: hex("#06224d"), skyMid: hex("#0d5d9c"), skyBottom: hex("#37c4d8"), glow: hex("#9ff0ff"),
    far: hex("#0f4a7d"), mid: hex("#0b3c68"), near: hex("#082c52"), ground: hex("#c9b681"),
    leaf: hex("#2fa36b"), trunk: hex("#2fa36b"), cloud: hex("#bff4ff"), cloudAlpha: 0.0, stars: 0,
    body: "none", bodyColor: hex("#ffffff"),
  },
  night: {
    skyTop: hex("#050914"), skyMid: hex("#101a3a"), skyBottom: hex("#33407a"), glow: hex("#7c8cff"),
    far: hex("#1c2650"), mid: hex("#121a3a"), near: hex("#0a1022"), ground: hex("#0d1530"),
    leaf: hex("#16304a"), trunk: hex("#0d1a2b"), cloud: hex("#8fa0ff"), cloudAlpha: 0.12, stars: 140,
    body: "moon", bodyColor: hex("#e6ecff"),
  },
  ember: {
    skyTop: hex("#1a0f33"), skyMid: hex("#8a2f5e"), skyBottom: hex("#ff9a4d"), glow: hex("#ffc27a"),
    far: hex("#5a2750"), mid: hex("#3a1a3f"), near: hex("#1f0f27"), ground: hex("#2a1230"),
    leaf: hex("#5e2a3a"), trunk: hex("#2a1520"), cloud: hex("#ffb27a"), cloudAlpha: 0.25, stars: 24,
    body: "sun", bodyColor: hex("#ffe0a0"),
  },
};

/** A small, fast, repeatable random number generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns any text (a version number, a page name) into a seed. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Which landscape a Minecraft version gets. The same version always gets the same one. */
export function kindForVersion(version: string): SceneKind {
  return SCENE_KINDS[seedFrom(version) % SCENE_KINDS.length];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

type Ctx = CanvasRenderingContext2D;

/** Smooth 1-D value noise from a few random control points. */
function noise1(rand: () => number, points: number): (x: number) => number {
  const v = Array.from({ length: points + 2 }, () => rand());
  return (x) => {
    const p = Math.min(points, Math.max(0, x * points));
    const i = Math.floor(p);
    const f = p - i;
    const s = f * f * (3 - 2 * f);
    return v[i] * (1 - s) + v[i + 1] * s;
  };
}

function sky(ctx: Ctx, w: number, h: number, p: Palette) {
  const horizon = h * 0.72;
  for (let y = 0; y < h; y++) {
    const t = Math.min(1, y / horizon);
    const c = t < 0.55 ? mix(p.skyTop, p.skyMid, t / 0.55) : mix(p.skyMid, p.skyBottom, (t - 0.55) / 0.45);
    ctx.fillStyle = css(c);
    ctx.fillRect(0, y, w, 1);
  }
}

function skyBody(ctx: Ctx, w: number, h: number, p: Palette, rand: () => number) {
  if (p.body === "none") return;
  const size = Math.max(6, Math.round(h * 0.07));
  const x = Math.round(w * (0.55 + rand() * 0.3));
  const y = Math.round(h * (p.body === "moon" ? 0.16 : 0.2 + rand() * 0.1));
  const g = ctx.createRadialGradient(x + size / 2, y + size / 2, 0, x + size / 2, y + size / 2, h * 0.5);
  g.addColorStop(0, css(p.glow, 0.55));
  g.addColorStop(1, css(p.glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css(p.bodyColor);
  ctx.fillRect(x, y, size, size);
  if (p.body === "moon") {
    ctx.fillStyle = css(mix(p.bodyColor, p.skyMid, 0.35));
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillRect(x + size - 4, y + size - 3, 2, 2);
  }
}

function stars(ctx: Ctx, w: number, h: number, p: Palette, rand: () => number) {
  for (let i = 0; i < p.stars; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h * 0.6);
    ctx.fillStyle = css([255, 255, 255], 0.25 + rand() * 0.65);
    ctx.fillRect(x, y, 1, 1);
  }
}

/** Blocky clouds: a few stacked rows of squares, drawn translucent. */
function clouds(ctx: Ctx, w: number, h: number, p: Palette, rand: () => number) {
  if (p.cloudAlpha <= 0) return;
  const count = Math.max(3, Math.round(w / 90));
  for (let i = 0; i < count; i++) {
    const u = Math.max(3, Math.round(h / 28));
    const x = Math.floor(rand() * w);
    const y = Math.floor(h * (0.08 + rand() * 0.34));
    const rows = 2 + Math.floor(rand() * 2);
    for (let r = 0; r < rows; r++) {
      const len = 3 + Math.floor(rand() * 5) - (r === rows - 1 ? 1 : 0);
      const off = Math.floor(rand() * 2) * u;
      ctx.fillStyle = css(p.cloud, p.cloudAlpha * (r === rows - 1 ? 0.8 : 1));
      ctx.fillRect(x + off, y + r * u, len * u, u);
    }
  }
}

/** One ridge of blocky mountains. Heights are rounded to whole blocks so the edge steps like terrain. */
function ridge(ctx: Ctx, w: number, h: number, rand: () => number, base: number, amp: number, color: RGB, block: number, lit: RGB) {
  const n = noise1(rand, 7);
  const n2 = noise1(rand, 19);
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const raw = base - (n(t) * 0.75 + n2(t) * 0.25) * amp;
    const top = Math.round(raw / block) * block;
    ctx.fillStyle = css(color);
    ctx.fillRect(x, top, 1, h - top);
    ctx.fillStyle = css(lit, 0.55);
    ctx.fillRect(x, top, 1, 1);
    if (rand() < 0.05) {
      ctx.fillStyle = css([0, 0, 0], 0.12);
      ctx.fillRect(x, top + 2 + Math.floor(rand() * (h - top - 2) * 0.4), 1 + Math.floor(rand() * 2), 1);
    }
  }
}

function tree(ctx: Ctx, x: number, ground: number, s: number, p: Palette, rand: () => number, pine: boolean) {
  ctx.fillStyle = css(p.trunk);
  ctx.fillRect(x, ground - 3 * s, s, 3 * s);
  ctx.fillStyle = css(mix(p.leaf, [0, 0, 0], 0.15 + rand() * 0.1));
  if (pine) {
    ctx.fillRect(x - 2 * s, ground - 5 * s, 5 * s, 2 * s);
    ctx.fillRect(x - s, ground - 7 * s, 3 * s, 2 * s);
    ctx.fillRect(x, ground - 9 * s, s, 2 * s);
  } else {
    ctx.fillRect(x - 2 * s, ground - 6 * s, 5 * s, 3 * s);
    ctx.fillStyle = css(p.leaf);
    ctx.fillRect(x - s, ground - 7 * s, 3 * s, s);
  }
}

function trees(ctx: Ctx, w: number, h: number, p: Palette, rand: () => number, kind: SceneKind) {
  const s = Math.max(1, Math.round(h / 90));
  const count = Math.round(w / 26);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * w);
    const ground = Math.round(h * (0.82 + rand() * 0.16));
    if (kind === "desert") {
      ctx.fillStyle = css(p.leaf);
      ctx.fillRect(x, ground - 6 * s, s * 2, 6 * s);
      if (rand() < 0.6) ctx.fillRect(x - 2 * s, ground - 4 * s, 2 * s, s);
      if (rand() < 0.6) ctx.fillRect(x + 2 * s, ground - 5 * s, 2 * s, s);
    } else if (kind !== "ember") {
      tree(ctx, x, ground, s, p, rand, kind === "meadow" || kind === "night" ? rand() < 0.6 : false);
    }
  }
}

/** Cherry petals / drifting dust: a few single pixels. */
function motes(ctx: Ctx, w: number, h: number, color: RGB, count: number, rand: () => number) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = css(color, 0.3 + rand() * 0.5);
    ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 1, 1);
  }
}

function land(ctx: Ctx, w: number, h: number, p: Palette, rand: () => number, kind: SceneKind) {
  const block = Math.max(2, Math.round(h / 45));
  ridge(ctx, w, h, rand, h * 0.66, h * 0.3, p.far, block, mix(p.far, p.glow, 0.5));
  ridge(ctx, w, h, rand, h * 0.78, h * 0.22, p.mid, block, mix(p.mid, p.glow, 0.35));
  ridge(ctx, w, h, rand, h * 0.9, h * 0.16, p.near, block, mix(p.near, p.glow, 0.25));
  trees(ctx, w, h, p, rand, kind);
  // A thin band of haze where the land meets the sky.
  const g = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.8);
  g.addColorStop(0, css(p.glow, 0));
  g.addColorStop(1, css(p.glow, 0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.55, w, h * 0.25);
}

function ocean(ctx: Ctx, w: number, h: number, p: Palette, rand: () => number) {
  for (let y = 0; y < h; y++) {
    const t = y / h;
    ctx.fillStyle = css(t < 0.5 ? mix(p.skyBottom, p.skyMid, t / 0.5) : mix(p.skyMid, p.skyTop, (t - 0.5) / 0.5));
    ctx.fillRect(0, y, w, 1);
  }
  // Light falling from the surface.
  for (let i = 0; i < 6; i++) {
    const x = rand() * w;
    const wide = w * (0.04 + rand() * 0.06);
    ctx.fillStyle = css(p.glow, 0.05 + rand() * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + wide, 0);
    ctx.lineTo(x + wide + w * 0.18, h);
    ctx.lineTo(x + w * 0.12, h);
    ctx.closePath();
    ctx.fill();
  }
  const block = Math.max(2, Math.round(h / 40));
  ridge(ctx, w, h, rand, h * 0.7, h * 0.22, p.far, block, p.glow);
  ridge(ctx, w, h, rand, h * 0.84, h * 0.16, p.mid, block, p.glow);
  // Sea floor, kelp and fish.
  for (let x = 0; x < w; x += block) {
    const top = Math.round(h * 0.9 / block) * block + (rand() < 0.3 ? -block : 0);
    ctx.fillStyle = css(rand() < 0.2 ? mix(p.ground, [0, 0, 0], 0.25) : p.ground);
    ctx.fillRect(x, top, block, h - top);
  }
  const s = Math.max(1, Math.round(h / 90));
  for (let i = 0; i < Math.round(w / 40); i++) {
    const x = Math.floor(rand() * w);
    const len = 8 + Math.floor(rand() * 16);
    for (let k = 0; k < len; k++) {
      ctx.fillStyle = css(mix(p.leaf, [0, 0, 0], k % 2 ? 0.1 : 0));
      ctx.fillRect(x + (k % 4 < 2 ? 0 : s), Math.round(h * 0.92) - k * s, s, s);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(h * (0.25 + rand() * 0.35));
    ctx.fillStyle = css([8, 28, 56], 0.85);
    ctx.fillRect(x, y, 7 * s, 2 * s);
    ctx.fillRect(x + 7 * s, y - s, 2 * s, 4 * s);
    ctx.fillStyle = css(p.glow, 0.5);
    ctx.fillRect(x + s, y, s, s);
  }
  motes(ctx, w, h, p.glow, Math.round(w / 5), rand);
}

/** Paints a landscape of the given kind into a canvas context of size w x h. */
export function paintScene(ctx: Ctx, w: number, h: number, kind: SceneKind, seed: number): void {
  const p = PALETTES[kind];
  const rand = rng(seed ^ seedFrom(kind));
  ctx.clearRect(0, 0, w, h);
  if (kind === "ocean") {
    ocean(ctx, w, h, p, rand);
    return;
  }
  sky(ctx, w, h, p);
  stars(ctx, w, h, p, rand);
  skyBody(ctx, w, h, p, rand);
  clouds(ctx, w, h, p, rand);
  land(ctx, w, h, p, rand, kind);
  if (kind === "cherry") motes(ctx, w, h, hex("#ffd1e3"), Math.round(w / 4), rand);
  if (kind === "ember") motes(ctx, w, h, hex("#ffb35c"), Math.round(w / 6), rand);
  if (kind === "night") {
    // Soft aurora bands.
    for (let b = 0; b < 3; b++) {
      const y0 = h * (0.18 + b * 0.07);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.12);
      g.addColorStop(0, css(b % 2 ? hex("#6a5cff") : hex("#3ad6ff"), 0));
      g.addColorStop(0.5, css(b % 2 ? hex("#6a5cff") : hex("#3ad6ff"), 0.07));
      g.addColorStop(1, css(b % 2 ? hex("#6a5cff") : hex("#3ad6ff"), 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, w, h * 0.12);
    }
  }
}

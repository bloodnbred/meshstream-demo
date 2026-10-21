/**
 * Seeded random number generation.
 *
 * Every generated artefact in the demo (guests, chat, hashes, topology,
 * telemetry) comes from a seeded stream so a reload or a "reset scenario"
 * reproduces exactly the same run. This is what makes the simulator
 * deterministic and the demo defensible in front of an examiner.
 */

export interface Rng {
  /** float in [0,1) */
  next(): number;
  /** float in [min,max) */
  range(min: number, max: number): number;
  /** integer in [min,max] inclusive */
  int(min: number, max: number): number;
  bool(p?: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** Fisher-Yates, returns a new array. */
  shuffle<T>(arr: readonly T[]): T[];
  /** Weighted pick. */
  weighted<T>(entries: readonly [T, number][]): T;
  /** Approximate normal via sum of uniforms. */
  normal(mean?: number, sd?: number): number;
}

/** mulberry32 — tiny, fast, good enough distribution for a demo. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    bool: (p = 0.5) => next() < p,
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    shuffle: <T,>(arr: readonly T[]) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    weighted: <T,>(entries: readonly [T, number][]) => {
      const total = entries.reduce((sum, [, w]) => sum + w, 0);
      let roll = next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    normal: (mean = 0, sd = 1) => {
      const u = next() + next() + next() + next() + next() + next();
      return mean + ((u - 3) / 1.2247) * sd;
    },
  };
  return rng;
}

/** Stable 32-bit string hash so seeds can be derived from names/ids. */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Smooth 1D value noise — used for wander in the telemetry series. */
export function valueNoise(seed: number) {
  const rng = makeRng(seed);
  const table = Array.from({ length: 256 }, () => rng.next());
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = table[((i % 256) + 256) % 256];
    const b = table[(((i + 1) % 256) + 256) % 256];
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
}

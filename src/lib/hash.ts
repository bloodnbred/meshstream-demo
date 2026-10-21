/**
 * Fake-but-plausible SHA-256 hashes.
 *
 * The demo never hashes anything real — it just needs 64 hex characters that
 * look like the digests the real edge proxy publishes in its signed manifest.
 * Output is derived from a seeded hash so it is stable across reloads.
 */

/** FNV-1a style 32-bit mixer, expanded to 64 bits of entropy per call. */
export function fnv1a(input: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const HEX = "0123456789abcdef";

/** Deterministic 64-char hex string that looks like a SHA-256 digest. */
export function fakeSha256(input: string): string {
  let out = "";
  let h1 = fnv1a(input, 0x811c9dc5);
  let h2 = fnv1a(input, 0x9e3779b9);
  let h3 = fnv1a(input, 0x85ebca6b);
  let h4 = fnv1a(input, 0xc2b2ae35);
  let round = 0;
  while (out.length < 64) {
    h1 = fnv1a(`${input}:${round}:1`, h1);
    h2 = fnv1a(`${input}:${round}:2`, h2);
    h3 = fnv1a(`${input}:${round}:3`, h3);
    h4 = fnv1a(`${input}:${round}:4`, h4);
    out += hex8(h1) + hex8(h2) + hex8(h3) + hex8(h4);
    round++;
  }
  return out.slice(0, 64);
}

function hex8(n: number): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s = HEX[(n >>> (i * 4)) & 0xf] + s;
  }
  return s;
}

/** Short display form: `a3f9…c21b`. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

/** Fake HMAC signature over the manifest window. */
export function fakeSignature(input: string): string {
  return fakeSha256(`sig:${input}`).slice(0, 43);
}

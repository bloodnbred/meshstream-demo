/**
 * Deterministic node fields for the story scenes.
 *
 * Each node carries three positions: where it starts (scattered), where it
 * snaps to (mesh) and where it finally collapses to (the logo glyph).
 */
import { makeRng } from "@/mock/rng";

export interface FieldNode {
  id: number;
  /** scattered start */
  sx: number;
  sy: number;
  /** mesh position */
  tx: number;
  ty: number;
  /** glyph position */
  gx: number;
  gy: number;
  r: number;
  delay: number;
  opacity: number;
}

export const FIELD_W = 1000;
export const FIELD_H = 600;

/** The three glyph nodes, in field coordinates. */
export const GLYPH = [
  { x: 500, y: 210 },
  { x: 380, y: 400 },
  { x: 620, y: 400 },
];

export function makeField(count = 46, seed = 7): FieldNode[] {
  const rng = makeRng(seed);
  const nodes: FieldNode[] = [];

  // Mesh targets: a loose tree around the origin at the top.
  const targets: { x: number; y: number }[] = [];
  targets.push({ x: 500, y: 90 });
  const level1 = 4;
  for (let i = 0; i < level1; i++) {
    targets.push({ x: 260 + (i * 480) / (level1 - 1), y: 210 });
  }
  const level2 = 9;
  for (let i = 0; i < level2; i++) {
    targets.push({ x: 90 + (i * 820) / (level2 - 1), y: 330 });
  }
  const level3 = 14;
  for (let i = 0; i < level3; i++) {
    targets.push({ x: 60 + (i * 880) / (level3 - 1), y: 450 });
  }
  const level4 = 12;
  for (let i = 0; i < level4; i++) {
    targets.push({ x: 90 + (i * 820) / (level4 - 1), y: 545 });
  }

  for (let i = 0; i < count; i++) {
    const target = targets[i % targets.length];
    const glyph = GLYPH[i % 3];
    nodes.push({
      id: i,
      sx: rng.range(-60, FIELD_W + 60),
      sy: rng.range(-40, FIELD_H + 40),
      tx: target.x + rng.range(-26, 26),
      ty: target.y + rng.range(-18, 18),
      gx: glyph.x + rng.range(-9, 9),
      gy: glyph.y + rng.range(-9, 9),
      r: rng.range(2.4, 5.2),
      delay: rng.range(0, 780),
      opacity: rng.range(0.45, 1),
    });
  }
  return nodes;
}

/** Edges between the mesh targets, used for the faint network lines. */
export function makeFieldEdges(): { a: number; b: number }[] {
  const edges: { a: number; b: number }[] = [];
  const levels = [1, 4, 9, 14, 12];
  let offset = 0;
  const starts: number[] = [];
  for (const size of levels) {
    starts.push(offset);
    offset += size;
  }

  // origin -> level 1
  for (let i = 0; i < levels[1]; i++) edges.push({ a: starts[0], b: starts[1] + i });
  // level 1 -> level 2
  for (let i = 0; i < levels[2]; i++) {
    edges.push({ a: starts[1] + Math.floor(i / 2.4), b: starts[2] + i });
  }
  // level 2 -> level 3
  for (let i = 0; i < levels[3]; i++) {
    edges.push({ a: starts[2] + Math.floor(i / 1.6), b: starts[3] + i });
  }
  // level 3 -> level 4
  for (let i = 0; i < levels[4]; i++) {
    edges.push({ a: starts[3] + Math.floor(i / 1.3), b: starts[4] + i });
  }
  return edges;
}

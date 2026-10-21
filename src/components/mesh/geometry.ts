/**
 * Shared mesh geometry helpers.
 *
 * Edges are drawn as shallow quadratic curves so the tree reads as an organic
 * network rather than a spreadsheet. Packets travel along the same curve.
 */

export interface Point {
  x: number;
  y: number;
}

export function nodePosition(
  peer: { x: number; y: number },
  width: number,
  height: number,
): Point {
  return { x: peer.x * width, y: peer.y * height };
}

/** Control point for a shallow curve between two nodes. */
export function controlPoint(a: Point, b: Point, bend = 0.12): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular offset.
  return { x: mx - (dy / len) * len * bend, y: my + (dx / len) * len * bend };
}

/** Point on a quadratic bezier at t in [0,1]. */
export function quadPoint(p0: Point, c: Point, p1: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
  };
}

/** SVG path for the curve between two nodes. */
export function edgePath(a: Point, b: Point, bend = 0.12): string {
  const c = controlPoint(a, b, bend);
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

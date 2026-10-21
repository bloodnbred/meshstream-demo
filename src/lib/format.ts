/** Formatting helpers used across every telemetry surface. */

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const round = (v: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export function fmtNumber(v: number, digits = 0): string {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${round(bytes / 1024, 1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${round(bytes / (1024 * 1024), 1)} MB`;
  return `${round(bytes / (1024 * 1024 * 1024), 2)} GB`;
}

export function fmtMbps(mbps: number, digits = 1): string {
  return `${round(mbps, digits)}`;
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${round(ms / 1000, 2)} s`;
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m % 60)}:${pad(s % 60)}`;
  return `${pad(m)}:${pad(s)}`;
}

/** Monospace clock timestamp used by chat + logs. */
export function fmtClock(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtTimeOfDay(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "3 peers, 1 edge, maxDepth 2" — the format used in the real run log. */
export function fmtTreeSummary(peers: number, edges: number, maxDepth: number): string {
  return `${peers} peers, ${edges} edge${edges === 1 ? "" : "s"}, maxDepth ${maxDepth}`;
}

export function pct(v: number, digits = 0): string {
  return `${round(v, digits)}%`;
}

export function titleCase(s: string): string {
  return s.replace(/(^|[\s-])(\w)/g, (_, a, b) => a + b.toUpperCase());
}

/**
 * Rolling time series for the studio + proof dashboards.
 *
 * Everything is sampled from the engine or from a seeded noise generator so
 * the sparklines look alive but never claim to be real measurements.
 */
import { valueNoise, type Rng } from "@/mock/rng";
import { SWARM_CONST } from "./swarm";

export class Series {
  private values: number[] = [];
  constructor(
    private capacity = 90,
    private initial = 0,
  ) {
    this.values = Array.from({ length: capacity }, () => initial);
  }

  push(value: number) {
    this.values.push(value);
    if (this.values.length > this.capacity) this.values.shift();
  }

  toArray(): number[] {
    return this.values;
  }

  get last(): number {
    return this.values[this.values.length - 1] ?? 0;
  }

  min(): number {
    return Math.min(...this.values);
  }

  max(): number {
    return Math.max(...this.values);
  }

  avg(): number {
    if (!this.values.length) return 0;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }

  reset(value = this.initial) {
    this.values = Array.from({ length: this.capacity }, () => value);
  }
}

export interface TelemetryBundle {
  bitrate: Series;
  rtt: Series;
  dropped: Series;
  origin: Series;
  offload: Series;
  cpu: Series;
  /** Smooth value noise used to make the series wander naturally. */
  noise: (x: number) => number;
}

/** Studio telemetry, seeded and updated from the engine. */
export function createTelemetry(seed = 4242): TelemetryBundle {
  const noise = valueNoise(seed + 1);
  return {
    bitrate: new Series(90, SWARM_CONST.VIDEO_MBPS * 1000),
    rtt: new Series(90, 42),
    dropped: new Series(90, 0),
    origin: new Series(90, 4.2),
    offload: new Series(90, 68),
    cpu: new Series(90, 18),
    noise,
  };
}

/** Next synthetic sample for the studio gauges. */
export function sampleStudio(telemetry: TelemetryBundle, t: number, rng: Rng) {
  const wobble = telemetry.noise(t * 0.35) - 0.5;
  telemetry.bitrate.push(2500 + wobble * 260 + rng.range(-40, 40));
  telemetry.rtt.push(38 + Math.abs(wobble) * 46 + rng.range(-6, 10));
  telemetry.dropped.push(Math.max(0, Math.round(rng.range(0, 3) + (wobble > 0.28 ? 4 : 0))));
  telemetry.origin.push(Math.max(0.4, 4.2 + wobble * 0.9 + rng.range(-0.15, 0.15)));
  telemetry.offload.push(68 + wobble * 9 + rng.range(-2, 2));
  telemetry.cpu.push(Math.max(4, 18 + wobble * 5 + rng.range(-1.4, 1.4)));
}

/* ------------------------------------------------------------------ */
/* Health score                                                        */
/* ------------------------------------------------------------------ */

export interface Health {
  score: string;
  tone: "ok" | "warn" | "error";
  /** Plain-language fixes — never a raw metric dump. */
  fixes: string[];
}

export function computeHealth(t: TelemetryBundle, originSaturated: boolean): Health {
  const fixes: string[] = [];
  let points = 6;

  const dropped = t.dropped.avg();
  if (dropped > 2.5) {
    points -= 2;
    fixes.push("Frames are dropping — lower the camera bitrate ceiling to 2.2 Mbps.");
  } else if (dropped > 1.2) {
    points -= 1;
    fixes.push("A few frames dropped. Keep the preview closed and avoid heavy tabs.");
  }

  const rtt = t.rtt.avg();
  if (rtt > 110) {
    points -= 2;
    fixes.push("Publish RTT is high — something else on this machine is using the uplink.");
  } else if (rtt > 70) {
    points -= 1;
    fixes.push("Publish RTT is creeping up. Check for background uploads.");
  }

  if (originSaturated) {
    points -= 3;
    fixes.push("Origin egress is over the 12 Mbps budget — new viewers may buffer.");
  }

  const bitrate = t.bitrate.avg();
  if (bitrate < 1700) {
    points -= 1;
    fixes.push("Bitrate is under the 720p target. Check the encoder settings.");
  }

  const offload = t.offload.avg();
  if (offload < 45) {
    points -= 1;
    fixes.push("Peers are not taking much traffic yet — the swarm is still warming up.");
  }

  const score = points >= 6 ? "A" : points === 5 ? "B" : points === 4 ? "C" : points === 3 ? "D" : points === 2 ? "E" : "F";
  const tone = points >= 5 ? "ok" : points >= 3 ? "warn" : "error";
  return { score, tone, fixes };
}

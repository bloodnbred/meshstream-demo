/**
 * Hands-free auto-play tour.
 *
 * Walks the whole demo in about three minutes, with captions. Each step
 * holds for a fixed time before moving on.
 */
import type { RouteId } from "@/types";

export interface TourStep {
  route: RouteId;
  /** How long to hold on this step, in milliseconds. */
  hold: number;
  /** Caption shown during this step. */
  caption: string;
}

export const TOUR: TourStep[] = [
  { route: "hero", hold: 14000, caption: "The audience is the network." },
  { route: "story", hold: 34000, caption: "One camera. One origin. Then the audience takes over." },
  { route: "studio", hold: 22000, caption: "Preflight → armed → 3-2-1 → on air." },
  { route: "viewer", hold: 22000, caption: "Sixty-eight percent of the bytes came from peers." },
  { route: "simulator", hold: 30000, caption: "Turn P2P off. Watch the origin spike." },
  { route: "architecture", hold: 20000, caption: "Five services behind one origin and one tunnel." },
  { route: "deepdive", hold: 20000, caption: "Cache, then peer, then origin — with a 1.6 s deadline." },
  { route: "proof", hold: 18000, caption: "Verified end-to-end. Zero dollars." },
  { route: "team", hold: 14000, caption: "One machine. Six milestones." },
];

export const TOUR_TOTAL_MS = TOUR.reduce((sum, step) => sum + step.hold, 0);

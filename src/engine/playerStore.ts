/**
 * Viewer player state (mock).
 *
 * Mirrors the real player controls in plan.md §8.4, including the honest
 * degradation ladder: P2P -> "Direct connection unavailable" -> "Origin only".
 */
import { create } from "zustand";

export type PlaybackSource = "p2p" | "unavailable" | "origin";

interface PlayerState {
  playing: boolean;
  muted: boolean;
  volume: number;
  quality: "720p" | "auto";
  latencyToLive: number;
  theater: boolean;
  fullscreen: boolean;
  source: PlaybackSource;
  syncedAt: number;
  captionsOn: boolean;

  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  toggleMuted: () => void;
  setVolume: (v: number) => void;
  setQuality: (q: "720p" | "auto") => void;
  syncToLive: () => void;
  toggleTheater: () => void;
  toggleFullscreen: () => void;
  setSource: (source: PlaybackSource) => void;
  toggleCaptions: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playing: true,
  muted: false,
  volume: 0.8,
  quality: "auto",
  latencyToLive: 2.8,
  theater: false,
  fullscreen: false,
  source: "p2p",
  syncedAt: Date.now(),
  captionsOn: false,

  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setVolume: (volume) => set({ volume, muted: volume === 0 }),
  setQuality: (quality) => set({ quality }),
  syncToLive: () => set({ latencyToLive: 0.4, syncedAt: Date.now() }),
  toggleTheater: () => set((s) => ({ theater: !s.theater })),
  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),
  setSource: (source) => set({ source }),
  toggleCaptions: () => set((s) => ({ captionsOn: !s.captionsOn })),
}));

/** Why the viewer might not be getting bytes from peers. */
export const DEGRADATION_REASONS: Record<PlaybackSource, { label: string; detail: string }> = {
  p2p: {
    label: "Peered",
    detail: "Parts are arriving from parent peers over WebRTC data channels.",
  },
  unavailable: {
    label: "Direct connection unavailable",
    detail:
      "The data channel never connected — usually a firewall, symmetric NAT, or the tab being backgrounded. Playback continues from the origin.",
  },
  origin: {
    label: "Origin only",
    detail:
      "This browser cannot relay parts. Safari and iOS use native HLS, so they always watch from the origin. The UI never claims peer traffic that did not happen.",
  },
};

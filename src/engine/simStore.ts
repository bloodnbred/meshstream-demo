/**
 * Simulator control surface.
 *
 * Thin, typed wrappers around the engine's scenario controls. The engine
 * itself stays outside React so the canvas can read it every frame without
 * triggering a re-render.
 */
import { create } from "zustand";
import { engine } from "./swarm";

export type Speed = 0.5 | 1 | 2 | 4;

interface SimState {
  viewers: number;
  p2pEnabled: boolean;
  slowNetwork: boolean;
  saturated: boolean;
  safariViewer: boolean;
  backgroundedPeer: boolean;
  originOffline: boolean;
  playing: boolean;
  speed: Speed;
  seed: number;
  /** Incremented by the global ticker so readouts refresh ~10x per second. */
  tick: number;

  setViewers: (n: number) => void;
  toggleP2p: () => void;
  toggleSlowNetwork: () => void;
  toggleSaturated: () => void;
  toggleSafari: () => void;
  toggleBackground: () => void;
  toggleOriginOffline: () => void;
  killRandomPeer: () => void;
  killThirty: () => void;
  corruptPart: () => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: Speed) => void;
  reset: (seed?: number) => void;
  bump: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  viewers: engine.scenario.viewers,
  p2pEnabled: engine.scenario.p2pEnabled,
  slowNetwork: engine.scenario.slowNetwork,
  saturated: engine.scenario.saturated,
  safariViewer: engine.scenario.safariViewer,
  backgroundedPeer: engine.scenario.backgroundedPeer,
  originOffline: engine.scenario.originOffline,
  playing: true,
  speed: 1,
  seed: engine.seed,
  tick: 0,

  setViewers: (n) => {
    const viewers = Math.max(1, Math.min(50, n));
    engine.setViewers(viewers);
    set({ viewers });
  },

  toggleP2p: () => {
    const next = !get().p2pEnabled;
    engine.setP2p(next);
    set({ p2pEnabled: next });
  },

  toggleSlowNetwork: () => {
    const next = !get().slowNetwork;
    engine.setSlowNetwork(next);
    set({ slowNetwork: next });
  },

  toggleSaturated: () => {
    const next = !get().saturated;
    engine.setSaturated(next);
    set({ saturated: next });
  },

  toggleSafari: () => {
    const next = !get().safariViewer;
    engine.setSafariViewer(next);
    set({ safariViewer: next });
  },

  toggleBackground: () => {
    const next = !get().backgroundedPeer;
    engine.setOriginOffline(engine.scenario.originOffline);
    if (next) {
      engine.backgroundTab();
    }
    set({ backgroundedPeer: next });
  },

  toggleOriginOffline: () => {
    const next = !get().originOffline;
    engine.setOriginOffline(next);
    set({ originOffline: next });
  },

  killRandomPeer: () => {
    engine.killRandomPeer();
  },

  killThirty: () => {
    engine.killFraction(0.3);
  },

  corruptPart: () => {
    engine.corruptPart();
  },

  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),

  reset: (seed) => {
    const nextSeed = seed ?? Math.floor(Math.random() * 1e6);
    engine.reset(nextSeed);
    set({
      seed: nextSeed,
      viewers: engine.scenario.viewers,
      p2pEnabled: engine.scenario.p2pEnabled,
      slowNetwork: engine.scenario.slowNetwork,
      saturated: engine.scenario.saturated,
      safariViewer: engine.scenario.safariViewer,
      backgroundedPeer: engine.scenario.backgroundedPeer,
      originOffline: engine.scenario.originOffline,
    });
  },

  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));

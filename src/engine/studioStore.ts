/**
 * Live studio state machine (mock).
 *
 * Models the real guard sequence from plan.md §8.3:
 *   preflight -> armed -> 3-2-1 countdown -> on air -> ending
 */
import { create } from "zustand";
import { mockApi } from "@/mock/api";
import { useAppStore } from "./store";

export type StudioPhase = "idle" | "preflight" | "armed" | "countdown" | "live" | "ending";
export type StudioSource = "camera" | "screen";

interface StudioState {
  phase: StudioPhase;
  streamId: string;
  hostKey: string;
  countdown: number;
  onAirSince: number;
  source: StudioSource;
  micOn: boolean;
  camOn: boolean;
  recording: boolean;
  micLevel: number;
  title: string;
  category: string;
  error: string | null;
  busy: boolean;

  setPhase: (phase: StudioPhase) => void;
  setSource: (source: StudioSource) => void;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleRecording: () => void;
  setTitle: (title: string) => void;
  setCategory: (category: string) => void;

  /** Runs the preflight checklist and creates the stream. */
  arm: () => Promise<void>;
  /** 3-2-1 countdown, then go live. */
  startCountdown: () => Promise<void>;
  goLive: () => Promise<void>;
  endStream: () => Promise<void>;
  setCountdown: (n: number) => void;
  setMicLevel: (v: number) => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  phase: "idle",
  streamId: "",
  hostKey: "",
  countdown: 3,
  onAirSince: 0,
  source: "camera",
  micOn: true,
  camOn: true,
  recording: false,
  micLevel: 0,
  title: "Building a peer-assisted CDN from a bedroom",
  category: "Engineering",
  error: null,
  busy: false,

  setPhase: (phase) => set({ phase }),
  setSource: (source) => set({ source }),
  toggleMic: () => set((s) => ({ micOn: !s.micOn })),
  toggleCam: () => set((s) => ({ camOn: !s.camOn })),
  toggleRecording: () => set((s) => ({ recording: !s.recording })),
  setTitle: (title) => set({ title }),
  setCategory: (category) => set({ category }),
  setCountdown: (countdown) => set({ countdown }),
  setMicLevel: (micLevel) => set({ micLevel }),

  arm: async () => {
    set({ busy: true, error: null });
    try {
      const { id, hostKey } = await mockApi.createStream(get().title);
      set({ streamId: id, hostKey, phase: "armed", busy: false });
      useAppStore.getState().pushToast({
        title: "Preflight passed",
        body: "Stream created · host key stored as a SHA-256 hash only.",
        tone: "ok",
      });
    } catch (err) {
      set({ busy: false, error: err instanceof Error ? err.message : "unknown error" });
    }
  },

  startCountdown: async () => {
    const { streamId } = get();
    if (!streamId) return;
    set({ phase: "countdown", countdown: 3, busy: true });
    for (let n = 3; n > 0; n--) {
      set({ countdown: n });
      await new Promise((r) => setTimeout(r, 800));
    }
    await get().goLive();
  },

  goLive: async () => {
    const { streamId, hostKey } = get();
    const res = await mockApi.startStream(streamId, hostKey);
    if (!res.ok) {
      set({ phase: "armed", busy: false, error: `Start failed (${res.status})` });
      return;
    }
    set({ phase: "live", busy: false, onAirSince: Date.now() });
    useAppStore.getState().pushToast({
      title: "You are live",
      body: "Publishing over WHIP to MediaMTX on :8889.",
      tone: "ok",
    });
  },

  endStream: async () => {
    const { streamId, hostKey } = get();
    set({ phase: "ending" });
    await mockApi.stopStream(streamId, hostKey);
    set({ phase: "idle", onAirSince: 0, recording: false });
    useAppStore.getState().pushToast({
      title: "Stream ended",
      body: "Recording finalized · peer caches expire in 60 s.",
      tone: "info",
    });
  },
}));

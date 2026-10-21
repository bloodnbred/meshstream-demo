/**
 * Global UI store.
 *
 * Everything the shell owns: routing, panels, motion preference, chat and
 * toasts. Kept deliberately small so that high-frequency telemetry never
 * causes an app-wide re-render.
 */
import { create } from "zustand";
import type { ChatMessage, Guest, RouteId, StreamSummary } from "@/types";

export const ROUTES: { id: RouteId; label: string; hint: string }[] = [
  { id: "hero", label: "Start", hint: "The audience is the network" },
  { id: "story", label: "How it works", hint: "8-scene guided story" },
  { id: "studio", label: "Studio", hint: "Broadcast console" },
  { id: "viewer", label: "Viewer", hint: "Player + swarm panel" },
  { id: "simulator", label: "Simulator", hint: "Break it on purpose" },
  { id: "architecture", label: "Architecture", hint: "Every service, every port" },
  { id: "deepdive", label: "P2P deep dive", hint: "Source selection + protocol" },
  { id: "proof", label: "Proof", hint: "SLOs, run evidence, cost" },
  { id: "team", label: "Team", hint: "Stack, roadmap, next" },
];

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: "info" | "ok" | "warn" | "error";
  ttl?: number;
}

export type MotionPref = "auto" | "on" | "off";

interface AppState {
  route: RouteId;
  setRoute: (route: RouteId) => void;

  devConsoleOpen: boolean;
  toggleDevConsole: () => void;
  setDevConsole: (open: boolean) => void;

  paletteOpen: boolean;
  setPalette: (open: boolean) => void;

  presenterMode: boolean;
  togglePresenter: () => void;

  projector: boolean;
  toggleProjector: () => void;

  motion: MotionPref;
  setMotion: (motion: MotionPref) => void;

  guest: Guest | null;
  setGuest: (guest: Guest) => void;

  chat: ChatMessage[];
  appendChat: (message: ChatMessage) => void;
  setChat: (messages: ChatMessage[]) => void;
  removeChat: (id: string) => void;

  liveStreams: StreamSummary[];
  setLiveStreams: (streams: StreamSummary[]) => void;

  tunnelUrl: string;
  setTunnelUrl: (url: string) => void;

  toasts: Toast[];
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;

  /** Bumped by the panic reset. */
  resetToken: number;
  panicReset: () => void;
}

let toastSeq = 1;

export const useAppStore = create<AppState>((set, get) => ({
  route: "hero",
  setRoute: (route) => {
    if (get().route === route) return;
    set({ route });
    if (typeof window !== "undefined") {
      const hash = `#/${route}`;
      if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    }
  },

  devConsoleOpen: false,
  toggleDevConsole: () => set((s) => ({ devConsoleOpen: !s.devConsoleOpen })),
  setDevConsole: (devConsoleOpen) => set({ devConsoleOpen }),

  paletteOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),

  presenterMode: false,
  togglePresenter: () => set((s) => ({ presenterMode: !s.presenterMode })),

  projector: false,
  toggleProjector: () => set((s) => ({ projector: !s.projector })),

  motion: "auto",
  setMotion: (motion) => {
    set({ motion });
    if (typeof document !== "undefined") {
      document.documentElement.dataset.motion = motion;
    }
  },

  guest: null,
  setGuest: (guest) => set({ guest }),

  chat: [],
  appendChat: (message) => set((s) => ({ chat: [...s.chat.slice(-120), message] })),
  setChat: (chat) => set({ chat }),
  removeChat: (id) => set((s) => ({ chat: s.chat.map((m) => (m.id === id ? { ...m, deleted: true } : m)) })),

  liveStreams: [],
  setLiveStreams: (liveStreams) => set({ liveStreams }),

  tunnelUrl: "",
  setTunnelUrl: (tunnelUrl) => set({ tunnelUrl }),

  toasts: [],
  pushToast: (toast) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const ttl = toast.ttl ?? 4200;
    if (ttl > 0) {
      setTimeout(() => get().dismissToast(id), ttl);
    }
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  resetToken: 0,
  panicReset: () => set((s) => ({ resetToken: s.resetToken + 1, chat: [], toasts: [] })),
}));

/** Read the current route from the URL hash (used once at boot). */
export function routeFromHash(): RouteId {
  if (typeof window === "undefined") return "hero";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const match = ROUTES.find((r) => r.id === hash);
  return match ? match.id : "hero";
}

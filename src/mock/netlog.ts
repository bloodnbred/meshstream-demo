/**
 * Dev console / network inspector store.
 *
 * Every mock HTTP call and every simulated WebSocket frame is recorded here
 * so the demo can show its own plumbing without a real backend. The drawer
 * in the UI subscribes to this store.
 */
import { create } from "zustand";
import type { LogEntry, LogKind, LogLevel, ProtocolMessage } from "@/types";

const MAX_ENTRIES = 400;

interface NetLogState {
  entries: LogEntry[];
  seq: number;
  paused: boolean;
  push: (entry: Omit<LogEntry, "id" | "ts">) => void;
  pushFrame: (payload: ProtocolMessage, detail?: string) => void;
  clear: () => void;
  togglePause: () => void;
}

export const useNetLog = create<NetLogState>((set, get) => ({
  entries: [],
  seq: 1,
  paused: false,

  push: (entry) => {
    if (get().paused) return;
    const id = get().seq;
    set((s) => ({
      seq: s.seq + 1,
      entries: [...s.entries, { ...entry, id, ts: Date.now() }].slice(-MAX_ENTRIES),
    }));
  },

  pushFrame: (payload, detail) => {
    const level: LogLevel =
      payload.t === "quarantine"
        ? "warn"
        : payload.t === "nack"
          ? "warn"
          : payload.t === "swarm:saturated"
            ? "warn"
            : "info";
    get().push({
      kind: "ws",
      level,
      method: "WS",
      path: "/ws/signal",
      detail: detail ?? describeFrame(payload),
      payload,
    });
  },

  clear: () => set({ entries: [] }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
}));

/** Human readable one-liner for a protocol frame. */
export function describeFrame(p: ProtocolMessage): string {
  switch (p.t) {
    case "hello":
      return `hello guest=${p.guestId} caps.parts=${p.caps.parts} safari=${p.caps.safari}`;
    case "assign":
      return `assign parents=[${p.parents.join(",")}] children=[${p.children.join(",")}]`;
    case "have":
      return `have peer=${p.peerId} bitmap=0b${p.bitmap.toString(2)}`;
    case "want":
      return `want peer=${p.peerId} part=${p.partId} deadline=${p.deadline}ms`;
    case "data":
      return `data peer=${p.peerId} part=${p.partId} off=${p.offset} chunk=${p.chunk}B`;
    case "cancel":
      return `cancel peer=${p.peerId} part=${p.partId}`;
    case "nack":
      return `nack peer=${p.peerId} part=${p.partId} reason=${p.reason}`;
    case "quarantine":
      return `quarantine peer=${p.peerId} reason=${p.reason}`;
    case "ping":
      return `ping t0=${p.t0}`;
    case "pong":
      return `pong t0=${p.t0}`;
    case "swarm:saturated":
      return `swarm:saturated origin=${p.originMbps.toFixed(1)}Mbps`;
    default:
      return "frame";
  }
}

/* ------------------------------------------------------------------ */
/* Convenience loggers                                                 */
/* ------------------------------------------------------------------ */

export function logHttp(opts: {
  method: string;
  path: string;
  status: number;
  ms: number;
  bytes?: number;
  detail?: string;
}) {
  const level: LogLevel =
    opts.status >= 500 ? "error" : opts.status >= 400 ? "warn" : opts.status < 300 ? "ok" : "info";
  useNetLog.getState().push({
    kind: "http",
    level,
    method: opts.method,
    path: opts.path,
    status: opts.status,
    ms: opts.ms,
    bytes: opts.bytes,
    detail: opts.detail,
  });
}

export function logEngine(detail: string, level: LogLevel = "info") {
  useNetLog.getState().push({ kind: "engine", level, method: "ENG", path: "swarm-engine", detail });
}

export type { LogKind };

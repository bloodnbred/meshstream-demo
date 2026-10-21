/**
 * Shared domain types.
 *
 * These mirror the real MeshStream protocol/API surface as closely as the
 * demo can while staying framework free (no React imports) so the mock
 * backend, the swarm engine and the UI all speak the same language.
 */

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

export type GuestRole = "guest" | "mod" | "host";

export interface Guest {
  id: string;
  name: string;
  color: string;
  initials: string;
  role: GuestRole;
}

export interface ChatMessage {
  id: string;
  guestId: string;
  name: string;
  color: string;
  initials: string;
  body: string;
  /** Epoch ms. */
  ts: number;
  role: GuestRole;
  /** Set when the host deleted the message. */
  deleted?: boolean;
}

/* ------------------------------------------------------------------ */
/* Streams                                                             */
/* ------------------------------------------------------------------ */

export interface StreamSummary {
  id: string;
  title: string;
  category: string;
  hostName: string;
  viewers: number;
  /** Deterministic seed for the generated SVG thumbnail. */
  thumbSeed: number;
  startedAt: number;
  resolution: string;
  fps: number;
  bitrateKbps: number;
}

export interface PlaybackGrant {
  streamId: string;
  /** Signed, short lived URL — never actually fetched in the demo. */
  playbackUrl: string;
  swarmToken: string;
  expiresAt: number;
  /** The edge proxy window the viewer is allowed to request. */
  manifestUrl: string;
}

export interface ManifestEntry {
  partId: string;
  seq: number;
  durationMs: number;
  bytes: number;
  sha256: string;
  signature: string;
}

/* ------------------------------------------------------------------ */
/* Swarm                                                               */
/* ------------------------------------------------------------------ */

export type PeerState =
  | "healthy"
  | "degraded"
  | "background"
  | "quarantined"
  | "safari"
  | "origin-only"
  | "dead";

export interface PeerNode {
  id: string;
  name: string;
  color: string;
  initials: string;
  state: PeerState;
  /** Parent peer ids (origin counts as a parent). */
  parents: string[];
  children: string[];
  /** Simulated seconds of verified parts buffered. */
  bufferSec: number;
  /** Uplink utilisation 0..1. */
  uplink: number;
  metered: boolean;
  /** Tit-for-tat contribution score 0..1. */
  contribution: number;
  rttMs: number;
  /** p95 fetch time for parts from this peer. */
  p95Ms: number;
  /** Is this peer currently allowed to serve? */
  serving: boolean;
  /** Bytes relayed to children. */
  servedBytes: number;
  /** Layout position in the mesh viewport (0..1). */
  x: number;
  y: number;
  /** Parts served in the last window. */
  servedParts: number;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  active: boolean;
  /** Dashed path drawn while a re-parent is in flight. */
  rerouting: boolean;
  /** 0..1 intensity used for the neon pulse. */
  load: number;
}

export interface Packet {
  id: string;
  edgeId: string;
  /** 0..1 along the edge. */
  t: number;
  from: string;
  to: string;
  kind: "part" | "control";
  corrupt: boolean;
}

export interface SwarmMetrics {
  viewers: number;
  peers: number;
  peersServing: number;
  /** Origin egress in Mbps (edge proxy -> viewers + seed peers). */
  originMbps: number;
  originCapMbps: number;
  /** Percentage of viewer bytes that arrived from a peer. */
  offloadPct: number;
  /** p95 glass-to-glass latency in ms. */
  p95LatencyMs: number;
  /** p95 join time in ms. */
  joinMs: number;
  /** Rebuffer ratio, percent. */
  rebufferPct: number;
  bytesFromPeers: number;
  bytesFromOrigin: number;
  bytesSaved: number;
  /** Origin guard tripped. */
  saturated: boolean;
  /** Swarm is re-parenting. */
  rebalancing: boolean;
  /** Global mode: direct connections unavailable. */
  originOnly: boolean;
}

/* ------------------------------------------------------------------ */
/* Simulator scenario                                                 */
/* ------------------------------------------------------------------ */

export interface Scenario {
  seed: number;
  viewers: number;
  p2pEnabled: boolean;
  slowNetwork: boolean;
  saturated: boolean;
  safariViewer: boolean;
  backgroundedPeer: boolean;
  playing: boolean;
  speed: 0.5 | 1 | 2 | 4;
  /** Peer ids that were killed recently (for the death animation). */
  recentlyDead: string[];
}

/* ------------------------------------------------------------------ */
/* Wire protocol (mock signal server)                                 */
/* ------------------------------------------------------------------ */

export type ProtocolMessage =
  | { t: "hello"; guestId: string; streamId: string; caps: { parts: boolean; safari: boolean } }
  | { t: "assign"; parents: string[]; children: string[]; iceServers: string[] }
  | { t: "have"; peerId: string; bitmap: number }
  | { t: "want"; peerId: string; partId: string; deadline: number; priority: number }
  | { t: "data"; peerId: string; partId: string; offset: number; chunk: number }
  | { t: "cancel"; peerId: string; partId: string }
  | { t: "nack"; peerId: string; partId: string; reason: string }
  | { t: "quarantine"; peerId: string; reason: string }
  | { t: "ping"; t0: number }
  | { t: "pong"; t0: number }
  | { t: "swarm:saturated"; originMbps: number };

export type ProtocolType = ProtocolMessage["t"];

/* ------------------------------------------------------------------ */
/* Dev console / network inspector                                    */
/* ------------------------------------------------------------------ */

export type LogKind = "http" | "ws" | "engine";
export type LogLevel = "info" | "ok" | "warn" | "error";

export interface LogEntry {
  id: number;
  kind: LogKind;
  level: LogLevel;
  ts: number;
  /** HTTP method or ws frame direction. */
  method: string;
  path: string;
  status?: number;
  ms?: number;
  bytes?: number;
  detail?: string;
  /** Extra payload for ws frames. */
  payload?: ProtocolMessage;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export type RouteId =
  | "hero"
  | "story"
  | "studio"
  | "viewer"
  | "simulator"
  | "architecture"
  | "deepdive"
  | "proof"
  | "team";

export interface SloTarget {
  id: string;
  label: string;
  target: string;
  value: number;
  unit: string;
  /** Direction of "good". */
  better: "lower" | "higher";
  pass: boolean;
}

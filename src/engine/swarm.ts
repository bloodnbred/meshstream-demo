/**
 * Deterministic swarm engine.
 *
 * This is the model that drives every telemetry surface in the demo. It is
 * NOT the real scheduler — it is a faithful re-implementation of the rules
 * documented in plan.md §5 so the numbers move the way the real system does:
 *
 *   • the origin is the root of a distribution tree with mesh repair
 *   • at most 3 direct seed children of the origin
 *   • every peer has 1–2 parents and up to 4 children
 *   • a peer may only serve when: buffer > 15 s, tab visible,
 *     uplink < 70 %, not metered, healthy contribution score
 *   • per-part source selection: cache -> best peer (lowest p95) -> origin
 *     with a hard deadline of ~1.6 s, then immediate origin fallback
 *   • the origin guard stops granting origin parents above 12 Mbps egress
 *
 * Everything is seeded, so `reset(seed)` reproduces a run exactly.
 */
import { makeRng, hashString, type Rng } from "@/mock/rng";
import { makeGuests } from "@/mock/data";
import type { Edge, Packet, PeerNode, PeerState, ProtocolMessage, SwarmMetrics } from "@/types";

/* ------------------------------------------------------------------ */
/* Constants (all taken from plan.md)                                 */
/* ------------------------------------------------------------------ */

export const SWARM_CONST = {
  VIDEO_MBPS: 2.5,
  AUDIO_MBPS: 0.112,
  /** Per-viewer demand: 720p H.264 + Opus, no transcoding. */
  TOTAL_MBPS: 2.612,
  PART_MS: 400,
  SEGMENT_MS: 1000,
  SEGMENT_WINDOW: 7,
  CACHE_SECONDS: 60,
  SEED_CHILDREN: 3,
  MAX_CHILDREN: 4,
  MIN_PARENTS: 1,
  MAX_PARENTS: 2,
  /** Keeps the distribution tree shallow — a chain would be a fake mesh. */
  MAX_DEPTH: 4,
  DEADLINE_MS: 1600,
  ORIGIN_CAP_MBPS: 12,
  /** Upload policy: a peer needs more than 15 s buffered to serve. */
  BUFFER_MIN_SERVE: 15,
  /** Upload policy: uplink utilisation must stay under 70 %. */
  UPLINK_MAX: 0.7,
  /** A viewer is fully peer-served once its own buffer reaches this. */
  VIEWER_BUFFER_TARGET: 12,
  /** Base chance a part request misses the peer deadline. */
  BASE_MISS_RATE: 0.05,
  /** Bytes already saved before this session (so the copy reads ~1.4 GB). */
  SAVED_SEED_BYTES: 1.38e9,
  /** Latency budget, milliseconds. */
  BUDGET: {
    capture: 33,
    encode: 80,
    whip: 120,
    packaging: 900,
    network: 600,
    decode: 150,
  },
} as const;

export const ORIGIN_ID = "origin";

/* ------------------------------------------------------------------ */
/* Engine state                                                        */
/* ------------------------------------------------------------------ */

export interface EngineEvent {
  kind: "peer-died" | "rebalance" | "saturated" | "quarantine" | "origin-offline" | "origin-online" | "joined";
  peerId?: string;
  detail: string;
}

export interface SwarmState {
  time: number;
  peers: PeerNode[];
  edges: Edge[];
  packets: Packet[];
  metrics: SwarmMetrics;
  /** Views that recently died — used for the red flash animation. */
  deaths: { id: string; at: number }[];
  saturatedAt: number | null;
}

export interface EngineScenario {
  viewers: number;
  p2pEnabled: boolean;
  slowNetwork: boolean;
  saturated: boolean;
  safariViewer: boolean;
  backgroundedPeer: boolean;
  originOffline: boolean;
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class SwarmEngine {
  state: SwarmState;
  scenario: EngineScenario;
  seed: number;

  private rng: Rng;
  private guestPool = makeGuests(20240517, 60);
  private packetSeq = 0;
  private partSeq = Math.floor(Date.now() / SWARM_CONST.PART_MS);
  private lastTopology = 0;
  private frames: ProtocolMessage[] = [];
  private events: EngineEvent[] = [];
  private bytesFromPeers = 0;
  private bytesFromOrigin = 0;
  private originOffline = false;
  /** Rolling origin traffic so the meter wobbles instead of sitting flat. */
  private originNoise = 0;
  /** Exponentially weighted offload so the metric reacts within ~1 s. */
  private offloadEma = 0;
  private lastBackgroundedId: string | null = null;

  onFrame: ((msg: ProtocolMessage) => void) | null = null;
  onEvent: ((event: EngineEvent) => void) | null = null;

  constructor(seed = 20240517) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.scenario = {
      viewers: 12,
      p2pEnabled: true,
      slowNetwork: false,
      saturated: false,
      safariViewer: false,
      backgroundedPeer: false,
      originOffline: false,
    };
    this.state = {
      time: 0,
      peers: [],
      edges: [],
      packets: [],
      metrics: this.emptyMetrics(),
      deaths: [],
      saturatedAt: null,
    };
    this.buildPeers(this.scenario.viewers);
    this.assignTopology();
    this.recompute();
    this.warmUp();
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  reset(seed = this.seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.guestPool = makeGuests(seed, 60);
    this.packetSeq = 0;
    this.bytesFromPeers = 0;
    this.bytesFromOrigin = 0;
    this.originNoise = 0;
    this.lastTopology = 0;
    this.frames = [];
    this.events = [];
    this.state = {
      time: 0,
      peers: [],
      edges: [],
      packets: [],
      metrics: this.emptyMetrics(),
      deaths: [],
      saturatedAt: null,
    };
    this.scenario = { ...this.scenario };
    this.buildPeers(this.scenario.viewers);
    this.assignTopology();
    this.recompute();
    this.warmUp();
  }

  /** Advance the simulation. `dt` is in seconds of simulated time. */
  step(dt: number, silent = false) {
    if (dt <= 0) return;
    this.state.time += dt;

    this.agePeers(dt);
    this.applyScenarioEffects();
    this.maybeAssignTopology();

    // Traffic per peer is modelled continuously; bytes accumulate.
    this.accumulateTraffic(dt);
    this.updatePackets(dt);
    this.recompute();

    if (!silent) {
      this.flushFrames();
      this.flushEvents();
    } else {
      this.frames = [];
      this.events = [];
    }
  }

  /**
   * Run the model forward without rendering.
   *
   * The demo opens on a swarm that has been live for a while: caches are
   * warm, the tree is settled and the origin meter is in its steady state.
   * Without this the first seconds would look like a cold start.
   */
  warmUp(seconds = 45) {
    const STEP = 0.1;
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i++) {
      this.step(STEP, true);
    }
    this.state.packets = [];
    this.state.deaths = [];
    this.frames = [];
    this.events = [];
  }

  /* ---------------------------------------------------------------- */
  /* Peers                                                             */
  /* ---------------------------------------------------------------- */

  private makePeer(index: number): PeerNode {
    const guest = this.guestPool[index % this.guestPool.length];
    const rng = this.rng;
    const id = `p${index.toString(36)}`;
    const rtt = Math.round(rng.range(24, 180));
    return {
      id,
      name: guest.name,
      color: guest.color,
      initials: guest.initials,
      state: "healthy",
      parents: [],
      children: [],
      // The initial cohort is warm: the stream has been running for a while.
      bufferSec: index < 8 ? rng.range(18, 46) : rng.range(0, 3),
      uplink: rng.range(0.12, 0.68),
      metered: rng.bool(0.12),
      contribution: rng.range(0.45, 1),
      rttMs: rtt,
      p95Ms: Math.round(rtt * rng.range(1.2, 2.1)),
      serving: false,
      servedBytes: 0,
      servedParts: 0,
      x: 0.5,
      y: 0.5,
    };
  }

  private buildPeers(count: number) {
    const peers: PeerNode[] = [];
    for (let i = 0; i < count; i++) {
      const peer = this.makePeer(i);
      if (this.scenario.safariViewer && i === count - 1) {
        peer.state = "safari";
        peer.serving = false;
      }
      peers.push(peer);
    }
    this.state.peers = peers;
  }

  /** Grow or shrink the audience. New peers join with a cold buffer. */
  setViewers(count: number) {
    const target = Math.max(1, Math.min(50, Math.round(count)));
    const peers = this.state.peers;
    if (target > peers.length) {
      for (let i = peers.length; i < target; i++) {
        const peer = this.makePeer(i);
        peer.bufferSec = 0;
        peers.push(peer);
        this.emitEvent({ kind: "joined", peerId: peer.id, detail: `${peer.name} joined the swarm` });
      }
    } else if (target < peers.length) {
      const removed = peers.splice(target);
      for (const peer of removed) {
        this.emitEvent({ kind: "peer-died", peerId: peer.id, detail: `${peer.name} left the swarm` });
      }
    }
    this.assignTopology();
    this.recompute();
  }

  private peerById(id: string): PeerNode | undefined {
    return this.state.peers.find((p) => p.id === id);
  }

  /* ---------------------------------------------------------------- */
  /* Upload policy                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * The real rule set from plan.md §5.4 — a peer serves only when all of
   * these hold. Exposed so the UI can show the checklist with live values.
   */
  uploadPolicy(peer: PeerNode): { buffer: boolean; visible: boolean; uplink: boolean; metered: boolean; score: boolean } {
    return {
      buffer: peer.bufferSec > SWARM_CONST.BUFFER_MIN_SERVE,
      visible: peer.state !== "background",
      uplink: peer.uplink < SWARM_CONST.UPLINK_MAX,
      metered: !peer.metered,
      score: peer.contribution > 0.35,
    };
  }

  /** Can this peer serve a part right now? */
  canServe(peer: PeerNode): boolean {
    if (!this.scenario.p2pEnabled) return false;
    if (peer.state === "dead" || peer.state === "quarantined") return false;
    if (peer.state === "safari") return false;
    if (this.originOffline) return false;
    const policy = this.uploadPolicy(peer);
    return policy.buffer && policy.visible && policy.uplink && policy.metered && policy.score;
  }

  /* ---------------------------------------------------------------- */
  /* Topology                                                          */
  /* ---------------------------------------------------------------- */

  /** Rebuild the distribution tree. Runs at most once per part interval. */
  private maybeAssignTopology() {
    const since = this.state.time - this.lastTopology;
    if (since < SWARM_CONST.PART_MS / 1000) return;
    this.lastTopology = this.state.time;
    this.assignTopology();
  }

  assignTopology() {
    const peers = this.state.peers.filter((p) => p.state !== "dead");
    for (const peer of peers) {
      peer.parents = [];
      peer.children = [];
    }

    const saturated = this.state.metrics.saturated;
    const childrenCount = new Map<string, number>();
    const depth = new Map<string, number>([[ORIGIN_ID, 0]]);
    const inc = (id: string) => childrenCount.set(id, (childrenCount.get(id) ?? 0) + 1);

    const eligible = peers.filter((p) => p.state !== "safari" && p.state !== "quarantined");

    // 1) Seeds: the origin may have at most 3 direct children.
    const seedCandidates = eligible
      .slice()
      .sort((a, b) => this.score(b) - this.score(a))
      .slice(0, SWARM_CONST.SEED_CHILDREN);

    const seedIds = new Set<string>();
    for (const seed of seedCandidates) {
      seed.parents = [ORIGIN_ID];
      depth.set(seed.id, 1);
      seedIds.add(seed.id);
      inc(ORIGIN_ID);
    }

    // 2) Everyone else attaches to 1–2 peers that still have child capacity.
    const ordered = eligible.filter((p) => !seedIds.has(p.id)).sort((a, b) => this.score(b) - this.score(a));

    for (const peer of ordered) {
      const parents = this.chooseParents(peer, eligible, childrenCount, depth);
      if (parents.length === 0) {
        // Nobody could take it: fall back to the origin unless it is saturated.
        if (!saturated) {
          peer.parents = [ORIGIN_ID];
          depth.set(peer.id, 1);
          inc(ORIGIN_ID);
        } else {
          peer.state = "origin-only";
        }
        continue;
      }
      peer.parents = parents;
      depth.set(peer.id, Math.min(...parents.map((p) => depth.get(p) ?? 1)) + 1);
      for (const parentId of parents) inc(parentId);
    }

    // 3) Rebuild edges and the children lists.
    const edges: Edge[] = [];
    for (const peer of peers) {
      for (const parentId of peer.parents) {
        if (parentId !== ORIGIN_ID) {
          const parent = this.peerById(parentId);
          if (parent) parent.children.push(peer.id);
        }
        edges.push({
          id: `${parentId}->${peer.id}`,
          from: parentId,
          to: peer.id,
          active: false,
          rerouting: false,
          load: 0,
        });
      }
    }
    this.state.edges = edges;
    this.layout();
  }

  /**
   * Pick 1–2 parents for a peer.
   *
   * Warm, healthy peers score highly; parents that already have children or
   * sit deep in the tree are penalised, which keeps the tree shallow and
   * spreads the load instead of building a chain.
   */
  private chooseParents(
    peer: PeerNode,
    peers: PeerNode[],
    childrenCount: Map<string, number>,
    depth: Map<string, number>,
  ): string[] {
    const wanted = this.rng.bool(0.35) ? SWARM_CONST.MAX_PARENTS : SWARM_CONST.MIN_PARENTS;

    const pool = peers.filter((p) => {
      if (p.id === peer.id) return false;
      if (p.state === "dead" || p.state === "quarantined" || p.state === "safari") return false;
      if ((childrenCount.get(p.id) ?? 0) >= SWARM_CONST.MAX_CHILDREN) return false;
      const d = depth.get(p.id);
      // Unattached peers are not usable parents; keep the tree shallow.
      if (d === undefined || d >= SWARM_CONST.MAX_DEPTH) return false;
      return true;
    });

    if (pool.length === 0) return [];

    const scored = pool
      .map((p) => ({
        p,
        score:
          this.score(p) +
          (p.bufferSec > SWARM_CONST.BUFFER_MIN_SERVE ? 0.9 : 0) +
          (this.canServe(p) ? 0.6 : 0) -
          (childrenCount.get(p.id) ?? 0) * 0.75 -
          (depth.get(p.id) ?? 1) * 0.3,
      }))
      .sort((a, b) => b.score - a.score);

    const chosen: string[] = [];
    for (const entry of scored) {
      if (chosen.length >= wanted) break;
      chosen.push(entry.p.id);
    }
    return chosen;
  }

  /** Parent selection quality: low p95 and a healthy contribution score. */
  private score(peer: PeerNode): number {
    const net = this.scenario.slowNetwork ? 2.3 : 1;
    const p95 = peer.p95Ms * net;
    return (1 - p95 / 900) * 1.4 + peer.contribution * 0.8 + (peer.bufferSec > 15 ? 0.5 : 0);
  }

  /* ---------------------------------------------------------------- */
  /* Per-tick simulation                                               */
  /* ---------------------------------------------------------------- */

  private agePeers(dt: number) {
    for (const peer of this.state.peers) {
      if (peer.state === "dead") continue;

      // A peer receives parts as long as it has a source.
      const hasParent = peer.parents.length > 0;
      const originUsable = !this.originOffline;
      if (hasParent || originUsable) {
        peer.bufferSec = Math.min(SWARM_CONST.CACHE_SECONDS, peer.bufferSec + dt);
      } else {
        peer.bufferSec = Math.max(0, peer.bufferSec - dt * 1.5);
      }

      peer.serving = this.canServe(peer);

      // Contribution drifts with usage (tit-for-tat).
      if (peer.serving && peer.children.length > 0) {
        peer.contribution = Math.min(1, peer.contribution + dt * 0.01);
        peer.servedBytes += peer.children.length * SWARM_CONST.TOTAL_MBPS * dt * 1e6 * 0.5;
        peer.servedParts += peer.children.length * dt * 2.5;
      } else if (!peer.serving) {
        peer.contribution = Math.max(0.2, peer.contribution - dt * 0.004);
      }
    }
  }

  private applyScenarioEffects() {
    const s = this.scenario;

    // Safari viewer: no data channels, origin only.
    const safari = this.state.peers.find((p) => p.state === "safari");
    if (safari) {
      safari.parents = [ORIGIN_ID];
      safari.serving = false;
    }

    // Backgrounded tab: stops serving entirely.
    if (s.backgroundedPeer) {
      const victim = this.state.peers.find((p) => p.state === "healthy" && p.children.length > 0);
      if (victim && this.lastBackgroundedId !== victim.id) {
        this.lastBackgroundedId = victim.id;
        victim.state = "background";
        victim.serving = false;
        this.emitEvent({
          kind: "rebalance",
          peerId: victim.id,
          detail: `${victim.name} backgrounded — stops serving, children re-parent`,
        });
      }
    } else {
      for (const peer of this.state.peers) {
        if (peer.state === "background") peer.state = "healthy";
      }
    }

    if (s.originOffline !== this.originOffline) {
      this.originOffline = s.originOffline;
      this.emitEvent({
        kind: s.originOffline ? "origin-offline" : "origin-online",
        detail: s.originOffline ? "origin unreachable — origin-only mode" : "origin reachable again",
      });
      if (s.originOffline) {
        for (const peer of this.state.peers) {
          peer.parents = peer.parents.filter((p) => p === ORIGIN_ID);
        }
        this.assignTopology();
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Traffic accounting                                                */
  /* ---------------------------------------------------------------- */

  private accumulateTraffic(dt: number) {
    const s = this.scenario;
    const netFactor = s.slowNetwork ? 2.4 : 1;
    let originToSeeds = 0;
    let originDirect = 0;
    let originMisses = 0;
    let peerBytes = 0;

    const seeds = this.state.peers.filter((p) => p.parents.includes(ORIGIN_ID) && p.state !== "dead");

    for (const peer of this.state.peers) {
      if (peer.state === "dead") continue;

      const isSeed = peer.parents.includes(ORIGIN_ID) && seeds.includes(peer);

      // Which parents can actually serve this part right now?
      const servingParents = peer.parents.filter((parentId) => {
        if (parentId === ORIGIN_ID) return false;
        const parent = this.peerById(parentId);
        return parent ? this.canServe(parent) : false;
      });

      const canPeer = s.p2pEnabled && peer.state !== "safari" && servingParents.length > 0 && !this.originOffline;

      // Bootstrap: a cold viewer backfills part of its buffer from the origin.
      const fill = Math.max(0, SWARM_CONST.VIEWER_BUFFER_TARGET - peer.bufferSec);
      const bootstrapShare = canPeer ? Math.min(1, fill / SWARM_CONST.VIEWER_BUFFER_TARGET) * 0.65 : 1;

      // Deadline misses: the peer did not answer in 1.6 s, origin covers.
      const missRate = Math.min(
        0.6,
        SWARM_CONST.BASE_MISS_RATE * netFactor +
          (s.saturated ? 0.08 : 0) +
          (peer.parents.some((p) => this.peerById(p)?.state === "background") ? 0.18 : 0),
      );

      const originShare = canPeer ? Math.min(1, bootstrapShare + missRate) : 1;
      const peerShare = 1 - originShare;

      const demandBytes = SWARM_CONST.TOTAL_MBPS * 1e6 * dt;
      peerBytes += demandBytes * peerShare;
      this.bytesFromPeers += demandBytes * peerShare;
      this.bytesFromOrigin += demandBytes * originShare;

      if (isSeed) {
        originToSeeds += demandBytes;
      } else if (originShare > 0.98) {
        originDirect += demandBytes;
      } else {
        originMisses += demandBytes * missRate;
      }

      peer.servedParts = peer.serving ? peer.servedParts : 0;
    }

    // Wobble the meter so it feels like a live link rather than a flat bar.
    this.originNoise += dt;
    const wobble = Math.sin(this.originNoise * 0.7) * 0.06 + Math.sin(this.originNoise * 2.3) * 0.025;

    const originBytes =
      this.originOffline
        ? 0
        : originToSeeds + originDirect + originMisses + (this.scenario.saturated ? 0.9e6 * dt : 0);

    const originMbps = (originBytes * 8) / 1e6;
    this.pendingOriginMbps = originMbps * (1 + wobble);

    // Fast-reacting offload estimate (EWMA over the last ~2 s).
    const tickTotal = peerBytes + originDirect + originMisses + originToSeeds;
    const instant = tickTotal > 0 ? peerBytes / tickTotal : 0;
    this.offloadEma = this.offloadEma * 0.9 + instant * 0.1;
  }

  private pendingOriginMbps = 0;

  /* ---------------------------------------------------------------- */
  /* Packets                                                           */
  /* ---------------------------------------------------------------- */

  private updatePackets(dt: number) {
    const edges = this.state.edges;
    if (edges.length === 0) return;

    // Retire finished packets.
    this.state.packets = this.state.packets.filter((p) => {
      p.t += dt * 1.6;
      return p.t < 1;
    });

    // Emit new packets along active edges (rate limited so the UI stays calm).
    const rate = this.scenario.p2pEnabled ? 14 : 2;
    const count = Math.min(4, Math.floor(rate * dt));
    for (let i = 0; i < count; i++) {
      const edge = edges[this.rng.int(0, edges.length - 1)];
      if (!edge) continue;
      edge.active = true;
      edge.load = Math.min(1, edge.load + 0.35);
      this.state.packets.push({
        id: `pk_${this.packetSeq++}`,
        edgeId: edge.id,
        t: 0,
        from: edge.from,
        to: edge.to,
        kind: "part",
        corrupt: false,
      });
    }
    for (const edge of edges) {
      edge.load = Math.max(0, edge.load - dt * 0.9);
      if (edge.load <= 0.001) edge.active = false;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Metrics                                                           */
  /* ---------------------------------------------------------------- */

  private recompute() {
    const peers = this.state.peers.filter((p) => p.state !== "dead");
    const total = this.state.peers.length || 1;

    // Origin egress as seen by the edge proxy.
    const originMbps = this.pendingOriginMbps;
    const cap = SWARM_CONST.ORIGIN_CAP_MBPS;
    const forcedSaturated = this.scenario.saturated;
    const saturated = forcedSaturated || originMbps > cap;

    if (saturated && this.state.saturatedAt === null) {
      this.state.saturatedAt = this.state.time;
      this.emitEvent({ kind: "saturated", detail: `origin egress ${originMbps.toFixed(1)} Mbps > ${cap} Mbps cap` });
      this.pushFrame({ t: "swarm:saturated", originMbps });
    } else if (!saturated && this.state.saturatedAt !== null) {
      this.state.saturatedAt = null;
    }

    // Latency: fixed pipeline + transport + penalties.
    const B = SWARM_CONST.BUDGET;
    const pipeline = B.capture + B.encode + B.whip + B.packaging + B.decode;
    const netFactor = this.scenario.slowNetwork ? 2.6 : 1;
    const transport = B.network * netFactor * (this.scenario.p2pEnabled ? 1 : 1.45);
    const penalty = (saturated ? 620 : 0) + (this.scenario.slowNetwork ? 340 : 0);
    const jitter = 140 + this.rng.next() * 180;
    const p95 = pipeline + transport + penalty + jitter;

    const joinMs = 1180 + (saturated ? 900 : 0) + this.rng.next() * 520 + (this.scenario.slowNetwork ? 400 : 0);

    const rebuffer = Math.max(
      0,
      (saturated ? 0.9 : 0) + (this.scenario.p2pEnabled ? 0.18 : 0.85) + (this.scenario.slowNetwork ? 0.35 : 0) + this.rng.next() * 0.12,
    );

    const peersServing = peers.filter((p) => p.serving).length;

    this.state.metrics = {
      viewers: total,
      peers: peers.length,
      peersServing,
      originMbps,
      originCapMbps: cap,
      offloadPct: this.originOffline ? 0 : this.offloadEma * 100,
      p95LatencyMs: p95,
      joinMs,
      rebufferPct: rebuffer,
      bytesFromPeers: this.bytesFromPeers,
      bytesFromOrigin: this.bytesFromOrigin,
      bytesSaved: SWARM_CONST.SAVED_SEED_BYTES + this.bytesFromPeers,
      saturated,
      rebalancing: this.state.deaths.some((d) => this.state.time - d.at < 1.2),
      originOnly: !this.scenario.p2pEnabled || this.originOffline,
    };
  }

  private emptyMetrics(): SwarmMetrics {
    return {
      viewers: 0,
      peers: 0,
      peersServing: 0,
      originMbps: 0,
      originCapMbps: SWARM_CONST.ORIGIN_CAP_MBPS,
      offloadPct: 0,
      p95LatencyMs: 2500,
      joinMs: 1400,
      rebufferPct: 0.2,
      bytesFromPeers: 0,
      bytesFromOrigin: 0,
      bytesSaved: SWARM_CONST.SAVED_SEED_BYTES,
      saturated: false,
      rebalancing: false,
      originOnly: false,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Failures                                                          */
  /* ---------------------------------------------------------------- */

  /** Kill a random peer: children re-parent, the origin covers the gap. */
  killRandomPeer(): string | null {
    const alive = this.state.peers.filter((p) => p.state !== "dead");
    if (alive.length <= 1) return null;
    const victim = this.rng.pick(alive);
    this.killPeer(victim.id);
    return victim.id;
  }

  killFraction(fraction: number): string[] {
    const alive = this.state.peers.filter((p) => p.state !== "dead");
    const count = Math.max(1, Math.round(alive.length * fraction));
    const victims = this.rng.shuffle(alive).slice(0, count);
    for (const victim of victims) this.killPeer(victim.id);
    return victims.map((v) => v.id);
  }

  killPeer(id: string) {
    const victim = this.peerById(id);
    if (!victim || victim.state === "dead") return;
    victim.state = "dead";
    this.state.deaths.push({ id, at: this.state.time });
    this.emitEvent({ kind: "peer-died", peerId: id, detail: `${victim.name} disconnected — ${victim.children.length} children re-parenting` });
    this.pushFrame({ t: "cancel", peerId: id, partId: `part-${this.partSeq}` });
    this.assignTopology();
    this.emitEvent({ kind: "rebalance", peerId: id, detail: "origin covering the gap while the tree repairs" });
  }

  /**
   * Corrupt a part: the receiver hashes it, the hash does not match, the
   * sender is quarantined and the children re-parent.
   */
  corruptPart(): string | null {
    const candidates = this.state.peers.filter((p) => p.state === "healthy" && p.children.length > 0);
    if (candidates.length === 0) return null;
    const victim = this.rng.pick(candidates);
    const partId = `part-${this.partSeq--}`;
    this.pushFrame({ t: "nack", peerId: victim.id, partId, reason: "sha256 mismatch" });
    this.pushFrame({ t: "quarantine", peerId: victim.id, reason: "sha256 mismatch" });
    victim.state = "quarantined";
    victim.serving = false;
    this.emitEvent({
      kind: "quarantine",
      peerId: victim.id,
      detail: `${victim.name} sent a corrupt part — quarantined, children re-parent`,
    });
    this.assignTopology();
    return victim.id;
  }

  /** Background a tab: it stops serving but stays connected. */
  backgroundTab(): string | null {
    const candidates = this.state.peers.filter((p) => p.state === "healthy" && p.children.length > 0);
    if (candidates.length === 0) return null;
    const victim = this.rng.pick(candidates);
    victim.state = "background";
    victim.serving = false;
    this.emitEvent({
      kind: "rebalance",
      peerId: victim.id,
      detail: `${victim.name} went to the background — stops serving`,
    });
    this.assignTopology();
    return victim.id;
  }

  setSafariViewer(on: boolean) {
    this.scenario.safariViewer = on;
    const last = this.state.peers[this.state.peers.length - 1];
    for (const peer of this.state.peers) {
      if (peer.state === "safari") peer.state = "healthy";
    }
    if (on && last) {
      last.state = "safari";
      last.serving = false;
    }
    this.assignTopology();
  }

  setP2p(on: boolean) {
    this.scenario.p2pEnabled = on;
    if (!on) {
      for (const peer of this.state.peers) {
        peer.parents = peer.parents.length ? [ORIGIN_ID] : [];
        peer.children = [];
        peer.serving = false;
      }
    }
    this.assignTopology();
  }

  setSaturated(on: boolean) {
    this.scenario.saturated = on;
  }

  setSlowNetwork(on: boolean) {
    this.scenario.slowNetwork = on;
  }

  setOriginOffline(on: boolean) {
    this.scenario.originOffline = on;
  }

  /* ---------------------------------------------------------------- */
  /* Frames + events                                                   */
  /* ---------------------------------------------------------------- */

  private pushFrame(msg: ProtocolMessage) {
    this.frames.push(msg);
  }

  private flushFrames() {
    if (this.frames.length === 0) return;
    const batch = this.frames.slice(0, 8);
    this.frames = this.frames.slice(8);
    for (const msg of batch) this.onFrame?.(msg);
  }

  private emitEvent(event: EngineEvent) {
    this.events.push(event);
  }

  private flushEvents() {
    if (this.events.length === 0) return;
    const batch = this.events.slice(0, 5);
    this.events = this.events.slice(5);
    for (const event of batch) this.onEvent?.(event);
  }

  /* ---------------------------------------------------------------- */
  /* Layout                                                            */
  /* ---------------------------------------------------------------- */

  /** Deterministic layered layout — the origin on top, the tree below it. */
  layout(width = 0, height = 0) {
    const peers = this.state.peers.filter((p) => p.state !== "dead");
    if (peers.length === 0) return;

    const depth = new Map<string, number>([[ORIGIN_ID, 0]]);
    const getDepth = (id: string, guard = 0): number => {
      if (guard > 12) return 6;
      if (depth.has(id)) return depth.get(id)!;
      const peer = peers.find((p) => p.id === id);
      if (!peer || peer.parents.length === 0) {
        depth.set(id, 1);
        return 1;
      }
      const d = Math.min(...peer.parents.map((p) => getDepth(p, guard + 1))) + 1;
      depth.set(id, d);
      return d;
    };

    const groups = new Map<number, PeerNode[]>();
    for (const peer of peers) {
      const d = getDepth(peer.id);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(peer);
    }

    const maxDepth = Math.max(1, ...groups.keys());
    const parentX = (peer: PeerNode): number => {
      if (peer.parents.length === 0) return 0.5;
      const xs = peer.parents.map((id) => (id === ORIGIN_ID ? 0.5 : peers.find((p) => p.id === id)?.x ?? 0.5));
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };

    for (const d of [...groups.keys()].sort((a, b) => a - b)) {
      const group = groups.get(d)!;
      // Sort by the position of the parents so children sit under them.
      group.sort((a, b) => parentX(a) - parentX(b));
      const n = group.length;
      group.forEach((peer, i) => {
        const jitter = (hashString(peer.id) % 100) / 100 - 0.5;
        const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2;
        peer.x = 0.5 + spread * 0.44 + jitter * 0.015;
        peer.y = 0.12 + (d / (maxDepth + 0.55)) * 0.76;
      });
    }
    void width;
    void height;
  }

  /** Summary string used by the Proof page and the dev console. */
  treeSummary(): string {
    const peers = this.state.peers.filter((p) => p.state !== "dead");
    const depth = new Map<string, number>();
    const getDepth = (id: string, guard = 0): number => {
      if (guard > 12) return 6;
      if (id === ORIGIN_ID) return 0;
      if (depth.has(id)) return depth.get(id)!;
      const peer = peers.find((p) => p.id === id);
      if (!peer || peer.parents.length === 0) {
        depth.set(id, 1);
        return 1;
      }
      const d = Math.min(...peer.parents.map((p) => getDepth(p, guard + 1))) + 1;
      depth.set(id, d);
      return d;
    };
    const maxDepth = peers.reduce((acc, p) => Math.max(acc, getDepth(p.id)), 1);
    return `${peers.length} peers, ${this.state.edges.length} edges, maxDepth ${maxDepth}`;
  }

  /** Part id for the current live edge — used by the story + deep dive. */
  currentPartId(): string {
    return `part-${this.partSeq++}`;
  }
}

/* ------------------------------------------------------------------ */
/* Singleton                                                           */
/* ------------------------------------------------------------------ */

/** The one engine that drives the whole demo. */
export const engine = new SwarmEngine(20240517);

export type { PeerState };

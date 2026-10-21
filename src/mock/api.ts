/**
 * Mock REST API.
 *
 * Mirrors the real Fastify surface from plan.md §7:
 *
 *   POST   /api/guest                create/refresh guest cookie
 *   PATCH  /api/guest                name, color
 *   POST   /api/streams              create stream -> { id, hostKey }
 *   POST   /api/streams/:id/start    host key required
 *   POST   /api/streams/:id/stop     host key required
 *   GET    /api/streams/live         landing page data
 *   GET    /api/streams/:id/playback signed HLS URL + swarm token
 *   GET    /api/streams/:id/manifest signed part-hash manifest window
 *   POST   /api/streams/:id/telemetry
 *   GET    /api/media/health
 *
 * Every call resolves asynchronously with a small fake latency and is
 * recorded in the network inspector. NOTHING here touches the network.
 */
import { logHttp } from "./netlog";
import { makeGuests, makeLiveStreams, makeTunnelUrl } from "./data";
import { fakeSha256, fakeSignature } from "@/lib/hash";
import type { Guest, ManifestEntry, PlaybackGrant, StreamSummary } from "@/types";

/* ------------------------------------------------------------------ */
/* Fake transport                                                      */
/* ------------------------------------------------------------------ */

const LATENCY_MIN = 45;
const LATENCY_MAX = 180;

function delay(rng: () => number, factor = 1): Promise<void> {
  const ms = (LATENCY_MIN + rng() * (LATENCY_MAX - LATENCY_MIN)) * factor;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}_${(counter++).toString(36)}${Date.now().toString(36).slice(-4)}`;

/** Server-side "random" — deterministic per call order. */
let rand = 0.5;
function rnd(): number {
  rand = (rand * 9301 + 49297) % 233280;
  return rand / 233280;
}

/* ------------------------------------------------------------------ */
/* Server state (in-memory, lives for the session)                    */
/* ------------------------------------------------------------------ */

interface ServerStream {
  id: string;
  hostKeyHash: string;
  title: string;
  state: "idle" | "live" | "ended";
  startedAt: number;
  peakViewers: number;
}

const server = {
  streams: new Map<string, ServerStream>(),
  guests: new Map<string, Guest>(),
  tunnelUrl: makeTunnelUrl(20240517),
  hostKey: "" as string,
};

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export const mockApi = {
  /** POST /api/guest */
  async createGuest(seed = 20240517): Promise<{ guest: Guest; cookie: string }> {
    const t0 = performance.now();
    await delay(rnd);
    const existing = server.guests.get("me");
    const guest: Guest =
      existing ??
      (() => {
        const list = makeGuests(seed, 12);
        const g = list[0];
        server.guests.set("me", g);
        return g;
      })();
    const cookie = `ms_guest=${fakeSha256(`guest:${guest.id}`).slice(0, 32)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;
    logHttp({
      method: "POST",
      path: "/api/guest",
      status: 200,
      ms: Math.round(performance.now() - t0),
      bytes: 148,
      detail: `ms_guest cookie issued · ${guest.name}`,
    });
    return { guest, cookie };
  },

  /** PATCH /api/guest */
  async updateGuest(patch: Partial<Pick<Guest, "name" | "color">>): Promise<Guest> {
    const t0 = performance.now();
    await delay(rnd);
    const current = server.guests.get("me") ?? makeGuests(1, 1)[0];
    const guest: Guest = { ...current, ...patch };
    server.guests.set("me", guest);
    logHttp({
      method: "PATCH",
      path: "/api/guest",
      status: 200,
      ms: Math.round(performance.now() - t0),
      bytes: 64,
      detail: `profile updated · ${guest.name}`,
    });
    return guest;
  },

  /** POST /api/streams -> { id, hostKey } */
  async createStream(title = "Live from the mesh"): Promise<{ id: string; hostKey: string }> {
    const t0 = performance.now();
    await delay(rnd, 1.2);
    const id = nextId("st");
    // 32 bytes of host key, hex encoded — only the SHA-256 hash is stored.
    const hostKey = fakeSha256(`host:${id}:${rnd()}`).slice(0, 64);
    const hostKeyHash = fakeSha256(hostKey);
    server.streams.set(id, {
      id,
      hostKeyHash,
      title,
      state: "idle",
      startedAt: 0,
      peakViewers: 0,
    });
    server.hostKey = hostKey;
    logHttp({
      method: "POST",
      path: "/api/streams",
      status: 201,
      ms: Math.round(performance.now() - t0),
      bytes: 96,
      detail: `stream ${id} created · hostKey stored as sha256 only`,
    });
    return { id, hostKey };
  },

  /** POST /api/streams/:id/start — requires the host key. */
  async startStream(id: string, hostKey: string): Promise<{ ok: boolean; status: number; detail: string }> {
    const t0 = performance.now();
    await delay(rnd, 1.1);
    const stream = server.streams.get(id);
    if (!stream) {
      logHttp({ method: "POST", path: `/api/streams/${id}/start`, status: 404, ms: Math.round(performance.now() - t0), detail: "stream not found" });
      return { ok: false, status: 404, detail: "stream not found" };
    }
    if (fakeSha256(hostKey) !== stream.hostKeyHash) {
      logHttp({ method: "POST", path: `/api/streams/${id}/start`, status: 401, ms: Math.round(performance.now() - t0), detail: "host key rejected" });
      return { ok: false, status: 401, detail: "host key rejected" };
    }
    stream.state = "live";
    stream.startedAt = Date.now();
    logHttp({ method: "POST", path: `/api/streams/${id}/start`, status: 200, ms: Math.round(performance.now() - t0), bytes: 32, detail: "publish token minted · WHIP :8889" });
    return { ok: true, status: 200, detail: "live" };
  },

  /** POST /api/streams/:id/stop — requires the host key. */
  async stopStream(id: string, hostKey: string): Promise<{ ok: boolean; status: number; detail: string }> {
    const t0 = performance.now();
    await delay(rnd);
    const stream = server.streams.get(id);
    if (!stream) {
      logHttp({ method: "POST", path: `/api/streams/${id}/stop`, status: 404, ms: Math.round(performance.now() - t0), detail: "stream not found" });
      return { ok: false, status: 404, detail: "stream not found" };
    }
    if (fakeSha256(hostKey) !== stream.hostKeyHash) {
      logHttp({ method: "POST", path: `/api/streams/${id}/stop`, status: 401, ms: Math.round(performance.now() - t0), detail: "host key rejected" });
      return { ok: false, status: 401, detail: "host key rejected" };
    }
    stream.state = "ended";
    logHttp({ method: "POST", path: `/api/streams/${id}/stop`, status: 200, ms: Math.round(performance.now() - t0), detail: "recording finalized" });
    return { ok: true, status: 200, detail: "ended" };
  },

  /** GET /api/streams/live */
  async getLiveStreams(): Promise<StreamSummary[]> {
    const t0 = performance.now();
    await delay(rnd);
    const streams = makeLiveStreams(9137, 6);
    logHttp({ method: "GET", path: "/api/streams/live", status: 200, ms: Math.round(performance.now() - t0), bytes: 1420, detail: `${streams.length} live` });
    return streams;
  },

  /** GET /api/streams/:id/playback */
  async getPlayback(streamId: string, token?: string): Promise<PlaybackGrant> {
    const t0 = performance.now();
    await delay(rnd);
    if (token !== undefined && !token.startsWith("ms_playback_")) {
      logHttp({ method: "GET", path: `/api/streams/${streamId}/playback`, status: 403, ms: Math.round(performance.now() - t0), detail: "bad playback token" });
      throw Object.assign(new Error("forbidden"), { status: 403 });
    }
    const sig = fakeSha256(`${streamId}:${rnd()}`).slice(0, 24);
    const grant: PlaybackGrant = {
      streamId,
      playbackUrl: `/hls/${streamId}/index.m3u8?token=ms_playback_${sig}`,
      swarmToken: `ms_swarm_${fakeSha256(`swarm:${streamId}`).slice(0, 20)}`,
      expiresAt: Date.now() + 15 * 60 * 1000,
      manifestUrl: `/api/streams/${streamId}/manifest?token=ms_playback_${sig}`,
    };
    logHttp({ method: "GET", path: `/api/streams/${streamId}/playback`, status: 200, ms: Math.round(performance.now() - t0), bytes: 240, detail: "signed URL · 15 min TTL" });
    return grant;
  },

  /** GET /api/streams/:id/manifest */
  async getManifest(streamId: string, count = 18): Promise<ManifestEntry[]> {
    const t0 = performance.now();
    await delay(rnd, 1.3);
    const entries: ManifestEntry[] = [];
    const baseSeq = Math.floor(Date.now() / 400);
    for (let i = 0; i < count; i++) {
      const seq = baseSeq - i;
      const partId = `${streamId}/part-${seq}.m4s`;
      const hash = fakeSha256(partId);
      entries.push({
        partId,
        seq,
        durationMs: 400,
        bytes: 125000 + ((seq * 7919) % 24000),
        sha256: hash,
        signature: fakeSignature(hash),
      });
    }
    logHttp({
      method: "GET",
      path: `/api/streams/${streamId}/manifest`,
      status: 200,
      ms: Math.round(performance.now() - t0),
      bytes: count * 148,
      detail: `${count} parts · HMAC signed`,
    });
    return entries;
  },

  /** POST /api/streams/:id/telemetry */
  async postTelemetry(streamId: string, events: unknown[]): Promise<{ accepted: number }> {
    const t0 = performance.now();
    await delay(rnd, 0.7);
    logHttp({
      method: "POST",
      path: `/api/streams/${streamId}/telemetry`,
      status: 202,
      ms: Math.round(performance.now() - t0),
      bytes: events.length * 64,
      detail: `${events.length} events batched`,
    });
    return { accepted: events.length };
  },

  /** GET /api/media/health */
  async health(): Promise<{ ok: boolean; detail: string }> {
    const t0 = performance.now();
    await delay(rnd, 0.6);
    logHttp({ method: "GET", path: "/api/media/health", status: 200, ms: Math.round(performance.now() - t0), detail: "MediaMTX ll-hls ready" });
    return { ok: true, detail: "MediaMTX ll-hls ready · 400ms parts" };
  },

  /** POST /api/tunnel/rotate — Quick Tunnel URLs change on restart. */
  async rotateTunnel(): Promise<string> {
    const t0 = performance.now();
    await delay(rnd, 1.4);
    server.tunnelUrl = makeTunnelUrl(Math.floor(rnd() * 1e9));
    logHttp({ method: "POST", path: "/api/tunnel/rotate", status: 200, ms: Math.round(performance.now() - t0), detail: `new url · ${server.tunnelUrl}` });
    return server.tunnelUrl;
  },

  getTunnelUrl(): string {
    return server.tunnelUrl;
  },

  getHostKey(): string {
    return server.hostKey;
  },
};

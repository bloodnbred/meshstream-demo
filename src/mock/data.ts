/**
 * Seeded content generators: guests, chat, live-now streams, tunnel URLs.
 *
 * All names/colors/timestamps are derived from a seed so the demo looks
 * "alive" but stays reproducible. Nothing here is a real person.
 */
import { makeRng, hashString, type Rng } from "./rng";
import type { ChatMessage, Guest, StreamSummary } from "@/types";

/* ------------------------------------------------------------------ */
/* Guest identity                                                      */
/* ------------------------------------------------------------------ */

const ADJECTIVES = [
  "Quiet", "Amber", "Swift", "Neon", "Velvet", "Cobalt", "Ember", "Lunar", "Static", "Copper",
  "Ivory", "Drift", "Solar", "Hollow", "Pixel", "Aurora", "Crimson", "Nimbus", "Slate", "Golden",
];

const CREATURES = [
  "Falcon", "Kite", "Otter", "Moth", "Heron", "Lynx", "Wren", "Fox", "Marten", "Ibis",
  "Bison", "Tern", "Gecko", "Shrew", "Orca", "Pika", "Vole", "Crane", "Boar", "Mantis",
];

const COLORS = [
  "#C9F73A", "#3DDC97", "#5B9DFF", "#FFB020", "#FF5A5F", "#B48CFF", "#48D9D0", "#FF8FA3",
  "#9BE564", "#5CC8FF", "#F7A072", "#C77DFF", "#7CE38B", "#FF6B8A", "#8FA8FF", "#FFD166",
];

/** Generate a stable guest list for a given seed. */
export function makeGuests(seed: number, count: number): Guest[] {
  const rng = makeRng(seed);
  const used = new Set<string>();
  const guests: Guest[] = [];

  for (let i = 0; i < count; i++) {
    let name = "";
    let guard = 0;
    do {
      name = `${rng.pick(ADJECTIVES)}${rng.pick(CREATURES)}`;
      guard++;
    } while (used.has(name) && guard < 40);
    used.add(name);

    const color = COLORS[hashString(name) % COLORS.length];
    guests.push({
      id: `g_${(hashString(name) ^ (seed + i * 7919)).toString(36).slice(0, 8)}`,
      name,
      color,
      initials: name.slice(0, 2).toUpperCase(),
      role: "guest",
    });
  }
  return guests;
}

export function initialsFor(name: string): string {
  const clean = name.replace(/[^A-Za-z]/g, "");
  return clean.slice(0, 2).toUpperCase() || "??";
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

const CHAT_LINES = [
  "this is running on my parents' wifi and it still doesn't stutter",
  "wait the origin meter is down to 30%? that's the whole point",
  "p2p offload at 68% — my phone is literally the CDN now",
  "how is this not costing money",
  "the part hashes are signed? nice",
  "my uplink is 12 Mbps and it's serving 4 other people",
  "wait why did it fall back to origin just then",
  "glad the tab visibility check exists",
  "one tab in the background and the mesh rebalances instantly",
  "is there a TURN server? no? brave",
  "800ms packaging budget, that's the LL-HLS window",
  "chat is fast but the video is 3s behind, love the honesty",
  "first time a livestream scales with its own audience",
  "the origin guard just kicked in, it stopped handing out parents",
  "sha256 mismatch -> quarantine, that's the anti-freeze-bit feature",
  "been watching for 5 min, zero rebuffer",
  "is this on a tunnel? that's wild",
  "each peer keeps 60s of parts cached? that's like 15MB, fine",
  "my browser is now part of the CDN and I'm not even an engineer",
  "can we get a 480p rendition for cellular",
  "the re-parent took under one part interval, nice",
  "opus at 128k for voice, H264 2.5 for video, no transcode, elegant",
  "seeing 'Origin only · Safari' on my iPad, expected",
  "cloudflare quick tunnel URL changed again, the banner is clutch",
  "the latency budget breakdown is my favourite part of this",
  "we tried this with 40 viewers and the home uplink held",
];

export function makeChatHistory(seed: number, guests: Guest[], count = 24): ChatMessage[] {
  const rng = makeRng(seed);
  const now = Date.now();
  const out: ChatMessage[] = [];
  let t = now - count * 4200;

  for (let i = 0; i < count; i++) {
    const guest = guests[rng.int(0, guests.length - 1)];
    t += rng.int(1800, 5200);
    out.push({
      id: `m_${i}_${rng.int(1000, 9999)}`,
      guestId: guest.id,
      name: guest.name,
      color: guest.color,
      initials: guest.initials,
      body: rng.pick(CHAT_LINES),
      ts: t,
      role: i === 3 ? "host" : guest.role,
    });
  }
  return out;
}

/** A single new chat line, used by the live simulation. */
export function makeChatLine(seed: number, guests: Guest[]): ChatMessage {
  const rng = makeRng(seed);
  const guest = rng.pick(guests);
  return {
    id: `m_live_${rng.int(100000, 999999)}`,
    guestId: guest.id,
    name: guest.name,
    color: guest.color,
    initials: guest.initials,
    body: rng.pick(CHAT_LINES),
    ts: Date.now(),
    role: guest.role,
  };
}

/* ------------------------------------------------------------------ */
/* Live-now stream cards                                               */
/* ------------------------------------------------------------------ */

const TITLES = [
  "Building a peer-assisted CDN from a bedroom",
  "LL-HLS internals: parts, windows and latency",
  "Why we deleted our transcoding pipeline",
  "WebRTC data channels as a video distribution tree",
  "Free hosting on a home Windows box",
  "Hashing every part: integrity on a $0 budget",
  "Tuning a swarm for a 12 Mbps uplink",
  "The 1.6s deadline that saves your stream",
];

const CATEGORIES = ["Engineering", "Streaming", "Deep dive", "Build in public", "Systems", "Workshop"];

export function makeLiveStreams(seed: number, count = 6): StreamSummary[] {
  const rng = makeRng(seed);
  const now = Date.now();
  const out: StreamSummary[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: `st_${hashString(TITLES[i % TITLES.length]).toString(36)}`,
      title: TITLES[i % TITLES.length],
      category: CATEGORIES[i % CATEGORIES.length],
      hostName: `${rng.pick(ADJECTIVES)}${rng.pick(CREATURES)}`,
      viewers: rng.int(4, 240),
      thumbSeed: rng.int(1, 99999),
      startedAt: now - rng.int(60, 5400) * 1000,
      resolution: "1280x720",
      fps: 30,
      bitrateKbps: 2500,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Cloudflare Quick Tunnel URL                                         */
/* ------------------------------------------------------------------ */

const TUNNEL_ADJ = [
  "amber", "quiet", "lunar", "solar", "cobalt", "ember", "ivory", "neon", "drift", "velvet",
];
const TUNNEL_NOUN = [
  "falcon", "kite", "otter", "moth", "heron", "lynx", "wren", "fox", "tern", "boar",
];

export function makeTunnelUrl(seed: number): string {
  const rng = makeRng(seed);
  const parts = [rng.pick(TUNNEL_ADJ), rng.pick(TUNNEL_NOUN), rng.pick(TUNNEL_ADJ), rng.pick(TUNNEL_NOUN)];
  const suffix = rng.int(1000, 9999);
  return `https://${parts.join("-")}-${suffix}.trycloudflare.com`;
}

/* ------------------------------------------------------------------ */
/* Bits used by the fake camera test pattern                          */
/* ------------------------------------------------------------------ */

export const TEST_PATTERN_LABELS = [
  "1280x720 30fps",
  "H.264 2.5 Mbps",
  "Opus 128 kbps",
  "WHIP :8889",
  "LL-HLS 400ms",
];

export function guestPalette(): string[] {
  return COLORS;
}

export function makeRngFor(seed: number): Rng {
  return makeRng(seed);
}

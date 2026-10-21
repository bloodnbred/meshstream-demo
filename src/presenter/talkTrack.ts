/**
 * Presenter talk track.
 *
 * Notes for each section, sized for roughly 20–30 seconds of speaking.
 * The presenter overlay shows the current note in large type.
 */
import type { RouteId } from "@/types";

export interface TalkTrack {
  route: RouteId;
  title: string;
  /** The one-line caption shown big at the bottom of the screen. */
  caption: string;
  /** What to say — 20–30 seconds. */
  notes: string;
}

export const TALK_TRACK: TalkTrack[] = [
  {
    route: "hero",
    title: "Hook",
    caption: "The audience is the network.",
    notes:
      "Start with the claim, not the architecture. One creator goes live; every viewer becomes part of the delivery network. There is no account, no email and no paid infrastructure — one home Windows machine behind a free Cloudflare tunnel. Everything you will see runs locally in this tab, with simulated data.",
  },
  {
    route: "story",
    title: "The story",
    caption: "One camera → sliced into parts → relayed by the audience.",
    notes:
      "Walk the eight scenes quickly. The key beat is scene four: parts travel sideways, so the origin's egress falls from a hundred percent to about thirty percent. Scene five is the honest part — if a peer dies, its children re-parent and the origin covers the gap.",
  },
  {
    route: "studio",
    title: "The studio",
    caption: "Preflight, arm, countdown, on air.",
    notes:
      "Show the guarded sequence: a preflight checklist, an armed state, a three-two-one countdown, and then on-air mode where the only destructive action is End stream. Point at the origin guard meter — four point two of twelve megabits — and at the health score, which always comes with a plain-language fix.",
  },
  {
    route: "viewer",
    title: "The viewer",
    caption: "Sixty-eight percent from peers — and it says so when it cannot.",
    notes:
      "The swarm panel is the signature. It shows the share of bytes that came from peers, the mesh, and the source breakdown. Then point at the degradation ladder: when peer delivery is impossible, the UI says 'Direct connection unavailable' or 'Origin only'. We never fake peer traffic.",
  },
  {
    route: "simulator",
    title: "The simulator",
    caption: "Break it on purpose.",
    notes:
      "This is the interactive part. Raise the viewer count and watch the origin meter settle. Turn peer-to-peer off and watch egress spike past the twelve megabit cap. Kill thirty percent of the peers and watch the tree re-parent. The model is deterministic, so the same seed always produces the same run.",
  },
  {
    route: "architecture",
    title: "The architecture",
    caption: "Five services, one origin, one tunnel.",
    notes:
      "Browser studio, MediaMTX, the Fastify edge proxy, the signal server and Caddy as the single origin. Caddy routes everything on port 8080, so there is no CORS and only one TLS endpoint. Use 'follow a video part' to show the latency budget: 1.28 seconds of fixed pipeline plus 600 milliseconds of network.",
  },
  {
    route: "deepdive",
    title: "The deep dive",
    caption: "Source selection, upload policy, integrity.",
    notes:
      "Three things make peer delivery safe. First, source selection: cache, then the fastest peer, then the origin — with a hard 1.6 second deadline. Second, the upload policy: a peer only serves with more than 15 seconds buffered, a visible tab and healthy uplink. Third, integrity: SHA-256 verified before caching, two-source agreement, and quarantine on mismatch.",
  },
  {
    route: "proof",
    title: "The proof",
    caption: "What was actually verified, and what it costs.",
    notes:
      "Separate the two kinds of evidence. The gauges are simulation. The checklist is the real run: three viewer tabs playing, the signal tree reporting three peers and one edge, host auth rejected with 401, a bad playback token rejected with 403. And the cost of the whole thing is zero dollars.",
  },
  {
    route: "team",
    title: "The plan",
    caption: "One machine, six milestones, honest non-goals.",
    notes:
      "Wrap with the plan: six milestones over roughly ten to twelve weeks to a public beta. Be explicit about the non-goals — no accounts, no DRM, no mobile studio, no TURN in v1. Then name the next three things: TURN, a named tunnel, and a 480p rendition.",
  },
];

export function trackFor(route: RouteId): TalkTrack {
  return TALK_TRACK.find((t) => t.route === route) ?? TALK_TRACK[0];
}

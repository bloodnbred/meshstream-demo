/**
 * The eight scenes of the guided story.
 *
 * Each scene is one visual idea, one sentence of copy. The captions are
 * written to be read aloud by a presenter in about 20–30 seconds.
 */

export interface SceneDef {
  id: number;
  key: string;
  nav: string;
  title: string;
  caption: string;
  /** Extra line of detail shown in the corner of the stage. */
  detail?: string;
}

export const SCENES: SceneDef[] = [
  {
    id: 0,
    key: "hero",
    nav: "Hook",
    title: "The audience is the network.",
    caption: "Every viewer becomes part of the delivery network. One camera, one origin, thousands of parts.",
    detail: "Live video that travels light.",
  },
  {
    id: 1,
    key: "origin",
    nav: "One stream in",
    title: "One camera. One origin.",
    caption: "You publish 720p from your browser over WHIP — no account, no download, no server to rent.",
    detail: "WHIP :8889 → MediaMTX",
  },
  {
    id: 2,
    key: "sliced",
    nav: "Sliced",
    title: "Live video, cut into seconds.",
    caption: "The stream becomes 400 ms parts. Every part has an address and a SHA-256 hash, so nothing can lie about what it is.",
    detail: "fMP4 · 400 ms parts · 1 s segments · 7 segment window",
  },
  {
    id: 3,
    key: "swarm",
    nav: "Swarm forms",
    title: "The audience becomes the network.",
    caption: "Viewers attach to each other in a tree: the origin seeds three of them, and each one passes parts to a few more.",
    detail: "max 3 origin seeds · 1–2 parents · up to 4 children",
  },
  {
    id: 4,
    key: "travel",
    nav: "Parts travel",
    title: "Pieces travel sideways.",
    caption: "The origin seeds the swarm and then steps back. Its egress falls from 100 % to about 30 % of what it would have been.",
    detail: "origin egress 100 % → 30 %",
  },
  {
    id: 5,
    key: "safety",
    nav: "Safety net",
    title: "Always a safety net.",
    caption: "If a peer disappears, its children re-parent inside one part interval and the origin covers the gap until the tree heals.",
    detail: "re-parent ≤ 400 ms · origin covers",
  },
  {
    id: 6,
    key: "simulator",
    nav: "Try it",
    title: "Try it yourself.",
    caption: "Change the audience, kill a peer, saturate the origin, and watch the scheduler react. Everything runs locally.",
    detail: "Simulation — modeled on the live scheduler",
  },
  {
    id: 7,
    key: "cta",
    nav: "Go live",
    title: "Go live in your browser.",
    caption: "No account. No email. Thirty seconds from opening the tab to a public link.",
    detail: "$0 hosting · Cloudflare Quick Tunnel",
  },
];

export const SCENE_COUNT = SCENES.length;

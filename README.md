# MeshStream — Live Demo Experience

A **self-contained, fully offline** explainer + simulator for MeshStream, the
peer-assisted live streaming project.

> **DEMO MODE — simulated data modeled on the real scheduler.**
> There is no backend, no network request, no camera and no microphone. Every
> number, packet and protocol frame in this build is generated in the browser
> from a deterministic model of the real system.

```
The audience is the network.
Live video that travels light.
```

---

## Quick start

```bash
npm i
npm run dev          # http://127.0.0.1:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on `127.0.0.1:5173` |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build on `:4173` |
| `npm run build:single` | One self-contained `dist-single/index.html` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:offline` | Fails if the build contains any external URL |

### Single-file build

```bash
npm run build:single
# open dist-single/index.html — double click it, no server needed
```

Fonts, styles and the whole app are inlined into one HTML file
(~1 MB, including the three variable fonts). It works from `file://`, from a
USB stick, or from a static host.

---

## What is in here

Nine surfaces, one app, no server:

| Section | What it does |
|---|---|
| **Start** | Landing: node field that snaps into a mesh, live counters, live-now cards |
| **How it works** | The guided story — 8 scroll-driven scenes with a progress rail |
| **Studio** | The mock broadcast console: rail / sources / stage / inspector, preflight → armed → 3-2-1 → on air |
| **Viewer** | 16:9 player with a fake camera feed, live chat and the signature swarm panel |
| **Simulator** | Origin + up to 50 peers. Kill peers, saturate the origin, corrupt a part, break the network |
| **Architecture** | Every service and port, with a "follow a video part" tracer |
| **P2P deep dive** | Source selection with the 1.6 s deadline, the protocol player, upload policy, integrity, host key |
| **Proof** | SLO dashboard, the verified real-run checklist, cost, free-tier limits, risks |
| **Team** | Stack, milestones M0–M5, non-goals, what is next |

Plus **presenter tools** (press `P`): big captions, a talk track, a timer, a
laser pointer and a hands-free 3-minute auto-play tour.

### Keyboard map

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `?` | Command palette / shortcuts |
| `P` | Presenter mode |
| `G` | Dev console (network inspector) |
| `Esc` `Esc` | Panic reset |
| `M` `V` `S` `R` `L` `C` `F` | Studio: mic, camera, screen, record, go live, chat, fullscreen |
| `←` `→` | Story: previous / next scene |
| `↑` `↓` | Presenter: previous / next section |
| `T` | Presenter: start / stop the auto-play tour |

---

## The model (and why it is honest)

The demo runs a **deterministic swarm engine** (`src/engine/swarm.ts`) that
re-implements the rules from the real project plan:

- The origin is the root of a distribution tree with mesh repair.
- At most **3 direct seed children** of the origin.
- Every peer has **1–2 parents** and up to **4 children**; the tree stays
  shallow (max depth 4) and children are spread across parents.
- A peer may only serve when: buffer > 15 s, tab visible, uplink < 70 %,
  not metered, healthy contribution score (tit-for-tat).
- Per-part source selection: local cache → best peer (lowest p95) → origin,
  with a hard deadline of ~1.6 s and then immediate origin fallback.
- The origin guard stops granting origin parents above **12 Mbps** egress and
  emits `swarm:saturated`.
- Offload is measured as peer bytes ÷ total viewer bytes; the origin egress
  meter counts the bytes the edge proxy actually pushes (including the three
  seed streams and cache misses).
- Latency is the real budget: capture 33 + encode 80 + WHIP 120 + packaging
  900 + network/P2P 600 + decode 150 ms, plus saturation penalties.

The engine runs on a fixed 100 ms tick from a seeded RNG (`mulberry32`), so
**the same seed always produces the same run**. The demo opens on a warmed-up
swarm (45 s of simulated time) so the first frame already looks like a live
stream rather than a cold start.

Everything is labelled. The Proof page keeps two kinds of evidence apart:
the gauges are *simulation*, the "verified end-to-end" checklist is quoted
from the **real run** against the production build, Caddy and a public
Cloudflare Quick Tunnel.

### Mock backend

`src/mock/` imitates the real API surface with fake latency and real status
codes:

```
POST   /api/guest                 -> signed ms_guest cookie
PATCH  /api/guest                 -> name, colour
POST   /api/streams               -> { id, hostKey }        (host key stored as sha256 only)
POST   /api/streams/:id/start     -> 401 when the host key does not match
POST   /api/streams/:id/stop      -> 401 when the host key does not match
GET    /api/streams/live          -> landing page data
GET    /api/streams/:id/playback  -> signed URL + swarm token (403 on a bad token)
GET    /api/streams/:id/manifest  -> HMAC-signed SHA-256 part manifest
POST   /api/streams/:id/telemetry -> batched client events
GET    /api/media/health          -> MediaMTX ll-hls status
POST   /api/tunnel/rotate         -> a new Quick Tunnel URL
```

Every call and every simulated WebSocket frame is recorded in the **dev
console** drawer (press `G`): HTTP status, latency, byte counts, and the raw
protocol frames (`hello`, `assign`, `have`, `want`, `data`, `cancel`, `nack`,
`quarantine`, `ping`, `pong`).

---

## Project structure

```
demo/
├─ index.html               entry document (no external references)
├─ vite.config.ts           dev + single-file build targets
├─ scripts/check-offline.mjs
├─ public/favicon.svg
└─ src/
   ├─ main.tsx  App.tsx    shell: routing, tick loop, global keys, panic reset
   ├─ styles/globals.css   design tokens, base layer, keyframes
   ├─ types/               shared domain + wire types
   ├─ mock/                rng · data · api · signal · netlog · protocol
   ├─ engine/              swarm engine · telemetry · stores · hooks
   ├─ components/
   │  ├─ ui/               buttons, panels, meters, controls, states, charts
   │  ├─ layout/           nav, command palette, dev console, toasts, background
   │  ├─ mesh/             SVG + canvas renderers, geometry, logo
   │  ├─ swarm/            the signature swarm panel
   │  └─ media/            the simulated camera test pattern
   ├─ pages/               hero, story, studio, viewer, simulator,
   │                       architecture, deep dive, proof, team
   ├─ scenes/              the 8 guided-story scenes + rail
   └─ presenter/           talk track, auto-play tour, presenter overlay
```

---

## How this demo maps to the real MeshStream

| Demo surface | Real system |
|---|---|
| Simulator swarm canvas | `packages/swarm` scheduler + the headless 50-peer harness |
| Source selection flowchart | The custom hls.js fragment loader (cache → peer → origin, 1.6 s deadline) |
| Upload policy checklist | `packages/swarm` upload policy + tit-for-tat scoring |
| Protocol player | The shared `packages/protocol` message set over the `ws` signal server |
| Integrity walkthrough | The edge proxy's signed manifest + SHA-256 verification + quarantine |
| Host key flow | `POST /api/streams` → `{ id, hostKey }`, only the SHA-256 hash stored |
| Studio | The real studio: WHIP publish, preflight, on-air mode, health score, origin guard |
| Viewer swarm panel | The real viewer: P2P ring, mesh, source breakdown, honest degradation |
| Architecture explorer | The real topology: MediaMTX, Fastify edge proxy, `ws` signal, Caddy, cloudflared |
| Proof page | The SLO table and the verified-run checklist from the project README |

The one thing the demo does **not** do is pretend the traffic is real. Every
surface that shows a number says where the number comes from.

---

## Offline guarantee

- No CDN, no remote fonts, no remote images, no `fetch`/`XHR` to a remote host.
- Fonts are vendored locally (`src/assets/fonts/`, latin subset, variable).
- Every visual is SVG, CSS or `<canvas>`.
- `npm run check:offline` scans `dist/` and `dist-single/` for any absolute
  `http(s)` URL and fails the build if one survives.

## Accessibility & performance

- 2 px lime focus rings, full keyboard navigation, `aria-live` status region.
- `prefers-reduced-motion` is respected: the story falls back to a complete
  written version with a "Play animations" button.
- Projector mode (`⌘` toolbar) bumps the base font size for rooms.
- Transform/opacity-only animations; the 50-peer mesh renders on `<canvas>`
  at 60 fps while React only refreshes the numeric readouts at 10 Hz.

---

## Deploying to GitHub Pages

```bash
npm run build
```

Push the `dist/` output with the included GitHub Actions workflow
(`.github/workflows/pages.yml`): it builds the app and publishes it to
GitHub Pages on every push to `main`. Enable **Settings → Pages → Source →
GitHub Actions** once, then the site is live at
`https://<user>.github.io/<repo>/`.

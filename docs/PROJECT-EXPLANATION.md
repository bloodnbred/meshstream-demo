# MeshStream — Project Explanation & Presentation Guide
### A computer-networking perspective on peer-assisted live streaming

> Use this document to prepare your defence. Section 1 is the 30-second version.
> Sections 2–10 explain *what is actually happening on the wire* in the language
> of your networking syllabus. Section 11 is the run-of-show. Section 12 is
> question prep.
>
> Companion artefacts: `plan.md` (architecture source of truth),
> `README.md` (operations + verified-run evidence),
> `demo/` (the live, fully offline explainer you can demo in the browser).

---

## 1. The 30-second version

MeshStream is a browser-based live streaming system where **the audience is the
delivery network**.

A creator publishes a single 720p H.264 stream from a browser. Instead of the
origin server pushing that stream to every viewer (which is exactly how CDNs
burn money), the viewers pass the video to *each other* over WebRTC data
channels. The origin only needs to **seed** the swarm and **cover failures**.

- **One camera. One origin. No accounts. $0 hosting.**
- The whole system runs on a single home Windows machine behind a free
  Cloudflare Quick Tunnel.
- Tagline: *Live video that travels light.*

---

## 2. The problem: egress is the entire cost of video streaming

This is the context your professor will care about, so lead with it.

A live stream to N viewers is **N times** the bitrate of the stream. At 720p30
and 2.5 Mbps video + 0.112 Mbps Opus, one viewer costs **2.612 Mbps** of
origin egress:

```
origin egress  =  N viewers  ×  2.612 Mbps
N = 30          →  78.4 Mbps
```

A home uplink is 10–40 Mbps. A residential connection cannot sustain that, and
a cloud CDN bills exactly that number. So the engineering problem is:

> **Deliver the same bytes to 30 viewers while the origin only pushes a few
> streams, without the viewer seeing a stall.**

MeshStream's answer is an **application-level overlay**: the viewers are the
relay nodes. The origin's job changes from *delivering* to *seeding*.

This is the same idea behind CDN tiering, P2P CDNs (e.g. historical BitTorrent
rendezvous/peer-assisted platforms), and modern P2P delivery extensions —
but implemented over WebRTC data channels with a real integrity story.

---

## 3. The two networks (overlay vs underlay)

This framing is the single most useful mental model for the whole project.

```
        ┌──────────────── UNDERLAY (the real Internet) ────────────────┐
        │                                                            │
        │   viewers ──HTTPS/WSS──▶ Cloudflare edge ──▶ tunnel ──▶ Caddy :8080
        │                                        │                      │
        │   viewers ══WebRTC/UDP (direct, peer-to-peer)══════════════╗ │
        └──────────────────────────────────────────────────────────║─┘
                                                                   ║
        ┌──────────────── OVERLAY (the mesh) ──────────────────────╨─┐
        │   viewer → parent peer → child peer → …                    │
        │   the overlay carries the *same* fMP4 parts the origin made │
        └────────────────────────────────────────────────────────────┘
```

| | Underlay | Overlay |
|---|---|---|
| **Paths** | HTTPS/WSS through the Cloudflare tunnel | WebRTC data channels, direct UDP |
| **Carries** | playlists, control, fallback parts, telemetry | the bulk of the video parts |
| **Topology** | client → edge → origin (star) | peer tree (rooted at the origin) |
| **Bypasses the tunnel?** | no | **yes** — peer traffic never touches Cloudflare |

**The key consequence:** the tunnel's request cap (200 in-flight requests per
Quick Tunnel) only applies to the underlay. As the swarm warms up, most video
bytes stop using the underlay at all.

---

## 4. The publish path, end to end

```
Creator browser ──WHIP──▶ MediaMTX ──LL-HLS──▶ API edge proxy ──▶ Caddy :8080
   1280x720@30             (remux only)      (sign, count, hash)     │
   H.264 2.5 Mbps                                                      │
   Opus 128 kbps                                                       ▼
                                                        viewers (hls.js + P2P loader)
```

### 4.1 Capture and encode
- `getUserMedia` / `getDisplayMedia` at **1280×720, 30 fps**.
- The browser's encoder produces **H.264 ~2.5 Mbps** + **Opus 96–128 kbps**.
- **No transcoding anywhere.** MediaMTX *remuxes* the browser's H.264 into
  fMP4 directly. This is the single most important decision for running on a
  home box: transcoding 720p30 is CPU-expensive, remuxing is nearly free.
- The studio caps the bitrate with `RTCRtpSender.setParameters` and watches
  `getStats()` — a basic congestion-control loop: if the uplink is short, you
  lower the ceiling rather than drop frames.

### 4.2 WHIP publish
- **WHIP** = WebRTC-HTTP Egress Protocol. The browser publishes over a
  WebRTC session to MediaMTX's WebRTC listener on **:8889**.
- WHIP is used because it is the *same* stack as the P2P data channels
  (DTLS + ICE + SCTP), so no second transport stack is needed.
- MediaMTX mints a **short-lived media JWT** for the publish path, bound to
  the stream — the host key authorises the publish, not the URL.

### 4.3 LL-HLS packaging
MediaMTX config (the real one):

```yaml
hls: yes
hlsAddress: :8888
hlsVariant: lowLatency
hlsSegmentDuration: 1s
hlsPartDuration: 400ms   # fewer requests; respects the tunnel cap
hlsSegmentCount: 7       # 7 s DVR window
hlsAlwaysRemux: yes
```

**What a "part" is:** an LL-HLS *partial segment* — a 400 ms slice of the
current 1 s segment, delivered as CMAF/fMP4. The player can start decoding a
part before the segment is finished. That is where the latency win comes from.

**The trade-off (a classic networking trade-off you can explain):**

| Part duration | Requests/sec/viewer | Latency floor | Tunnel load |
|---|---|---|---|
| 200 ms | 5.0 | ~200 ms | very high |
| **400 ms** | **2.5** | **~400 ms** | **moderate** |
| 1 s (classic HLS) | 1.0 | ~1–3 s | low |

400 ms is the compromise the project picked: it roughly halves the request rate
versus 200 ms while keeping the latency floor at half a second.

The **7-segment window** is the DVR/replay buffer. It bounds how stale a
playlist can be and how much the origin must retain. It also bounds **how far
behind a peer may be** before it is told to sync to the live edge instead of
backfilling (see §6.4).

### 4.4 The API edge proxy (`:4000`)
HLS does **not** go straight to MediaMTX. Every playlist/part request passes
through the Fastify API, because that proxy is where the system's guarantees
live:

1. **Token check** — the playback URL carries a short-lived HMAC token bound to
   stream + session. Bad token → **403**. No token → **401** on host routes.
2. **Byte counting** — every byte that leaves the origin is counted. This is
   the offload metric, and it is the origin guard's input.
3. **Hashing** — each published part is SHA-256 hashed; the hashes are exposed
   in a **short-lived HMAC-signed manifest window** that peers can verify
   against.
4. **Cache headers + request coalescing** — the same part requested by many
   peers at once is served once from cache.

This makes the origin an **origin shield**: it is the only component that ever
touches the tunnel, so the accounting is complete.

### 4.5 Caddy — one origin, one TLS endpoint (`:8080`)

| Route | Target |
|---|---|
| `/` | web (Next.js) `:3000` |
| `/api/*` | API `:4000` |
| `/ws/*` | signal `:4001` |
| `/hls/*` | media `:8888` |
| `/whip/*` | media `:8889` |

Everything is **same-origin**, so there is no CORS to configure and only one
TLS certificate. Peer traffic never touches Caddy at all.

---

## 5. The P2P overlay: why a tree and not a mesh

This is the section your professor will probe hardest. Be precise.

### 5.1 Full mesh vs distribution tree

A **full mesh** between N peers has N(N−1)/2 connections. At N = 30 that is
**435 connections**, each needing a WebRTC handshake (STUN + ICE + DTLS +
SCTP association). A new joiner would have to negotiate with 29 peers.

A **rooted distribution tree** with branching factor *b* needs **N − 1 edges**
and depth **log_b(N)**.

```
full mesh, N=30 :  435 connections, depth 1 (but n² handshakes)
tree, b=4, N=30 :   29 connections,  depth 3
```

The tree is chosen because of **uplink asymmetry**, which is the real
constraint:

> A home connection has a fast download (hundreds of Mbps) and a slow upload
> (10–40 Mbps). A viewer's *uplink* is the scarce resource that the overlay
> spends. A tree spends each viewer's uplink **once** (to its children), not
> once per peer.

### 5.2 The exact topology rules (from the plan)

| Rule | Value | Why |
|---|---|---|
| Origin's direct children | **≤ 3** ("seeds") | The origin must stream 3 full copies; more would multiply its egress |
| Parents per peer | **1–2** | Redundancy against a parent dying, without doubling relay traffic |
| Children per peer | **≤ 4** | Caps how much a single home uplink is asked to serve |
| Depth | shallow (≤ 4) | Keeps tail latency down; deep chains add hop-by-hop delay |
| Verified cache per peer | **~60 s** of parts | Enough to serve children that are slightly behind, without unbounded RAM/disk |
| Part interval | **400 ms** | Re-parenting deadline unit |

**Fan-out math (worth doing on the board):** with 3 seeds and branching factor 4,
the tree covers `3 + 3·4 + 3·4² + 3·4³ + …` viewers. Depth 4 covers
**3 + 12 + 48 + 192 + 768 ≈ 1023** viewers structurally. The binding
constraint is therefore **not** the topology — it is **the home uplink budget**.

### 5.3 Mesh repair and re-parenting
- Children hold **1–2 parents**, so a single parent failure does not orphan
  anyone.
- On churn, children **re-parent within one part interval (400 ms)** — the
  failure-detection timeout is the same order as the reconfiguration time.
  This is like LACP link failover: detect fast, converge fast.
- If no peer can take a child, **the origin covers the gap** until the tree
  heals. The stream never stops; only the offload ratio dips.
- The **signal server** (`:4001`, Node + `ws`) is the coordinator: it assigns
  parents/children, relays SDP/ICE, validates every frame against swarm
  membership, heartbeats every 25 s (to survive the tunnel's idle timeout),
  and broadcasts `swarm:saturated` when the origin guard trips.

### 5.4 WebRTC data channels — and why there are two

Each peer pair gets **two channels**:

| Channel | Configuration | Carries |
|---|---|---|
| `control` | **reliable, ordered** | `hello`, `assign`, `have`, `want`, `cancel`, `nack`, `quarantine`, `ping/pong` |
| `data` | **unordered, no retransmission** | `data` frames carrying part bytes |

Why two? This is the same split as TCP vs UDP, applied at the application
layer:

- **Control must be reliable and ordered.** A `want` that arrives after the
  `data` is useless. Retransmission is desirable here — the messages are tiny.
- **Data must not be.** Head-of-line blocking is fatal for live video: if one
  chunk is lost, waiting for its retransmission stalls every later chunk,
  even though later parts are more valuable (they are closer to live). Instead
  the **part-level deadline** handles loss: a missing chunk means the part
  misses its 1.6 s deadline, the request is cancelled, and the part is taken
  from the origin. **Loss becomes a deadline miss, not a stall.**

**Chunking:** parts are sent in **16 KiB chunks**. That is a balance:
- Large enough that per-chunk header overhead is negligible.
- Small enough that `bufferedAmountLowThreshold` backpressure works — the
  sender can check the SCTP send buffer and stop before it grows without
  bound (a classic flow-control problem, solved by the WebRTC API for you).

**Transport stack (bottom-up):**

```
application frames (have/want/data)
        │
     SCTP  ← reliable (control) / unordered+unreliable (data)
        │
     DTLS  ← end-to-end encryption + integrity, per hop
        │
     ICE  ← connectivity checks, candidate gathering
        │
   STUN / UDP  ← NAT traversal, direct path
```

**NAT traversal (be ready for this question):**
- **STUN** discovers the public reflexive address.
- **ICE** races candidates (host, server-reflexive, peer-reflexive) to find a
  working pair — this is the "happy eyeballs" of NAT traversal.
- **UDP hole punching** works when both peers are behind NATs that allow
  outbound traffic to create the mapping — true for the vast majority of
  home routers.
- **Symmetric NAT** breaks hole punching. There is **no TURN in v1**: those
  viewers simply stay **origin-only**, and the UI says so honestly
  (`Direct connection unavailable`). A TURN relay is explicitly listed as
  future work — it costs money and adds a bottleneck, so it is only worth it
  once you know the affected population.

---

## 6. The core algorithm: source selection per part

**This is the intellectual heart of the project.** Every 400 ms part is
resolved independently by every viewer.

```
  ┌───────────────┐   hit?
  │ 1. LOCAL CACHE│──────────────▶ done (0 ms)
  └───────┬───────┘
          │ miss
  ┌───────▼────────┐  best peer by lowest p95, answers within deadline?
  │ 2. BEST PEER   │──────────────▶ done (~300–600 ms)
  └───────┬────────┘
          │ no peer has it, or the 1.6 s deadline expired
  ┌───────▼────────┐
  │ 3. ORIGIN      │──────────────▶ done (always allowed)
  └────────────────┘
```

### 6.1 The hard deadline
A part has a **hard deadline of ~1.6 s** from the moment it is requested
(≈ 4 × the part interval). If a peer has not delivered by then:

1. The peer request is **cancelled** (`cancel` frame).
2. The part is fetched from the **origin** immediately.

The deadline is the **tail-latency insurance policy**. It converts an
unbounded wait (a peer that stalls, a congested path) into a bounded, known
cost (origin bytes + ~250 ms extra latency).

> **Design invariant, stated in the plan:** *"The player must never stall
> because P2P was attempted; added rebuffering versus origin-only is a release
> blocker."*
>
> This is the correct engineering call. P2P saves **money and origin capacity**;
> it must never cost the viewer **quality**.

### 6.2 Why "lowest p95" and not "lowest RTT"
The choice is made on the **p95 fetch time**, not the mean RTT. The mean hides
the tail; the tail is what causes a deadline miss and therefore an origin
fallback. Selecting on p95 directly optimises for the thing you actually care
about: **not falling back**.

### 6.3 Cache hit rate
Each peer keeps ~60 s of **verified** parts. That is the "hot cache" that
makes relaying possible: when a peer is asked for a part it received 2 s ago,
it answers instantly. The cache is also why the *first* seconds of a fresh
swarm are origin-heavy — peers simply do not have anything to serve yet.

### 6.4 Staleness policy
A peer more than ~4 s behind is told to **sync to the live edge** rather than
backfill. Backfilling a 30-second-old part is wasted bandwidth: the viewer
needs the live edge, not completeness. This is a **TTL / staleness** policy
borrowed from distributed cache invalidation.

---

## 7. Upload policy and fairness

A peer is only allowed to serve a part when **all** of these hold:

| Policy | Value | Networking meaning |
|---|---|---|
| Buffer depth | **> 15 s** | Enough queued data to absorb jitter and serve children that lag; also a proxy for "I am actually receiving" |
| Tab visibility | **visible** | A backgrounded tab is throttled and may not be receiving; it must not serve |
| Uplink utilisation | **< 70 %** | Congestion guard — don't add traffic to a link that is already busy (this is the anti-bufferbloat rule) |
| Metered connection | **not metered** | Respect the user's data plan |
| Contribution score | **healthy** | Tit-for-tat fairness |

### 7.1 Tit-for-tat
A peer's **contribution score** rises when it serves children and decays when
it does not. Parents are chosen partly by contribution, so **reliable
relayers become preferred parents**. This is the classic tit-for-tat /
reciprocity heuristic used in BitTorrent: it punishes pure free-riders
(degrade them toward origin-only) **without punishing weak devices** (a
slow-but-honest peer is not "cheating", it just scores lower).

### 7.2 The origin guard
The edge proxy counts egress bytes per second. If egress exceeds the
configured upstream budget (**default 12 Mbps**):

1. The API **stops granting new origin parents** (no more seeds).
2. The swarm is told to **rebalance** (`swarm:saturated` frame).
3. The studio shows **"Origin saturated"**.
4. The UI **prefers higher latency over rebuffering** — new viewers may wait,
   but existing streams are protected.

This is a **circuit breaker with a graceful degradation path**: shed load
before collapsing.

---

## 8. Integrity, security and access control

### 8.1 The problem
If viewers can serve video to each other, a malicious viewer can serve
**corrupt or malicious bytes** and poison the stream for everyone downstream.

### 8.2 The defence in depth

| Layer | Mechanism | Purpose |
|---|---|---|
| Transport | **DTLS** on every data channel | Confidentiality + integrity in transit, hop-to-hop |
| Access | **Short-lived HMAC-signed playback URLs** | Capability-based access; a peer only ever sees URLs the viewer already has |
| Manifest | **HMAC-signed SHA-256 manifest window** | The origin publishes the authoritative hash of every part |
| Verification | **SHA-256 verified before caching** | A part that does not match is **discarded, never cached, never relayed** |
| First sight | **2-source agreement** | A part seen for the first time needs **quorum (2 of N)** before it is trusted |
| Enforcement | **Quarantine** the sender | The offending peer stops serving; its children re-parent |

**Two-source agreement** is a quorum/consensus idea: a single source can lie,
but two independent sources agreeing makes a targeted attack expensive. It is
the same reasoning as Byzantine-fault tolerance: tolerate *t* faulty sources
with *t+1* agreement.

### 8.3 Identity: no accounts at all
- **Guest identity**: first request → a signed **`ms_guest`** cookie
  (HttpOnly, SameSite=Lax, 30 days) carrying an id, a generated display name
  (`QuietFalcon`, `AmberKite`) and a colour. Viewing never prompts for a name.
- **Host control**: creating a stream returns a **32-byte host key**. The
  server stores **only the SHA-256 hash**; the key lives in the browser's
  local storage. Host actions require the `x-host-key` header — a wrong key
  gets **401**. Losing the key loses control: streams are *ephemeral by design*.
- **Abuse defence** without accounts: per-IP rate limits on stream creation,
  chat and signalling; hashed IPs; optional Turnstile; signed cookies; no PII.

### 8.4 The protocol message set
| Message | Direction | Purpose |
|---|---|---|
| `hello` | viewer → signal | Announce guest id + capabilities (`parts`, `safari`) |
| `assign` | signal → viewer | Your parents and children (the tree) + ICE servers |
| `have` | peer ↔ peer | Bitmap of which parts this peer already holds |
| `want` | viewer → peer | "I need part X, my deadline is T" |
| `data` | peer → viewer | Part bytes in 16 KiB chunks with an offset |
| `cancel` | viewer → peer | Deadline expired — stop sending |
| `nack` | viewer → peer | This part is bad (hash mismatch) |
| `quarantine` | viewer → signal | The sender is a liar; stop trusting it |
| `ping`/`pong` | both | Keepalive (25 s) + RTT measurement |

---

## 9. Latency engineering: the budget

This is the table to put on the board. Every millisecond of glass-to-glass
latency is accounted for:

| Stage | Budget | What happens |
|---|---|---|
| Capture | **33 ms** | One frame at 30 fps |
| Encode | **80 ms** | H.264 encoder pipeline |
| WHIP publish | **120 ms** | WebRTC transport to MediaMTX |
| Packaging | **900 ms** | LL-HLS part duration + segment assembly + playlist reload |
| Network / P2P | **600 ms** | Physical path, underlay **or** peer-to-peer hop |
| Decode | **150 ms** | Decoder + render |
| **Total** | **≈ 1.88 s fixed** | + jitter → **2.5–4 s glass-to-glass target** |

**Where the latency actually lives:** packaging dominates (900 ms). This is
why LL-HLS exists: classic HLS cannot go below ~3–6 s because a whole segment
must be produced and published before a client can start on it. Partial
segments (parts) cut that wait to 400 ms.

**Why 600 ms for "network/P2P":** a peer hop is *not* automatically cheaper
than the origin. It saves **origin bandwidth and money**, and it removes one
hop from the *origin's* bill, but the packet still crosses the internet twice
(peer→peer instead of origin→peer). The honest framing: **P2P optimises cost
and origin capacity, not necessarily latency.** The demo shows both paths'
latency explicitly rather than pretending otherwise.

---

## 10. Failure modes and fault tolerance

| Failure | Detection | Response |
|---|---|---|
| Peer disconnects | ICE/DTLS close, or heartbeat timeout | Children **re-parent within 400 ms**; origin covers the gap meanwhile |
| Peer sends a corrupt part | SHA-256 mismatch at the receiver | Discard (never cache), `nack`, **quarantine** the sender, re-parent children |
| Data channel never connects | ICE fails / timeout | Viewer stays **origin-only**; UI says "Direct connection unavailable" |
| Tab backgrounded | `document.visibilityState` | Peer stops serving; children rebalance; browser may throttle timers |
| Origin saturated | Edge proxy byte counter > 12 Mbps | Stop granting origin parents, `swarm:saturated`, studio shows "Origin saturated" |
| Origin offline | Signal/API heartbeat | Player enters a **reconnect state**; stream ends after a grace period |
| Safari / iOS | Capability detection | Native HLS, P2P off, UI states **"Origin only · Safari"** |

**The honest-degradation ladder** (a great thing to point out in the viewer
panel):

```
68 % from peers  →  Direct connection unavailable  →  Origin only
```

The UI **never claims peer traffic that did not happen**. This is the same
discipline as the real product's visual principles: *"If P2P is off, the UI
says Origin — never a fake peer count."*

---

## 11. Free-tier networking constraints (and why they shape the design)

Running on a home machine for $0 means living inside someone else's limits:

| Constraint | Impact | Design response |
|---|---|---|
| Cloudflare Quick Tunnel URL rotates on restart | Shared links die | Always show the **current** URL in the studio; named tunnel later |
| **200 in-flight requests** per tunnel | Bursts → 429 | 400 ms parts (2.5 req/s/viewer), P2P-first, caching, request coalescing |
| No SSE support | — | WebSockets only |
| No uptime guarantee | Stream can drop | Local recovery, auto-restart services, LAN fallback URL |
| Home upload 10–40 Mbps | Origin is the bottleneck | 720p single rendition, 3 seeds, origin guard, tree topology |
| Device must stay awake | Downtime | Windows services (NSSM), power plan, boot auto-start, health pages |
| No free TURN | Some pairs cannot connect | Those viewers stay origin-only |

**Cost table (for the "is it really free?" question):**

| Item | Cost |
|---|---|
| Hosting | **$0** (your own device) |
| Cloudflare Quick Tunnel | **$0** |
| STUN | **$0** |
| Domain (optional, stable link) | ~$10–12 / year |
| TURN (optional, later) | free tiers or a small VPS |
| Recording storage | local disk, ~1.1 GB/hour at 2.5 Mbps |

---

## 12. Run-of-show for your defence

Use the **demo** (`demo/`, also live at the GitHub Pages URL) as your visual
aid. Map each section to the talking point:

| # | Demo section | Show this | Say this |
|---|---|---|---|
| 1 | **Start** | Node field snapping into a mesh; live counters | "One creator, every viewer becomes the network." |
| 2 | **How it works** | The 8 scenes; pause on **Scene 4** (parts travel, egress falls 100 %→30 %) and **Scene 5** (peer dies, children re-parent, origin covers) | The whole architecture in 90 seconds |
| 3 | **Studio** | Preflight → Go live → 3-2-1 → **ON AIR**; point at the **origin guard meter** (4.2 / 12 Mbps) and the **health score** with its plain-language fix | "Guarded sequence, and the number that matters on a home connection." |
| 4 | **Viewer** | The **swarm panel**: ring, mesh, source bar; then force "Origin only" and show the honest message | "68 % of the bytes came from peers — and when it can't, it says so." |
| 5 | **Simulator** | Raise viewers to 30; toggle **P2P off** (egress spikes, guard trips); **kill 30 %** (tree re-parents); **corrupt a part** (quarantine) | "Break it on purpose." Deterministic seed → reproducible. |
| 6 | **Architecture** | Click nodes; hit **"Follow a video part"** for the latency stack | Every service, every port, one latency budget |
| 7 | **P2P deep dive** | The **source-selection** widget (turn off "peer answers within the deadline" → watch 1.6 s expire → origin fallback); the **protocol player**; the **upload policy** sliders; **host key** flow with the 401 | The algorithm, the policy and the security model |
| 8 | **Proof** | SLO gauges, then the **verified checklist**, then the cost table | Simulation vs real-run evidence, kept separate on purpose |

**Two rules for the demo:**
1. Say out loud that it is **DEMO MODE — simulated data modeled on the real
   scheduler**. The Proof page separates *simulation* from the *quoted real run*.
   Examiners respect honesty about scope far more than a smooth demo.
2. **Presenter mode** (`P`) gives you big captions, a talk track and a
   3-minute auto-play tour with captions — use it for the long version.

---

## 13. Question prep

**"Why not just use a normal CDN / HLS?"**
Because the cost of video delivery is egress, and a CDN charges for exactly
the bytes we are trying to avoid sending. We still *use* a CDN-like edge
(origin shield + tunnel + caching) — we just move the **last mile** onto the
audience.

**"Isn't this just a WebRTC SFU?"**
No — an SFU **forwards media on a server**; the server still handles every
viewer's media. Here the **clients forward to each other**, and the origin
only seeds 3 peers. The server cost drops from O(N) to O(1).

**"Why not a full mesh between viewers?"**
O(N²) connections and handshakes, and — more importantly — it multiplies
every viewer's upload by N. The tree spends each uplink once.

**"What if a peer is malicious?"**
SHA-256 against an HMAC-signed manifest, verified *before* caching; first-seen
parts need two-source agreement; a mismatch quarantines the sender. The
origin never trusts a peer for a part it has not verified.

**"What about NATs and symmetric NAT?"**
STUN + ICE + UDP hole punching handles the common case. Symmetric NATs fail
to punch through; those viewers stay origin-only and the UI says so. TURN is
future work because it costs money and re-introduces a bottleneck.

**"How do you measure p95 latency?"**
Client-side telemetry (join time, latency-to-live, rebuffer count, source
breakdown) is batched and POSTed to `/api/streams/:id/telemetry`; the demo's
dev console (`G`) shows the same traffic.

**"Is 55 % offload enough to matter?"**
At 30 viewers it is the difference between ~78 Mbps of origin egress (impossible
on a home link) and ~10 Mbps (feasible). The real run showed **21 % via peers**
on a small, fresh swarm through the tunnel — the honest number, because a cold
swarm has nothing to serve yet. Offload climbs as caches warm.

**"Why no ABR ladder?"**
Ladder = more CPU (transcoding) and more origin egress. v1 is a single 720p
rendition remuxed from the browser's own encoder. 480p is future work.

**"What are the weak points?"**
No TURN (symmetric NAT → origin-only), no multi-origin failover, tunnel URL
rotation, no accounts so abuse defence is rate-limiting only, and P2P adds a
tail-latency risk that the deadline mitigates but cannot eliminate.

**"What would you do next?"**
TURN for the blocked population; a named Cloudflare Tunnel for a stable
hostname; a 480p rendition for cellular; multi-origin failover; and — the
research-interesting one — replacing the simple "lowest p95" parent choice
with a cost-aware scheduler that also considers uplink headroom and
contribution history.

---

## 14. Glossary (networking terms used above)

| Term | Meaning here |
|---|---|
| **Overlay** | The logical peer-to-peer network layered on top of the Internet |
| **Underlay** | The real IP network the overlay rides on |
| **Distribution tree** | Rooted tree topology: 1–2 parents, ≤4 children per node |
| **Branching factor** | Children per node (here ≤ 4) |
| **Seed** | A viewer directly attached to the origin (≤ 3) |
| **Part / partial segment** | A 400 ms slice of an fMP4 segment (LL-HLS) |
| **DVR window** | The 7-segment (~7 s) playlist window |
| **Staleness / TTL** | "Sync to the live edge" instead of backfilling old parts |
| **Tail latency (p95)** | The 95th-percentile delay — what determines deadline misses |
| **Head-of-line blocking** | Waiting for a lost chunk stalls later chunks (why the data channel is unordered) |
| **Backpressure** | `bufferedAmountLowThreshold` stops the sender before its buffer explodes |
| **Bufferbloat** | Excess buffering adds latency; the 70 % uplink rule prevents it |
| **Bandwidth-delay product** | How much data must be in flight to fill the pipe; why peers need a real buffer |
| **NAT traversal** | STUN + ICE + UDP hole punching; TURN is the relay fallback |
| **DTLS / SCTP / ICE** | The WebRTC stack: encryption, transport, connectivity |
| **Quorum / 2-source agreement** | Two independent sources must agree before a first-seen part is trusted |
| **Capability URL** | A signed URL that *is* the permission |
| **Origin shield** | The edge proxy that terminates all origin traffic so accounting is complete |
| **Circuit breaker** | The origin guard: shed load (stop seeding) before collapsing |
| **Amplification** | One origin copy fanned out to many viewers |

---

## 15. Honest limitations — say these out loud

1. No TURN in v1 → symmetric-NAT viewers are origin-only.
2. No multi-origin failover; if the home machine sleeps, the stream stops.
3. Quick Tunnel URLs rotate; shared links die on restart.
4. No accounts → abuse defence is rate limits, signed cookies and hashed IPs.
5. Offload depends on buffer warmth and network timing; a fresh swarm is
   mostly origin-served (the real run: 21 %).
6. Safari/iOS has no P2P → explicitly labelled "Origin only".
7. The demo you have is a **model**, not the real system: it reimplements the
   documented rules, but the numbers it shows are simulated.

---

### Where to look in the code

| Thing | File |
|---|---|
| The swarm rules (topology, offload, guard) | `demo/src/engine/swarm.ts` |
| The mock API + status codes | `demo/src/mock/api.ts` |
| Protocol frames + dev console | `demo/src/mock/netlog.ts`, `demo/src/mock/protocol.ts` |
| Latency budget + SLOs | `demo/src/pages/ProofPage.tsx`, `demo/src/pages/DeepDivePage.tsx` |
| Source-selection widget (the core algorithm) | `demo/src/pages/DeepDivePage.tsx` |
| The full architecture plan | `plan.md` |
| Operations, ports, verified run | `README.md` |

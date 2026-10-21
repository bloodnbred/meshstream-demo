import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Panel, SectionLabel } from "@/components/ui/Panel";
import { LatencyStack, type BudgetSegment } from "@/components/charts/Charts";
import { useAppStore } from "@/engine/store";

interface ArchNode {
  id: string;
  label: string;
  sub: string;
  tech: string;
  port?: string;
  responsibility: string;
  x: number;
  y: number;
  w: number;
  kind: "app" | "media" | "infra" | "client";
}

const NODES: ArchNode[] = [
  {
    id: "studio",
    label: "Browser Studio",
    sub: "Next.js 15 · React 19",
    tech: "Next.js 15 + React 19 + Tailwind v4 + Radix + Motion",
    port: ":3000",
    responsibility:
      "Camera/screen capture, WHIP publish, track replacement, local recording, room health, chat and the command palette.",
    x: 110,
    y: 120,
    w: 150,
    kind: "app",
  },
  {
    id: "mediamtx",
    label: "MediaMTX",
    sub: "ingest + packaging",
    tech: "MediaMTX (single binary)",
    port: ":8889 WHIP · :8888 HLS",
    responsibility:
      "Accepts the WHIP publish, remuxes the browser's H.264 straight into LL-HLS (400 ms fMP4 parts, 1 s segments, 7 segment window) and writes the local recording. No transcoding.",
    x: 350,
    y: 120,
    w: 160,
    kind: "media",
  },
  {
    id: "api",
    label: "API edge proxy",
    sub: "Fastify + SQLite",
    tech: "Fastify + SQLite (WAL)",
    port: ":4000",
    responsibility:
      "Guest cookies, stream lifecycle, signed playback tokens, the HLS edge proxy (byte counting + SHA-256 part hashes), chat persistence and telemetry batches.",
    x: 600,
    y: 120,
    w: 160,
    kind: "app",
  },
  {
    id: "caddy",
    label: "Caddy",
    sub: "single origin",
    tech: "Caddy",
    port: ":8080",
    responsibility:
      "One public origin. / → web :3000, /api → API :4000, /ws → signal :4001, /hls → media :8888, /whip → media :8889. Same origin means no CORS and one TLS endpoint.",
    x: 850,
    y: 120,
    w: 150,
    kind: "infra",
  },
  {
    id: "cloudflared",
    label: "cloudflared",
    sub: "Quick Tunnel",
    tech: "cloudflared",
    port: "public HTTPS/WSS",
    responsibility:
      "The only public entrypoint. Free HTTPS and WebSockets with no account. The URL rotates on every restart — the studio always shows the current one.",
    x: 1090,
    y: 120,
    w: 150,
    kind: "infra",
  },
  {
    id: "signal",
    label: "Signal server",
    sub: "swarm coordinator",
    tech: "Node + ws",
    port: ":4001",
    responsibility:
      "Assigns parents and children, relays SDP/ICE, validates every frame against swarm membership, heartbeats every 25 s and tells the swarm when the origin is saturated.",
    x: 350,
    y: 320,
    w: 160,
    kind: "app",
  },
  {
    id: "sqlite",
    label: "SQLite",
    sub: "WAL + local disk",
    tech: "node:sqlite",
    port: "./data/meshstream.db",
    responsibility:
      "Guests, streams, chat messages, view sessions, recordings and telemetry events. WAL mode, in-process state for the rest.",
    x: 600,
    y: 320,
    w: 160,
    kind: "infra",
  },
  {
    id: "peer",
    label: "Peer relay",
    sub: "WebRTC data channel",
    tech: "WebRTC · DTLS · 16 KiB chunks",
    port: "direct UDP (bypasses the tunnel)",
    responsibility:
      "Every viewer that has a warm cache and a healthy upload policy serves parts to up to four children. Two channels per pair: control (reliable) and data (unordered).",
    x: 850,
    y: 320,
    w: 150,
    kind: "client",
  },
  {
    id: "viewer",
    label: "Viewer",
    sub: "hls.js + P2P loader",
    tech: "hls.js with a custom P2P fragment loader",
    port: "browser",
    responsibility:
      "Picks the source per part: local cache, then the fastest peer, then the origin. Verifies SHA-256 before caching and keeps about 60 s of verified parts.",
    x: 1090,
    y: 320,
    w: 150,
    kind: "client",
  },
];

interface ArchEdge {
  from: string;
  to: string;
  label: string;
  kind: "media" | "control" | "p2p" | "tunnel";
  path?: string;
}

const EDGES: ArchEdge[] = [
  { from: "studio", to: "mediamtx", label: "WHIP publish", kind: "media" },
  { from: "mediamtx", to: "api", label: "LL-HLS 400 ms parts", kind: "media" },
  { from: "api", to: "caddy", label: "signed URLs", kind: "tunnel" },
  { from: "caddy", to: "cloudflared", label: "HTTPS / WSS", kind: "tunnel" },
  { from: "cloudflared", to: "viewer", label: "playlist + parts", kind: "tunnel", path: "M1165 165 L1165 295" },
  { from: "studio", to: "signal", label: "presence + chat", kind: "control", path: "M185 165 L185 295 L270 295" },
  { from: "viewer", to: "signal", label: "hello / assign / have / want", kind: "control", path: "M1015 295 L430 295" },
  { from: "api", to: "sqlite", label: "persist", kind: "control" },
  { from: "viewer", to: "peer", label: "WebRTC data channel", kind: "p2p" },
  { from: "peer", to: "viewer", label: "16 KiB chunks", kind: "p2p", path: "M1015 355 L995 355" },
];

const KIND_COLOR: Record<ArchEdge["kind"], string> = {
  media: "#C9F73A",
  control: "#5B9DFF",
  p2p: "#3DDC97",
  tunnel: "#6A7280",
};

/**
 * Architecture explorer.
 *
 * Every service, every port, every responsibility — with a mode that traces
 * one video part from the camera all the way to the decoder.
 */
export function ArchitecturePage() {
  const [selected, setSelected] = useState<ArchNode | null>(NODES[0]);
  const [hover, setHover] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const setRoute = useAppStore((s) => s.setRoute);

  const byId = useMemo(() => new Map(NODES.map((n) => [n.id, n])), []);

  const partPath = useMemo(() => {
    const ids = ["studio", "mediamtx", "api", "caddy", "cloudflared", "viewer"];
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  }, [byId]);

  const [token, setToken] = useState<{ x: number; y: number; label: string } | null>(null);
  const [budget, setBudget] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!follow) {
      setToken(null);
      setBudget(0);
      return;
    }
    let start = performance.now();
    const duration = 5200;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Walk the polyline of node centres.
      const segments = partPath.length - 1;
      const scaled = t * segments;
      const index = Math.min(segments - 1, Math.floor(scaled));
      const local = scaled - index;
      const a = partPath[index];
      const b = partPath[index + 1];
      const x = a.x + (b.x - a.x) * local;
      const y = a.y + (b.y - a.y) * local;
      setToken({ x, y, label: a.label });
      setBudget(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        setTimeout(() => {
          setFollow(false);
        }, 1200);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [follow, partPath]);

  const segments: BudgetSegment[] = [
    { label: "capture", ms: 33, color: "#3DDC97" },
    { label: "encode", ms: 80, color: "#C9F73A" },
    { label: "WHIP", ms: 120, color: "#FFB020" },
    { label: "packaging", ms: 900, color: "#5B9DFF" },
    { label: "network / P2P", ms: 600, color: "#B48CFF" },
    { label: "decode", ms: 150, color: "#9AA1AE" },
  ];

  const shownSegments = useMemo(() => {
    if (!follow || budget <= 0) return segments;
    const total = segments.reduce((s, x) => s + x.ms, 0);
    let acc = 0;
    return segments.map((seg) => {
      const from = acc / total;
      acc += seg.ms;
      const to = acc / total;
      const fill = Math.max(0, Math.min(1, (budget - from) / (to - from)));
      return { ...seg, ms: Math.round(seg.ms * fill) };
    });
  }, [segments, follow, budget]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">architecture</div>
          <h1 className="display text-[26px] leading-tight">Every service, every port.</h1>
          <p className="mt-1 max-w-[68ch] text-[12.5px] leading-relaxed text-text-2">
            One creator browser, one media server, one API, one signal server and one tunnel. The audience relays to each other directly over
            UDP — peer traffic never touches the tunnel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={follow ? "primary" : "secondary"} onClick={() => setFollow((f) => !f)}>
            {follow ? "Tracing part…" : "Follow a video part"}
          </Button>
        </div>
      </header>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="overflow-hidden" dense>
          <div className="relative w-full" style={{ aspectRatio: "1250 / 470" }}>
            <svg viewBox="0 0 1250 470" className="h-full w-full" aria-label="Service architecture diagram">
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 z" fill="#6A7280" />
                </marker>
              </defs>

              {/* Edges */}
              {EDGES.map((edge) => {
                const a = byId.get(edge.from)!;
                const b = byId.get(edge.to)!;
                const d =
                  edge.path ??
                  `M${a.x + a.w / 2},${a.y} C${a.x + a.w / 2},${(a.y + b.y) / 2} ${b.x + b.w / 2},${(a.y + b.y) / 2} ${b.x + b.w / 2},${b.y}`;
                const active = hover === edge.from || hover === edge.to || selected?.id === edge.from || selected?.id === edge.to;

                // Label anchor: the midpoint of the endpoints, nudged off the line.
                const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
                const lx = (a.x + b.x) / 2 + (vertical ? 62 : 0);
                const ly = (a.y + b.y) / 2 + (vertical ? 0 : -8);

                return (
                  <g key={`${edge.from}-${edge.to}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={KIND_COLOR[edge.kind]}
                      strokeOpacity={active ? 0.9 : 0.34}
                      strokeWidth={active ? 1.8 : 1.2}
                      strokeDasharray={edge.kind === "p2p" ? "6 4" : undefined}
                      markerEnd="url(#arrow)"
                      style={edge.kind === "p2p" ? { animation: "dash-march 1400ms linear infinite" } : undefined}
                    />
                    {active && (
                      <text
                        x={lx}
                        y={ly}
                        textAnchor="middle"
                        className="num"
                        fontSize="9.5"
                        fill="var(--color-text-2)"
                        style={{ paintOrder: "stroke", stroke: "var(--color-bg-1)", strokeWidth: 4 }}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {NODES.map((node) => {
                const isSel = selected?.id === node.id;
                const isHover = hover === node.id;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x - node.w / 2},${node.y})`}
                    onMouseEnter={() => setHover(node.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setSelected(node)}
                    style={{ cursor: "pointer" }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelected(node);
                    }}
                  >
                    <rect
                      width={node.w}
                      height={62}
                      rx={11}
                      fill="#101318"
                      stroke={isSel ? "#C9F73A" : isHover ? "#323947" : "#232833"}
                      strokeWidth={isSel ? 1.6 : 1}
                    />
                    <rect width={node.w} height={2} rx={1} fill={node.kind === "client" ? "#3DDC97" : node.kind === "media" ? "#C9F73A" : "#323947"} />
                    <text x={node.w / 2} y={28} textAnchor="middle" fontSize="12" fill="#ECEEF2" fontWeight="600" fontFamily="Inter Tight Variable, sans-serif">
                      {node.label}
                    </text>
                    <text x={node.w / 2} y={44} textAnchor="middle" fontSize="9.5" fill="#6A7280" fontFamily="JetBrains Mono Variable, monospace">
                      {node.port ?? node.sub}
                    </text>
                  </g>
                );
              })}

              {/* Traced part token */}
              {token && (
                <g>
                  <circle cx={token.x} cy={token.y} r={14} fill="#C9F73A" opacity={0.16} />
                  <circle cx={token.x} cy={token.y} r={5} fill="#C9F73A" />
                  <circle cx={token.x} cy={token.y} r={9} fill="none" stroke="#C9F73A" strokeWidth={1.4} opacity={0.7} />
                </g>
              )}
            </svg>

            <div className="absolute bottom-3 left-3 flex flex-wrap gap-3">
              {(
                [
                  ["media", "media path"],
                  ["control", "control"],
                  ["p2p", "peer-to-peer (bypasses the tunnel)"],
                  ["tunnel", "through the tunnel"],
                ] as [ArchEdge["kind"], string][]
              ).map(([kind, label]) => (
                <span key={kind} className="inline-flex items-center gap-1.5 text-[10px] text-text-3">
                  <span className="h-[2px] w-5 rounded-full" style={{ background: KIND_COLOR[kind] }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-3">
          <Panel title={selected?.label ?? "Select a node"} dense>
            {selected ? (
              <div className="p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={selected.kind === "client" ? "ok" : selected.kind === "media" ? "accent" : "muted"}>
                    {selected.kind}
                  </Badge>
                  {selected.port && <span className="num text-[10.5px] text-text-3">{selected.port}</span>}
                </div>
                <p className="text-[12.5px] leading-relaxed text-text-2">{selected.responsibility}</p>
                <div className="mt-3 border-t border-line pt-2.5">
                  <div className="eyebrow mb-1">built with</div>
                  <div className="text-[11.5px] text-text-2">{selected.tech}</div>
                </div>
              </div>
            ) : (
              <div className="px-3.5 py-6 text-center text-[11.5px] text-text-3">Hover or click any node in the diagram.</div>
            )}
          </Panel>

          <Panel title="Latency budget" dense>
            <div className="p-3.5">
              <SectionLabel right={<span className="num text-[10.5px] text-text-3">target 2.5–4 s</span>}>
                one part, end to end
              </SectionLabel>
              <LatencyStack segments={shownSegments} total={1883} height={24} />
              <div className="mt-3 space-y-1 border-t border-line pt-2.5">
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-text-3">fixed pipeline</span>
                  <span className="num text-text-2">1 283 ms</span>
                </div>
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-text-3">network / P2P</span>
                  <span className="num text-text-2">600 ms</span>
                </div>
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-text-3">glass-to-glass</span>
                  <span className="num text-accent">2.5–4 s p95</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Routing table" dense>
            <ul className="num text-[11px]">
              {[
                ["/", "web :3000"],
                ["/api/*", "API :4000"],
                ["/ws/*", "signal :4001"],
                ["/hls/*", "media :8888"],
                ["/whip/*", "media :8889"],
              ].map(([route, target]) => (
                <li key={route} className="flex justify-between border-b border-line/60 px-3.5 py-1.5 last:border-b-0">
                  <span className="text-accent">{route}</span>
                  <span className="text-text-3">{target}</span>
                </li>
              ))}
              <li className="flex justify-between border-b border-line/60 px-3.5 py-1.5">
                <span className="text-ok">peer ↔ peer</span>
                <span className="text-text-3">direct UDP</span>
              </li>
            </ul>
            <div className="border-t border-line p-3">
              <Button size="sm" variant="secondary" onClick={() => setRoute("deepdive")}>
                How a part is chosen →
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

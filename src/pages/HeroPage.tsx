import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import { Logo } from "@/components/mesh/Logo";
import { FIELD_H, FIELD_W, makeField, makeFieldEdges } from "@/scenes/field";
import { engine } from "@/engine/swarm";
import { useSimStore } from "@/engine/simStore";
import { useAppStore } from "@/engine/store";
import { mockApi } from "@/mock/api";
import { useCountUp } from "@/engine/hooks";
import { round } from "@/lib/format";
import type { StreamSummary } from "@/types";

/**
 * Landing page.
 *
 * A node field snaps into a mesh and then into the glyph, while the live
 * counters below tick with the simulated swarm.
 */
export function HeroPage() {
  const setRoute = useAppStore((s) => s.setRoute);
  const setLiveStreams = useAppStore((s) => s.setLiveStreams);
  const liveStreams = useAppStore((s) => s.liveStreams);
  const tick = useSimStore((s) => s.tick);

  const nodes = useMemo(() => makeField(52, 3), []);
  const edges = useMemo(() => makeFieldEdges(), []);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    engine.setViewers(18);
    engine.setP2p(true);
    void mockApi.getLiveStreams().then(setLiveStreams);
  }, [setLiveStreams]);

  const metrics = engine.state.metrics;
  const offload = useCountUp(metrics.offloadPct, 900, mounted);
  const originMbps = useCountUp(metrics.originMbps, 900, mounted);
  const peers = useCountUp(metrics.peers, 900, mounted);

  return (
    <div className="relative">
      {/* Node field */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden">
        <svg viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} className="h-full w-full" aria-hidden>
          <g opacity={0.9} style={{ transition: "opacity 1200ms ease 1600ms" }}>
            {edges.map((edge, i) => {
              const a = nodes[edge.a % nodes.length];
              const b = nodes[edge.b % nodes.length];
              if (!a || !b) return null;
              return (
                <line
                  key={i}
                  x1={a.tx}
                  y1={a.ty}
                  x2={b.tx}
                  y2={b.ty}
                  stroke="#1A1E26"
                  strokeWidth={1}
                />
              );
            })}
          </g>

          {nodes.map((n) => (
            <circle
              key={n.id}
              cx={0}
              cy={0}
              r={n.r}
              fill="#C9F73A"
              className="node-field"
              style={
                {
                  "--sx": `${n.sx}px`,
                  "--sy": `${n.sy}px`,
                  "--tx": `${n.tx}px`,
                  "--ty": `${n.ty}px`,
                  "--gx": `${n.gx}px`,
                  "--gy": `${n.gy}px`,
                  "--delay": `${n.delay}ms`,
                  "--op": n.opacity * 0.55,
                  "--s0": 0.3,
                  transformBox: "view-box",
                } as React.CSSProperties
              }
            />
          ))}
        </svg>
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-[1240px] px-5 pb-16 pt-20 lg:px-6 lg:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="max-w-[720px]"
        >
          <div className="mb-5 flex items-center gap-3">
            <Logo size={30} />
            <DemoBadge />
          </div>

          <h1 className="display text-[clamp(34px,6.2vw,74px)] leading-[0.98] text-text-1">
            The audience is the
            <br />
            <span className="text-accent text-glow">network.</span>
          </h1>

          <p className="mt-5 max-w-[54ch] text-[15px] leading-relaxed text-text-2">
            Live video that travels light. One creator goes live; every viewer relays parts to a few others over WebRTC. No accounts, no paid
            infrastructure — a single home Windows machine behind a free Cloudflare Quick Tunnel.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <Button variant="primary" size="lg" magnetic onClick={() => setRoute("story")}>
              Start guided demo
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setRoute("simulator")}>
              Open simulator
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setRoute("studio")}>
              Watch the studio
            </Button>
          </div>

          {/* Stat ticker */}
          <div className="mt-10 grid max-w-[620px] grid-cols-3 gap-3">
            <TickerTile label="from peers" value={`${round(offload, 0)}%`} tone="accent" />
            <TickerTile label="origin egress" value={`${round(originMbps, 1)} Mbps`} tone="default" />
            <TickerTile label="peers in swarm" value={`${round(peers, 0)}`} tone="default" />
          </div>

          <p className="mt-3 text-[10.5px] text-text-3">
            Simulated counters from the demo scheduler — not a real stream.
          </p>
        </motion.div>

        {/* Live now */}
        <section className="mt-20">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="eyebrow mb-1">live now</div>
              <h2 className="display text-[20px]">Streams on the demo origin</h2>
            </div>
            <Badge tone="muted">{liveStreams.length || 6} live</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(liveStreams.length ? liveStreams : []).map((stream, i) => (
              <StreamCard key={stream.id} stream={stream} index={i} onOpen={() => setRoute("viewer")} />
            ))}
            {liveStreams.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass h-[132px] animate-pulse" />
              ))}
          </div>
        </section>

        {/* What it is */}
        <section className="mt-20 grid gap-3 md:grid-cols-3">
          <InfoCard
            title="One origin, no accounts"
            body="The creator publishes 720p H.264 from a browser over WHIP. MediaMTX remuxes it into LL-HLS with 400 ms parts. Guests watch with a signed cookie — no sign-up, ever."
            accent="origin"
          />
          <InfoCard
            title="Viewers relay to viewers"
            body="Peers form a distribution tree: the origin seeds at most three of them, each peer has one or two parents and up to four children, and every peer keeps about 60 s of verified parts."
            accent="mesh"
          />
          <InfoCard
            title="Honest about failure"
            body="Dead peers re-parent inside one part interval. Corrupt parts are caught by SHA-256 and quarantine the sender. Safari says 'origin only' because that is exactly what happens."
            accent="guard"
          />
        </section>

        <p className="mt-10 text-[11px] text-text-3">
          <span className="num">Tick {tick}</span> · the demo scheduler keeps running in the background no matter which section you are in.
        </p>
      </div>
    </div>
  );
}

function TickerTile({ label, value, tone }: { label: string; value: string; tone: "accent" | "default" }) {
  return (
    <div className="glass glass-strong px-3.5 py-3">
      <div className="eyebrow mb-1">{label}</div>
      <div className={`num text-[24px] font-semibold leading-none ${tone === "accent" ? "text-accent" : "text-text-1"}`}>{value}</div>
    </div>
  );
}

function StreamCard({ stream, index, onOpen }: { stream: StreamSummary; index: number; onOpen: () => void }) {
  const hue = (stream.thumbSeed % 360);
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      onClick={onOpen}
      className="glass glass-strong group overflow-hidden text-left transition-colors hover:border-accent/40"
    >
      <div
        className="relative aspect-video overflow-hidden"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 42% 14%), hsl(${(hue + 48) % 360} 38% 9%))`,
        }}
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(70% 60% at 25% 30%, rgba(201,247,58,.22), transparent 62%), radial-gradient(60% 70% at 78% 72%, rgba(91,157,255,.16), transparent 60%)",
          }}
        />
        <div className="num absolute bottom-1.5 right-2 text-[9.5px] text-text-2">{stream.resolution}</div>
        <span className="absolute left-2 top-2 rounded-[4px] bg-live/90 px-1.5 py-[2px] text-[9px] font-bold uppercase tracking-[0.1em] text-white">
          live
        </span>
      </div>
      <div className="p-3">
        <div className="truncate text-[12.5px] font-medium text-text-1 group-hover:text-accent">{stream.title}</div>
        <div className="mt-1 flex items-center justify-between text-[10.5px] text-text-3">
          <span>{stream.hostName}</span>
          <span className="num">{stream.viewers} watching</span>
        </div>
      </div>
    </motion.button>
  );
}

function InfoCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: "origin" | "mesh" | "guard";
}) {
  const icon = { origin: "◉", mesh: "⑂", guard: "⛉" }[accent];
  return (
    <Panel className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[14px] text-accent">{icon}</span>
        <h3 className="text-[13.5px] font-semibold text-text-1">{title}</h3>
      </div>
      <p className="text-[12px] leading-relaxed text-text-3">{body}</p>
    </Panel>
  );
}

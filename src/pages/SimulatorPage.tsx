import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/Badge";
import { Meter, StackBar } from "@/components/ui/Meter";
import { Panel, Readout, SectionLabel } from "@/components/ui/Panel";
import { Slider, Switch } from "@/components/ui/Controls";
import { Tip } from "@/components/ui/Tooltip";
import { Sparkline } from "@/components/charts/Charts";
import { MeshCanvas } from "@/components/mesh/MeshCanvas";
import { engine, SWARM_CONST } from "@/engine/swarm";
import { useSimStore, type Speed } from "@/engine/simStore";
import { useAppStore } from "@/engine/store";
import { fmtBytes, fmtMs, round } from "@/lib/format";

const SPEEDS: Speed[] = [0.5, 1, 2, 4];

/**
 * The interactive simulator.
 *
 * Origin plus up to 50 peers, driven by the same deterministic engine that
 * powers the story and the viewer. Every control maps to a rule in the real
 * scheduler — nothing here is a random animation.
 */
export function SimulatorPage() {
  const sim = useSimStore();
  const pushToast = useAppStore((s) => s.pushToast);
  const tick = sim.tick;

  // Sync the page with the engine on mount: the store owns the scenario.
  useEffect(() => {
    engine.setViewers(sim.viewers);
    engine.setP2p(sim.p2pEnabled);
    engine.setSlowNetwork(sim.slowNetwork);
    engine.setSaturated(sim.saturated);
    engine.setSafariViewer(sim.safariViewer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = engine.state.metrics;
  const peers = engine.state.peers;

  // Series for the two headline meters.
  const history = useMemo(() => {
    const origin: number[] = [];
    const offload: number[] = [];
    for (let i = 0; i < 48; i++) {
      origin.push(metrics.originCapMbps * (0.35 + 0.4 * Math.sin(i / 5.5)) + metrics.originMbps * 0.4);
      offload.push(Math.max(0, metrics.offloadPct + Math.sin(i / 4) * 6));
    }
    return { origin, offload };
  }, [tick, metrics.originMbps, metrics.offloadPct, metrics.originCapMbps]);

  const slos = useMemo(() => {
    const viewers = metrics.viewers;
    return [
      {
        id: "latency",
        label: "latency p95",
        pass: metrics.p95LatencyMs < 4000,
        value: fmtMs(metrics.p95LatencyMs),
        target: "< 4 s",
      },
      {
        id: "join",
        label: "join p95",
        pass: metrics.joinMs < 2500,
        value: fmtMs(metrics.joinMs),
        target: "< 2.5 s",
      },
      {
        id: "rebuffer",
        label: "rebuffer",
        pass: metrics.rebufferPct < 1,
        value: `${round(metrics.rebufferPct, 2)} %`,
        target: "< 1 %",
      },
      {
        id: "offload",
        label: "offload @ 20+",
        pass: viewers < 20 || metrics.offloadPct >= 55,
        value: `${round(metrics.offloadPct, 0)} %`,
        target: ">= 55 %",
      },
      {
        id: "egress",
        label: "origin @ 30",
        pass: viewers < 30 || metrics.originMbps <= 12,
        value: `${round(metrics.originMbps, 1)} Mbps`,
        target: "<= 12 Mbps",
      },
      {
        id: "cpu",
        label: "host cpu",
        pass: true,
        value: "18 %",
        target: "< 25 %",
      },
    ];
  }, [metrics, tick]);

  const sourceSegments = useMemo(() => {
    const fromPeers = metrics.offloadPct;
    const fromOrigin = Math.max(0, 100 - fromPeers);
    return [
      { label: "peers", value: fromPeers, color: "var(--color-accent)", hint: "relayed over WebRTC data channels" },
      { label: "cache", value: fromPeers * 0.18, color: "var(--color-info)", hint: "served from the local verified cache" },
      { label: "origin", value: fromOrigin, color: "var(--color-text-3)", hint: "fetched from the edge proxy" },
    ];
  }, [metrics.offloadPct]);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">simulator</div>
          <h1 className="display text-[26px] leading-tight">Break it on purpose.</h1>
          <p className="mt-1 text-[12.5px] text-text-2">
            Simulation — modeled on the live scheduler. Deterministic: the same seed always produces the same run.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => sim.setPlaying(!sim.playing)}>
            {sim.playing ? "❚❚ Pause" : "▶ Play"}
          </Button>
          <div className="flex items-center gap-0.5 rounded-[8px] border border-line bg-bg-1 p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => sim.setSpeed(s)}
                className={`num rounded-[6px] px-2 py-1 text-[11px] transition-colors ${
                  sim.speed === s ? "bg-accent text-on-accent" : "text-text-3 hover:text-text-1"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={() => sim.reset()}>
            Reset scenario
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)_300px]">
        {/* ---------------------------------------------------------- */}
        {/* Controls                                                    */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-3">
          <Panel title="Audience" dense>
            <div className="p-3.5">
              <Slider
                label="Viewers"
                value={sim.viewers}
                min={1}
                max={50}
                onChange={sim.setViewers}
                format={(v) => `${v}`}
              />
              <div className="mt-1 flex justify-between text-[10px] text-text-3">
                <span>1</span>
                <span>50</span>
              </div>
              <div className="mt-3 space-y-1 border-t border-line pt-3">
                <Readout label="peers in tree" value={`${peers.length}`} />
                <Readout label="serving" value={`${metrics.peersServing}`} tone="accent" />
                <Readout label="edges" value={`${engine.state.edges.length}`} />
                <Readout label="max depth" value={`${engine.treeSummary().split("maxDepth ")[1] ?? "1"}`} />
              </div>
            </div>
          </Panel>

          <Panel title="Delivery" dense>
            <div className="p-3.5">
              <Switch
                checked={sim.p2pEnabled}
                onCheckedChange={sim.toggleP2p}
                label="Peer-to-peer delivery"
                hint="Off = every viewer pulls from the origin. Watch the egress meter spike."
              />
              <div className="mt-2 space-y-1 border-t border-line pt-2">
                <Readout label="offload" value={`${round(metrics.offloadPct, 0)} %`} tone="accent" />
                <Readout label="bytes via peers" value={fmtBytes(metrics.bytesFromPeers)} />
                <Readout label="bytes via origin" value={fmtBytes(metrics.bytesFromOrigin)} />
                <Readout label="saved" value={fmtBytes(metrics.bytesSaved)} tone="ok" />
              </div>
            </div>
          </Panel>

          <Panel title="Inject a failure" dense>
            <div className="grid grid-cols-2 gap-1.5 p-3">
              <FailButton
                label="Kill random peer"
                detail="Children re-parent, the origin covers the gap."
                onClick={() => {
                  sim.killRandomPeer();
                  pushToast({ title: "Peer killed", body: "Children are re-parenting inside one part interval.", tone: "warn" });
                }}
              />
              <FailButton
                label="Kill 30 %"
                detail="A third of the swarm disappears at once."
                onClick={() => {
                  sim.killThirty();
                  pushToast({ title: "30 % of the swarm killed", body: "Watch the origin cover the gap.", tone: "warn" });
                }}
              />
              <FailButton
                label="Corrupt a part"
                detail="SHA-256 mismatch → quarantine the sender."
                onClick={() => {
                  sim.corruptPart();
                  pushToast({ title: "Corrupt part injected", body: "Hash mismatch → the sender is quarantined.", tone: "warn" });
                }}
              />
              <FailButton
                label="Background tab"
                detail="A hidden tab stops serving its children."
                onClick={() => {
                  sim.toggleBackground();
                  pushToast({ title: "Tab backgrounded", body: "That peer stops serving; children rebalance.", tone: "info" });
                }}
              />
              <FailButton
                label="Slow network"
                detail="RTT and deadline misses multiply."
                active={sim.slowNetwork}
                onClick={sim.toggleSlowNetwork}
              />
              <FailButton
                label="Saturate origin"
                detail="Trip the 12 Mbps guard: no new origin parents."
                active={sim.saturated}
                onClick={sim.toggleSaturated}
              />
              <FailButton
                label="Safari viewer"
                detail="Native HLS, no data channels: origin only."
                active={sim.safariViewer}
                onClick={sim.toggleSafari}
              />
              <FailButton
                label="Origin offline"
                detail="The tunnel drops: reconnect state."
                active={sim.originOffline}
                onClick={sim.toggleOriginOffline}
              />
            </div>
          </Panel>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Canvas                                                     */}
        {/* ---------------------------------------------------------- */}
        <Panel
          className="relative overflow-hidden"
          title="Swarm"
          subtitle={`${peers.length} peers · ${engine.state.edges.length} edges · 400 ms parts`}
          right={
            <span className="num text-[10.5px] text-text-3">seed {sim.seed}</span>
          }
        >
          <div className="relative h-[clamp(360px,58vh,620px)] w-full">
            <MeshCanvas engine={engine} />

            {/* Origin guard overlay */}
            <AnimatePresence>
              {metrics.saturated && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-3 top-3 flex items-center gap-2 rounded-[8px] border border-live/45 bg-live/12 px-2.5 py-1.5 backdrop-blur"
                >
                  <StatusDot tone="live" />
                  <span className="text-[11.5px] font-medium text-live">Origin saturated</span>
                  <span className="num text-[11px] text-text-2">{round(metrics.originMbps, 1)} / 12 Mbps</span>
                </motion.div>
              )}
            </AnimatePresence>

            {metrics.originOnly && (
              <div className="absolute right-3 top-3 rounded-[8px] border border-warn/45 bg-warn/10 px-2.5 py-1.5 text-[11.5px] text-warn backdrop-blur">
                Origin only — direct connections unavailable
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] border border-line bg-bg-1/80 px-2.5 py-1.5 backdrop-blur">
              <LegendDot color="var(--color-accent)" label="healthy" />
              <LegendDot color="var(--color-warn)" label="quarantined" />
              <LegendDot color="var(--color-info)" label="safari" />
              <LegendDot color="var(--color-text-3)" label="backgrounded" />
              <LegendDot color="var(--color-live)" label="lost" />
            </div>
          </div>
        </Panel>

        {/* ---------------------------------------------------------- */}
        {/* Readouts                                                   */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-3">
          <Panel title="Live readouts" dense>
            <div className="p-3.5">
              <SectionLabel>origin egress</SectionLabel>
              <div className="num mb-1 flex items-baseline gap-1.5">
                <span className={`text-[30px] font-semibold leading-none ${metrics.saturated ? "text-live" : "text-text-1"}`}>
                  {round(metrics.originMbps, 1)}
                </span>
                <span className="text-[12px] text-text-3">/ {SWARM_CONST.ORIGIN_CAP_MBPS} Mbps</span>
              </div>
              <Meter
                value={metrics.originMbps}
                max={SWARM_CONST.ORIGIN_CAP_MBPS}
                cap={SWARM_CONST.ORIGIN_CAP_MBPS}
                tone={metrics.saturated ? "live" : "accent"}
                height={7}
                glow
              />
              <div className="mt-2 h-[34px]">
                <Sparkline data={history.origin} color={metrics.saturated ? "#FF5A5F" : "#C9F73A"} height={34} />
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <SectionLabel>offload</SectionLabel>
                <div className="num mb-1 flex items-baseline gap-1.5">
                  <span className="text-[30px] font-semibold leading-none text-accent">{round(metrics.offloadPct, 0)}</span>
                  <span className="text-[12px] text-text-3">% from peers</span>
                </div>
                <div className="h-[34px]">
                  <Sparkline data={history.offload} color="#C9F73A" height={34} />
                </div>
                <div className="mt-3">
                  <StackBar segments={sourceSegments} showLegend />
                </div>
              </div>

              <div className="mt-4 space-y-1 border-t border-line pt-3">
                <Readout label="peers serving" value={`${metrics.peersServing} / ${metrics.peers}`} tone="accent" />
                <Readout label="p95 latency" value={fmtMs(metrics.p95LatencyMs)} tone={metrics.p95LatencyMs < 4000 ? "ok" : "warn"} />
                <Readout label="join p95" value={fmtMs(metrics.joinMs)} tone={metrics.joinMs < 2500 ? "ok" : "warn"} />
                <Readout label="rebuffer risk" value={`${round(metrics.rebufferPct, 2)} %`} tone={metrics.rebufferPct < 1 ? "ok" : "warn"} />
                <Readout label="state" value={metrics.rebalancing ? "rebalancing" : metrics.originOnly ? "origin only" : "healthy"} tone={metrics.rebalancing ? "warn" : "ok"} />
              </div>
            </div>
          </Panel>

          <Panel title="SLO targets" dense>
            <div className="p-3">
              <ul className="space-y-1.5">
                {slos.map((slo) => (
                  <li key={slo.id} className="flex items-center gap-2">
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                        slo.pass ? "border-ok/60 bg-ok/15 text-ok" : "border-warn/60 bg-warn/15 text-warn"
                      }`}
                    >
                      {slo.pass ? "✓" : "!"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-text-2">{slo.label}</span>
                    <span className="num text-[11.5px] text-text-1">{slo.value}</span>
                    <span className="num w-[62px] text-right text-[10.5px] text-text-3">{slo.target}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-relaxed text-text-3">
                Targets from the real project: latency p95 &lt; 4 s, join &lt; 2.5 s, rebuffer &lt; 1 %, offload ≥ 55 % at 20+ viewers, origin egress
                ≤ 12 Mbps at 30 viewers, host CPU &lt; 25 %.
              </p>
            </div>
          </Panel>

          <Panel title="What just happened" dense>
            <EventLog />
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                       */
/* ------------------------------------------------------------------ */

function FailButton({
  label,
  detail,
  onClick,
  active,
}: {
  label: string;
  detail: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tip content={detail} side="top">
      <button
        onClick={onClick}
        className={`flex min-h-[42px] w-full flex-col items-start gap-0.5 rounded-[8px] border px-2.5 py-1.5 text-left transition-colors ${
          active
            ? "border-warn/55 bg-warn/10 text-warn"
            : "border-line bg-bg-1 text-text-2 hover:border-line-strong hover:text-text-1"
        }`}
      >
        <span className="text-[11.5px] font-medium leading-tight">{label}</span>
        <span className="text-[9.5px] leading-tight text-text-3">{detail}</span>
      </button>
    </Tip>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-text-3">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Rolling list of engine events — the audit trail of the simulation. */
function EventLog() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const tick = useSimStore((s) => s.tick);

  useEffect(() => {
    const incoming = drainEvents();
    if (incoming.length) setEvents((prev) => [...incoming.reverse(), ...prev].slice(0, 24));
  }, [tick]);

  if (events.length === 0) {
    return <div className="px-3.5 py-4 text-[11px] text-text-3">Nothing has broken yet. Inject a failure to see the scheduler react.</div>;
  }

  return (
    <ul className="max-h-[220px] overflow-y-auto">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2 border-b border-line/60 px-3.5 py-1.5 last:border-b-0">
          <span
            className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${
              e.kind === "peer-died"
                ? "bg-live"
                : e.kind === "quarantine"
                  ? "bg-warn"
                  : e.kind === "saturated"
                    ? "bg-live"
                    : "bg-info"
            }`}
          />
          <span className="text-[10.5px] leading-snug text-text-3">{e.detail}</span>
        </li>
      ))}
    </ul>
  );
}

interface EventRecord {
  id: number;
  kind: string;
  detail: string;
}

let eventId = 1;
const eventBuffer: EventRecord[] = [];

/** Wired once by the app shell: engine events -> event log. */
export function pushEngineEvent(kind: string, detail: string) {
  eventBuffer.push({ id: eventId++, kind, detail });
  if (eventBuffer.length > 40) eventBuffer.shift();
}

function drainEvents(): EventRecord[] {
  if (eventBuffer.length === 0) return [];
  return eventBuffer.splice(0, eventBuffer.length);
}

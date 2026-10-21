import { useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge, StatusDot } from "@/components/ui/Badge";
import { Panel, Readout, SectionLabel } from "@/components/ui/Panel";
import { Gauge } from "@/components/charts/Charts";
import { Meter } from "@/components/ui/Meter";
import { engine } from "@/engine/swarm";
import { useSimStore } from "@/engine/simStore";
import { useAppStore } from "@/engine/store";
import { SWARM_CONST } from "@/engine/swarm";
import { round } from "@/lib/format";

/**
 * Results & proof.
 *
 * Two very different kinds of evidence live here and they are kept apart on
 * purpose: the SLO dashboard is the *simulation*, while the "verified
 * end-to-end" checklist is the *real run* quoted from the project README.
 */
export function ProofPage() {
  const metrics = engine.state.metrics;
  const setRoute = useAppStore((s) => s.setRoute);
  const sim = useSimStore();

  const trigger = (kind: "kill" | "kill30" | "saturate" | "corrupt" | "background" | "safari" | "slow") => {
    if (kind === "kill") sim.killRandomPeer();    if (kind === "kill30") sim.killThirty();
    if (kind === "saturate") sim.toggleSaturated();
    if (kind === "corrupt") sim.corruptPart();
    if (kind === "background") sim.toggleBackground();
    if (kind === "safari") sim.toggleSafari();
    if (kind === "slow") sim.toggleSlowNetwork();
    setRoute("simulator");
  };

  const gauges = useMemo(
    () => [
      {
        label: "latency p95",
        value: metrics.p95LatencyMs / 1000,
        max: 6,
        unit: "s",
        target: 4,
        color: metrics.p95LatencyMs < 4000 ? "var(--color-ok)" : "var(--color-warn)",
        pass: metrics.p95LatencyMs < 4000,
      },
      {
        label: "join p95",
        value: metrics.joinMs / 1000,
        max: 5,
        unit: "s",
        target: 2.5,
        color: metrics.joinMs < 2500 ? "var(--color-ok)" : "var(--color-warn)",
        pass: metrics.joinMs < 2500,
      },
      {
        label: "rebuffer",
        value: metrics.rebufferPct,
        max: 3,
        unit: "%",
        target: 1,
        color: metrics.rebufferPct < 1 ? "var(--color-ok)" : "var(--color-warn)",
        pass: metrics.rebufferPct < 1,
      },
      {
        label: "offload",
        value: metrics.offloadPct,
        max: 100,
        unit: "%",
        target: 55,
        color: metrics.offloadPct >= 55 ? "var(--color-ok)" : "var(--color-warn)",
        pass: metrics.offloadPct >= 55,
      },
    ],
    [metrics],
  );

  const verified = [
    "studio unlock, fake-camera capture, Go live, WHIP publish, On air",
    "MediaMTX H.264 track at 1280x720, LL-HLS master and variant playlists",
    "400 ms parts, 200 responses for parts",
    "three viewer tabs all playing",
    'signal tree reported "3 peers, 1 edge, maxDepth 2"',
    "peer-assisted transfer observed — 21 % via peers in the tunnel run",
    "origin fallback continued to work",
    "host auth rejection (401)",
    "bad playback token rejection (403)",
    "chat broadcast and persistence",
    "media health probe",
  ];

  const failures = [
    { mode: "Peer disconnects", behavior: "Children re-parent; the origin covers until the tree is repaired", trigger: "kill" as const, button: "Kill a peer" },
    { mode: "Peer sends a corrupt part", behavior: "Hash mismatch → discard, quarantine the sender, retry another source", trigger: "corrupt" as const, button: "Corrupt a part" },
    { mode: "Data channel never connects", behavior: "The viewer stays origin-only; the UI says “Direct connection unavailable”", trigger: "safari" as const, button: "Safari viewer" },
    { mode: "Tab backgrounded", behavior: "The peer stops serving; children rebalance", trigger: "background" as const, button: "Background a tab" },
    { mode: "Origin saturated", behavior: "New peers wait and rebalance; existing streams stay protected", trigger: "saturate" as const, button: "Saturate origin" },
    { mode: "Origin offline", behavior: "The player shows a reconnect state; the stream ends after the grace period", trigger: "kill30" as const, button: "Kill 30 %" },
    { mode: "Slow uplink", behavior: "Deadline misses increase, rebuffer risk rises, the origin guard trips", trigger: "slow" as const, button: "Slow network" },
  ];

  const costs = [
    ["Hosting", "$0", "the machine you already own"],
    ["Cloudflare Quick Tunnel", "$0", "no account, no domain"],
    ["STUN", "$0", "Google's public STUN"],
    ["Domain (optional)", "~$10–12 / year", "only if a stable link matters"],
    ["TURN (optional)", "$0 – small VPS", "later, only for blocked peers"],
    ["Recording storage", "local disk", "≈1.1 GB per hour at 2.5 Mbps"],
  ];

  const limits = [
    ["Quick Tunnel URL changes on restart", "Shared links die", "Always show the current URL in the studio; named tunnel later"],
    ["200 in-flight requests per tunnel", "Bursts can 429", "400 ms parts, P2P-first, request coalescing, cache"],
    ["No uptime guarantee", "The stream can drop", "Local recovery, auto-restart services, LAN fallback URL"],
    ["Home upload 10–40 Mbps", "The origin is the bottleneck", "720p, 3 origin seeds, origin guard, tree topology"],
    ["The device must stay awake", "Downtime", "Power plan, NSSM services, boot auto-start"],
    ["No free TURN", "Some pairs cannot connect", "Those viewers stay origin-only"],
  ];

  const risks = [
    ["Quick Tunnel rotates the URL / no SLA", "High", "Link banner in the studio, named tunnel later, LAN fallback"],
    ["200 in-flight tunnel cap", "High", "400 ms parts, P2P-first, caching, load test, 429 telemetry"],
    ["Home upstream too small", "High", "720p, 3 seeds, origin guard, honest UI"],
    ["PC sleeps or reboots", "High", "NSSM services, power plan, boot auto-start, health checks"],
    ["No TURN → some pairs fail", "Medium", "Origin fallback per viewer; optional coturn later"],
    ["P2P adds rebuffering", "High", "Hard deadlines, immediate origin fallback, release gate"],
    ["Hash poisoning / free riders", "Medium", "Signed manifests, quarantine, tit-for-tat"],
    ["Safari / iOS has no P2P", "Medium", "Native HLS, explicit “Origin only” state"],
    ["No accounts to abuse", "Medium", "Rate limits, signed cookies, hashed IPs"],
    ["Guest loses the host key", "Low", "Host key restore field; ephemeral streams"],
  ];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
      <header className="mb-4">
        <div className="eyebrow mb-1">results & proof</div>
        <h1 className="display text-[26px] leading-tight">What it does, and what it costs.</h1>
        <p className="mt-1 max-w-[74ch] text-[12.5px] leading-relaxed text-text-2">
          The gauges below come from the demo scheduler. The checklist below them is quoted from the real production run against Caddy and a
          public Cloudflare Quick Tunnel.
        </p>
      </header>

      {/* SLO dashboard */}
      <Panel title="SLO dashboard" subtitle="Simulation output — live from the demo scheduler" className="mb-3">
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {gauges.map((g) => (
            <div key={g.label} className="flex flex-col items-center gap-2">
              <Gauge value={g.value} max={g.max} unit={g.unit} label={g.label} target={g.target} color={g.color} size={116} />
              <Badge tone={g.pass ? "ok" : "warn"}>{g.pass ? "pass" : "failing"}</Badge>
            </div>
          ))}
        </div>
        <div className="grid gap-4 border-t border-line px-5 py-4 md:grid-cols-2">
          <div>
            <SectionLabel>origin guard</SectionLabel>
            <div className="num mb-1 flex items-baseline gap-1.5">
              <span className={`text-[24px] font-semibold leading-none ${metrics.saturated ? "text-live" : "text-text-1"}`}>
                {round(metrics.originMbps, 1)}
              </span>
              <span className="text-[11.5px] text-text-3">/ {SWARM_CONST.ORIGIN_CAP_MBPS} Mbps</span>
            </div>
            <Meter value={metrics.originMbps} max={12} cap={12} tone={metrics.saturated ? "live" : "accent"} height={7} glow />
            <p className="mt-2 text-[11px] leading-snug text-text-3">
              Above 12 Mbps the origin stops granting new parents and emits <span className="num text-text-2">swarm:saturated</span>.
            </p>
          </div>
          <div>
            <SectionLabel>host cost</SectionLabel>
            <div className="space-y-1">
              <Readout label="host cpu (no transcode)" value="18 % / 25 % budget" tone="ok" />
              <Readout label="origin egress at 30 viewers" value={`${round(metrics.originMbps, 1)} Mbps`} tone={metrics.originMbps <= 12 ? "ok" : "warn"} />
              <Readout label="peers relaying" value={`${metrics.peersServing}`} tone="accent" />
              <Readout label="bytes saved" value={`${(metrics.bytesSaved / 1e9).toFixed(2)} GB`} tone="ok" />
            </div>
          </div>
        </div>
      </Panel>

      {/* Verified run */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Verified end-to-end" subtitle="Real run — production build, Caddy and a public Quick Tunnel">
          <ul className="p-2">
            {verified.map((item, i) => (
              <motion.li
                key={item}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-2.5 rounded-[6px] px-2 py-1.5 hover:bg-bg-3/50"
              >
                <span className="mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-ok/55 bg-ok/12 text-[8.5px] text-ok">
                  ✓
                </span>
                <span className="text-[12px] leading-snug text-text-2">{item}</span>
              </motion.li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-text-3">
            Headless browser tests show inflated stalls in background tabs — foreground tabs play normally. Peer offload depends on buffered
            overlap and network timing, so a small fresh swarm may still be mostly origin-served. That is exactly the <span className="num">21 %</span>{" "}
            figure from the tunnel run, and exactly why the simulator warms the swarm up before it reports offload.
          </div>
        </Panel>

        <Panel title="Cost" dense>
          <table className="w-full text-[11.5px]">
            <tbody>
              {costs.map(([item, cost, note]) => (
                <tr key={item} className="border-b border-line/60 last:border-b-0">
                  <td className="px-3.5 py-2">
                    <div className="text-text-1">{item}</div>
                    <div className="text-[10px] text-text-3">{note}</div>
                  </td>
                  <td className="num whitespace-nowrap px-3.5 py-2 text-right text-accent">{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line p-3.5">
            <div className="num text-[22px] font-semibold text-accent">$0</div>
            <p className="mt-1 text-[11px] leading-relaxed text-text-3">
              The only realistic upgrade is a $5–10/month VPS or a domain. The code stays portable: Docker Compose for media/api/signal, SQLite
              file backup, no cloud-specific dependencies.
            </p>
          </div>
        </Panel>
      </div>

      {/* Failure modes */}
      <Panel title="Failure modes" subtitle="Every one of these can be triggered live in the simulator" className="mb-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="eyebrow px-4 py-2 font-normal">Mode</th>
                <th className="eyebrow px-4 py-2 font-normal">Behaviour</th>
                <th className="eyebrow px-4 py-2 text-right font-normal">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((f) => (
                <tr key={f.mode} className="border-b border-line/60 last:border-b-0 hover:bg-bg-3/40">
                  <td className="px-4 py-2.5 align-top text-text-1">{f.mode}</td>
                  <td className="px-4 py-2.5 align-top text-text-3">{f.behavior}</td>
                  <td className="px-4 py-2.5 text-right align-top">
                    <Button size="sm" variant="ghost" onClick={() => trigger(f.trigger)}>
                      {f.button} →
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Free tier + risks */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Free-tier limits" subtitle="Accepted for v1">
          <table className="w-full text-[11.5px]">
            <tbody>
              {limits.map(([a, b, c]) => (
                <tr key={a} className="border-b border-line/60 last:border-b-0 align-top">
                  <td className="px-4 py-2">
                    <div className="text-text-1">{a}</div>
                    <div className="text-[10px] text-text-3">{c}</div>
                  </td>
                  <td className="px-4 py-2 text-right text-warn">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Risks" subtitle="Severity and mitigation">
          <table className="w-full text-[11.5px]">
            <tbody>
              {risks.map(([a, b, c]) => (
                <tr key={a} className="border-b border-line/60 last:border-b-0 align-top">
                  <td className="px-4 py-2">
                    <div className="text-text-1">{a}</div>
                    <div className="text-[10px] text-text-3">{c}</div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`num text-[11px] ${
                        b === "High" ? "text-live" : b === "Medium" ? "text-warn" : "text-text-3"
                      }`}
                    >
                      {b}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-line bg-bg-1 px-4 py-3 text-[11.5px] text-text-3">
        <StatusDot tone="accent" size={6} />
        <span>
          The SLO numbers above are simulated. The verified checklist is quoted from the real run. The demo never claims simulated traffic is
          real traffic.
        </span>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setRoute("simulator")}>
          Open the simulator
        </Button>
      </div>
    </div>
  );
}

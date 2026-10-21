import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TestPattern } from "@/components/media/TestPattern";
import { Button, IconButton, KeyCap } from "@/components/ui/Button";
import { Badge, LiveChip, StatusDot } from "@/components/ui/Badge";
import { Meter, StackBar } from "@/components/ui/Meter";
import { Panel, Readout, SectionLabel } from "@/components/ui/Panel";
import { CheckRow, Field, Select } from "@/components/ui/Controls";
import { EmptyState } from "@/components/ui/State";
import { Sparkline } from "@/components/charts/Charts";
import { Tip } from "@/components/ui/Tooltip";
import { useStudioStore, type StudioPhase } from "@/engine/studioStore";
import { useAppStore } from "@/engine/store";
import { engine } from "@/engine/swarm";
import { computeHealth, createTelemetry, sampleStudio } from "@/engine/telemetry";
import { makeRng } from "@/mock/rng";
import { mockApi } from "@/mock/api";
import { fmtBytes, fmtDuration, round } from "@/lib/format";

const PHASE_COPY: Record<StudioPhase, string> = {
  idle: "Preflight",
  preflight: "Preflight",
  armed: "Armed",
  countdown: "Starting",
  live: "On air",
  ending: "Ending",
};

export function StudioPage() {
  const studio = useStudioStore();
  const pushToast = useAppStore((s) => s.pushToast);
  const tunnelUrl = useAppStore((s) => s.tunnelUrl);
  const setTunnelUrl = useAppStore((s) => s.setTunnelUrl);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [activeRail, setActiveRail] = useState("Studio");
  const [alerts, setAlerts] = useState<{ id: number; text: string; tone: "ok" | "warn" | "info" }[]>([]);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  const telemetry = useMemo(() => createTelemetry(4242), []);
  const rng = useMemo(() => makeRng(99), []);

  // Sample telemetry + alert feed.
  useEffect(() => {
    const id = setInterval(() => {
      sampleStudio(telemetry, performance.now() / 1000, rng);
      if (Math.random() < 0.06) {
        const pool = [
          { text: "Peer QuietFalcon joined the swarm", tone: "info" as const },
          { text: "Origin egress stable at 4.2 Mbps", tone: "ok" as const },
          { text: "Viewer count crossed 12", tone: "info" as const },
          { text: "RTT spike on seed peer 2", tone: "warn" as const },
          { text: "Chat slow mode enabled", tone: "info" as const },
        ];
        const pick = pool[Math.floor(Math.random() * pool.length)];
        setAlerts((prev) => [{ id: Date.now() + Math.random(), ...pick }, ...prev].slice(0, 6));
      }
    }, 900);
    return () => clearInterval(id);
  }, [rng, telemetry]);

  useEffect(() => {
    engine.setViewers(12);
  }, []);

  // Keyboard shortcuts (plan.md §8.8).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "m":
          studio.toggleMic();
          break;
        case "v":
          studio.toggleCam();
          break;
        case "s":
          studio.setSource(studio.source === "screen" ? "camera" : "screen");
          break;
        case "r":
          studio.toggleRecording();
          pushToast({
            title: studio.recording ? "Recording paused" : "Recording started",
            body: "fMP4 written to ./data/recordings/<streamId>/",
            tone: "info",
          });
          break;
        case "l":
          if (studio.phase === "idle") void studio.arm().then(() => studio.startCountdown());
          break;
        case "c":
          chatInputRef.current?.focus();
          break;
        case "f":
          pushToast({ title: "Fullscreen", body: "Preview fullscreen is a mock in this demo.", tone: "info" });
          break;
        case "?":
          setShortcutsOpen((v) => !v);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studio, pushToast]);

  const metrics = engine.state.metrics;
  const health = computeHealth(telemetry, metrics.saturated);
  const onAir = studio.phase === "live";
  const [micLevel, setMicLevel] = useState(0.42);

  useEffect(() => {
    const id = setInterval(() => setMicLevel(0.28 + Math.random() * 0.5), 140);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col">
      {/* On-air hairline */}
      <AnimatePresence>
        {onAir && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-0 z-40 h-[2px] origin-left bg-live"
            style={{ boxShadow: "0 0 18px 1px rgba(255,90,95,.55)" }}
          />
        )}
      </AnimatePresence>

      <div
        className={`grid flex-1 transition-opacity duration-300 ${
          onAir ? "grid-cols-[64px_248px_minmax(0,1fr)_328px] opacity-95" : "grid-cols-[64px_248px_minmax(0,1fr)_328px]"
        }`}
      >
        {/* ---------------------------------------------------------- */}
        {/* Rail                                                      */}
        {/* ---------------------------------------------------------- */}
        <aside className="flex flex-col items-center gap-1 border-r border-line bg-bg-1/60 py-3">
          {["Studio", "Live", "Library", "Stats"].map((item) => (
            <Tip key={item} content={item} side="right">
              <button
                onClick={() => setActiveRail(item)}
                aria-label={item}
                className={`flex h-9 w-9 items-center justify-center rounded-[9px] border transition-colors ${
                  activeRail === item
                    ? "border-line bg-bg-3 text-accent"
                    : "border-transparent text-text-3 hover:bg-bg-2 hover:text-text-2"
                }`}
              >
                {item === "Studio" ? "◉" : item === "Live" ? "◉" : item === "Library" ? "▤" : "◍"}
              </button>
            </Tip>
          ))}
          <div className="mt-auto flex flex-col items-center gap-1">
            <IconButton label="Keyboard shortcuts (?)" onClick={() => setShortcutsOpen((v) => !v)}>
              <span className="text-[13px] font-semibold">?</span>
            </IconButton>
          </div>
        </aside>

        {/* ---------------------------------------------------------- */}
        {/* Sources                                                    */}
        {/* ---------------------------------------------------------- */}
        <aside className="flex flex-col gap-3 overflow-y-auto border-r border-line p-3">
          <div>
            <SectionLabel>Scenes</SectionLabel>
            <div className="space-y-1">
              {["Camera", "Screen", "Overlay"].map((scene, i) => (
                <button
                  key={scene}
                  className={`flex w-full items-center justify-between rounded-[8px] border px-2.5 py-2 text-left text-[12px] transition-colors ${
                    i === 0 ? "border-accent/40 bg-accent/8 text-text-1" : "border-line bg-bg-1 text-text-3 hover:text-text-2"
                  }`}
                >
                  {scene}
                  {i === 0 && <span className="num text-[9.5px] text-accent">live</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Source</SectionLabel>
            <div className="space-y-1.5">
              <SourceButton
                label="Camera"
                detail="1280x720 · 30 fps"
                active={studio.source === "camera"}
                onClick={() => studio.setSource("camera")}
                icon="◉"
              />
              <SourceButton
                label="Screen"
                detail="1920x1080 · scaled"
                active={studio.source === "screen"}
                onClick={() => studio.setSource("screen")}
                icon="▤"
              />
            </div>
            <div className="mt-2 space-y-2">
              <Select
                label="Camera device"
                value="cam0"
                onChange={() => {}}
                options={[
                  { value: "cam0", label: "FaceTime HD Camera (mock)" },
                  { value: "cam1", label: "OBS Virtual Camera (mock)" },
                ]}
              />
              <Select
                label="Microphone"
                value="mic0"
                onChange={() => {}}
                options={[
                  { value: "mic0", label: "Built-in Microphone (mock)" },
                  { value: "mic1", label: "External USB Mic (mock)" },
                ]}
              />
            </div>
          </div>

          <div>
            <SectionLabel>Audio</SectionLabel>
            <div className="rounded-[9px] border border-line bg-bg-1 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] text-text-3">Mic level</span>
                <span className="num text-[11px] text-text-2">{Math.round(micLevel * 100)} %</span>
              </div>
              <Meter value={micLevel} max={1} tone={micLevel > 0.85 ? "live" : "accent"} height={6} glow />
              <div className="mt-2 flex gap-1">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-3 flex-1 rounded-[2px]"
                    style={{
                      background:
                        i / 18 < micLevel
                          ? i > 15
                            ? "var(--color-live)"
                            : i > 12
                              ? "var(--color-warn)"
                              : "var(--color-accent)"
                          : "var(--color-bg-3)",
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant={studio.micOn ? "secondary" : "danger"} onClick={studio.toggleMic}>
                  M · {studio.micOn ? "Mic on" : "Mic off"}
                </Button>
                <Button size="sm" variant={studio.camOn ? "secondary" : "danger"} onClick={studio.toggleCam}>
                  V · {studio.camOn ? "Cam on" : "Cam off"}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Recording</SectionLabel>
            <button
              onClick={studio.toggleRecording}
              className={`flex w-full items-center gap-2 rounded-[8px] border px-2.5 py-2 text-left text-[12px] transition-colors ${
                studio.recording ? "border-live/45 bg-live/8 text-live" : "border-line bg-bg-1 text-text-3 hover:text-text-2"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${studio.recording ? "bg-live" : "bg-text-3"}`} />
              {studio.recording ? "Recording locally (fMP4)" : "Record locally"}
              <span className="num ml-auto text-[9.5px]">R</span>
            </button>
          </div>
        </aside>

        {/* ---------------------------------------------------------- */}
        {/* Stage                                                     */}
        {/* ---------------------------------------------------------- */}
        <main className="flex min-w-0 flex-col gap-3 p-3">
          {/* Preflight */}
          {studio.phase === "idle" && (
            <Panel title="Preflight" subtitle="Everything is checked before the stream goes out.">
              <div className="grid gap-x-6 gap-y-1 p-4 sm:grid-cols-2">
                <div>
                  <CheckRow ok label="Camera source" detail="1280x720 @ 30 fps (mock device)" />
                  <CheckRow ok label="Microphone" detail="Opus 128 kbps target" />
                  <CheckRow ok label="Encoder budget" detail="H.264 2.5 Mbps ceiling, no transcoding" />
                </div>
                <div>
                  <CheckRow ok={metrics.originMbps < 12} label="Origin guard" detail={`${round(metrics.originMbps, 1)} / 12 Mbps`} />
                  <CheckRow ok label="Tunnel reachable" detail={tunnelUrl || "acme-lark-mesa-4417.trycloudflare.com"} />
                  <CheckRow ok label="Peer cache ready" detail="~60 s of verified parts" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line p-3.5">
                <Field
                  label="Stream title"
                  value={studio.title}
                  onChange={studio.setTitle}
                  className="min-w-[240px] flex-1"
                />
                <Button variant="primary" onClick={() => void studio.arm().then(() => studio.startCountdown())}>
                  Go live
                </Button>
              </div>
            </Panel>
          )}

          {/* Countdown */}
          {studio.phase === "countdown" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg-0/80 backdrop-blur-sm">
              <AnimatePresence mode="wait">
                <motion.div
                  key={studio.countdown}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="num text-[110px] font-semibold text-accent text-glow"
                >
                  {studio.countdown}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Preview */}
          <div className="relative overflow-hidden rounded-[12px] border border-line bg-black">
            <div className="aspect-video">
              <TestPattern showOverlay />
            </div>

            {/* Safe guides */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[8%] rounded-[4px] border border-dashed border-white/10" />
              <div className="absolute inset-[16%] rounded-[4px] border border-dashed border-white/[0.07]" />
              <div className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-white/15" />
              <div className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-white/15" />
            </div>

            {/* On-air overlay */}
            {onAir && (
              <div className="pointer-events-none absolute inset-0 border-[2px] border-live/40">
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <LiveChip />
                  <span className="num text-[11px] text-text-2">{fmtDuration((Date.now() - studio.onAirSince) / 1000)}</span>
                </div>
              </div>
            )}

            {!studio.camOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-0/85">
                <EmptyState title="Camera is off" body="Press V to bring the source back." icon="◉" />
              </div>
            )}
          </div>

          {/* Audio strips */}
          <div className="grid grid-cols-2 gap-3">
            <AudioStrip label="Mic" level={micLevel} active={studio.micOn} />
            <AudioStrip label="Program" level={0.62} active />
          </div>

          {/* Alerts */}
          <Panel title="Alerts" dense>
            {alerts.length === 0 ? (
              <div className="px-3.5 py-4 text-[11.5px] text-text-3">No alerts. The stream is healthy.</div>
            ) : (
              <ul>
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 border-b border-line/70 px-3.5 py-1.5 last:border-b-0">
                    <StatusDot tone={a.tone === "warn" ? "warn" : a.tone === "ok" ? "ok" : "info"} size={6} />
                    <span className="text-[11.5px] text-text-2">{a.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </main>

        {/* ---------------------------------------------------------- */}
        {/* Inspector                                                  */}
        {/* ---------------------------------------------------------- */}
        <aside className="flex flex-col gap-3 overflow-y-auto border-l border-line p-3">
          <Panel dense>
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                {onAir ? <LiveChip /> : <Badge tone="muted">{PHASE_COPY[studio.phase]}</Badge>}
                {onAir && (
                  <span className="num text-[12px] text-text-2">{fmtDuration((Date.now() - studio.onAirSince) / 1000)}</span>
                )}
              </div>
              <HealthChip score={health.score} tone={health.tone} />
            </div>

            {onAir ? (
              <div className="p-3">
                <Button variant="danger" className="w-full" onClick={() => void studio.endStream()}>
                  End stream
                </Button>
                <p className="mt-2 text-center text-[10.5px] text-text-3">
                  End stream is the only destructive action while you are live.
                </p>
              </div>
            ) : studio.phase === "armed" ? (
              <div className="p-3">
                <Button variant="primary" className="w-full" onClick={() => void studio.startCountdown()}>
                  Start broadcast
                </Button>
                <div className="mt-2 text-[10.5px] text-text-3">
                  Stream <span className="num text-text-2">{studio.streamId}</span> · host key stored as sha256 only
                </div>
              </div>
            ) : (
              <div className="p-3">
                <Button variant="secondary" className="w-full" onClick={() => void studio.arm()}>
                  Create stream & arm
                </Button>
                <div className="mt-2 text-[10.5px] text-text-3">
                  Guards: preflight → armed → 3-2-1 → on air
                </div>
              </div>
            )}
          </Panel>

          {/* Origin guard */}
          <Panel title="Origin guard" dense>
            <div className="p-3.5">
              <div className="num mb-1 flex items-baseline gap-1.5">
                <span className={`text-[26px] font-semibold leading-none ${metrics.saturated ? "text-live" : "text-text-1"}`}>
                  {round(metrics.originMbps, 1)}
                </span>
                <span className="text-[11.5px] text-text-3">/ 12 Mbps</span>
              </div>
              <Meter
                value={metrics.originMbps}
                max={12}
                cap={12}
                tone={metrics.saturated ? "live" : "accent"}
                height={7}
                glow
              />
              <div className="mt-3">
                <StackBar
                  segments={[
                    { label: "origin", value: 100 - metrics.offloadPct, color: "var(--color-text-3)" },
                    { label: "peers", value: metrics.offloadPct, color: "var(--color-accent)" },
                  ]}
                  showLegend
                />
              </div>
            </div>
          </Panel>

          {/* Health */}
          <Panel title="Room health" dense>
            <div className="p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`num flex h-9 w-9 items-center justify-center rounded-[9px] text-[18px] font-semibold ${
                    health.tone === "ok"
                      ? "bg-ok/15 text-ok"
                      : health.tone === "warn"
                        ? "bg-warn/15 text-warn"
                        : "bg-live/15 text-live"
                  }`}
                >
                  {health.score}
                </span>
                <div className="text-[11.5px] leading-snug text-text-3">
                  {health.fixes.length === 0 ? (
                    "Everything looks healthy. Bitrate is stable, frames are not dropping, the origin is well under budget."
                  ) : (
                    health.fixes[0]
                  )}
                </div>
              </div>
              {health.fixes.length > 1 && (
                <ul className="space-y-1 border-t border-line pt-2">
                  {health.fixes.slice(1).map((fix) => (
                    <li key={fix} className="text-[11px] leading-snug text-text-3">
                      • {fix}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          {/* Telemetry */}
          <Panel title="Telemetry" dense>
            <div className="space-y-3 p-3.5">
              <TelemetryRow label="bitrate" unit="kbps" data={telemetry.bitrate.toArray()} value={`${Math.round(telemetry.bitrate.last)}`} />
              <TelemetryRow label="rtt" unit="ms" data={telemetry.rtt.toArray()} value={`${Math.round(telemetry.rtt.last)}`} color="#5B9DFF" />
              <TelemetryRow
                label="dropped frames"
                unit=""
                data={telemetry.dropped.toArray()}
                value={`${Math.round(telemetry.dropped.last)}`}
                color="#FF5A5F"
              />
              <div className="space-y-1 border-t border-line pt-2">
                <Readout label="viewers" value={`${metrics.viewers}`} />
                <Readout label="peers" value={`${metrics.peers}`} tone="accent" />
                <Readout label="bytes from peers" value={fmtBytes(metrics.bytesFromPeers)} />
                <Readout label="host cpu" value={`${Math.round(telemetry.cpu.last)} %`} />
                <Readout label="latency p95" value={`${round(metrics.p95LatencyMs / 1000, 2)} s`} tone="ok" />
              </div>
            </div>
          </Panel>

          {/* Share */}
          <Panel title="Share this stream" dense>
            <div className="p-3.5">
              <div className="num truncate rounded-[8px] border border-line bg-bg-1 px-2.5 py-2 text-[11px] text-accent">
                {tunnelUrl || "https://acme-lark-mesa-4417.trycloudflare.com"}
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard?.writeText(tunnelUrl).catch(() => {});
                    pushToast({ title: "Link copied", tone: "ok" });
                  }}
                >
                  Copy link
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const url = await mockApi.rotateTunnel();
                    setTunnelUrl(url);
                    pushToast({ title: "Tunnel URL rotated", body: "Quick Tunnel URLs change on every restart.", tone: "info" });
                  }}
                >
                  Rotate
                </Button>
              </div>
              <p className="mt-2 text-[10px] leading-snug text-text-3">
                Quick Tunnel URLs rotate when the tunnel restarts. The banner above always shows the current one.
              </p>
            </div>
          </Panel>

          {/* Chat */}
          <Panel title="Chat" dense>
            <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
              <StatusDot tone="ok" size={6} />
              <span className="num text-[10.5px] text-text-3">slow mode 5s</span>
              <span className="num ml-auto text-[10.5px] text-text-3">12 online</span>
            </div>
            <div className="max-h-[150px] overflow-y-auto px-3.5 py-2">
              <ChatStub />
            </div>
            <div className="flex gap-1.5 border-t border-line p-2.5">
              <input
                ref={chatInputRef}
                placeholder="Message the room…"
                aria-label="Chat message"
                className="h-8 flex-1 rounded-[7px] border border-line bg-bg-1 px-2.5 text-[12px] text-text-1 placeholder:text-text-3 focus:border-accent/60 focus:outline-none"
              />
              <Button size="sm" variant="primary">
                Send
              </Button>
            </div>
          </Panel>
        </aside>
      </div>

      {/* Shortcut sheet */}
      <AnimatePresence>
        {shortcutsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="glass glass-strong fixed bottom-6 left-[76px] z-[65] w-[320px] p-4"
          >
            <div className="eyebrow mb-3">keyboard shortcuts</div>
            <div className="space-y-1.5">
              {[
                ["M", "toggle mic"],
                ["V", "toggle camera"],
                ["S", "toggle screen source"],
                ["R", "toggle local recording"],
                ["L", "go live"],
                ["C", "focus chat"],
                ["F", "fullscreen"],
                ["?", "this sheet"],
                ["⌘K", "command palette"],
                ["Esc ×2", "panic reset"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <KeyCap>{key}</KeyCap>
                  <span className="text-[11.5px] text-text-2">{label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function SourceButton({
  label,
  detail,
  active,
  onClick,
  icon,
}: {
  label: string;
  detail: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-[8px] border px-2.5 py-2 text-left transition-colors ${
        active ? "border-accent/45 bg-accent/8" : "border-line bg-bg-1 hover:border-line-strong"
      }`}
    >
      <span className={active ? "text-accent" : "text-text-3"}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] text-text-1">{label}</span>
        <span className="block text-[10px] text-text-3">{detail}</span>
      </span>
      {active && <span className="num ml-auto text-[9.5px] text-accent">on</span>}
    </button>
  );
}

function AudioStrip({ label, level, active }: { label: string; level: number; active: boolean }) {
  return (
    <div className="rounded-[10px] border border-line bg-bg-1 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className="num text-[10px] text-text-3">{active ? `${Math.round(level * 100)} %` : "off"}</span>
      </div>
      <div className="flex h-6 items-center gap-[2px] overflow-hidden">
        {Array.from({ length: 42 }).map((_, i) => {
          const seed = Math.sin(i * 12.9898) * 43758.5453;
          const noise = seed - Math.floor(seed);
          const on = active && noise < level * 0.9;
          return (
            <span
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: `${20 + noise * 70}%`,
                background: on ? (i > 32 ? "var(--color-warn)" : "var(--color-accent)") : "var(--color-bg-3)",
                opacity: on ? 0.9 : 0.5,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function TelemetryRow({
  label,
  unit,
  data,
  value,
  color = "#C9F73A",
}: {
  label: string;
  unit: string;
  data: number[];
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="num text-[11.5px] text-text-1">
          {value}
          {unit && <span className="text-text-3"> {unit}</span>}
        </span>
      </div>
      <Sparkline data={data} color={color} height={30} />
    </div>
  );
}

function HealthChip({ score, tone }: { score: string; tone: "ok" | "warn" | "error" }) {
  const cls = {
    ok: "border-ok/45 bg-ok/12 text-ok",
    warn: "border-warn/45 bg-warn/12 text-warn",
    error: "border-live/45 bg-live/12 text-live",
  }[tone];
  return (
    <Tip content="Room health: bitrate stability, dropped frames, RTT, origin saturation and peer ratio.">
      <span className={`num flex h-7 w-7 cursor-help items-center justify-center rounded-[7px] border text-[13px] font-semibold ${cls}`}>
        {score}
      </span>
    </Tip>
  );
}

function ChatStub() {
  const lines = [
    { name: "AmberKite", body: "origin meter is at 4.2, nice" },
    { name: "QuietFalcon", body: "switched over wifi, still fine" },
    { name: "meshstream", body: "host pinned the latency explanation" },
  ];
  return (
    <ul className="space-y-1.5">
      {lines.map((l) => (
        <li key={l.name} className="text-[11.5px] leading-snug">
          <span className="font-medium text-text-1">{l.name}</span> <span className="text-text-3">{l.body}</span>
        </li>
      ))}
    </ul>
  );
}

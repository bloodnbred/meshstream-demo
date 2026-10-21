import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TestPattern } from "@/components/media/TestPattern";
import { SwarmPanel } from "@/components/swarm/SwarmPanel";
import { Button, IconButton, Segmented } from "@/components/ui/Button";
import { Badge, LiveChip, StatusDot } from "@/components/ui/Badge";
import { Panel, Readout } from "@/components/ui/Panel";
import { Tip } from "@/components/ui/Tooltip";
import { DegradedBanner } from "@/components/ui/State";
import { engine } from "@/engine/swarm";
import { useAppStore } from "@/engine/store";
import { usePlayerStore, DEGRADATION_REASONS } from "@/engine/playerStore";
import { useSimStore } from "@/engine/simStore";
import { fmtBytes, fmtClock, round } from "@/lib/format";
import type { ChatMessage, PeerNode } from "@/types";

type Tab = "about" | "swarm" | "chat" | "recordings";
type Side = "swarm" | "chat";

/**
 * The viewer: a 16:9 player, live chat and the swarm panel.
 */
export function ViewerPage() {
  const player = usePlayerStore();
  const chat = useAppStore((s) => s.chat);
  const appendChat = useAppStore((s) => s.appendChat);
  const pushToast = useAppStore((s) => s.pushToast);
  const tick = useSimStore((s) => s.tick);
  const [tab, setTab] = useState<Tab>("about");
  const [side, setSide] = useState<Side>("swarm");
  const [selected, setSelected] = useState<PeerNode | null>(null);
  const [draft, setDraft] = useState("");
  const [slowModeUntil, setSlowModeUntil] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Warm the swarm for the viewer view.
  useEffect(() => {
    engine.setViewers(12);
    engine.setP2p(true);
    engine.setSaturated(false);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length]);

  const metrics = engine.state.metrics;

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    if (Date.now() < slowModeUntil) {
      pushToast({ title: "Slow mode", body: "You can send one message every 5 seconds.", tone: "warn" });
      return;
    }
    appendChat({
      id: `m_me_${Date.now()}`,
      guestId: "me",
      name: "You",
      color: "#C9F73A",
      initials: "YO",
      body,
      ts: Date.now(),
      role: "guest",
    });
    setDraft("");
    setSlowModeUntil(Date.now() + 5000);
  };

  const latency = player.latencyToLive + (tick % 10) * 0.04;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6">
      {/* Top bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <LiveChip />
        <h1 className="display truncate text-[16px]">Building a peer-assisted CDN from a bedroom</h1>
        <Badge tone="muted">Engineering</Badge>
        <div className="ml-auto flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-text-3">
            <StatusDot tone="accent" />
            <span className="num text-text-1">{metrics.peers}</span> peers
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-text-3">
            <StatusDot tone="ok" />
            <span className="num text-text-1">{metrics.viewers}</span> viewers
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText("https://amber-kite-7421.trycloudflare.com/watch/st_demo").catch(() => {});
              pushToast({ title: "Share link copied", body: "Quick Tunnel URLs rotate on restart.", tone: "ok" });
            }}
          >
            Share
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------------------------------------------------- */}
        {/* Player                                                    */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-3">
          <div
            className={`relative overflow-hidden rounded-[14px] border border-line bg-black ${
              player.theater ? "aspect-[21/9]" : "aspect-video"
            }`}
          >
            <TestPattern />

            {/* Lower third */}
            <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2.5">
              <span className="h-8 w-[3px] rounded-full bg-accent" />
              <div>
                <div className="text-[13px] font-medium text-text-1">meshstream</div>
                <div className="text-[11px] text-text-2">live from the swarm</div>
              </div>
            </div>

            {/* Captions */}
            <AnimatePresence>
              {player.captionsOn && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="absolute inset-x-0 bottom-16 flex justify-center px-8"
                >
                  <span className="rounded-[6px] bg-black/75 px-3 py-1.5 text-[13px] text-white">
                    ...and the audience becomes the delivery network.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Controls */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-8">
              {/* Live progress */}
              <div className="relative mb-2 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                <span className="absolute inset-y-0 right-0 w-[18%] bg-white/10" />
                <span className="absolute inset-y-0 left-0 w-full bg-accent/70" />
                <span className="absolute inset-y-[-2px] right-[18%] w-[3px] rounded-full bg-accent" />
              </div>

              <div className="flex items-center gap-2">
                <IconButton
                  label={player.playing ? "Pause" : "Play"}
                  onClick={player.togglePlaying}
                  tone={player.playing ? "accent" : "default"}
                >
                  {player.playing ? (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                      <rect x="2.5" y="1.5" width="3.2" height="11" rx="1" />
                      <rect x="8.3" y="1.5" width="3.2" height="11" rx="1" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3 1.8 12 7l-9 5.2z" />
                    </svg>
                  )}
                </IconButton>

                <IconButton label={player.muted ? "Unmute" : "Mute"} onClick={player.toggleMuted}>
                  {player.muted ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
                      <path d="m11 6 4 4M15 6l-4 4" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <path d="M2 6h2.5L8 3v10L4.5 10H2z" />
                      <path d="M10.5 5.6a3.4 3.4 0 0 1 0 4.8M12.6 3.6a6 6 0 0 1 0 8.8" strokeLinecap="round" />
                    </svg>
                  )}
                </IconButton>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={player.muted ? 0 : player.volume}
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/20 sm:block"
                  style={{
                    background: `linear-gradient(90deg, var(--color-accent) ${(player.muted ? 0 : player.volume) * 100}%, rgba(255,255,255,.2) 0)`,
                  }}
                />

                <span className="num ml-1 hidden items-center gap-1.5 text-[11px] text-text-2 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-live" />
                  LIVE
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <Tip content="Latency to the live edge. LL-HLS targets 2.5–4 s glass-to-glass.">
                    <span className="num cursor-help rounded-[6px] border border-line bg-bg-1/70 px-2 py-1 text-[11px] text-text-2">
                      {round(latency, 1)}s behind
                    </span>
                  </Tip>

                  <Button size="sm" variant="secondary" onClick={player.syncToLive}>
                    Sync to live
                  </Button>

                  <Segmented
                    size="sm"
                    value={player.quality}
                    onChange={player.setQuality}
                    options={[
                      { value: "auto", label: "Auto (720p)" },
                      { value: "720p", label: "720p" },
                    ]}
                  />

                  <IconButton
                    label="Captions"
                    active={player.captionsOn}
                    onClick={player.toggleCaptions}
                    tone={player.captionsOn ? "accent" : "default"}
                  >
                    <span className="text-[11px] font-semibold">CC</span>
                  </IconButton>

                  <IconButton label="Theater mode" active={player.theater} onClick={player.toggleTheater}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
                    </svg>
                  </IconButton>

                  <IconButton label="Fullscreen" active={player.fullscreen} onClick={player.toggleFullscreen}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" strokeLinecap="round" />
                    </svg>
                  </IconButton>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-line">
            {(["about", "swarm", "chat", "recordings"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-3 py-2 text-[12.5px] capitalize transition-colors ${
                  tab === t ? "text-text-1" : "text-text-3 hover:text-text-2"
                }`}
              >
                {t}
                {tab === t && (
                  <motion.span layoutId="viewer-tab" className="absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>

          <div className="min-h-[220px]">
            {tab === "about" && (
              <div className="grid gap-3 md:grid-cols-2">
                <Panel title="Session" dense>
                  <div className="p-3.5">
                    <Readout label="resolution" value="1280x720 @ 30 fps" />
                    <Readout label="codec" value="H.264 · Opus 128 kbps" />
                    <Readout label="delivery" value="LL-HLS · 400 ms parts" />
                    <Readout label="playback" value="hls.js + P2P fragment loader" />
                    <Readout label="playback token" value="ms_playback_… (15 min TTL)" />
                    <Readout label="origin" value="edge proxy · signed URL" />
                  </div>
                </Panel>
                <Panel title="Why you can watch at all" dense>
                  <div className="p-3.5 text-[12px] leading-relaxed text-text-2">
                    You are watching a stream that a single home Windows machine publishes. It reaches you through a free Cloudflare Quick
                    Tunnel — and, when other viewers are connected, straight from a peer over WebRTC instead.
                    <div className="mt-3">
                      <Readout label="bytes from peers" value={fmtBytes(metrics.bytesFromPeers)} tone="accent" />
                      <Readout label="bytes from origin" value={fmtBytes(metrics.bytesFromOrigin)} />
                      <Readout label="origin egress right now" value={`${round(metrics.originMbps, 1)} Mbps`} />
                    </div>
                  </div>
                </Panel>
              </div>
            )}

            {tab === "swarm" && (
              <Panel title="Swarm" dense>
                <SwarmPanel
                  peers={engine.state.peers}
                  edges={engine.state.edges}
                  packets={engine.state.packets}
                  offloadPct={metrics.offloadPct}
                  bytesSaved={metrics.bytesSaved}
                  source={player.source}
                  onSelectPeer={setSelected}
                  height={300}
                />
              </Panel>
            )}

            {tab === "chat" && <ChatPanel messages={chat} onSend={send} draft={draft} setDraft={setDraft} />}

            {tab === "recordings" && (
              <Panel title="Recordings" dense>
                <div className="p-6 text-center text-[12px] text-text-3">
                  The host records locally (MediaMTX writes fMP4 to disk). Recordings are scoped to the host key and are not a public VOD
                  library.
                </div>
              </Panel>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Right column: swarm + chat                                */}
        {/* ---------------------------------------------------------- */}
        <div className="flex flex-col gap-3">
          <Segmented
            value={side}
            onChange={setSide}
            options={[
              { value: "swarm", label: "Swarm" },
              { value: "chat", label: "Chat" },
            ]}
            className="self-start"
          />

          {side === "swarm" ? (
            <>
              <Panel className="overflow-hidden" dense>
                <SwarmPanel
                  peers={engine.state.peers}
                  edges={engine.state.edges}
                  packets={engine.state.packets}
                  offloadPct={metrics.offloadPct}
                  bytesSaved={metrics.bytesSaved}
                  source={player.source}
                  onSelectPeer={setSelected}
                  height={240}
                />
              </Panel>

              <Panel title="Peer detail" dense>
                {selected ? (
                  <div className="p-3.5">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full" style={{ background: selected.color }} />
                      <span className="text-[13px] font-medium text-text-1">{selected.name}</span>
                      <Badge tone={selected.state === "healthy" ? "ok" : "warn"}>{selected.state}</Badge>
                    </div>
                    <Readout label="parents" value={selected.parents.join(", ") || "—"} />
                    <Readout label="children" value={`${selected.children.length}`} />
                    <Readout label="buffer" value={`${round(selected.bufferSec, 1)} s`} />
                    <Readout label="uplink" value={`${Math.round(selected.uplink * 100)} %`} />
                    <Readout label="p95 fetch" value={`${selected.p95Ms} ms`} />
                    <Readout label="contribution" value={`${Math.round(selected.contribution * 100)} %`} tone="accent" />
                    <Readout label="may serve" value={selected.serving ? "yes" : "no"} tone={selected.serving ? "ok" : "warn"} />
                  </div>
                ) : (
                  <div className="px-3.5 py-6 text-center text-[11.5px] text-text-3">
                    Click a node in the mesh to inspect that peer.
                  </div>
                )}
              </Panel>

              <DegradedBanner
                tone={player.source === "p2p" ? "info" : "warn"}
                title={player.source === "p2p" ? "Peer delivery active" : DEGRADATION_REASONS[player.source].label}
                body={DEGRADATION_REASONS[player.source].detail}
                action={
                  player.source === "p2p" ? (
                    <Button size="sm" variant="ghost" onClick={() => player.setSource("origin")}>
                      Simulate origin only
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => player.setSource("p2p")}>
                      Restore
                    </Button>
                  )
                }
              />
            </>
          ) : (
            <ChatPanel messages={chat} onSend={send} draft={draft} setDraft={setDraft} tall />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

function ChatPanel({
  messages,
  onSend,
  draft,
  setDraft,
  tall,
}: {
  messages: ChatMessage[];
  onSend: () => void;
  draft: string;
  setDraft: (v: string) => void;
  tall?: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className={`glass flex flex-col ${tall ? "h-[560px]" : "h-[420px]"}`}>
      <header className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <span className="eyebrow">live chat</span>
        <span className="num text-[10.5px] text-text-3">slow mode 5s</span>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <div className="py-10 text-center text-[11.5px] text-text-3">No messages yet. Say hello.</div>
        )}
        <ul className="space-y-1.5">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-2 text-[12px] leading-snug">
              <span className="num shrink-0 pt-[3px] text-[10px] text-text-3">{fmtClock(m.ts)}</span>
              <span className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                  <span className="font-medium text-text-1">{m.name}</span>
                  {m.role === "host" && (
                    <span className="rounded-[4px] bg-accent px-1 py-px text-[9px] font-semibold uppercase text-on-accent">host</span>
                  )}
                  {m.role === "mod" && (
                    <span className="rounded-[4px] bg-info/20 px-1 py-px text-[9px] font-semibold uppercase text-info">mod</span>
                  )}
                </span>
                {m.deleted ? (
                  <span className="ml-1 italic text-text-3">message removed by host</span>
                ) : (
                  <span className="ml-1 text-text-2">{m.body}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div ref={endRef} />
      </div>

      <div className="border-t border-line p-2.5">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
            placeholder="Send a message…"
            aria-label="Chat message"
            className="h-9 flex-1 rounded-[8px] border border-line bg-bg-1 px-3 text-[12.5px] text-text-1 placeholder:text-text-3 focus:border-accent/60 focus:outline-none"
          />
          <Button size="sm" variant="primary" onClick={onSend}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

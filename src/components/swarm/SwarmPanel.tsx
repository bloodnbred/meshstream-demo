import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ring } from "@/components/charts/Charts";
import { StackBar } from "@/components/ui/Meter";
import { Badge } from "@/components/ui/Badge";
import { Tip } from "@/components/ui/Tooltip";
import { MeshSVG } from "@/components/mesh/MeshSVG";
import { DEGRADATION_REASONS, type PlaybackSource } from "@/engine/playerStore";
import { fmtBytes, round } from "@/lib/format";
import type { Edge, Packet, PeerNode } from "@/types";

/**
 * The signature swarm panel.
 *
 * A ring with the share of bytes that came from peers, the live mesh, the
 * source breakdown — and an honest degradation ladder. When peer delivery is
 * not possible the panel says so instead of pretending.
 */
export function SwarmPanel({
  peers,
  edges,
  packets,
  offloadPct,
  bytesSaved,
  source,
  onSelectPeer,
  height = 260,
}: {
  peers: PeerNode[];
  edges: Edge[];
  packets: Packet[];
  offloadPct: number;
  bytesSaved: number;
  source: PlaybackSource;
  onSelectPeer?: (peer: PeerNode) => void;
  height?: number;
}) {
  const reason = DEGRADATION_REASONS[source];

  const segments = useMemo(() => {
    const cache = offloadPct * 0.18;
    const peersShare = Math.max(0, offloadPct - cache);
    const origin = Math.max(0, 100 - offloadPct);
    return [
      { label: "peers", value: peersShare, color: "var(--color-accent)", hint: "relayed over WebRTC data channels" },
      { label: "cache", value: cache, color: "var(--color-info)", hint: "served instantly from the local verified cache" },
      { label: "origin", value: origin, color: "var(--color-text-3)", hint: "fetched from the signed edge proxy" },
    ];
  }, [offloadPct]);

  const serving = peers.filter((p) => p.serving).length;

  return (
    <div className="flex h-full flex-col">
      {/* Headline */}
      <div className="flex items-center gap-4 px-4 py-3.5">
        <Ring pct={offloadPct} size={104} stroke={9}>
          <span className="num text-[22px] font-semibold leading-none text-accent">{round(offloadPct, 0)}%</span>
          <span className="mt-1 text-[9.5px] uppercase tracking-[0.12em] text-text-3">from peers</span>
        </Ring>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={reason.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-[13px] font-medium text-text-1"
              >
                {reason.label}
              </motion.div>
            </AnimatePresence>
            {source === "p2p" ? (
              <Badge tone="accent">DTLS</Badge>
            ) : source === "origin" ? (
              <Badge tone="info">native HLS</Badge>
            ) : (
              <Badge tone="warn">no data channel</Badge>
            )}
          </div>

          <p className="mt-1 text-[11px] leading-snug text-text-3">{reason.detail}</p>

          <div className="mt-2 flex items-center gap-4 text-[11px]">
            <span className="text-text-3">
              <span className="num text-text-1">{fmtBytes(bytesSaved)}</span> saved
            </span>
            <span className="text-text-3">
              <span className="num text-text-1">{serving}</span>/{peers.length} peers serving
            </span>
          </div>
        </div>
      </div>

      {/* Mesh */}
      <div className="relative border-y border-line bg-bg-0/40" style={{ height }}>
        <MeshSVG
          peers={peers}
          edges={edges}
          packets={packets}
          showLabels={peers.length <= 16}
          onSelect={onSelectPeer}
          className="h-full w-full"
        />
        {source !== "p2p" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-bg-0/45 backdrop-blur-[1px]">
            <span className="rounded-[8px] border border-line bg-bg-1/90 px-3 py-1.5 text-[11.5px] text-text-2">
              {source === "origin" ? "Origin only · Safari" : "Direct connection unavailable"}
            </span>
          </div>
        )}
      </div>

      {/* Source bar */}
      <div className="px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="eyebrow">source of every part</span>
          <Tip content="Each 400 ms part is served from the local cache first, then from the fastest peer, and only then from the origin.">
            <span className="cursor-help text-[10.5px] text-text-3 underline decoration-dotted underline-offset-2">
              how it works
            </span>
          </Tip>
        </div>
        <StackBar segments={segments} showLegend height={9} />
      </div>
    </div>
  );
}

import { memo, useEffect, useRef, useState } from "react";
import type { Edge, Packet, PeerNode } from "@/types";
import { controlPoint, edgePath, nodePosition, quadPoint, type Point } from "./geometry";

export interface MeshSVGProps {
  peers: PeerNode[];
  edges: Edge[];
  packets?: Packet[];
  /** Optional fixed size — otherwise the component measures its container. */
  width?: number;
  height?: number;
  /** Origin node is drawn as a card instead of a dot. */
  showLabels?: boolean;
  nodeRadius?: number;
  highlightIds?: string[];
  className?: string;
  /** Called when a peer node is clicked. */
  onSelect?: (peer: PeerNode) => void;
}

const ORIGIN = "origin";

function MeshSVGInner({
  peers,
  edges,
  packets = [],
  width: widthProp,
  height: heightProp,
  showLabels = true,
  nodeRadius = 11,
  highlightIds = [],
  className = "",
  onSelect,
}: MeshSVGProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);

  // Measure the container so the viewBox matches the real pixel size and the
  // mesh fills the panel instead of letterboxing inside it.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setMeasured((prev) => {
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (prev && Math.abs(prev.w - w) < 2 && Math.abs(prev.h - h) < 2) return prev;
        return { w, h };
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const width = widthProp ?? measured?.w ?? 520;
  const height = heightProp ?? measured?.h ?? 260;

  const byId = new Map<string, PeerNode>();
  for (const peer of peers) byId.set(peer.id, peer);

  const originPos: Point = { x: width / 2, y: height * 0.07 };

  const posOf = (id: string): Point | null => {
    if (id === ORIGIN) return originPos;
    const peer = byId.get(id);
    if (!peer) return null;
    return nodePosition(peer, width, height);
  };

  const highlighted = new Set(highlightIds);

  return (
    <div ref={wrapperRef} className={`h-full w-full ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        style={{ overflow: "visible" }}
        role="img"
        aria-label={`Swarm mesh with ${peers.length} peers and ${edges.length} connections`}
      >
      <defs>
        <filter id="mesh-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="mesh-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#323947" />
          <stop offset="100%" stopColor="#232833" />
        </linearGradient>
      </defs>

      {/* Edges */}
      <g>
        {edges.map((edge) => {
          const a = posOf(edge.from);
          const b = posOf(edge.to);
          if (!a || !b) return null;
          const isHot = highlighted.has(edge.from) && highlighted.has(edge.to);
          return (
            <path
              key={edge.id}
              d={edgePath(a, b)}
              fill="none"
              stroke={edge.active ? "var(--color-accent)" : isHot ? "var(--color-info)" : "url(#mesh-edge)"}
              strokeWidth={edge.active ? 1.7 : 1.1}
              strokeOpacity={edge.active ? 0.9 : 0.85}
              strokeLinecap="round"
              style={
                edge.active
                  ? { filter: "drop-shadow(0 0 4px var(--color-accent))" }
                  : { transition: "stroke 220ms, stroke-width 220ms" }
              }
            />
          );
        })}
      </g>

      {/* Packets */}
      <g>
        {packets.map((packet) => {
          const a = posOf(packet.from);
          const b = posOf(packet.to);
          if (!a || !b) return null;
          const c = controlPoint(a, b);
          const p = quadPoint(a, c, b, packet.t);
          return (
            <g key={packet.id}>
              <circle cx={p.x} cy={p.y} r={5.5} fill="var(--color-accent)" opacity={0.16} />
              <circle
                cx={p.x}
                cy={p.y}
                r={2.4}
                fill={packet.corrupt ? "var(--color-live)" : "var(--color-accent)"}
                filter="url(#mesh-glow)"
              />
            </g>
          );
        })}
      </g>

      {/* Nodes */}
      <g>
        {peers.map((peer) => {
          const p = nodePosition(peer, width, height);
          const dead = peer.state === "dead";
          const quarantine = peer.state === "quarantined";
          const stroke = dead
            ? "var(--color-live)"
            : quarantine
              ? "var(--color-warn)"
              : peer.state === "safari"
                ? "var(--color-info)"
                : peer.state === "background"
                  ? "var(--color-text-3)"
                  : "var(--color-accent)";

          return (
            <g
              key={peer.id}
              transform={`translate(${p.x},${p.y})`}
              onClick={onSelect ? () => onSelect(peer) : undefined}
              style={{ cursor: onSelect ? "pointer" : undefined, opacity: dead ? 0.35 : 1 }}
            >
              {peer.serving && !dead && (
                <circle r={nodeRadius + 5} fill="none" stroke="var(--color-accent)" strokeOpacity={0.22} />
              )}
              <circle
                r={nodeRadius}
                fill="var(--color-bg-1)"
                stroke={stroke}
                strokeWidth={dead || quarantine ? 1.8 : 1.4}
                strokeOpacity={dead ? 0.6 : 1}
              />
              {showLabels && (
                <text
                  y={nodeRadius + 13}
                  textAnchor="middle"
                  className="num"
                  fontSize={9.5}
                  fill="var(--color-text-3)"
                  style={{ pointerEvents: "none" }}
                >
                  {peer.initials}
                </text>
              )}
            </g>
          );
        })}

        {/* Origin node */}
        <g transform={`translate(${originPos.x},${originPos.y})`}>
          <rect x={-34} y={-16} width={68} height={32} rx={8} fill="var(--color-bg-2)" stroke="var(--color-line-strong)" />
          <rect x={-34} y={-16} width={68} height={2} rx={1} fill="var(--color-accent)" />
          <text y={4} textAnchor="middle" className="num" fontSize={10} fill="var(--color-text-1)">
            origin
          </text>
        </g>
      </g>
      </svg>
    </div>
  );
}

export const MeshSVG = memo(MeshSVGInner);

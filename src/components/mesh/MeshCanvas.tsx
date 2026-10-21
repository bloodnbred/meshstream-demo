import { useEffect, useRef } from "react";
import type { SwarmEngine } from "@/engine/swarm";
import { controlPoint, nodePosition, quadPoint, type Point } from "./geometry";

/**
 * Canvas renderer for the swarm.
 *
 * Used by the simulator, where up to 50 peers animate continuously. The
 * engine state is read directly from the mutable object on every frame, so
 * React never re-renders during animation — only the numeric readouts do,
 * at 10 Hz.
 */
export function MeshCanvas({
  engine,
  className = "",
  showLabels = true,
  onSelect,
}: {
  engine: SwarmEngine;
  className?: string;
  showLabels?: boolean;
  onSelect?: (peerId: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.max(320, rect.width);
      const h = Math.max(240, rect.height);
      sizeRef.current = { w, h };
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);

    const posOf = (id: string, w: number, h: number): Point | null => {
      if (id === "origin") return { x: w / 2, y: h * 0.06 };
      const peer = engine.state.peers.find((p) => p.id === id);
      if (!peer) return null;
      return nodePosition(peer, w, h);
    };

    const draw = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      const peers = engine.state.peers;
      const edges = engine.state.edges;

      // --- edges -----------------------------------------------------
      ctx.lineCap = "round";
      for (const edge of edges) {
        const a = posOf(edge.from, w, h);
        const b = posOf(edge.to, w, h);
        if (!a || !b) continue;
        const c = controlPoint(a, b);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
        if (edge.active) {
          ctx.strokeStyle = "rgba(201,247,58,0.75)";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "rgba(201,247,58,0.65)";
          ctx.shadowBlur = 7;
        } else {
          ctx.strokeStyle = "rgba(50,57,71,0.85)";
          ctx.lineWidth = 1;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // --- packets ---------------------------------------------------
      for (const packet of engine.state.packets) {
        const a = posOf(packet.from, w, h);
        const b = posOf(packet.to, w, h);
        if (!a || !b) continue;
        const c = controlPoint(a, b);
        const p = quadPoint(a, c, b, packet.t);
        const color = packet.corrupt ? "255,90,95" : "201,247,58";

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
        grad.addColorStop(0, `rgba(${color},0.42)`);
        grad.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgb(${color})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- nodes -----------------------------------------------------
      // The origin is not a peer — it is the root of the tree.
      const ox = w / 2;
      const oy = h * 0.06;
      ctx.fillStyle = "rgba(19,22,28,1)";
      ctx.strokeStyle = "rgba(50,57,71,1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(ox - 34, oy - 15, 68, 30, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(201,247,58,1)";
      ctx.fillRect(ox - 34, oy - 15, 68, 2);
      ctx.fillStyle = "rgba(236,238,242,0.92)";
      ctx.font = "10px 'JetBrains Mono Variable', monospace";
      ctx.textAlign = "center";
      ctx.fillText("origin", ox, oy + 4);

      for (const peer of peers) {
        const p = nodePosition(peer, w, h);
        const dead = peer.state === "dead";
        const r = 8;

        // Death flash ring.
        const death = engine.state.deaths.find((d) => d.id === peer.id);
        if (death) {
          const age = engine.state.time - death.at;
          if (age < 0.9) {
            const k = 1 - age / 0.9;
            ctx.strokeStyle = `rgba(255,90,95,${k * 0.85})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 9 + (1 - k) * 22, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        const stroke =
          dead
            ? "rgba(255,90,95,0.55)"
            : peer.state === "quarantined"
              ? "rgba(255,176,32,0.95)"
              : peer.state === "safari"
                ? "rgba(91,157,255,0.95)"
                : peer.state === "background"
                  ? "rgba(106,114,128,0.9)"
                  : "rgba(201,247,58,0.95)";

        if (peer.serving && !dead) {
          ctx.strokeStyle = "rgba(201,247,58,0.2)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = dead ? "rgba(13,15,19,0.7)" : peer.color;
        ctx.globalAlpha = dead ? 0.45 : 0.95;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = stroke;
        ctx.lineWidth = dead || peer.state === "quarantined" ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();

        if (showLabels && !dead && peers.length <= 34) {
          ctx.fillStyle = "rgba(236,238,242,0.88)";
          ctx.font = "8.5px 'JetBrains Mono Variable', monospace";
          ctx.textAlign = "center";
          ctx.fillText(peer.initials, p.x, p.y + 2.6);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [engine, showLabels]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelect) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: { id: string; dist: number } | null = null;
    for (const peer of engine.state.peers) {
      if (peer.id === "origin") continue;
      const p = nodePosition(peer, sizeRef.current.w, sizeRef.current.h);
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < 14 && (!best || dist < best.dist)) best = { id: peer.id, dist };
    }
    if (best) onSelect(best.id);
  };

  return (
    <div ref={wrapperRef} className={`relative h-full w-full ${className}`}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="block h-full w-full"
        role="img"
        aria-label={`Live swarm canvas: ${engine.state.peers.length} peers, ${engine.state.edges.length} connections`}
      />
    </div>
  );
}

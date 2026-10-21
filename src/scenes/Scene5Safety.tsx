import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Scene 5 — the safety net.
 *
 * A peer dies: a 120 ms red flash, a dashed "rerouting" path, the children
 * re-parent, and the origin briefly covers the gap.
 */
export function Scene5Safety({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<"idle" | "death" | "reroute" | "healed">("idle");

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setPhase("death"), 900));
    timers.push(window.setTimeout(() => setPhase("reroute"), 1500));
    timers.push(window.setTimeout(() => setPhase("healed"), 3200));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active]);

  const origin = { x: 500, y: 60 };
  const parent = { x: 360, y: 190 };
  const children = [
    { x: 250, y: 330 },
    { x: 420, y: 330 },
  ];
  const orphan = { x: 580, y: 330 };
  const grandchild = { x: 660, y: 440 };

  const dead = phase !== "idle";

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="relative w-full max-w-[760px]">
        <svg viewBox="0 0 1000 520" className="w-full" aria-hidden>
          {/* Static tree */}
          <line x1={origin.x} y1={origin.y} x2={parent.x} y2={parent.y} stroke="#232833" strokeWidth="1.2" />
          <line x1={origin.x} y1={origin.y} x2={590} y2={parent.y} stroke="#232833" strokeWidth="1.2" />
          <line x1={parent.x} y1={parent.y} x2={children[0].x} y2={children[0].y} stroke="#232833" strokeWidth="1.2" />
          <line x1={parent.x} y1={parent.y} x2={children[1].x} y2={children[1].y} stroke="#232833" strokeWidth="1.2" />
          <line x1={children[1].x} y1={children[1].y} x2={grandchild.x} y2={grandchild.y} stroke="#232833" strokeWidth="1.2" />

          {/* The origin covering the gap — solid lime while it covers */}
          <motion.line
            x1={origin.x}
            y1={origin.y}
            x2={children[0].x}
            y2={children[0].y}
            stroke="#C9F73A"
            strokeWidth="1.6"
            strokeDasharray="6 5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={phase === "reroute" ? { pathLength: 1, opacity: 0.9 } : { pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.5 }}
          />

          {/* Dashed rerouting path to a new parent */}
          <motion.line
            x1={origin.x}
            y1={origin.y}
            x2={orphan.x}
            y2={orphan.y}
            stroke="#FFB020"
            strokeWidth="1.6"
            strokeDasharray="7 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={phase === "reroute" ? { pathLength: 1, opacity: 0.95 } : phase === "healed" ? { pathLength: 1, opacity: 0.3 } : { pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ animation: phase === "reroute" ? "dash-march 900ms linear infinite" : undefined }}
          />

          {/* Nodes */}
          <g>
            <rect x={origin.x - 34} y={origin.y - 16} width={68} height={32} rx={8} fill="#13161C" stroke="#323947" />
            <rect x={origin.x - 34} y={origin.y - 16} width={68} height={2} rx={1} fill="#C9F73A" />
          </g>

          {/* The peer that dies */}
          <g>
            <motion.circle
              cx={parent.x}
              cy={parent.y}
              r={15}
              fill="#0D0F13"
              stroke={dead ? "#FF5A5F" : "#C9F73A"}
              strokeWidth={2}
              animate={dead ? { opacity: 0.45 } : { opacity: 1 }}
            />
            <AnimatePresence>
              {phase === "death" && (
                <motion.circle
                  key="flash"
                  cx={parent.x}
                  cy={parent.y}
                  r={16}
                  fill="none"
                  stroke="#FF5A5F"
                  strokeWidth={2.5}
                  initial={{ opacity: 0.9, scale: 1 }}
                  animate={{ opacity: 0, scale: 2.6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45 }}
                  style={{ transformOrigin: `${parent.x}px ${parent.y}px` }}
                />
              )}
            </AnimatePresence>
            {dead && (
              <text x={parent.x} y={parent.y + 38} textAnchor="middle" className="num" fontSize="10" fill="#FF5A5F">
                peer lost
              </text>
            )}
          </g>

          {[{ p: children[0], c: "#323947" }, { p: children[1], c: "#323947" }, { p: orphan, c: "#FFB020" }, { p: grandchild, c: "#323947" }].map(
            ({ p, c }) => (
              <g key={`${p.x}-${p.y}`}>
                <circle cx={p.x} cy={p.y} r={12} fill="#0D0F13" stroke={c} strokeWidth={1.6} />
                <circle cx={p.x} cy={p.y} r={4} fill={c === "#FFB020" ? "#FFB020" : "#9AA1AE"} />
              </g>
            ),
          )}
        </svg>
      </div>

      {/* Explanation card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="absolute bottom-4 left-1/2 w-[min(560px,92vw)] -translate-x-1/2"
      >
        <div className="glass glass-strong p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                phase === "idle" ? "bg-ok" : phase === "death" ? "bg-live" : phase === "reroute" ? "bg-warn" : "bg-accent"
              }`}
            />
            <span className="eyebrow">
              {phase === "idle" && "stable"}
              {phase === "death" && "peer disconnected"}
              {phase === "reroute" && "re-parenting"}
              {phase === "healed" && "tree healed"}
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-text-2">
            If a peer disappears, its children re-parent inside one part interval. The origin covers the gap in the meantime — the stream never stops.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

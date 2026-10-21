import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { makeRng } from "@/mock/rng";
import { Meter } from "@/components/ui/Meter";

/**
 * Scene 4 — parts travel sideways.
 *
 * Packets run along the tree edges while the origin meter falls from 100 %
 * to about 30 %.
 */
export function Scene4Travel({ active }: { active: boolean }) {
  const nodes = useMemo(() => {
    const rng = makeRng(12);
    const origin = { x: 500, y: 60 };
    const seeds = [
      { x: 300, y: 175 },
      { x: 500, y: 175 },
      { x: 700, y: 175 },
    ];
    const mids = [
      { x: 180, y: 300 },
      { x: 340, y: 300 },
      { x: 560, y: 300 },
      { x: 760, y: 300 },
    ];
    const leaves = [
      { x: 110, y: 420 },
      { x: 260, y: 420 },
      { x: 420, y: 420 },
      { x: 580, y: 420 },
      { x: 740, y: 420 },
      { x: 880, y: 420 },
    ];
    const all: { id: string; x: number; y: number; parent: string | null }[] = [
      { id: "o", ...origin, parent: null },
      ...seeds.map((s, i) => ({ id: `s${i}`, ...s, parent: "o" })),
      ...mids.map((m, i) => ({ id: `m${i}`, ...m, parent: `s${i % 3}` })),
      ...leaves.map((l, i) => ({ id: `l${i}`, ...l, parent: `m${i % 4}` })),
    ];
    void rng;
    return all;
  }, []);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const [egress, setEgress] = useState(100);

  useEffect(() => {
    if (!active) return;
    setEgress(100);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 2600);
      // 100 % -> 30 % with an ease-out curve.
      setEgress(100 - 70 * (1 - (1 - t) ** 2));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const packetEdges = nodes.filter((n) => n.parent);

  return (
    <div className="relative flex h-full w-full items-center justify-center gap-10 px-6">
      <div className="relative w-full max-w-[620px]">
        <svg viewBox="0 0 1000 500" className="w-full" aria-hidden>
          {packetEdges.map((n) => {
            const p = byId.get(n.parent!)!;
            return (
              <g key={`e-${n.id}`}>
                <line x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke="#232833" strokeWidth="1.2" />
                {active &&
                  [0, 1].map((k) => (
                    <motion.circle
                      key={k}
                      r={3.4}
                      fill="#C9F73A"
                      initial={{ cx: p.x, cy: p.y, opacity: 0 }}
                      animate={{ cx: n.x, cy: n.y, opacity: [0, 1, 1, 0] }}
                      transition={{
                        delay: 0.5 + k * 0.9 + (n.id.charCodeAt(1) % 7) * 0.12,
                        duration: 1.1,
                        repeat: Infinity,
                        repeatDelay: 0.5,
                        ease: "linear",
                      }}
                      style={{ filter: "drop-shadow(0 0 5px rgba(201,247,58,.8))" }}
                    />
                  ))}
              </g>
            );
          })}

          {nodes.map((n) => (
            <g key={n.id}>
              {n.id === "o" ? (
                <>
                  <rect x={n.x - 34} y={n.y - 16} width={68} height={32} rx={8} fill="#13161C" stroke="#323947" />
                  <rect x={n.x - 34} y={n.y - 16} width={68} height={2} rx={1} fill="#C9F73A" />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" className="num" fontSize="10" fill="#ECEEF2">
                    origin
                  </text>
                </>
              ) : (
                <circle cx={n.x} cy={n.y} r={n.id.startsWith("s") ? 13 : 9} fill="#0D0F13" stroke="#C9F73A" strokeWidth={1.5} />
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Origin egress meter */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="w-[240px] shrink-0"
      >
        <div className="eyebrow mb-3">origin egress</div>
        <div className="num mb-1 text-[38px] font-semibold leading-none text-text-1">
          {Math.round(egress)}
          <span className="ml-1 text-[16px] text-text-3">%</span>
        </div>
        <Meter value={egress} max={100} tone={egress < 45 ? "accent" : "warn"} height={7} glow />
        <p className="mt-3 text-[11.5px] leading-relaxed text-text-3">
          The origin seeds the swarm and then steps back. The rest of the bytes travel viewer to viewer, straight over UDP — they never touch the tunnel.
        </p>
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-[11px]">
          <div className="flex justify-between">
            <span className="text-text-3">before</span>
            <span className="num text-text-2">11.6 Mbps</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-3">after</span>
            <span className="num text-accent">3.4 Mbps</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

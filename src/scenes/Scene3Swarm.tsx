import { useMemo } from "react";
import { motion } from "framer-motion";
import { makeRng } from "@/mock/rng";

/**
 * Scene 3 — the swarm forms.
 *
 * Viewers appear and snap into a distribution tree around the origin.
 */
export function Scene3Swarm({ active }: { active: boolean }) {
  const layout = useMemo(() => {
    const rng = makeRng(31);
    const origin = { x: 500, y: 70 };
    const seeds = [
      { x: 320, y: 190 },
      { x: 500, y: 190 },
      { x: 680, y: 190 },
    ];
    const mids = [
      { x: 190, y: 310 },
      { x: 330, y: 310 },
      { x: 500, y: 310 },
      { x: 670, y: 310 },
      { x: 810, y: 310 },
    ];
    const leaves = [
      { x: 120, y: 430 },
      { x: 250, y: 430 },
      { x: 380, y: 430 },
      { x: 500, y: 430 },
      { x: 620, y: 430 },
      { x: 750, y: 430 },
      { x: 880, y: 430 },
    ];
    const nodes = [
      { id: "o", ...origin, kind: "origin" as const, parent: null },
      ...seeds.map((s, i) => ({ id: `s${i}`, ...s, kind: "seed" as const, parent: "o" })),
      ...mids.map((m, i) => ({ id: `m${i}`, ...m, kind: "peer" as const, parent: `s${i % 3}` })),
      ...leaves.map((l, i) => ({ id: `l${i}`, ...l, kind: "peer" as const, parent: `m${i % 5}` })),
    ];
    return { origin, seeds, mids, leaves, nodes, jitter: rng.range(-8, 8) };
  }, []);

  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      <svg viewBox="0 0 1000 520" className="w-full max-w-[1000px] px-6" aria-hidden>
        {/* Edges draw in first, then the nodes land on them. */}
        {layout.nodes
          .filter((n) => n.parent)
          .map((n, i) => {
            const p = byId.get(n.parent!)!;
            return (
              <motion.line
                key={`e-${n.id}`}
                x1={p.x}
                y1={p.y}
                x2={n.x}
                y2={n.y}
                stroke="#232833"
                strokeWidth="1.2"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={{ delay: 0.12 * i + 0.3, duration: 0.5, ease: "easeOut" }}
              />
            );
          })}

        {layout.nodes.map((n, i) => {
          const isOrigin = n.kind === "origin";
          const isSeed = n.kind === "seed";
          return (
            <motion.g
              key={n.id}
              initial={{ opacity: 0, scale: 0.4, x: n.x + 40, y: n.y - 30 }}
              animate={
                active
                  ? {
                      opacity: 1,
                      scale: 1,
                      x: n.x,
                      y: n.y,
                      transition: { delay: 0.5 + 0.055 * i, duration: 0.55, ease: [0.2, 0.9, 0.25, 1] },
                    }
                  : { opacity: 0, scale: 0.4, x: n.x + 40, y: n.y - 30 }
              }
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {isOrigin ? (
                <g>
                  <rect x={-36} y={-17} width={72} height={34} rx={9} fill="#13161C" stroke="#323947" />
                  <rect x={-36} y={-17} width={72} height={2} rx={1} fill="#C9F73A" />
                  <text y={4} textAnchor="middle" className="num" fontSize="11" fill="#ECEEF2">
                    origin
                  </text>
                </g>
              ) : (
                <g>
                  <circle
                    r={isSeed ? 15 : 11}
                    fill="#0D0F13"
                    stroke={isSeed ? "#C9F73A" : "#323947"}
                    strokeWidth={isSeed ? 2 : 1.3}
                  />
                  <circle r={isSeed ? 5 : 3.6} fill={isSeed ? "#C9F73A" : "#9AA1AE"} />
                </g>
              )}
            </motion.g>
          );
        })}
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="mt-2 flex max-w-[56ch] flex-col items-center gap-3 px-6 text-center"
      >
        <p className="text-[13px] leading-relaxed text-text-2">
          The audience becomes the network. The origin seeds three viewers; each viewer passes parts to up to four more.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10.5px] text-text-3">
          <span>
            <span className="num text-text-2">≤ 3</span> origin seeds
          </span>
          <span>
            <span className="num text-text-2">1–2</span> parents
          </span>
          <span>
            <span className="num text-text-2">≤ 4</span> children
          </span>
          <span>
            <span className="num text-text-2">60 s</span> verified cache
          </span>
        </div>
      </motion.div>
    </div>
  );
}

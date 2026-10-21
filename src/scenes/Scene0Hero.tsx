import { useMemo } from "react";
import { motion } from "framer-motion";
import { FIELD_H, FIELD_W, GLYPH, makeField, makeFieldEdges } from "./field";

/**
 * Scene 0 — the hook.
 *
 * A sparse node field drifts, snaps into a mesh, then three of the nodes
 * brighten into the MeshStream glyph.
 */
export function Scene0Hero({ active }: { active: boolean }) {
  const nodes = useMemo(() => makeField(46, 7), []);
  const edges = useMemo(() => makeFieldEdges(), []);

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="hero-node" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#C9F73A" stopOpacity="1" />
            <stop offset="100%" stopColor="#C9F73A" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        {/* Network lines that appear once the field has snapped. */}
        <g opacity={active ? 1 : 0} style={{ transition: "opacity 900ms ease 2000ms" }}>
          {edges.map((edge, i) => {
            const a = nodes[edge.a % nodes.length];
            const b = nodes[edge.b % nodes.length];
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.tx}
                y1={a.ty}
                x2={b.tx}
                y2={b.ty}
                stroke="#232833"
                strokeWidth={1}
                opacity={0.9}
              />
            );
          })}
        </g>

        {/* The node field. */}
        {nodes.map((n) => (
          <circle
            key={n.id}
            cx={0}
            cy={0}
            r={n.r}
            fill="url(#hero-node)"
            className={active ? "node-field node-field-collapse" : ""}
            style={
              {
                "--sx": `${n.sx}px`,
                "--sy": `${n.sy}px`,
                "--tx": `${n.tx}px`,
                "--ty": `${n.ty}px`,
                "--gx": `${n.gx}px`,
                "--gy": `${n.gy}px`,
                "--delay": `${n.delay}ms`,
                "--op": n.opacity,
                "--s0": 0.4,
                transformBox: "view-box",
              } as React.CSSProperties
            }
          />
        ))}

        {/* The glyph that the field collapses into. */}
        <motion.g
          initial={{ opacity: 0, scale: 0.9 }}
          animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ delay: 2.9, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ transformOrigin: "500px 300px" }}
        >
          <path
            d={`M${GLYPH[0].x} ${GLYPH[0].y} L${GLYPH[1].x} ${GLYPH[1].y} L${GLYPH[2].x} ${GLYPH[2].y} Z`}
            fill="none"
            stroke="#C9F73A"
            strokeWidth="1.6"
            strokeOpacity="0.45"
            strokeDasharray="220"
            style={{ animation: active ? "glyph-draw 900ms cubic-bezier(.2,.8,.2,1) 3s both" : undefined }}
          />
          <path
            d={`M${GLYPH[0].x} ${GLYPH[0].y} L${GLYPH[2].x} ${GLYPH[2].y}`}
            fill="none"
            stroke="#C9F73A"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="220"
            style={{ animation: active ? "glyph-draw 700ms cubic-bezier(.2,.8,.2,1) 3.1s both" : undefined }}
          />
          {GLYPH.map((g, i) => (
            <circle key={i} cx={g.x} cy={g.y} r={i === 0 ? 13 : 11} fill="#0D0F13" stroke="#C9F73A" strokeWidth="2" />
          ))}
        </motion.g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          className="max-w-[640px] px-6 text-center"
        >
          <div className="eyebrow mb-3">MeshStream</div>
          <h2 className="display text-[clamp(28px,4.6vw,58px)] leading-[1.02] text-text-1 text-glow">
            The audience is the network.
          </h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-[14px] leading-relaxed text-text-2">
            Live video that travels light. One creator goes live; every viewer relays parts to a few others over WebRTC.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

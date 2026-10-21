import { useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/mesh/Logo";
import { useAppStore } from "@/engine/store";
import { FIELD_H, FIELD_W, GLYPH, makeField } from "./field";

/**
 * Scene 7 — the close.
 *
 * The mesh collapses back into the glyph and the demo hands over the three
 * ways in: guided story, simulator, studio.
 */
export function Scene7Cta({ active }: { active: boolean }) {
  const setRoute = useAppStore((s) => s.setRoute);
  const nodes = useMemo(() => makeField(34, 19), []);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 px-6">
      <svg viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {nodes.map((n) => (
          <circle
            key={n.id}
            cx={0}
            cy={0}
            r={n.r * 0.8}
            fill="#C9F73A"
            className={active ? "node-field-collapse" : ""}
            style={
              {
                "--sx": `${n.sx}px`,
                "--sy": `${n.sy}px`,
                "--tx": `${n.tx}px`,
                "--ty": `${n.ty}px`,
                "--gx": `${n.gx}px`,
                "--gy": `${n.gy}px`,
                "--delay": `${n.delay}ms`,
                opacity: 0.35,
                transformBox: "view-box",
              } as React.CSSProperties
            }
          />
        ))}
      </svg>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ delay: 0.2, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 flex flex-col items-center gap-5 text-center"
      >
        <Logo size={54} animated />
        <h2 className="display text-[clamp(26px,4vw,52px)] leading-[1.05] text-text-1">Go live in your browser.</h2>
        <p className="max-w-[44ch] text-[13.5px] leading-relaxed text-text-2">
          No account. No email. Thirty seconds from opening the tab to a public link. The audience does the rest.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" size="lg" onClick={() => setRoute("story")}>
            Start guided demo
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setRoute("simulator")}>
            Open simulator
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setRoute("studio")}>
            Watch the studio
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-text-3">
          <span>
            <span className="num text-text-2">$0</span> hosting
          </span>
          <span>
            <span className="num text-text-2">1280x720</span> @ 30 fps
          </span>
          <span>
            <span className="num text-text-2">2.5–4 s</span> glass-to-glass
          </span>
          <span>
            <span className="num text-text-2">55–70 %</span> offload at 20+ viewers
          </span>
        </div>
      </motion.div>

      <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[10.5px] uppercase tracking-[0.16em] text-text-3">
        {GLYPH.length} nodes · one network
      </span>
    </div>
  );
}

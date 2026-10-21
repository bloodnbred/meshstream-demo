import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MeshCanvas } from "@/components/mesh/MeshCanvas";
import { Button } from "@/components/ui/Button";
import { engine } from "@/engine/swarm";
import { useAppStore } from "@/engine/store";

/**
 * Scene 6 — the hand-off to the simulator.
 *
 * A live, read-only slice of the real engine so the audience sees that the
 * simulator is the same model, not a video.
 */
export function Scene6Simulator({ active }: { active: boolean }) {
  const setRoute = useAppStore((s) => s.setRoute);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;
    // Keep the swarm small and warm for the teaser.
    engine.setViewers(14);
    engine.setP2p(true);
    engine.setSaturated(false);
    engine.setSlowNetwork(false);
  }, [active]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="glass glass-strong w-full max-w-[760px] overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
          <span className="eyebrow">live model</span>
          <span className="num text-[10px] text-text-3">origin · 14 peers · 1 s parts</span>
        </div>
        <div ref={containerRef} className="h-[260px] w-full">
          <MeshCanvas engine={engine} showLabels={false} />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ delay: 0.25, duration: 0.6 }}
        className="flex max-w-[52ch] flex-col items-center gap-4 text-center"
      >
        <p className="text-[13px] leading-relaxed text-text-2">
          Try it yourself. Change the audience, kill a peer, saturate the origin, and watch the scheduler react — the same engine that drives this
          page.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" onClick={() => setRoute("simulator")}>
            Open the simulator
          </Button>
          <Button variant="secondary" onClick={() => setRoute("viewer")}>
            See it as a viewer
          </Button>
        </div>
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-3">
          Simulation — modeled on the live scheduler
        </span>
      </motion.div>
    </div>
  );
}

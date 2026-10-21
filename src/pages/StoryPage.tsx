import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/Badge";
import { SceneRail } from "@/scenes/SceneRail";
import { SCENES } from "@/scenes/scenesData";
import { Scene0Hero } from "@/scenes/Scene0Hero";
import { Scene1Origin } from "@/scenes/Scene1Origin";
import { Scene2Sliced } from "@/scenes/Scene2Sliced";
import { Scene3Swarm } from "@/scenes/Scene3Swarm";
import { Scene4Travel } from "@/scenes/Scene4Travel";
import { Scene5Safety } from "@/scenes/Scene5Safety";
import { Scene6Simulator } from "@/scenes/Scene6Simulator";
import { Scene7Cta } from "@/scenes/Scene7Cta";
import { useAnimationsEnabled } from "@/engine/hooks";
import { useAppStore } from "@/engine/store";

const SCENE_COMPONENTS = [
  Scene0Hero,
  Scene1Origin,
  Scene2Sliced,
  Scene3Swarm,
  Scene4Travel,
  Scene5Safety,
  Scene6Simulator,
  Scene7Cta,
];

/**
 * The guided story.
 *
 * A sticky 100vh stage driven by scroll. Every scene is a single visual
 * idea; the caption below it is the sentence a presenter would say.
 */
export function StoryPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const animations = useAnimationsEnabled();
  const setRoute = useAppStore((s) => s.setRoute);
  const setMotion = useAppStore((s) => s.setMotion);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  useMotionValueEvent(smooth, "change", (value) => {
    setProgress(value);
    const index = Math.min(SCENES.length - 1, Math.max(0, Math.floor(value * SCENES.length + 0.001)));
    setActive((prev) => (prev === index ? prev : index));
  });

  const scrollToScene = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container) return;
      const total = container.offsetHeight - window.innerHeight;
      const target = container.offsetTop + (total * index) / SCENES.length;
      window.scrollTo({ top: target, behavior: animations ? "smooth" : "auto" });
    },
    [animations],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        scrollToScene(Math.min(SCENES.length - 1, active + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        scrollToScene(Math.max(0, active - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, scrollToScene]);

  const CurrentScene = SCENE_COMPONENTS[active];
  const scene = SCENES[active];

  if (!animations) {
    // Static fallback: the full step list, complete on its own.
    return (
      <div className="mx-auto max-w-[1000px] px-5 py-10">
        <header className="mb-8">
          <DemoBadge className="mb-4" />
          <h1 className="display text-[34px]">How MeshStream works</h1>
          <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-text-2">
            Animations are off (your system asks for reduced motion). The story is below as a complete, readable sequence — every step, every number.
          </p>
        </header>
        <ol className="space-y-6">
          {SCENES.map((s) => (
            <li key={s.id} className="glass p-5">
              <div className="eyebrow mb-2">
                {s.id + 1}. {s.nav}
              </div>
              <h2 className="display text-[19px]">{s.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">{s.caption}</p>
              {s.detail && <p className="mt-2 text-[11px] text-text-3">{s.detail}</p>}
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setRoute("simulator")}>
            Open the simulator
          </Button>
          <Button variant="secondary" onClick={() => setRoute("hero")}>
            Back to the start
          </Button>
          <Button variant="ghost" onClick={() => setMotion("on")}>
            Play animations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" style={{ height: `${SCENES.length * 100}vh` }}>
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden">
        <SceneRail active={active} progress={progress} onSelect={scrollToScene} />

        {/* Stage */}
        <div className="relative mx-auto h-full w-full max-w-[1240px] px-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="h-full w-full pt-12 pb-[104px]"
            >
              <CurrentScene active={active === scene.id} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Caption bar */}
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-line bg-bg-0/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="num text-[11px] text-accent">
                  {String(scene.id + 1).padStart(2, "0")}/{String(SCENES.length).padStart(2, "0")}
                </span>
                <span className="eyebrow">{scene.nav}</span>
              </div>
              <p className="mt-0.5 truncate text-[13.5px] text-text-1">{scene.caption}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => scrollToScene(0)}>
                Replay
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setRoute("simulator")}>
                Skip to simulator
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, KeyCap } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ROUTES, useAppStore } from "@/engine/store";
import { trackFor } from "./talkTrack";
import { TOUR, TOUR_TOTAL_MS } from "./tour";
import { fmtDuration } from "@/lib/format";

/**
 * Presenter mode.
 *
 * Big captions, a talk track, a timer, section navigation and a laser
 * pointer. The auto-play tour runs the whole demo hands-free.
 */
export function PresenterOverlay() {
  const presenterMode = useAppStore((s) => s.presenterMode);
  const togglePresenter = useAppStore((s) => s.togglePresenter);
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);

  const [elapsed, setElapsed] = useState(0);
  const [tour, setTour] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [tourRemaining, setTourRemaining] = useState(0);
  const pointerRef = useRef<HTMLDivElement | null>(null);

  const track = trackFor(route);

  // Timer
  useEffect(() => {
    if (!presenterMode) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(id);
  }, [presenterMode]);

  // Section navigation + tour control
  useEffect(() => {
    if (!presenterMode) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const idx = ROUTES.findIndex((r) => r.id === route);

      if (e.key === "ArrowDown" || e.key === "]" || e.key === "PageDown") {
        e.preventDefault();
        setRoute(ROUTES[Math.min(ROUTES.length - 1, idx + 1)].id);
      } else if (e.key === "ArrowUp" || e.key === "[" || e.key === "PageUp") {
        e.preventDefault();
        setRoute(ROUTES[Math.max(0, idx - 1)].id);
      } else if (e.key === "t" || e.key === "T") {
        setTour((t) => !t);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenterMode, route, setRoute]);

  // Auto-play tour
  useEffect(() => {
    if (!tour) return;
    const step = TOUR[tourIndex];
    setRoute(step.route);
    setTourRemaining(step.hold);
    const started = Date.now();

    const tick = setInterval(() => setTourRemaining(Math.max(0, step.hold - (Date.now() - started))), 200);
    const advance = setTimeout(() => {
      setTourIndex((i) => {
        if (i >= TOUR.length - 1) {
          setTour(false);
          return i;
        }
        return i + 1;
      });
    }, step.hold);

    return () => {
      clearInterval(tick);
      clearTimeout(advance);
    };
  }, [tour, tourIndex, setRoute]);

  // Laser pointer
  useEffect(() => {
    if (!presenterMode) return;
    const onMove = (e: MouseEvent) => {
      const el = pointerRef.current;
      if (!el) return;
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [presenterMode]);

  if (!presenterMode) return null;

  const caption = tour ? TOUR[tourIndex]?.caption ?? track.caption : track.caption;

  return (
    <>
      {/* Laser pointer */}
      <div
        ref={pointerRef}
        className="laser"
        style={{ transform: "translate3d(-100px,-100px,0)" }}
        aria-hidden
      />

      {/* Big caption */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[85] flex justify-center px-6 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={caption}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="glass glass-strong max-w-[1000px] px-6 py-4 text-center"
          >
            <div className="text-[clamp(18px,2.6vw,30px)] font-semibold leading-tight tracking-[-0.02em] text-text-1">
              {caption}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Talk track + controls */}
      <aside className="fixed right-4 top-4 z-[86] w-[340px]">
        <div className="glass glass-strong overflow-hidden">
          <header className="flex items-center gap-2 border-b border-line px-3.5 py-2">
            <Badge tone="accent">presenter</Badge>
            <span className="num ml-auto text-[11px] text-text-2">{fmtDuration(elapsed / 1000)}</span>
            <button
              onClick={togglePresenter}
              className="rounded px-1 text-[11px] text-text-3 transition-colors hover:text-text-1"
              aria-label="Exit presenter mode"
            >
              exit
            </button>
          </header>

          <div className="p-3.5">
            <div className="eyebrow mb-1">
              {ROUTES.find((r) => r.id === route)?.label} · talk track
            </div>
            <p className="text-[12.5px] leading-relaxed text-text-2">{track.notes}</p>
          </div>

          {tour && (
            <div className="border-t border-line p-3.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="eyebrow">auto-play tour</span>
                <span className="num text-[11px] text-text-2">
                  {Math.ceil(tourRemaining / 1000)}s · step {tourIndex + 1}/{TOUR.length}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-bg-3">
                <div
                  className="h-full bg-accent transition-[width] duration-200"
                  style={{ width: `${100 - (tourRemaining / (TOUR[tourIndex]?.hold || 1)) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setTour(false)}>
                  Stop tour
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTourIndex((i) => Math.min(TOUR.length - 1, i + 1))}
                >
                  Skip →
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-line p-3.5">
            <div className="eyebrow mb-1.5">sections</div>
            <div className="max-h-[190px] space-y-0.5 overflow-y-auto">
              {ROUTES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRoute(r.id)}
                  className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1 text-left text-[11.5px] transition-colors ${
                    r.id === route ? "bg-bg-3 text-text-1" : "text-text-3 hover:bg-bg-2 hover:text-text-2"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${r.id === route ? "bg-accent" : "bg-line-strong"}`} />
                  {r.label}
                </button>
              ))}
            </div>

            <div className="mt-2.5 border-t border-line pt-2.5">
              <Button size="sm" variant={tour ? "primary" : "secondary"} className="w-full" onClick={() => setTour((t) => !t)}>
                {tour ? "Stop auto-play" : `Auto-play tour (${Math.round(TOUR_TOTAL_MS / 1000)}s)`}
              </Button>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-3">
                <span className="inline-flex items-center gap-1">
                  <KeyCap>↑</KeyCap>
                  <KeyCap>↓</KeyCap> section
                </span>
                <span className="inline-flex items-center gap-1">
                  <KeyCap>T</KeyCap> tour
                </span>
                <span className="inline-flex items-center gap-1">
                  <KeyCap>P</KeyCap> exit
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

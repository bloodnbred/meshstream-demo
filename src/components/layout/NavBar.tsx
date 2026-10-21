import { motion } from "framer-motion";
import { Logo, Wordmark } from "@/components/mesh/Logo";
import { DemoBadge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/Button";
import { Tip } from "@/components/ui/Tooltip";
import { ROUTES, useAppStore } from "@/engine/store";
import { useSystemReducedMotion } from "@/engine/hooks";
import type { RouteId } from "@/types";

export function NavBar() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const setPalette = useAppStore((s) => s.setPalette);
  const toggleDevConsole = useAppStore((s) => s.toggleDevConsole);
  const togglePresenter = useAppStore((s) => s.togglePresenter);
  const projector = useAppStore((s) => s.projector);
  const toggleProjector = useAppStore((s) => s.toggleProjector);
  const presenterMode = useAppStore((s) => s.presenterMode);
  const devConsoleOpen = useAppStore((s) => s.devConsoleOpen);
  const motionPref = useAppStore((s) => s.motion);
  const setMotion = useAppStore((s) => s.setMotion);
  const systemReduced = useSystemReducedMotion();

  const go = (id: RouteId) => {
    setRoute(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg-0/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:px-6">
        <button
          onClick={() => go("hero")}
          className="flex items-center gap-2.5 rounded-[8px] pr-2 text-left"
          aria-label="MeshStream home"
        >
          <Logo size={24} animated />
          <Wordmark />
        </button>

        <DemoBadge className="hidden md:inline-flex" />

        <nav className="ml-2 hidden flex-1 items-center gap-0.5 lg:flex" aria-label="Sections">
          {ROUTES.map((item) => {
            const active = route === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                title={item.hint}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-[8px] px-2.5 py-1.5 text-[12.5px] transition-colors duration-150 ${
                  active ? "text-text-1" : "text-text-3 hover:text-text-2"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-[8px] border border-line bg-bg-2"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {systemReduced && motionPref === "auto" && (
            <Tip content="Your system asks for reduced motion. Turn the animation layer on anyway.">
              <button
                onClick={() => setMotion("on")}
                className="mr-1 hidden items-center gap-1.5 rounded-[8px] border border-accent/40 bg-accent/8 px-2 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/15 sm:inline-flex"
              >
                ▶ Play animations
              </button>
            </Tip>
          )}

          <Tip content="Command palette (Ctrl/⌘ + K)">
            <button
              onClick={() => setPalette(true)}
              className="num hidden h-8 items-center gap-2 rounded-[8px] border border-line bg-bg-1 px-2.5 text-[11px] text-text-3 transition-colors hover:border-line-strong hover:text-text-2 md:flex"
            >
              <span>search</span>
              <span className="rounded-[4px] border border-line px-1 py-px text-[9.5px]">⌘K</span>
            </button>
          </Tip>

          <Tip content="Projector mode — bigger type for the room">
            <IconButton
              label="Toggle projector mode"
              onClick={toggleProjector}
              active={projector}
              tone={projector ? "accent" : "default"}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
                <path d="M6 14h4" strokeLinecap="round" />
              </svg>
            </IconButton>
          </Tip>

          <Tip content="Presenter mode (P)">
            <IconButton
              label="Toggle presenter mode"
              onClick={togglePresenter}
              active={presenterMode}
              tone={presenterMode ? "accent" : "default"}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
                <path d="M8 2v1.5" strokeLinecap="round" />
              </svg>
            </IconButton>
          </Tip>

          <Tip content="Dev console / network inspector (G)">
            <IconButton
              label="Toggle dev console"
              onClick={toggleDevConsole}
              active={devConsoleOpen}
              tone={devConsoleOpen ? "accent" : "default"}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="m5 5-3 3 3 3M11 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </IconButton>
          </Tip>
        </div>
      </div>

      {/* Mobile route strip */}
      <div className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 lg:hidden">
        {ROUTES.map((item) => (
          <button
            key={item.id}
            onClick={() => go(item.id)}
            className={`shrink-0 rounded-[7px] px-2 py-1 text-[11.5px] transition-colors ${
              route === item.id ? "bg-bg-2 text-text-1" : "text-text-3"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </header>
  );
}

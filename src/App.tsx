import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Background } from "@/components/layout/Background";
import { NavBar } from "@/components/layout/NavBar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { DevConsole } from "@/components/layout/DevConsole";
import { Toaster, LiveRegion } from "@/components/layout/Toaster";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { PresenterOverlay } from "@/presenter/PresenterOverlay";
import { HeroPage } from "@/pages/HeroPage";
import { StoryPage } from "@/pages/StoryPage";
import { StudioPage } from "@/pages/StudioPage";
import { ViewerPage } from "@/pages/ViewerPage";
import { SimulatorPage } from "@/pages/SimulatorPage";
import { ArchitecturePage } from "@/pages/ArchitecturePage";
import { DeepDivePage } from "@/pages/DeepDivePage";
import { ProofPage } from "@/pages/ProofPage";
import { TeamPage } from "@/pages/TeamPage";
import { engine } from "@/engine/swarm";
import { useSimStore } from "@/engine/simStore";
import { routeFromHash, useAppStore } from "@/engine/store";
import { useNetLog } from "@/mock/netlog";
import { mockApi } from "@/mock/api";
import { makeChatHistory, makeGuests } from "@/mock/data";
import { pushEngineEvent } from "@/pages/SimulatorPage";

/**
 * The application shell.
 *
 * Boots the mock backend, owns the engine tick loop, wires the global
 * keyboard map and renders the current section.
 */
export default function App() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const presenterMode = useAppStore((s) => s.presenterMode);
  const projector = useAppStore((s) => s.projector);
  const motionPref = useAppStore((s) => s.motion);
  const resetToken = useAppStore((s) => s.resetToken);

  const bump = useSimStore((s) => s.bump);
  const pushFrame = useNetLog((s) => s.pushFrame);
  const pushToast = useAppStore((s) => s.pushToast);

  const bootedRef = useRef(false);

  /* ---------------------------------------------------------------- */
  /* Boot: guest identity, chat history, tunnel url                   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const app = useAppStore.getState();

    void mockApi.createGuest().then(({ guest }) => {
      app.setGuest(guest);
      const guests = makeGuests(20240517, 14);
      app.setChat(makeChatHistory(20240517, guests, 22));
    });

    app.setTunnelUrl(mockApi.getTunnelUrl());
    void mockApi.health();

    pushToast({
      title: "Demo mode",
      body: "Simulated data modeled on the real scheduler. No camera, no mic, no network.",
      tone: "info",
      ttl: 6000,
    });
  }, [pushToast]);

  /* ---------------------------------------------------------------- */
  /* Hash routing                                                     */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const sync = () => setRoute(routeFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [setRoute]);

  /* ---------------------------------------------------------------- */
  /* Engine tick loop                                                 */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    engine.onFrame = (frame) => pushFrame(frame);
    engine.onEvent = (event) => {
      pushEngineEvent(event.kind, event.detail);
      if (event.kind === "saturated") {
        pushToast({
          title: "Origin saturated",
          body: "Above 12 Mbps the origin stops granting new parents. The swarm rebalances.",
          tone: "warn",
        });
      }
      if (event.kind === "quarantine") {
        pushToast({ title: "Peer quarantined", body: event.detail, tone: "warn" });
      }
    };
    return () => {
      engine.onFrame = null;
      engine.onEvent = null;
    };
  }, [pushFrame, pushToast]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let uiAcc = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;

      const sim = useSimStore.getState();
      if (sim.playing) {
        acc += dt * sim.speed;
        // Fixed 100 ms simulation steps keep the model deterministic.
        const STEP = 0.1;
        let guard = 0;
        while (acc >= STEP && guard < 8) {
          engine.step(STEP);
          acc -= STEP;
          guard++;
        }
        if (guard >= 8) acc = 0;
      }

      uiAcc += dt;
      if (uiAcc >= 0.1) {
        uiAcc = 0;
        bump();
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bump]);

  /* ---------------------------------------------------------------- */
  /* Global keyboard map                                              */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const app = useAppStore.getState();
    let escHits = 0;
    let escTimer = 0;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setPalette(!app.paletteOpen);
        return;
      }

      if (e.key === "Escape") {
        if (app.paletteOpen) {
          app.setPalette(false);
          return;
        }
        escHits += 1;
        window.clearTimeout(escTimer);
        if (escHits >= 2) {
          escHits = 0;
          engine.reset(Math.floor(Math.random() * 1e6));
          useSimStore.getState().reset();
          app.panicReset();
          app.pushToast({ title: "Panic reset", body: "The demo state has been reset.", tone: "info" });
          return;
        }
        escTimer = window.setTimeout(() => {
          escHits = 0;
        }, 900);
        return;
      }

      if (typing) return;

      if (e.key === "?") {
        e.preventDefault();
        app.setPalette(true);
      } else if (e.key.toLowerCase() === "p" && !e.metaKey && !e.ctrlKey) {
        app.togglePresenter();
      } else if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        app.toggleDevConsole();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Document attributes: motion + projector                           */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    document.documentElement.dataset.motion = motionPref;
  }, [motionPref]);

  useEffect(() => {
    document.documentElement.dataset.projector = projector ? "on" : "off";
  }, [projector]);

  /* ---------------------------------------------------------------- */
  /* Panic reset clears chat + toasts                                 */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (resetToken > 0) {
      engine.reset(engine.seed);
    }
  }, [resetToken]);

  return (
    <TooltipProvider delayDuration={160} skipDelayDuration={200}>
      <Background />
      {!presenterMode && <NavBar />}

      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {route === "hero" && <HeroPage />}
            {route === "story" && <StoryPage />}
            {route === "studio" && <StudioPage />}
            {route === "viewer" && <ViewerPage />}
            {route === "simulator" && <SimulatorPage />}
            {route === "architecture" && <ArchitecturePage />}
            {route === "deepdive" && <DeepDivePage />}
            {route === "proof" && <ProofPage />}
            {route === "team" && <TeamPage />}
          </motion.div>
        </AnimatePresence>
      </main>

      <DevConsole />
      <CommandPalette />
      <Toaster />
      <PresenterOverlay />
      <LiveRegion message={`Section: ${route}`} />
    </TooltipProvider>
  );
}

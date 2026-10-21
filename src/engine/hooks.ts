/**
 * Small, dependency-free hooks used across the demo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "./store";

/* ------------------------------------------------------------------ */
/* Motion preference                                                   */
/* ------------------------------------------------------------------ */

/**
 * True when the operating system asks for reduced motion.
 */
export function useSystemReducedMotion(): boolean {
  const [systemReduced, setSystemReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setSystemReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return systemReduced;
}

/**
 * True when animations should run.
 *
 * `auto` follows the OS setting; the user can override with the
 * "Play animations" button (reduced-motion fallback) or with the toggle.
 */
export function useAnimationsEnabled(): boolean {
  const motion = useAppStore((s) => s.motion);
  const systemReduced = useSystemReducedMotion();

  return useMemo(() => {
    if (motion === "on") return true;
    if (motion === "off") return false;
    return !systemReduced;
  }, [motion, systemReduced]);
}

/* ------------------------------------------------------------------ */
/* rAF helpers                                                         */
/* ------------------------------------------------------------------ */

/** Run a callback every animation frame. The callback receives delta seconds. */
export function useRafLoop(callback: (dt: number, elapsed: number) => void, active = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      cbRef.current(dt, elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

/**
 * A cheap re-render trigger at a fixed rate.
 *
 * Used for numeric readouts: the canvas reads the engine directly every
 * frame, React only needs to refresh the digits a few times per second.
 */
export function useTicker(hz = 8): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return tick;
}

/* ------------------------------------------------------------------ */
/* Animated numbers                                                    */
/* ------------------------------------------------------------------ */

/** Smoothly animate a number towards its target (no layout thrash). */
export function useCountUp(target: number, duration = 600, enabled = true): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    fromRef.current = value;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(fromRef.current + (target - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, enabled]);

  return value;
}

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 900px)");
}

/* ------------------------------------------------------------------ */
/* Keyboard                                                            */
/* ------------------------------------------------------------------ */

/** Fires when Escape is pressed twice within `windowMs`. */
export function useDoubleEscape(onReset: () => void, windowMs = 900) {
  const lastRef = useRef(0);
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = performance.now();
      if (now - lastRef.current < windowMs) {
        lastRef.current = 0;
        onReset();
      } else {
        lastRef.current = now;
      }
    },
    [onReset, windowMs],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Persist a value in localStorage (best effort — file:// may block it). */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode / file:// — ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/** Copy text to the clipboard with a graceful fallback. */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    } else {
      fallback();
    }
    function fallback() {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        done();
      } catch {
        /* ignore */
      }
      document.body.removeChild(el);
    }
  }, []);
  return [copied, copy];
}

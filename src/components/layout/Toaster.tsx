import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/engine/store";

const TONE = {
  info: "border-line-strong bg-bg-2 text-text-1",
  ok: "border-ok/40 bg-bg-2 text-text-1",
  warn: "border-warn/45 bg-bg-2 text-text-1",
  error: "border-live/50 bg-bg-2 text-text-1",
};

const DOT = {
  info: "bg-info",
  ok: "bg-ok",
  warn: "bg-warn",
  error: "bg-live",
};

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[75] flex w-[320px] flex-col gap-2" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,.95)] ${TONE[toast.tone]}`}
          >
            <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[toast.tone]}`} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium">{toast.title}</div>
              {toast.body && <div className="mt-0.5 text-[11px] leading-snug text-text-3">{toast.body}</div>}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 text-text-3 transition-colors hover:text-text-1"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Small hook so pages can announce things without touching the store. */
export function useAnnounce() {
  const pushToast = useAppStore((s) => s.pushToast);
  return pushToast;
}

/** Polite live region for status changes (screen readers). */
export function LiveRegion({ message }: { message: string }) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div ref={ref} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNetLog } from "@/mock/netlog";
import { useAppStore } from "@/engine/store";
import { fmtClock } from "@/lib/format";
import type { LogEntry, LogKind } from "@/types";

type Filter = "all" | LogKind;

const KIND_STYLE: Record<LogKind, { dot: string; text: string }> = {
  http: { dot: "bg-info", text: "text-info" },
  ws: { dot: "bg-accent", text: "text-accent" },
  engine: { dot: "bg-warn", text: "text-warn" },
};

/**
 * Dev console / network inspector.
 *
 * Shows every simulated HTTP request and WebSocket frame in real time so
 * the demo can prove the plumbing it is describing.
 */
export function DevConsole() {
  const open = useAppStore((s) => s.devConsoleOpen);
  const toggle = useAppStore((s) => s.toggleDevConsole);
  const entries = useNetLog((s) => s.entries);
  const paused = useNetLog((s) => s.paused);
  const togglePause = useNetLog((s) => s.togglePause);
  const clear = useNetLog((s) => s.clear);

  const [filter, setFilter] = useState<Filter>("all");
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);

  const filtered = useMemo(() => {
    const list = filter === "all" ? entries : entries.filter((e) => e.kind === filter);
    return list.slice(-160).reverse();
  }, [entries, filter]);

  useEffect(() => {
    if (pinned && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries, pinned]);

  return (
    <>
      {/* Collapsed tab */}
      {!open && (
        <button
          onClick={toggle}
          className="num fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-[10px] border border-line bg-bg-2/90 px-3 py-2 text-[11px] text-text-2 backdrop-blur transition-colors hover:border-accent/50 hover:text-text-1"
          title="Open the dev console (G)"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          dev console
          <span className="text-text-3">· {entries.length}</span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="glass glass-strong fixed bottom-4 left-4 z-[60] flex h-[340px] w-[440px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden"
            aria-label="Dev console"
          >
            <header className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className="eyebrow">dev console</span>
              <span className="rounded-[5px] border border-warn/40 bg-warn/10 px-1.5 py-px text-[9.5px] uppercase tracking-[0.1em] text-warn">
                simulated
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => setPinned((p) => !p)}
                  className={`rounded-[6px] px-1.5 py-1 text-[10.5px] transition-colors ${
                    pinned ? "text-accent" : "text-text-3 hover:text-text-2"
                  }`}
                  title="Auto-scroll to newest"
                >
                  {pinned ? "↓ pinned" : "↓ free"}
                </button>
                <button
                  onClick={togglePause}
                  className={`rounded-[6px] px-1.5 py-1 text-[10.5px] transition-colors ${
                    paused ? "text-warn" : "text-text-3 hover:text-text-2"
                  }`}
                >
                  {paused ? "paused" : "pause"}
                </button>
                <button
                  onClick={clear}
                  className="rounded-[6px] px-1.5 py-1 text-[10.5px] text-text-3 transition-colors hover:text-text-1"
                >
                  clear
                </button>
                <button
                  onClick={toggle}
                  className="rounded-[6px] px-1.5 py-1 text-[10.5px] text-text-3 transition-colors hover:text-text-1"
                  aria-label="Close dev console"
                >
                  ✕
                </button>
              </div>
            </header>

            <div className="flex items-center gap-1 border-b border-line px-2.5 py-1.5">
              {(["all", "http", "ws", "engine"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-[6px] px-2 py-1 text-[10.5px] transition-colors ${
                    filter === f ? "bg-bg-3 text-text-1" : "text-text-3 hover:text-text-2"
                  }`}
                >
                  {f}
                </button>
              ))}
              <span className="num ml-auto text-[10px] text-text-3">{filtered.length} shown</span>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-1.5 font-mono text-[10.5px] leading-relaxed">
              {filtered.length === 0 && (
                <div className="px-2 py-6 text-center text-[11px] text-text-3">
                  No entries yet. Interact with the demo — every call is recorded here.
                </div>
              )}
              {filtered.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const style = KIND_STYLE[entry.kind];
  const statusTone =
    entry.status === undefined
      ? ""
      : entry.status < 300
        ? "text-ok"
        : entry.status < 400
          ? "text-text-2"
          : entry.status < 500
            ? "text-warn"
            : "text-live";

  return (
    <div className="flex items-start gap-2 rounded-[4px] px-1.5 py-[3px] hover:bg-bg-3/70">
      <span className="num shrink-0 text-text-3">{fmtClock(entry.ts)}</span>
      <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      <span className={`num shrink-0 ${style.text}`}>{entry.method}</span>
      <span className="num min-w-0 flex-1 truncate text-text-2">{entry.path}</span>
      {entry.status !== undefined && <span className={`num shrink-0 ${statusTone}`}>{entry.status}</span>}
      {entry.ms !== undefined && <span className="num shrink-0 text-text-3">{entry.ms}ms</span>}
      {entry.bytes !== undefined && <span className="num shrink-0 text-text-3">{entry.bytes}B</span>}
      {entry.detail && <span className="hidden max-w-[140px] shrink-0 truncate text-text-3 xl:inline">{entry.detail}</span>}
    </div>
  );
}

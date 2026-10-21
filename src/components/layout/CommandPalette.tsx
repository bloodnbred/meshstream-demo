import { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore, ROUTES } from "@/engine/store";
import { useSimStore } from "@/engine/simStore";
import { engine } from "@/engine/swarm";
import { mockApi } from "@/mock/api";
import { KeyCap } from "@/components/ui/Button";

interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const open = useAppStore((s) => s.paletteOpen);
  const setOpen = useAppStore((s) => s.setPalette);
  const setRoute = useAppStore((s) => s.setRoute);
  const toggleDevConsole = useAppStore((s) => s.toggleDevConsole);
  const togglePresenter = useAppStore((s) => s.togglePresenter);
  const toggleProjector = useAppStore((s) => s.toggleProjector);
  const pushToast = useAppStore((s) => s.pushToast);
  const sim = useSimStore();

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    for (const route of ROUTES) {
      list.push({
        id: `go-${route.id}`,
        label: `Go to ${route.label}`,
        group: "Navigate",
        hint: route.hint,
        run: () => setRoute(route.id),
      });
    }

    list.push(
      {
        id: "dev-console",
        label: "Toggle dev console",
        group: "Tools",
        hint: "Inspect the simulated HTTP + WebSocket traffic",
        run: toggleDevConsole,
      },
      {
        id: "presenter",
        label: "Toggle presenter mode",
        group: "Tools",
        hint: "Big captions, talk track, laser pointer",
        run: togglePresenter,
      },
      {
        id: "projector",
        label: "Toggle projector mode",
        group: "Tools",
        hint: "Bump every font size for the room",
        run: toggleProjector,
      },
      {
        id: "kill-peer",
        label: "Kill a random peer",
        group: "Simulator",
        hint: "Children re-parent, the origin covers the gap",
        run: () => {
          engine.killRandomPeer();
          pushToast({ title: "Peer killed", body: "Children are re-parenting now.", tone: "warn" });
        },
      },
      {
        id: "corrupt",
        label: "Corrupt a part",
        group: "Simulator",
        hint: "SHA-256 mismatch → quarantine the sender",
        run: () => {
          engine.corruptPart();
          pushToast({ title: "Corrupt part injected", body: "Hash mismatch → the sender is quarantined.", tone: "warn" });
        },
      },
      {
        id: "toggle-p2p",
        label: "Toggle peer-to-peer delivery",
        group: "Simulator",
        hint: "Watch origin egress spike when P2P is off",
        run: () => sim.toggleP2p(),
      },
      {
        id: "saturate",
        label: "Saturate the origin",
        group: "Simulator",
        hint: "Trip the 12 Mbps guard",
        run: () => sim.toggleSaturated(),
      },
      {
        id: "rotate-tunnel",
        label: "Rotate the Quick Tunnel URL",
        group: "Tools",
        hint: "Quick Tunnel URLs change on every restart",
        run: async () => {
          const url = await mockApi.rotateTunnel();
          useAppStore.getState().setTunnelUrl(url);
          pushToast({ title: "Tunnel URL rotated", body: url, tone: "info" });
        },
      },
    );

    return list;
  }, [setRoute, toggleDevConsole, togglePresenter, toggleProjector, pushToast, sim]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => setIndex(0), [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[index];
      if (cmd) {
        cmd.run();
        setOpen(false);
      }
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[76] bg-black/70 backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="glass glass-strong fixed left-1/2 top-[14vh] z-[77] w-[92vw] max-w-[620px] -translate-x-1/2 overflow-hidden"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="text-text-3">⌕</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands and sections…"
              className="flex-1 bg-transparent text-[13.5px] text-text-1 outline-none placeholder:text-text-3"
            />
            <KeyCap>esc</KeyCap>
          </div>

          <div className="max-h-[52vh] overflow-y-auto py-1.5">
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-text-3">No command matches “{query}”.</div>
            )}
            <AnimatePresence initial={false}>
              {filtered.map((cmd, i) => (
                <motion.button
                  key={cmd.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => {
                    cmd.run();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${
                    i === index ? "bg-bg-3" : "hover:bg-bg-2"
                  }`}
                >
                  <span className="w-[86px] shrink-0 text-[10px] uppercase tracking-[0.12em] text-text-3">{cmd.group}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-text-1">{cmd.label}</span>
                    {cmd.hint && <span className="block truncate text-[11px] text-text-3">{cmd.hint}</span>}
                  </span>
                  {i === index && <span className="text-[10px] text-text-3">↵</span>}
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[10.5px] text-text-3">
            <span className="inline-flex items-center gap-1">
              <KeyCap>↑</KeyCap>
              <KeyCap>↓</KeyCap> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <KeyCap>↵</KeyCap> run
            </span>
            <span className="ml-auto">All commands run locally — nothing leaves the browser.</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

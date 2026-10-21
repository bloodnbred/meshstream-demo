/**
 * Global keyboard map.
 *
 * Mirrors the real studio shortcut sheet from plan.md §8.8 and adds the
 * presenter-mode keys. Handlers are registered on `window` and ignored while
 * the user is typing in a field or has a layer open.
 */

export interface Shortcut {
  keys: string;
  label: string;
  group: "global" | "studio" | "player" | "presenter";
  match: (e: KeyboardEvent) => boolean;
}

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
};

export function shouldIgnoreKey(e: KeyboardEvent): boolean {
  if (isTypingTarget(e.target)) return true;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === "BUTTON" && (e.key === " " || e.key === "Enter")) return true;
  return false;
}

export const isModifier = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;

export const SHORTCUTS: Shortcut[] = [
  { keys: "⌘K / Ctrl+K", label: "Command palette", group: "global", match: (e) => isModifier(e) && e.key.toLowerCase() === "k" },
  { keys: "?", label: "Keyboard shortcuts", group: "global", match: (e) => e.key === "?" },
  { keys: "P", label: "Presenter mode", group: "global", match: (e) => e.key.toLowerCase() === "p" },
  { keys: "G", label: "Dev console / network inspector", group: "global", match: (e) => e.key.toLowerCase() === "g" },
  { keys: "Esc ×2", label: "Panic reset (double press)", group: "global", match: (e) => e.key === "Escape" },

  { keys: "M", label: "Toggle mic level meter", group: "studio", match: (e) => e.key.toLowerCase() === "m" },
  { keys: "V", label: "Toggle camera preview", group: "studio", match: (e) => e.key.toLowerCase() === "v" },
  { keys: "S", label: "Toggle screen source", group: "studio", match: (e) => e.key.toLowerCase() === "s" },
  { keys: "R", label: "Toggle local recording", group: "studio", match: (e) => e.key.toLowerCase() === "r" },
  { keys: "L", label: "Go live", group: "studio", match: (e) => e.key.toLowerCase() === "l" },
  { keys: "C", label: "Focus chat", group: "studio", match: (e) => e.key.toLowerCase() === "c" },
  { keys: "F", label: "Fullscreen", group: "studio", match: (e) => e.key.toLowerCase() === "f" },

  { keys: "Space", label: "Play / pause", group: "player", match: (e) => e.code === "Space" },
  { keys: "← →", label: "Previous / next scene", group: "player", match: () => false },
  { keys: "↑ ↓", label: "Previous / next section", group: "presenter", match: () => false },
];

export interface ShortcutDoc {
  keys: string;
  label: string;
}

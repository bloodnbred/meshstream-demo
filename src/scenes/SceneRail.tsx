import { motion } from "framer-motion";
import { SCENES } from "./scenesData";

/**
 * Left progress rail for the guided story.
 */
export function SceneRail({
  active,
  progress,
  onSelect,
}: {
  active: number;
  progress: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Story progress"
      className="pointer-events-auto absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 lg:block"
    >
      <ol className="relative flex flex-col gap-3 pl-3">
        {/* Rail */}
        <span className="absolute left-[3px] top-2 bottom-2 w-px bg-line" aria-hidden />
        <motion.span
          className="absolute left-[3px] top-2 w-px origin-top bg-accent"
          style={{ height: `${progress * 100}%` }}
          aria-hidden
        />

        {SCENES.map((scene) => {
          const isActive = scene.id === active;
          const isDone = scene.id < active;
          return (
            <li key={scene.id}>
              <button
                onClick={() => onSelect(scene.id)}
                aria-current={isActive ? "step" : undefined}
                className="group flex items-center gap-3 text-left"
              >
                <span
                  className={`relative z-10 block h-[7px] w-[7px] rounded-full border transition-all duration-200 ${
                    isActive
                      ? "border-accent bg-accent shadow-[0_0_10px_var(--color-accent)]"
                      : isDone
                        ? "border-accent/60 bg-accent/50"
                        : "border-line-strong bg-bg-1 group-hover:border-text-3"
                  }`}
                />
                <span
                  className={`text-[11.5px] transition-colors duration-200 ${
                    isActive ? "text-text-1" : "text-text-3 group-hover:text-text-2"
                  }`}
                >
                  {scene.nav}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

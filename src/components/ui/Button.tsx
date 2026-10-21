import { forwardRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "live";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent border-accent hover:brightness-110 shadow-[0_0_24px_-8px_var(--color-accent)]",
  secondary:
    "bg-bg-3 text-text-1 border-line-strong hover:border-accent/60 hover:text-white",
  ghost: "bg-transparent text-text-2 border-transparent hover:text-text-1 hover:bg-bg-2",
  danger: "bg-live/10 text-live border-live/50 hover:bg-live/20",
  live: "bg-live text-white border-live hover:bg-live/90 shadow-[0_0_26px_-6px_var(--color-live)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[11px] gap-1.5 rounded-[6px]",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-[10px]",
  lg: "h-11 px-5 text-sm gap-2 rounded-[10px]",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** Pulls the button toward the cursor — the "magnetic" feel. */
  magnetic?: boolean;
  active?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, magnetic, active, className = "", children, ...rest },
  ref,
) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!magnetic) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - rect.left) / rect.width - 0.5) * 6);
    y.set(((e.clientY - rect.top) / rect.height - 0.5) * 4);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      style={magnetic ? { x: sx, y: sy } : undefined}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      whileTap={{ scale: 0.97 }}
      className={[
        "inline-flex select-none items-center justify-center border font-medium tracking-[-0.01em]",
        "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        active ? "ring-1 ring-accent/70" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {icon}
      {children}
    </motion.button>
  );
});

export interface IconButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: ReactNode;
  label: string;
  active?: boolean;
  tone?: "default" | "live" | "accent";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, tone = "default", className = "", children, ...rest },
  ref,
) {
  const toneClass =
    tone === "live"
      ? "text-live hover:text-live"
      : tone === "accent"
        ? "text-accent hover:text-accent"
        : "text-text-2 hover:text-text-1";
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.94 }}
      title={label}
      aria-label={label}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-transparent",
        "transition-colors duration-150 hover:bg-bg-2 hover:border-line",
        toneClass,
        active ? "bg-bg-3 border-line-strong text-text-1" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </motion.button>
  );
});

/** A segmented control used for quality / mode switches. */
export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const { value, options, onChange, className = "", size = "md" } = props;
  return (
    <div
      role="tablist"
      className={[
        "inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-bg-1 p-0.5",
        className,
      ].join(" ")}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={selected}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={[
              "relative rounded-[7px] font-medium transition-colors duration-150",
              size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-[12px]",
              selected ? "text-on-accent" : "text-text-3 hover:text-text-1",
            ].join(" ")}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${options.map((o) => o.value).join("")}`}
                className="absolute inset-0 rounded-[7px] bg-accent"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Little keyboard key cap. */
export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd className="num inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-bg-3 px-1.5 text-[10px] font-medium text-text-2">
      {children}
    </kbd>
  );
}

import type { ReactNode } from "react";

/** Section label used above every block of the app. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="eyebrow">{children}</span>
      {right}
    </div>
  );
}

/**
 * Glass panel with a hairline border and a top inner highlight.
 * Every surface in the app is built from this so the lighting stays consistent.
 */
export function Panel({
  children,
  className = "",
  title,
  subtitle,
  right,
  dense,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  dense?: boolean;
  as?: "section" | "div" | "aside";
}) {
  return (
    <Tag className={`glass ${dense ? "glass-strong" : ""} ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-3.5 py-2.5">
          <div className="min-w-0">
            {title && <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em] text-text-1">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-text-3">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

/** Row used inside panels — dense, hairline separated. */
export function Row({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 border-b border-line/70 px-3.5 py-2 last:border-b-0 ${onClick ? "cursor-pointer hover:bg-bg-3/60" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** Label + value pair, the workhorse of the dense readouts. */
export function Readout({
  label,
  value,
  tone = "default",
  mono = true,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "default" | "accent" | "ok" | "warn" | "live" | "info";
  mono?: boolean;
  hint?: string;
}) {
  const toneClass = {
    default: "text-text-1",
    accent: "text-accent",
    ok: "text-ok",
    warn: "text-warn",
    live: "text-live",
    info: "text-info",
  }[tone];
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]" title={hint}>
      <span className="truncate text-[11.5px] text-text-3">{label}</span>
      <span className={`shrink-0 text-[12px] ${mono ? "num" : ""} ${toneClass}`}>{value}</span>
    </div>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-line ${className}`} />;
}

/** Thin vertical rule used in the studio columns. */
export function VRule() {
  return <div className="h-full w-px bg-line" />;
}

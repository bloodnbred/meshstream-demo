import type { ReactNode } from "react";

type Tone = "accent" | "ok" | "warn" | "live" | "info" | "text";

const FILL: Record<Tone, string> = {
  accent: "var(--color-accent)",
  ok: "var(--color-ok)",
  warn: "var(--color-warn)",
  live: "var(--color-live)",
  info: "var(--color-info)",
  text: "var(--color-text-2)",
};

/**
 * Linear meter with an optional cap marker.
 *
 * The origin guard meter uses `cap` to draw the 12 Mbps budget line — the
 * single number that matters on a home connection.
 */
export function Meter({
  value,
  max,
  cap,
  tone = "accent",
  height = 6,
  label,
  right,
  glow,
  className = "",
}: {
  value: number;
  max: number;
  cap?: number;
  tone?: Tone;
  height?: number;
  label?: ReactNode;
  right?: ReactNode;
  glow?: boolean;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const over = cap !== undefined && value > cap;

  return (
    <div className={className}>
      {(label || right) && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          {label && <span className="text-[11px] text-text-3">{label}</span>}
          {right && <span className="num text-[11.5px] text-text-2">{right}</span>}
        </div>
      )}
      <div
        className="relative w-full overflow-hidden rounded-full bg-bg-3"
        style={{ height }}
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
          style={{
            width: `${pct * 100}%`,
            background: FILL[over ? "live" : tone],
            boxShadow: glow ? `0 0 14px -2px ${FILL[over ? "live" : tone]}` : undefined,
          }}
        />
        {cap !== undefined && cap <= max && (
          <div
            className="absolute inset-y-0 w-px bg-text-2/70"
            style={{ left: `${(cap / max) * 100}%` }}
            title={`cap ${cap}`}
          >
            <div className="absolute -top-[3px] h-[calc(100%+6px)] w-px bg-text-2/40" />
          </div>
        )}
      </div>
    </div>
  );
}

export interface StackSegment {
  label: string;
  value: number;
  color: string;
  hint?: string;
}

/** Stacked source bar: peers / cache / origin. */
export function StackBar({
  segments,
  height = 8,
  className = "",
  showLegend = false,
}: {
  segments: StackSegment[];
  height?: number;
  className?: string;
  showLegend?: boolean;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={className}>
      <div
        className="flex w-full overflow-hidden rounded-full bg-bg-3"
        style={{ height }}
        role="img"
        aria-label={segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")}
      >
        {segments.map((seg) => (
          <div
            key={seg.label}
            title={seg.hint ?? `${seg.label}: ${Math.round((seg.value / total) * 100)}%`}
            className="h-full transition-[width] duration-500"
            style={{
              width: `${(seg.value / total) * 100}%`,
              background: seg.color,
              boxShadow: `inset 0 0 0 1px rgba(0,0,0,.25)`,
            }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {segments.map((seg) => (
            <span key={seg.label} className="inline-flex items-center gap-1.5 text-[10.5px] text-text-3">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: seg.color }} />
              {seg.label}
              <span className="num text-text-2">{Math.round((seg.value / total) * 100)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

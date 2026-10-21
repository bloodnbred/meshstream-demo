import type { ReactNode } from "react";

type Tone = "default" | "accent" | "ok" | "warn" | "live" | "info" | "muted";

const TONES: Record<Tone, string> = {
  default: "border-line text-text-2 bg-bg-2",
  accent: "border-accent/40 text-accent bg-accent/10",
  ok: "border-ok/40 text-ok bg-ok/10",
  warn: "border-warn/45 text-warn bg-warn/10",
  live: "border-live/50 text-live bg-live/12",
  info: "border-info/40 text-info bg-info/10",
  muted: "border-line text-text-3 bg-transparent",
};

export function Badge({
  children,
  tone = "default",
  className = "",
  mono = true,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-1.5 py-[2px] text-[10.5px] font-medium leading-none ${
        mono ? "num" : ""
      } ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Pulsing status dot. */
export function StatusDot({
  tone = "ok",
  pulse = true,
  size = 7,
}: {
  tone?: Tone;
  pulse?: boolean;
  size?: number;
}) {
  const color = {
    default: "bg-text-3",
    accent: "bg-accent",
    ok: "bg-ok",
    warn: "bg-warn",
    live: "bg-live",
    info: "bg-info",
    muted: "bg-text-3",
  }[tone];
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      {pulse && (
        <span
          className={`absolute inset-0 rounded-full ${color} opacity-40`}
          style={{ animation: "pulse-lime 1.9s ease-in-out infinite" }}
        />
      )}
      <span className={`relative inline-block rounded-full ${color}`} style={{ width: size, height: size }} />
    </span>
  );
}

/** The persistent "this is a demo" marker. */
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-warn/35 bg-warn/8 px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.14em] text-warn ${className}`}
      title="DEMO MODE — simulated data modeled on the real scheduler. No real traffic, no camera, no network."
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-warn" />
      Demo mode
    </span>
  );
}

/** LIVE chip with the signature red pulse. */
export function LiveChip({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-live px-1.5 py-[3px] text-[10px] font-bold uppercase tracking-[0.12em] text-white">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full bg-white opacity-70" style={{ animation: "pulse-lime 1.6s ease-in-out infinite" }} />
        <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      {label}
    </span>
  );
}

/** Small caps label used above a value. */
export function StatLabel({ children }: { children: ReactNode }) {
  return <div className="eyebrow mb-1">{children}</div>;
}

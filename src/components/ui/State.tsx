import type { ReactNode } from "react";

/**
 * Every interactive surface in the demo has a designed state.
 * These components make the empty / loading / error / degraded states
 * first-class instead of an afterthought.
 */

export function EmptyState({
  title,
  body,
  action,
  icon = "◍",
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-bg-2 text-[16px] text-text-3">
        {icon}
      </div>
      <div className="text-[13px] font-medium text-text-1">{title}</div>
      {body && <p className="max-w-[46ch] text-[11.5px] leading-relaxed text-text-3">{body}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-8 text-[12px] text-text-3">
      <span className="h-3 w-3 animate-spin rounded-full border border-line-strong border-t-accent" />
      {label}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[10px] border border-live/35 bg-live/8 px-4 py-3">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-live">
        <span aria-hidden>⚠</span>
        {title}
      </div>
      {body && <p className="text-[11.5px] leading-relaxed text-text-2">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Degraded banner — used for "Origin saturated", "Origin only", etc. */
export function DegradedBanner({
  tone = "warn",
  title,
  body,
  action,
}: {
  tone?: "warn" | "info" | "live";
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  const colors = {
    warn: "border-warn/40 bg-warn/8 text-warn",
    info: "border-info/40 bg-info/8 text-info",
    live: "border-live/40 bg-live/8 text-live",
  }[tone];
  return (
    <div className={`flex items-start justify-between gap-3 rounded-[10px] border px-3.5 py-2.5 ${colors}`}>
      <div className="min-w-0">
        <div className="text-[12px] font-medium">{title}</div>
        {body && <div className="mt-0.5 text-[11px] leading-snug text-text-2">{body}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

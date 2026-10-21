import { useId, useMemo } from "react";

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({
  data,
  color = "var(--color-accent)",
  height = 34,
  strokeWidth = 1.4,
  fill = true,
  className = "",
  showDot = true,
  min,
  max,
}: {
  data: number[];
  color?: string;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
  className?: string;
  showDot?: boolean;
  min?: number;
  max?: number;
}) {
  const gid = useId().replace(/:/g, "");

  const geometry = useMemo(() => {
    if (!data.length) return null;
    const lo = min ?? Math.min(...data);
    const hi = max ?? Math.max(...data);
    const span = hi - lo || 1;
    const w = 100;
    const h = 100;
    const pts = data.map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w;
      const y = h - ((v - lo) / span) * (h - 8) - 4;
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const area = `${line} L${w},${h} L0,${h} Z`;
    return { line, area, last: pts[pts.length - 1] };
  }, [data, min, max]);

  if (!geometry) {
    return <div className={className} style={{ height }} aria-hidden />;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      style={{ height, width: "100%" }}
      role="img"
      aria-label="sparkline"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#sg-${gid})`} />
        </>
      )}
      <path
        d={geometry.line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDot && (
        <circle cx={geometry.last[0]} cy={geometry.last[1]} r={1.8} fill={color} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Radial gauge                                                        */
/* ------------------------------------------------------------------ */

export function Gauge({
  value,
  max = 100,
  label,
  unit,
  size = 120,
  stroke = 8,
  color = "var(--color-accent)",
  track = "var(--color-bg-3)",
  target,
  targetLabel,
}: {
  value: number;
  max?: number;
  label: React.ReactNode;
  unit?: string;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  target?: number;
  targetLabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const targetPct = target !== undefined ? Math.max(0, Math.min(1, target / max)) : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
            style={{ transition: "stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)" }}
          />
          {targetPct !== null && (
            <line
              x1={size / 2}
              y1={size / 2 - r - stroke / 2 - 1}
              x2={size / 2}
              y2={size / 2 - r + stroke / 2 + 1}
              stroke="var(--color-text-2)"
              strokeWidth={1.6}
              transform={`rotate(${targetPct * 360} ${size / 2} ${size / 2})`}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="num text-[19px] font-semibold text-text-1">
            {Math.round(value * 10) / 10}
            {unit && <span className="ml-0.5 text-[11px] text-text-3">{unit}</span>}
          </div>
          <div className="max-w-[90px] text-center text-[9.5px] uppercase tracking-[0.1em] text-text-3">{label}</div>
        </div>
      </div>
      {target !== undefined && (
        <div className="num text-[10px] text-text-3">
          target {target}
          {targetLabel ? ` ${targetLabel}` : ""}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ring (P2P offload)                                                  */
/* ------------------------------------------------------------------ */

export function Ring({
  pct,
  size = 116,
  stroke = 9,
  color = "var(--color-accent)",
  track = "var(--color-bg-3)",
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * clamped) / 100} ${c}`}
          style={{
            transition: "stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1), stroke 300ms",
            filter: clamped > 0 ? `drop-shadow(0 0 6px ${color})` : undefined,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Latency budget stack                                                */
/* ------------------------------------------------------------------ */

export interface BudgetSegment {
  label: string;
  ms: number;
  color: string;
}

export function LatencyStack({
  segments,
  total,
  height = 26,
  showLabels = true,
}: {
  segments: BudgetSegment[];
  total?: number;
  height?: number;
  showLabels?: boolean;
}) {
  const sum = total ?? segments.reduce((s, x) => s + x.ms, 0);
  return (
    <div>
      <div className="flex w-full overflow-hidden rounded-[6px] bg-bg-3" style={{ height }}>
        {segments.map((seg) => (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.ms} ms`}
            className="relative h-full transition-[width] duration-500"
            style={{ width: `${(seg.ms / sum) * 100}%`, background: seg.color }}
          >
            {showLabels && seg.ms / sum > 0.08 && (
              <span className="num absolute inset-0 flex items-center justify-center text-[9px] font-medium text-black/80">
                {seg.ms}
              </span>
            )}
          </div>
        ))}
      </div>
      {showLabels && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {segments.map((seg) => (
            <span key={seg.label} className="inline-flex items-center gap-1.5 text-[10px] text-text-3">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: seg.color }} />
              {seg.label}
              <span className="num text-text-2">{seg.ms}ms</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

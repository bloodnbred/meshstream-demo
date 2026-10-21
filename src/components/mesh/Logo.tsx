/**
 * The MeshStream glyph: three lime nodes in a triangle with one brighter
 * edge — the relay path.
 */
export function Logo({
  size = 26,
  className = "",
  animated = false,
}: {
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="MeshStream logo"
    >
      <g stroke="#C9F73A" strokeWidth="1.5" strokeLinecap="round" fill="none">
        <path d="M16 8.5 24.5 21.5H7.5Z" strokeOpacity="0.38" />
        <path
          d="M16 8.5 24.5 21.5"
          strokeOpacity="1"
          strokeWidth="1.8"
          style={animated ? { strokeDasharray: 24, strokeDashoffset: 0 } : undefined}
        />
      </g>
      <circle cx="16" cy="8.5" r="3.1" fill="#C9F73A" />
      <circle cx="7.5" cy="21.5" r="3.1" fill="#C9F73A" fillOpacity="0.72" />
      <circle cx="24.5" cy="21.5" r="3.1" fill="#C9F73A" fillOpacity="0.72" />
    </svg>
  );
}

/** Wordmark — lowercase, Inter Tight 600, tight tracking. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`display text-[15px] tracking-[-0.03em] text-text-1 ${className}`}>
      mesh<span className="text-accent">stream</span>
    </span>
  );
}

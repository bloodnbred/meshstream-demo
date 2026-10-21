/**
 * Ambient background: drifting 24 px grid, aurora glow, radial vignette and
 * a 2 % film grain. Purely decorative — it never intercepts pointer events.
 */
export function Background() {
  return (
    <div className="bg-root" aria-hidden>
      <div className="bg-grid" />
      <div className="bg-aurora" />
      <div className="bg-vignette" />
      <div className="bg-grain" />
    </div>
  );
}

import { useEffect, useRef } from "react";

/**
 * Simulated camera feed.
 *
 * A 1280x720 test pattern drawn on a canvas. No capture device is ever
 * requested — the demo never asks for camera or microphone permissions.
 */
export function TestPattern({
  className = "",
  showOverlay = true,
  intensity = 1,
}: {
  className?: string;
  showOverlay?: boolean;
  intensity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1280;
    const H = 720;
    canvas.width = W;
    canvas.height = H;

    let raf = 0;
    let t = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;

      // Base gradient
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0B0E12");
      g.addColorStop(0.5, "#141922");
      g.addColorStop(1, "#0A0C10");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Drifting lime/blue blobs
      const blobs = [
        { x: 0.25 + 0.08 * Math.sin(t * 0.32), y: 0.28 + 0.06 * Math.cos(t * 0.24), r: 0.36, c: "201,247,58", a: 0.16 },
        { x: 0.72 + 0.06 * Math.cos(t * 0.21), y: 0.62 + 0.07 * Math.sin(t * 0.29), r: 0.42, c: "91,157,255", a: 0.13 },
        { x: 0.52 + 0.05 * Math.sin(t * 0.17), y: 0.18 + 0.05 * Math.cos(t * 0.19), r: 0.3, c: "255,176,32", a: 0.07 },
      ];
      for (const b of blobs) {
        const rg = ctx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r * W);
        rg.addColorStop(0, `rgba(${b.c},${b.a * intensity})`);
        rg.addColorStop(1, `rgba(${b.c},0)`);
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }

      // Sweep bar
      const sweepX = ((t * 0.09) % 1.4 - 0.2) * W;
      const sg = ctx.createLinearGradient(sweepX - 220, 0, sweepX + 220, 0);
      sg.addColorStop(0, "rgba(201,247,58,0)");
      sg.addColorStop(0.5, `rgba(201,247,58,${0.1 * intensity})`);
      sg.addColorStop(1, "rgba(201,247,58,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(sweepX - 220, 0, 440, H);

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Big rotating glyph in the middle
      ctx.save();
      ctx.translate(W / 2, H / 2 - 20);
      ctx.rotate(t * 0.25);
      ctx.strokeStyle = `rgba(201,247,58,${0.55 * intensity})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(a) * 86;
        const y = Math.sin(a) * 86;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 86, Math.sin(a) * 86, 9, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(201,247,58,0.85)";
        ctx.fill();
      }
      ctx.restore();

      // Overlay text
      if (showOverlay) {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const tc = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

        ctx.fillStyle = "rgba(7,8,10,0.55)";
        ctx.fillRect(28, H - 92, 330, 58);
        ctx.fillStyle = "#ECEEF2";
        ctx.font = "600 30px 'JetBrains Mono Variable', monospace";
        ctx.fillText(tc, 44, H - 56);
        ctx.fillStyle = "#9AA1AE";
        ctx.font = "16px 'JetBrains Mono Variable', monospace";
        ctx.fillText("1280x720 · 30fps · H.264 2.5 Mbps", 44, H - 34);

        ctx.fillStyle = "rgba(255,90,95,0.92)";
        ctx.font = "600 15px 'JetBrains Mono Variable', monospace";
        ctx.fillText("SIMULATED CAMERA — NO DEVICE IS USED", W - 420, 44);

        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, W - 2, H - 2);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [showOverlay, intensity]);

  return <canvas ref={canvasRef} className={`block h-full w-full ${className}`} aria-label="Simulated camera test pattern" />;
}

import { motion } from "framer-motion";

/**
 * Scene 1 — one camera, one origin.
 *
 * A single lime ribbon carries the stream from the browser to the origin.
 */
export function Scene1Origin({ active }: { active: boolean }) {
  const show = (delay: number) => ({
    initial: { opacity: 0, y: 16, scale: 0.96 },
    animate: active ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.96 },
    transition: { delay, duration: 0.65, ease: [0.2, 0.8, 0.2, 1] as const },
  });

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="relative grid w-full max-w-[900px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
        {/* Creator browser */}
        <motion.div {...show(0.1)} className="glass glass-strong relative overflow-hidden p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-live" />
            <span className="eyebrow">browser studio</span>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-[8px] border border-line bg-bg-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 30% 20%, rgba(201,247,58,.22), transparent 60%), radial-gradient(90% 80% at 75% 70%, rgba(91,157,255,.18), transparent 62%), linear-gradient(160deg,#0D0F13,#13161C)",
              }}
            />
            <div className="num absolute bottom-1.5 left-2 text-[9.5px] text-text-3">1280x720 · 30fps · H.264</div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-text-3">
            <span>getUserMedia</span>
            <span className="num text-text-2">2.5 Mbps</span>
          </div>
        </motion.div>

        {/* Ribbon */}
        <div className="relative flex h-[240px] w-[120px] items-center justify-center">
          <svg viewBox="0 0 120 240" className="absolute inset-0 h-full w-full" aria-hidden>
            <path
              d="M10 120 C 45 120, 75 60, 110 120"
              fill="none"
              stroke="#232833"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <motion.path
              d="M10 120 C 45 120, 75 60, 110 120"
              fill="none"
              stroke="#C9F73A"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ delay: 0.5, duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ filter: "drop-shadow(0 0 8px rgba(201,247,58,.55))" }}
            />
            {active &&
              [0, 1, 2].map((i) => (
                <motion.circle
                  key={i}
                  r={4}
                  fill="#C9F73A"
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
                  transition={{ delay: 1.2 + i * 0.45, duration: 1.4, repeat: Infinity, repeatDelay: 0.6, ease: "linear" }}
                  style={{ offsetPath: "path('M10 120 C 45 120, 75 60, 110 120')" }}
                />
              ))}
          </svg>
          <motion.div
            initial={{ opacity: 0 }}
            animate={active ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 1.5 }}
            className="num relative mt-[92px] rounded-[6px] border border-line bg-bg-1 px-2 py-1 text-[10px] text-accent"
          >
            WHIP
          </motion.div>
        </div>

        {/* Origin */}
        <motion.div {...show(0.75)} className="glass glass-strong relative overflow-hidden p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="eyebrow">origin</span>
          </div>
          <div className="rounded-[8px] border border-line bg-bg-0 p-3">
            <div className="num text-[12px] text-text-1">MediaMTX</div>
            <div className="mt-1.5 space-y-1 text-[10.5px] text-text-3">
              <div className="flex justify-between">
                <span>WHIP ingest</span>
                <span className="num">:8889</span>
              </div>
              <div className="flex justify-between">
                <span>LL-HLS out</span>
                <span className="num">:8888</span>
              </div>
              <div className="flex justify-between">
                <span>remux only</span>
                <span className="num text-accent">no transcode</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-text-3">
            <span>edge proxy + signing</span>
            <span className="num text-text-2">:4000</span>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        className="absolute bottom-6 left-1/2 max-w-[52ch] -translate-x-1/2 px-6 text-center"
      >
        <p className="text-[13px] leading-relaxed text-text-2">
          One camera. One origin. You publish 720p from your browser over WHIP — no account, no download, no server to rent.
        </p>
      </motion.div>
    </div>
  );
}

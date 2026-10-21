import { useMemo } from "react";
import { motion } from "framer-motion";
import { fakeSha256 } from "@/lib/hash";
import { shortHash } from "@/lib/hash";

/**
 * Scene 2 — the stream, sliced.
 *
 * The ribbon becomes a filmstrip of 400 ms parts. Each part carries an
 * address and a SHA-256 hash: that is what makes peer-to-peer delivery safe.
 */
export function Scene2Sliced({ active }: { active: boolean }) {
  const parts = useMemo(() => {
    const base = 18422;
    return Array.from({ length: 9 }, (_, i) => {
      const seq = base + i;
      const id = `part-${seq}.m4s`;
      const hash = fakeSha256(`live/${id}`);
      return {
        seq,
        id,
        hash,
        bytes: 118000 + ((seq * 7919) % 26000),
        ms: 400,
      };
    });
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 px-6">
      <div className="relative w-full max-w-[980px] overflow-hidden rounded-[12px] border border-line bg-bg-1/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow">ll-hls · fmp4</span>
          <span className="num text-[10.5px] text-text-3">400 ms parts · 1 s segments · 7 segment window</span>
        </div>

        <div className="relative h-[190px] overflow-hidden tape-mask">
          <div className="tape flex gap-2.5">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 gap-2.5">
                {parts.map((part, i) => (
                  <motion.div
                    key={`${copy}-${part.seq}`}
                    initial={{ opacity: 0, y: 18, scale: 0.94 }}
                    animate={
                      active
                        ? { opacity: 1, y: 0, scale: 1, transition: { delay: 0.18 * i + copy * 0.02, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } }
                        : { opacity: 0, y: 18, scale: 0.94 }
                    }
                    className="w-[124px] shrink-0 rounded-[9px] border border-line bg-bg-2 p-2.5"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="num text-[10px] text-accent">#{part.seq}</span>
                      <span className="num text-[9px] text-text-3">{part.ms}ms</span>
                    </div>
                    <div
                      className="mb-2 h-[42px] rounded-[5px] border border-line"
                      style={{
                        background: `linear-gradient(135deg, rgba(201,247,58,${0.05 + (i % 5) * 0.035}), rgba(19,22,28,.9))`,
                      }}
                    />
                    <div className="num truncate text-[9px] text-text-3">/live/{part.id}</div>
                    <div className="num mt-1 flex items-center gap-1 text-[9px] text-text-3">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                      {shortHash(part.hash)}
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line pt-3 text-[10.5px] text-text-3">
          <span>
            <span className="num text-text-2">{Math.round(parts[0].bytes / 1024)} KB</span> per part
          </span>
          <span>
            <span className="num text-text-2">sha256</span> verified before caching
          </span>
          <span>
            <span className="num text-text-2">hmac</span> signed manifest window
          </span>
          <span>
            <span className="num text-text-2">2-source</span> agreement on first sight
          </span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        className="max-w-[54ch] text-center"
      >
        <p className="text-[13px] leading-relaxed text-text-2">
          Live video, cut into seconds. Every part has an address and a hash — so a peer cannot hand you a broken part and get away with it.
        </p>
      </motion.div>
    </div>
  );
}

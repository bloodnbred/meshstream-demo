import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Panel, Readout, SectionLabel } from "@/components/ui/Panel";
import { Switch, CheckRow } from "@/components/ui/Controls";
import { Tip } from "@/components/ui/Tooltip";
import { useAppStore } from "@/engine/store";
import { mockApi } from "@/mock/api";
import { SWARM_CONST } from "@/engine/swarm";
import { fakeSha256, shortHash } from "@/lib/hash";
import type { ProtocolMessage } from "@/types";

/* ------------------------------------------------------------------ */
/* 1. Source selection                                                */
/* ------------------------------------------------------------------ */

type SelectStage = "idle" | "cache" | "peer" | "origin" | "served";

function SourceSelection() {
  const [stage, setStage] = useState<SelectStage>("idle");
  const [peerHasPart, setPeerHasPart] = useState(true);
  const [peerFast, setPeerFast] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef(0);
  const pushToast = useAppStore((s) => s.pushToast);

  const deadline = SWARM_CONST.DEADLINE_MS;

  const run = () => {
    setStage("cache");
    setElapsed(0);
    const t0 = performance.now();

    const step = (now: number) => {
      const t = now - t0;
      setElapsed(t);

      if (stage === "cache") {
        // The local cache answers in ~0 ms.
        if (t > 260) {
          setStage("peer");
          return requestAnimationFrame(step);
        }
      }
      if (stage === "peer") {
        if (!peerHasPart) {
          if (t > 260) {
            setStage("origin");
            return requestAnimationFrame(step);
          }
        } else if (peerFast) {
          if (t > 520) {
            setStage("served");
            return;
          }
        } else if (t > deadline) {
          // The deadline missed: cancel the peer request, fall back to origin.
          setStage("origin");
          return requestAnimationFrame(step);
        }
      }
      if (stage === "origin") {
        if (t > deadline + 320) {
          setStage("served");
          return;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const remaining = Math.max(0, deadline - elapsed);
  const progress = Math.min(1, elapsed / deadline);

  const steps = [
    { key: "cache", label: "1 · local cache", detail: "instant if the part is already verified" },
    { key: "peer", label: "2 · best peer", detail: "lowest p95 among parents and children" },
    { key: "origin", label: "3 · origin", detail: "the safety net — always allowed" },
  ];

  return (
    <Panel
      title="Source selection, per part"
      subtitle="Every 400 ms part is resolved independently. The player must never stall because P2P was attempted."
      right={<Badge tone="muted">deadline 1.6 s</Badge>}
    >
      <div className="p-4">
        {/* Flow */}
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {steps.map((step) => {
            const isActive = stage === step.key;
            const isDone = ["served"].includes(stage) || (stage === "peer" && step.key === "cache") || (stage === "origin" && step.key !== "origin");
            return (
              <div
                key={step.key}
                className={`relative rounded-[10px] border px-3 py-2.5 transition-colors duration-200 ${
                  isActive ? "border-accent/55 bg-accent/8" : isDone ? "border-ok/35 bg-ok/6" : "border-line bg-bg-1"
                }`}
              >
                <div className={`text-[12px] font-medium ${isActive ? "text-accent" : isDone ? "text-ok" : "text-text-2"}`}>
                  {step.label}
                </div>
                <div className="mt-0.5 text-[10.5px] leading-snug text-text-3">{step.detail}</div>
                {isActive && (
                  <motion.span
                    layoutId="select-glow"
                    className="absolute inset-0 rounded-[10px] ring-1 ring-accent/40"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Deadline */}
        <div className="mb-4 rounded-[10px] border border-line bg-bg-1 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="eyebrow">hard deadline</span>
            <span className="num text-[11.5px] text-text-2">
              {stage === "served" ? "served" : `${Math.round(remaining)} ms left`}
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-bg-3">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${remaining === 0 ? "bg-live" : "bg-accent"}`}
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
            <span className="absolute inset-y-0 left-[100%] w-px bg-live/60" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-text-3">
            <span>
              elapsed <span className="num text-text-2">{Math.round(elapsed)} ms</span>
            </span>
            <span>
              deadline <span className="num text-text-2">{deadline} ms</span>
            </span>
            {stage === "origin" && (
              <span className="text-warn">
                peer request cancelled → origin fallback
              </span>
            )}
          </div>
        </div>

        {/* Toggles */}
        <div className="mb-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <Switch
            checked={peerHasPart}
            onCheckedChange={setPeerHasPart}
            label="Peer advertises the part"
            hint="If not, we never ask — we go straight to the origin."
          />
          <Switch
            checked={peerFast}
            onCheckedChange={setPeerFast}
            label="Peer answers within the deadline"
            hint="Turn it off to watch the 1.6 s deadline expire."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={run}>
            Request part #18437
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setStage("idle");
              setElapsed(0);
            }}
          >
            Reset
          </Button>
          <span className="ml-auto text-[11px] text-text-3">
            {stage === "served"
              ? peerHasPart && peerFast
                ? "Served by a peer in 520 ms."
                : "Served by the origin after the deadline."
              : "Press request to run the selection."}
          </span>
        </div>

        {stage === "served" && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-[9px] border border-ok/35 bg-ok/8 px-3 py-2 text-[11.5px] text-ok"
            >
              Part verified against the signed manifest before it is cached.
              <button
                className="ml-2 underline decoration-dotted"
                onClick={() => pushToast({ title: "nack", body: "sha256 mismatch → the sender would be quarantined", tone: "warn" })}
              >
                what if the hash is wrong?
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Protocol sequence                                               */
/* ------------------------------------------------------------------ */

const SCRIPT: { from: string; to: string; msg: ProtocolMessage; note: string }[] = [
  {
    from: "viewer",
    to: "signal",
    msg: { t: "hello", guestId: "g_8fk2", streamId: "st_demo", caps: { parts: true, safari: false } },
    note: "Announce capabilities. Safari peers set caps.parts = false.",
  },
  {
    from: "signal",
    to: "viewer",
    msg: { t: "assign", parents: ["p1", "origin"], children: [], iceServers: ["stun:stun.l.google.com:19302"] },
    note: "1–2 parents, up to 4 children. The origin is the root of the tree.",
  },
  {
    from: "viewer",
    to: "peer",
    msg: { t: "have", peerId: "g_8fk2", bitmap: 0b101010 },
    note: "On connect and on every new part: which parts this peer already holds.",
  },
  {
    from: "viewer",
    to: "peer",
    msg: { t: "want", peerId: "g_8fk2", partId: "part-18437", deadline: 1600, priority: 1 },
    note: "A part is needed. The deadline is the arrival time plus ~1.6 s.",
  },
  {
    from: "peer",
    to: "viewer",
    msg: { t: "data", peerId: "p1", partId: "part-18437", offset: 0, chunk: 16384 },
    note: "16 KiB chunks on the unordered data channel.",
  },
  {
    from: "peer",
    to: "viewer",
    msg: { t: "data", peerId: "p1", partId: "part-18437", offset: 16384, chunk: 16384 },
    note: "Continued until the part is complete.",
  },
  {
    from: "viewer",
    to: "peer",
    msg: { t: "nack", peerId: "p1", partId: "part-18438", reason: "sha256 mismatch" },
    note: "The hash did not match. The part is discarded, never cached.",
  },
  {
    from: "viewer",
    to: "signal",
    msg: { t: "quarantine", peerId: "p1", reason: "sha256 mismatch" },
    note: "The sender is quarantined. Its children re-parent immediately.",
  },
  {
    from: "viewer",
    to: "peer",
    msg: { t: "cancel", peerId: "p1", partId: "part-18439" },
    note: "The deadline expired — cancel the peer request, take it from the origin.",
  },
  {
    from: "viewer",
    to: "signal",
    msg: { t: "ping", t0: 1724339200000 },
    note: "Heartbeat every 25 s so the tunnel does not drop an idle socket.",
  },
  {
    from: "signal",
    to: "viewer",
    msg: { t: "pong", t0: 1724339200000 },
    note: "Round-trip time feeds the peer scoring and the p95.",
  },
];

function ProtocolPlayer() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= SCRIPT.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing]);

  const current = SCRIPT[index];

  return (
    <Panel
      title="Protocol"
      subtitle="Two data channels per pair: control (reliable) and data (unordered)."
      right={
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setIndex(0)}>
            Reset
          </Button>
          <Button size="sm" variant={playing ? "secondary" : "primary"} onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </Button>
        </div>
      }
    >
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="num text-[10.5px] text-text-3">
            {String(index + 1).padStart(2, "0")}/{String(SCRIPT.length).padStart(2, "0")}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-3">
            <motion.div
              className="h-full bg-accent"
              animate={{ width: `${((index + 1) / SCRIPT.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="mb-3 rounded-[10px] border border-line bg-bg-0 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="num rounded-[5px] bg-accent/12 px-1.5 py-[2px] text-[10px] text-accent">{current.msg.t}</span>
            <span className="num text-[10.5px] text-text-3">
              {current.from} → {current.to}
            </span>
          </div>
          <pre className="num overflow-x-auto text-[10.5px] leading-relaxed text-text-2">
{JSON.stringify(current.msg, null, 2)}
          </pre>
          <p className="mt-2 border-t border-line pt-2 text-[11px] leading-snug text-text-3">{current.note}</p>
        </div>

        <ul className="space-y-1">
          {SCRIPT.map((step, i) => (
            <li key={i}>
              <button
                onClick={() => setIndex(i)}
                className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1 text-left transition-colors ${
                  i === index ? "bg-bg-3" : "hover:bg-bg-2"
                }`}
              >
                <span className={`num w-[16px] text-[10px] ${i === index ? "text-accent" : "text-text-3"}`}>
                  {i + 1}
                </span>
                <span className={`num text-[10.5px] ${i === index ? "text-text-1" : "text-text-3"}`}>{step.msg.t}</span>
                <span className="ml-auto truncate text-[10px] text-text-3">{step.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Upload policy                                                    */
/* ------------------------------------------------------------------ */

function UploadPolicy() {
  const [buffer, setBuffer] = useState(22);
  const [visible, setVisible] = useState(true);
  const [uplink, setUplink] = useState(0.42);
  const [metered, setMetered] = useState(false);
  const [score, setScore] = useState(0.82);

  const checks = [
    { ok: buffer > SWARM_CONST.BUFFER_MIN_SERVE, label: "Buffer above 15 s", detail: `${buffer.toFixed(1)} s buffered` },
    { ok: visible, label: "Tab is visible", detail: visible ? "document.visibilityState = visible" : "hidden — the browser throttles timers" },
    { ok: uplink < 0.7, label: "Uplink below 70 %", detail: `${Math.round(uplink * 100)} % measured utilisation` },
    { ok: !metered, label: "Not a metered connection", detail: metered ? "Network Information API says metered" : "Network Information API says unmetered" },
    { ok: score > 0.35, label: "Healthy contribution score", detail: `${Math.round(score * 100)} % — tit-for-tat` },
  ];
  const mayServe = checks.every((c) => c.ok);

  return (
    <Panel title="Upload policy" subtitle="A peer serves only when every condition holds.">
      <div className="p-4">
        <div className="mb-3 rounded-[10px] border border-line bg-bg-1 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="eyebrow">may this peer serve?</span>
            <span className={`num text-[13px] font-semibold ${mayServe ? "text-ok" : "text-warn"}`}>
              {mayServe ? "yes" : "no"}
            </span>
          </div>
          <p className="text-[11.5px] leading-snug text-text-3">
            {mayServe
              ? "This peer can answer want requests for its children."
              : "The peer stays in the tree but does not serve. Its children fall back to the origin or re-parent."}
          </p>
        </div>

        <div className="mb-3 space-y-1">
          {checks.map((c) => (
            <CheckRow key={c.label} ok={c.ok} label={c.label} detail={c.detail} />
          ))}
        </div>

        <div className="space-y-3 border-t border-line pt-3">
          <label className="block">
            <div className="mb-1 flex items-center justify-between text-[11px] text-text-3">
              <span>buffer</span>
              <span className="num text-text-2">{buffer.toFixed(1)} s</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={0.5}
              value={buffer}
              onChange={(e) => setBuffer(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Buffer seconds"
            />
          </label>
          <label className="block">
            <div className="mb-1 flex items-center justify-between text-[11px] text-text-3">
              <span>uplink utilisation</span>
              <span className="num text-text-2">{Math.round(uplink * 100)} %</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={uplink}
              onChange={(e) => setUplink(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Uplink utilisation"
            />
          </label>
          <label className="block">
            <div className="mb-1 flex items-center justify-between text-[11px] text-text-3">
              <span>contribution score</span>
              <span className="num text-text-2">{Math.round(score * 100)} %</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Contribution score"
            />
          </label>
          <div className="flex gap-4">
            <Switch checked={visible} onCheckedChange={setVisible} label="Tab visible" />
            <Switch checked={metered} onCheckedChange={setMetered} label="Metered" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Integrity + security                                            */
/* ------------------------------------------------------------------ */

function Integrity() {
  const [step, setStep] = useState(0);
  const hash = useMemo(() => fakeSha256("live/part-18437.m4s"), []);
  const steps = [
    { title: "Signed playback URL", body: "The edge proxy mints a short-lived HMAC token bound to the stream and session. Peers only ever see URLs the viewer already has." },
    { title: "Signed hash manifest", body: "A sidecar manifest exposes the SHA-256 of every published part for the current window, signed with the same secret." },
    { title: "Verify before caching", body: "A part is hashed on arrival. If it does not match the manifest it is discarded — never cached, never relayed." },
    { title: "Two-source agreement", body: "A part seen for the first time needs agreement from two sources before it is trusted." },
    { title: "Quarantine the sender", body: "A mismatch quarantines the peer: it stops serving, its children re-parent, and the origin covers the gap." },
  ];

  return (
    <Panel title="Integrity & access" subtitle="Why a peer cannot poison the stream.">
      <div className="p-4">
        <ol className="mb-3 space-y-1.5">
          {steps.map((s, i) => (
            <li key={s.title}>
              <button
                onClick={() => setStep(i)}
                className={`flex w-full items-start gap-2.5 rounded-[8px] border px-2.5 py-2 text-left transition-colors ${
                  step === i ? "border-accent/45 bg-accent/8" : "border-line bg-bg-1 hover:border-line-strong"
                }`}
              >
                <span className="num mt-[1px] text-[10px] text-accent">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="block text-[12px] text-text-1">{s.title}</span>
                  <span className="block text-[10.5px] leading-snug text-text-3">{s.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="rounded-[10px] border border-line bg-bg-0 p-3">
          <div className="eyebrow mb-1.5">manifest entry</div>
          <div className="num space-y-1 text-[10.5px] text-text-3">
            <div className="flex justify-between gap-3">
              <span>part</span>
              <span className="text-text-2">live/part-18437.m4s</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>sha256</span>
              <span className="text-text-2">{shortHash(hash)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>signature</span>
              <span className="text-text-2">hmac-sha256:{shortHash(hash + "sig")}</span>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Host key + guest identity                                       */
/* ------------------------------------------------------------------ */

function Identity() {
  const [hostKey, setHostKey] = useState("");
  const [streamId, setStreamId] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [detail, setDetail] = useState("");
  const pushToast = useAppStore((s) => s.pushToast);

  const create = async () => {
    const res = await mockApi.createStream("Identity walkthrough");
    setStreamId(res.id);
    setHostKey(res.hostKey);
    setStatus(201);
    setDetail(`Stream ${res.id} created. The server stored only sha256(hostKey) — the key itself lives in this browser.`);
  };

  const tryWrongKey = async () => {
    if (!streamId) {
      setStatus(400);
      setDetail("Create a stream first.");
      return;
    }
    const res = await mockApi.startStream(streamId, "wrong-key");
    setStatus(res.status);
    setDetail(res.detail === "host key rejected" ? "401 — the host key did not match the stored hash." : res.detail);
  };

  const tryRightKey = async () => {
    if (!streamId) {
      setStatus(400);
      setDetail("Create a stream first.");
      return;
    }
    const res = await mockApi.startStream(streamId, hostKey);
    setStatus(res.status);
    setDetail(res.ok ? "200 — publish token minted, WHIP endpoint ready." : res.detail);
  };

  const tryBadToken = async () => {
    try {
      await mockApi.getPlayback(streamId || "st_demo", "not-a-valid-token");
      setStatus(200);
    } catch (err) {
      setStatus((err as { status?: number }).status ?? 500);
      setDetail("403 — the playback token was rejected by the edge proxy.");
    }
  };

  return (
    <Panel title="Host key & guest identity" subtitle="No accounts. A device-local secret is the only control surface.">
      <div className="p-4">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-[9px] border border-line bg-bg-1 p-2.5">
            <div className="eyebrow mb-1">guest</div>
            <p className="text-[11px] leading-snug text-text-3">
              First request sets a signed <span className="num text-text-2">ms_guest</span> cookie (HttpOnly, SameSite=Lax, 30 days) with an id, a
              display name and a colour. No sign-up, ever.
            </p>
          </div>
          <div className="rounded-[9px] border border-line bg-bg-1 p-2.5">
            <div className="eyebrow mb-1">host</div>
            <p className="text-[11px] leading-snug text-text-3">
              Creating a stream returns a 32-byte host key. Only its SHA-256 hash is stored. Losing it loses control — by design.
            </p>
          </div>
        </div>

        <div className="mb-3 space-y-1.5">
          <Button size="sm" variant="secondary" onClick={() => void create()} className="w-full">
            POST /api/streams
          </Button>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => void tryRightKey()} className="flex-1">
              start with the real key
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void tryWrongKey()} className="flex-1">
              start with a bad key
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void tryBadToken()} className="flex-1">
              bad playback token
            </Button>
          </div>
        </div>

        {status !== null && (
          <div
            className={`rounded-[9px] border px-3 py-2 ${
              status < 300 ? "border-ok/40 bg-ok/8" : "border-live/45 bg-live/8"
            }`}
          >
            <div className={`num text-[12px] ${status < 300 ? "text-ok" : "text-live"}`}>{status}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-text-2">{detail}</div>
          </div>
        )}

        {hostKey && (
          <div className="mt-3 rounded-[9px] border border-line bg-bg-0 p-2.5">
            <div className="eyebrow mb-1">host key (this browser only)</div>
            <div className="num break-all text-[10px] text-text-3">{hostKey}</div>
            <button
              className="mt-2 text-[10.5px] text-accent underline decoration-dotted"
              onClick={() => {
                navigator.clipboard?.writeText(hostKey).catch(() => {});
                pushToast({ title: "Host key copied", body: "Treat it like a password — it is the only thing that controls this stream.", tone: "warn" });
              }}
            >
              copy host key
            </button>
          </div>
        )}

        <div className="mt-3 border-t border-line pt-2.5">
          <SectionLabel>also enforced</SectionLabel>
          <Readout label="playback URL" value="signed, 15 min TTL" />
          <Readout label="signalling" value="validated against swarm membership" />
          <Readout label="abuse" value="per-IP rate limits, hashed IPs, no PII" />
          <Readout label="transport" value="DTLS on every data channel" />
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function DeepDivePage() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
      <header className="mb-4">
        <div className="eyebrow mb-1">p2p deep dive</div>
        <h1 className="display text-[26px] leading-tight">How a part actually gets to you.</h1>
        <p className="mt-1 max-w-[72ch] text-[12.5px] leading-relaxed text-text-2">
          The rule set that makes peer delivery safe: source selection with a hard deadline, an upload policy that keeps peers honest,
          hash-verified integrity, and host control that needs no account.
        </p>
      </header>

      <div className="grid gap-3 xl:grid-cols-2">
        <SourceSelection />
        <ProtocolPlayer />
        <UploadPolicy />
        <Integrity />
        <div className="xl:col-span-2">
          <Identity />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-[11px] text-text-3">
        <Tip content="Every panel on this page is interactive — the values are live.">
          <span className="cursor-help underline decoration-dotted underline-offset-2">Everything here is live</span>
        </Tip>
      </div>
    </div>
  );
}

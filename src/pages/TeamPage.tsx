import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Panel, SectionLabel } from "@/components/ui/Panel";
import { useAppStore } from "@/engine/store";

const STACK: { group: string; items: { name: string; role: string }[] }[] = [
  {
    group: "Web",
    items: [
      { name: "Next.js 15", role: "studio, viewer, explainer" },
      { name: "React 19", role: "UI runtime" },
      { name: "Tailwind v4", role: "tokens + layout" },
      { name: "Radix", role: "unstyled primitives" },
      { name: "Motion", role: "spring motion" },
      { name: "Zustand", role: "realtime UI state" },
    ],
  },
  {
    group: "Services",
    items: [
      { name: "Fastify", role: "API + edge proxy" },
      { name: "SQLite (WAL)", role: "persistence" },
      { name: "node ws", role: "signal server" },
      { name: "MediaMTX", role: "ingest, packaging, recording" },
      { name: "Caddy", role: "single origin routing" },
      { name: "cloudflared", role: "free public HTTPS/WSS" },
    ],
  },
  {
    group: "Media & transport",
    items: [
      { name: "hls.js", role: "player with a custom P2P loader" },
      { name: "WHIP", role: "browser → MediaMTX publish" },
      { name: "WebRTC", role: "data channels, DTLS" },
      { name: "LL-HLS fMP4", role: "400 ms parts, 1 s segments" },
      { name: "SHA-256 / HMAC", role: "part integrity + signed manifest" },
    ],
  },
];

const MILESTONES = [
  {
    id: "M0",
    title: "Foundations",
    week: "week 1",
    items: ["Monorepo, strict TS, Tailwind tokens", "Guest cookie + name modal, SQLite schema", "Caddy + MediaMTX configs", "API health checks"],
  },
  {
    id: "M1",
    title: "Live at 720p",
    week: "weeks 2–3",
    items: ["Studio capture, device selection, preflight", "WHIP publish with a host token", "LL-HLS + edge proxy + hls.js player", "Cloudflare tunnel script, phone test"],
  },
  {
    id: "M2",
    title: "Swarm",
    week: "weeks 4–6",
    items: ["Signal service, assignment, SDP/ICE relay", "Protocol + data channels + part scheduler", "hls.js P2P loaders, manifests, quarantine", "Mesh panel + 50 peer headless simulator"],
  },
  {
    id: "M3",
    title: "Pro UI + explainer",
    week: "weeks 6–8",
    items: ["On-air mode, health score, origin meter", "Chat + moderation, library, settings", "The animated how-it-works page", "Accessibility and keyboard pass"],
  },
  {
    id: "M4",
    title: "Hardening + ops",
    week: "weeks 8–10",
    items: ["Reconnect/backoff, tab visibility, backpressure", "Windows services, boot auto-start, logs", "Rate limits, CSP, hijack tests", "100 viewer load test, recording finalize"],
  },
  {
    id: "M5",
    title: "Beta",
    week: "week 10+",
    items: ["10–20 real viewers, 3–5 streams", "Fix list, SLO verification", "Cost and upstream report"],
  },
];

const NON_GOALS = [
  "Real accounts, OAuth, email, profiles, follows",
  "DRM, monetization, subscriptions, ads",
  "Mobile studio, native apps",
  "Multi-region, managed CDN, ABR ladder",
  "TURN relay infrastructure (blocked peers simply use the origin)",
  "VOD transcoding pipelines, clips editor, live captions",
  "Seamless failover across multiple origin machines",
];

const NEXT = [
  {
    title: "TURN relay",
    body: "coturn on a small VPS so symmetric-NAT pairs can still peer. v1 keeps those viewers origin-only.",
    when: "after the beta",
  },
  {
    title: "Named Cloudflare Tunnel",
    body: "A permanent hostname for the same architecture. Costs a domain, nothing else changes.",
    when: "when links start breaking",
  },
  {
    title: "480p rendition",
    body: "One extra variant for cellular viewers. Costs CPU only where the browser is already encoding.",
    when: "after upstream data",
  },
  {
    title: "Multi-origin",
    body: "A second machine that can take over if the first one sleeps. Needs stream migration logic.",
    when: "later",
  },
];

export function TeamPage() {
  const setRoute = useAppStore((s) => s.setRoute);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">
      <header className="mb-5">
        <div className="eyebrow mb-1">team · stack · roadmap</div>
        <h1 className="display text-[26px] leading-tight">Built to run on one home machine.</h1>
        <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-text-2">
          A small stack, a lot of moving parts, and a hard constraint: the whole thing has to fit on a Windows box and a home uplink without
          ever asking for money.
        </p>
      </header>

      {/* Stack */}
      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        {STACK.map((group, gi) => (
          <Panel key={group.group} title={group.group} dense>
            <div className="p-3.5">
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item, i) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: gi * 0.05 + i * 0.04 }}
                    className="rounded-[9px] border border-line bg-bg-1 px-2.5 py-2 transition-colors hover:border-accent/40"
                  >
                    <div className="display text-[12.5px] text-text-1">{item.name}</div>
                    <div className="mt-0.5 text-[10px] leading-tight text-text-3">{item.role}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Roadmap */}
      <Panel title="Roadmap" subtitle="Solo estimate: 10–12 weeks to a public beta" className="mb-5">
        <div className="relative p-5">
          {/* Spine */}
          <div className="absolute left-5 top-8 bottom-8 w-px bg-line md:left-10" />

          <ol className="space-y-5">
            {MILESTONES.map((m, i) => (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="relative pl-10 md:pl-14"
              >
                <span className="absolute left-[13px] top-1 flex h-6 w-6 items-center justify-center rounded-full border border-accent/45 bg-bg-1 md:left-[33px]">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                </span>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="num text-[12px] text-accent">{m.id}</span>
                  <span className="text-[13.5px] font-medium text-text-1">{m.title}</span>
                  <span className="num text-[10.5px] text-text-3">{m.week}</span>
                </div>
                <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                  {m.items.map((item) => (
                    <li key={item} className="text-[11.5px] leading-snug text-text-3">
                      • {item}
                    </li>
                  ))}
                </ul>
              </motion.li>
            ))}
          </ol>
        </div>
      </Panel>

      {/* Non-goals + next */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="Non-goals for v1" subtitle="Said out loud so nobody expects them">
          <ul className="p-4">
            {NON_GOALS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 py-1.5">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-text-3" />
                <span className="text-[12px] leading-snug text-text-3">{item}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-4">
            <SectionLabel>the one-line pitch</SectionLabel>
            <p className="text-[13px] leading-relaxed text-text-2">
              A stranger opens a link on their phone and watches a 720p stream within three seconds; ten or more viewers watch from a home
              connection while the origin serves less than half the bytes.
            </p>
          </div>
        </Panel>

        <Panel title="What's next" dense>
          <div className="divide-y divide-line">
            {NEXT.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-4"
              >
                <Badge tone="muted">{item.when}</Badge>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-text-1">{item.title}</div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-text-3">{item.body}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="border-t border-line p-4">
            <button
              onClick={() => setRoute("simulator")}
              className="text-[12px] text-accent underline decoration-dotted underline-offset-2"
            >
              Go back and break the thing →
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

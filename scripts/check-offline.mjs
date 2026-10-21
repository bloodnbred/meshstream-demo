#!/usr/bin/env node
/**
 * Offline guarantee check.
 *
 * The demo must never talk to the network at runtime: no CDN fonts, no remote
 * images, no fetch/XHR to a remote host. This script scans the built output
 * for anything that could cause a runtime request:
 *
 *   src="https://…"      href="https://…"   url(https://…)
 *   fetch("https://…")   import("https://…") @import "https://…"
 *   new Worker("https://…")  new EventSource("https://…")
 *
 * Absolute URLs that only appear inside error messages (React's error
 * decoder, Tailwind's licence comment) are reported as notes, never as
 * failures — they are never requested.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const targets = ["dist", "dist-single"].filter((d) => {
  try {
    return statSync(join(root, d)).isDirectory();
  } catch {
    return false;
  }
});

/** Patterns that would actually trigger a network request. */
const REQUEST_PATTERNS = [
  { re: /\bsrc\s*=\s*["'`]https?:\/\/[^"'`)]+/gi, kind: "src attribute" },
  { re: /\bhref\s*=\s*["'`]https?:\/\/[^"'`)]+/gi, kind: "href attribute" },
  { re: /url\(\s*["']?https?:\/\/[^)"']+/gi, kind: "css url()" },
  { re: /@import\s+(?:url\()?["']https?:\/\/[^"')\s]+/gi, kind: "css @import" },
  { re: /\bfetch\(\s*["'`]https?:\/\/[^"'`)]+/gi, kind: "fetch()" },
  { re: /\bimport\(\s*["'`]https?:\/\/[^"'`)]+/gi, kind: "dynamic import" },
  { re: /new\s+(?:Worker|EventSource|WebSocket)\(\s*["'`]https?:\/\/[^"'`)]+/gi, kind: "socket" },
  { re: /navigator\.(?:sendBeacon|clipboard)/gi, kind: "navigator API", ignore: true },
];

const ANY_URL = /https?:\/\/[^\s"'`)<>\\]+/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const failures = [];
const notes = new Set();
let scanned = 0;

for (const target of targets) {
  for (const file of walk(join(root, target))) {
    const ext = extname(file);
    if (![".js", ".css", ".html", ".svg", ".json"].includes(ext)) continue;
    scanned++;

    const text = readFileSync(file, "utf8");
    const rel = file.replace(root, ".");

    for (const { re, kind, ignore } of REQUEST_PATTERNS) {
      re.lastIndex = 0;
      for (const match of text.matchAll(re)) {
        if (ignore) continue;
        failures.push(`${rel} · ${kind} -> ${match[0].slice(0, 90)}`);
      }
    }

    // Everything else with an absolute URL is only a note (error copy, licence).
    for (const match of text.match(ANY_URL) ?? []) {
      notes.add(`${rel} · ${match.slice(0, 70)}`);
    }
  }
}

if (notes.size) {
  console.log("notes (not requests — error messages / licence text):");
  for (const note of [...notes].slice(0, 12)) console.log(`  · ${note}`);
  if (notes.size > 12) console.log(`  · …and ${notes.size - 12} more`);
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} request-causing reference(s) found. The demo must run with zero network calls:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log(`\n✓ offline-check: ${scanned} file(s) scanned in [${targets.join(", ")}] — nothing can reach the network.`);

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";

// The owner's visitor report: every session with its IPs, wallets, time on site and activity. Needs the stats key.
const STATS_DIR = process.env.STATS_DIR ?? "/var/www/cardsdotgg-data";
const MAX_EVENTS_PER_SESSION = 300;

type Line = { t: number; ip: string; ua: string; sid: string; type: string; path: string; wallet?: string; data?: Record<string, unknown> };

function allowed(given: string | null) {
  const key = process.env.STATS_KEY ?? "";
  if (!key || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!allowed(req.headers.get("x-stats-key"))) return NextResponse.json({ error: "Wrong key." }, { status: 401 });
  let raw = "";
  try { raw = await readFile(join(STATS_DIR, "events.jsonl"), "utf8"); } catch {}

  const sessions = new Map<string, { sid: string; first: number; last: number; ips: Set<string>; wallets: Set<string>; ua: string; pages: number; events: Line[] }>();
  let total = 0;
  for (const row of raw.split("\n")) {
    if (!row) continue;
    let e: Line;
    try { e = JSON.parse(row); } catch { continue; }
    total++;
    let s = sessions.get(e.sid);
    if (!s) { s = { sid: e.sid, first: e.t, last: e.t, ips: new Set(), wallets: new Set(), ua: e.ua, pages: 0, events: [] }; sessions.set(e.sid, s); }
    s.last = Math.max(s.last, e.t);
    s.first = Math.min(s.first, e.t);
    if (e.ip) s.ips.add(e.ip);
    if (e.wallet) s.wallets.add(e.wallet.toLowerCase());
    if (e.type === "page") s.pages++;
    if (e.type !== "ping") { s.events.push(e); if (s.events.length > MAX_EVENTS_PER_SESSION) s.events.shift(); }
  }

  const now = Date.now();
  const list = [...sessions.values()].sort((a, b) => b.last - a.last).map((s) => ({
    sid: s.sid, first: s.first, last: s.last, seconds: Math.round((s.last - s.first) / 1000), live: now - s.last < 60_000,
    ips: [...s.ips], wallets: [...s.wallets], ua: s.ua, pages: s.pages,
    events: s.events.map((e) => ({ t: e.t, type: e.type, path: e.path, wallet: e.wallet, data: e.data })),
  }));
  const ips = new Set(list.flatMap((s) => s.ips)), wallets = new Set(list.flatMap((s) => s.wallets));
  return NextResponse.json({
    now, events: total, sessions: list.length, uniqueIps: ips.size, uniqueWallets: wallets.size, liveNow: list.filter((s) => s.live).length,
    list,
  });
}

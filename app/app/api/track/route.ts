import { NextResponse } from "next/server";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// Stores one visitor event per line, with the IP nginx forwards and the server time, for the owner's /stats page.
// The file lives outside the app folder, so redeploys keep it.
const STATS_DIR = process.env.STATS_DIR ?? "/var/www/cardsdotgg-data";
const TYPES = new Set(["page", "ping", "wallet", "leave", "tx", "tx_error", "action"]);

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 4000) return new NextResponse(null, { status: 413 });
  let e: { sid?: string; type?: string; path?: string; wallet?: string; data?: unknown };
  try { e = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }
  if (!e.sid || typeof e.sid !== "string" || e.sid.length > 64 || !e.type || !TYPES.has(e.type)) return new NextResponse(null, { status: 400 });

  const h = req.headers;
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const line = {
    t: Date.now(),
    ip,
    ua: (h.get("user-agent") ?? "").slice(0, 200),
    sid: e.sid,
    type: e.type,
    path: typeof e.path === "string" ? e.path.slice(0, 200) : "",
    wallet: typeof e.wallet === "string" && /^0x[0-9a-fA-F]{40}$/.test(e.wallet) ? e.wallet : undefined,
    data: e.data && typeof e.data === "object" ? e.data : undefined,
  };
  try {
    await mkdir(STATS_DIR, { recursive: true });
    await appendFile(join(STATS_DIR, "events.jsonl"), JSON.stringify(line) + "\n");
  } catch {
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}

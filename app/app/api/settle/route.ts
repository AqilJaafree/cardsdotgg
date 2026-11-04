import { NextResponse } from "next/server";
import { botWallet, settle, withBot } from "@/lib/bot";

// Settles a match once both players are in, so nobody has to sign a FIGHT transaction.
// The contract lets anyone resolve, and the result comes only from the seed, so this changes nothing about who wins.
export async function POST(req: Request) {
  const bot = botWallet();
  if (!bot) return NextResponse.json({ error: "Match settling is not configured on this server." }, { status: 503 });
  const { matchId } = (await req.json().catch(() => ({}))) as { matchId?: string };
  if (!matchId || !/^\d+$/.test(matchId)) return NextResponse.json({ error: "Invalid match." }, { status: 400 });
  try {
    const status = await withBot(() => settle(BigInt(matchId), bot.wallet));
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.split("\n")[0] : "Could not settle the match" }, { status: 500 });
  }
}

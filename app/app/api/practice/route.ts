import { NextResponse } from "next/server";
import { zeroAddress } from "viem";
import { arena, arenaAbi, botWallet, pub, settle, withBot } from "@/lib/bot";

// Practice on chain: a player opens a challenge aimed at the practice bot, and the bot joins it with its own deck and
// fights it right away. The match is a normal Arena match, so it settles and rates like any other.
export async function POST(req: Request) {
  const bot = botWallet();
  const deck = process.env.BOT_DECK_ID;
  if (!bot || !deck) return NextResponse.json({ error: "Practice bot is not configured on this server." }, { status: 503 });
  const { matchId } = (await req.json().catch(() => ({}))) as { matchId?: string };
  if (!matchId || !/^\d+$/.test(matchId)) return NextResponse.json({ error: "Invalid match." }, { status: 400 });
  const id = BigInt(matchId);

  try {
    const status = await withBot(async () => {
      const m = await pub.readContract({ address: arena, abi: arenaAbi, functionName: "getMatch", args: [id] });
      const opp = await pub.readContract({ address: arena, abi: arenaAbi, functionName: "opponentOf", args: [id] });
      if (opp.toLowerCase() !== bot.account.address.toLowerCase() || m.playerA === zeroAddress) throw new Error("This match is not a practice match.");
      if (m.status === 0) {
        const hash = await bot.wallet.writeContract({ address: arena, abi: arenaAbi, functionName: "accept", args: [id, BigInt(deck)] });
        await pub.waitForTransactionReceipt({ hash });
      }
      return settle(id, bot.wallet);
    });
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.split("\n")[0] : "Practice bot failed" }, { status: 500 });
  }
}

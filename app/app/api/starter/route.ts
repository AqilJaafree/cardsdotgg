import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, defineChain, http, isAddress, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Gas for new players: a Google sign-in gives a fresh wallet with no MON, and every move onchain needs gas.
// The server sends a small amount once per address, only while that wallet is nearly empty. Testnet only.
const chain = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
});
const DRIP = parseEther("0.25");
const NEEDS_GAS_BELOW = parseEther("0.05");
const served = new Map<string, number>();

export async function POST(req: Request) {
  const key = process.env.DRIP_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) return NextResponse.json({ error: "Gas drip is not configured on this server." }, { status: 503 });
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address || !isAddress(address)) return NextResponse.json({ error: "Invalid address." }, { status: 400 });

  const pub = createPublicClient({ chain, transport: http() });
  const balance = await pub.getBalance({ address });
  if (balance >= NEEDS_GAS_BELOW) return NextResponse.json({ funded: false, reason: "has gas" });
  const last = served.get(address.toLowerCase());
  if (last && Date.now() - last < 24 * 3600 * 1000) return NextResponse.json({ funded: false, reason: "already sent today" });

  served.set(address.toLowerCase(), Date.now());
  try {
    const wallet = createWalletClient({ account: privateKeyToAccount(key), chain, transport: http() });
    const hash = await wallet.sendTransaction({ to: address, value: DRIP });
    await pub.waitForTransactionReceipt({ hash });
    return NextResponse.json({ funded: true, hash });
  } catch (e) {
    served.delete(address.toLowerCase());
    return NextResponse.json({ error: e instanceof Error ? e.message.split("\n")[0] : "Drip failed" }, { status: 500 });
  }
}

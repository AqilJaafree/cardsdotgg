"use client";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { BRAND } from "@/lib/brand";

export function ConnectBar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  return (
    <header className="bar">
      <Link href="/" className="brand">{BRAND}</Link>
      <nav>
        <Link href="/deposit">Deposit</Link>
        <Link href="/decks">Decks</Link>
        <Link href="/arena">Arena</Link>
        <Link href="/withdraw">Withdraw</Link>
      </nav>
      {isConnected ? (
        <button className="ghost" onClick={() => disconnect()}>{address!.slice(0, 6)}…{address!.slice(-4)}</button>
      ) : (
        <button onClick={() => connect({ connector: connectors[0] })} disabled={isPending}>Connect wallet</button>
      )}
    </header>
  );
}

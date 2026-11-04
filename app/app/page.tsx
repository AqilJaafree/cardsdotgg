import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <div className="card">
      <h1>{BRAND}</h1>
      <p>Deposit testnet tokens, mint a deck NFT, and stake your yield in 1v1 battles. Principal never moves.</p>
      <p><Link className="btn" href="/deposit">Start: claim tokens and deposit</Link></p>
    </div>
  );
}

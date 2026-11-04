import { deployed } from "@/lib/contracts";
export function Gate({ children }: { children: React.ReactNode }) {
  if (!deployed) return <div className="card warn"><h2>The onchain arena isn’t connected yet.</h2><p>This local build includes practice battles, the card showcase, and free reference packs. Wallet deposits and matches become available when deployment addresses are configured.</p><a className="btn" href="/">Play a practice battle</a></div>;
  return <>{children}</>;
}

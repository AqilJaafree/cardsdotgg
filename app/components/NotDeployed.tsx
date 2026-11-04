import { deployed } from "@/lib/contracts";
export function Gate({ children }: { children: React.ReactNode }) {
  if (!deployed) return <div className="card warn">Contracts are not deployed yet (shared/addresses.json missing). Waiting on Agent A.</div>;
  return <>{children}</>;
}

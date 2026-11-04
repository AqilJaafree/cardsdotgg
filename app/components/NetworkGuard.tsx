"use client";
import { useAccount, useSwitchChain } from "wagmi";
import { monadTestnet } from "@/lib/chain";

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();
  if (isConnected && chainId !== monadTestnet.id) {
    return (
      <div className="card warn">
        <p>
          Wrong network. {`Cardsdotgg`} runs on Monad Testnet (chain{" "}
          {monadTestnet.id}).
        </p>
        <button
          onClick={() => switchChain({ chainId: monadTestnet.id })}
          disabled={isPending}
        >
          {isPending ? "Switching…" : "Switch to Monad Testnet"}
        </button>
        {error && <p className="err">{error.message}</p>}
      </div>
    );
  }
  return <>{children}</>;
}

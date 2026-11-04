"use client";
import { useEffect } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { explorerTx } from "@/lib/chain";

type Req = Parameters<ReturnType<typeof useWriteContract>["writeContract"]>[0];

/** All writes go through this: wallet prompt -> pending -> explorer link, with revert reasons. */
export function TxButton({
  label, request, disabled, onConfirmed,
}: { label: string; request: Req; disabled?: boolean; onConfirmed?: (hash: `0x${string}`) => void }) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const rcpt = useWaitForTransactionReceipt({ hash });

  useEffect(() => { if (rcpt.isSuccess && hash) onConfirmed?.(hash); }, [rcpt.isSuccess, hash]); // eslint-disable-line

  const status = isPending ? "Confirm in wallet…" : hash && rcpt.isLoading ? "Pending…" : label;
  const reverted = rcpt.data?.status === "reverted";
  const msg = (error as { shortMessage?: string } | null)?.shortMessage ?? error?.message ?? rcpt.error?.message;

  return (
    <div className="tx">
      <button disabled={disabled || isPending || (!!hash && rcpt.isLoading)} onClick={() => { reset(); writeContract(request); }}>
        {status}
      </button>
      {hash && (
        <a href={explorerTx(hash)} target="_blank" rel="noreferrer">
          {rcpt.isSuccess && !reverted ? "✓ Confirmed" : reverted ? "✗ Reverted" : "Submitted"} · view on explorer
        </a>
      )}
      {(msg || reverted) && <p className="err">{reverted ? "Transaction reverted onchain." : msg}</p>}
    </div>
  );
}

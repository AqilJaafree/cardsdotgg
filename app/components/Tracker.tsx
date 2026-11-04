"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { setTrackedWallet, track } from "@/lib/track";

/** Sends page views, the connected wallet and a heartbeat every 20 s while the tab is visible. Renders nothing. */
export function Tracker() {
  const path = usePathname();
  const { address } = useAccount();

  useEffect(() => {
    setTrackedWallet(address);
    if (address) track("wallet", { address });
  }, [address]);

  useEffect(() => { track("page"); }, [path]);

  useEffect(() => {
    const beat = setInterval(() => { if (document.visibilityState === "visible") track("ping"); }, 20_000);
    const leave = () => track("leave");
    addEventListener("pagehide", leave);
    return () => { clearInterval(beat); removeEventListener("pagehide", leave); };
  }, []);

  return null;
}

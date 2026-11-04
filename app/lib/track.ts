"use client";
// Visitor analytics for the owner's /stats page: one session id per browser tab, page views, a heartbeat while the tab
// is visible (for time on site), the connected wallet, and key actions. The server adds the IP and the time.

const SID_KEY = "cardsdotgg.sid";
let wallet: string | undefined;

export function sessionId(): string {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem(SID_KEY, sid); }
    return sid;
  } catch {
    return "no-session";
  }
}

export function setTrackedWallet(address?: string) {
  wallet = address;
}

export function track(type: string, data?: Record<string, unknown>) {
  try {
    if (location.pathname.startsWith("/stats")) return;
    const body = JSON.stringify({ sid: sessionId(), type, path: location.pathname + location.search, wallet, data, ts: Date.now() });
    if (type === "leave" && navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {}
}

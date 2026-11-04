"use client";
import { useEffect, useState } from "react";

// The owner's visitor report. Opens with the stats key: from the link (#key=...), or typed in once and kept in this browser.
const KEY = "cardsdotgg.stats-key";
type Event = { t: number; type: string; path: string; wallet?: string; data?: Record<string, unknown> };
type Session = { sid: string; first: number; last: number; seconds: number; live: boolean; ips: string[]; wallets: string[]; ua: string; pages: number; events: Event[] };
type Report = { now: number; events: number; sessions: number; uniqueIps: number; uniqueWallets: number; liveNow: number; list: Session[] };

const time = (t: number) => new Date(t).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dur = (s: number) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`);
const device = (ua: string) => {
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "?";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "?";
  return `${br} · ${os}`;
};
const what = (e: Event) => {
  if (e.type === "page") return `opened ${e.path}`;
  if (e.type === "wallet") return `wallet connected ${e.wallet}`;
  if (e.type === "leave") return `left (${e.path})`;
  if (e.type === "tx") return `✓ ${String(e.data?.label ?? e.data?.fn ?? "transaction")}`;
  if (e.type === "tx_error") return `✗ ${String(e.data?.label ?? "transaction")}: ${String(e.data?.message ?? "")}`;
  return `${String(e.data?.name ?? e.type)}${e.data?.detail ? `: ${String(e.data.detail)}` : ""}`;
};

export default function Stats() {
  const [key, setKey] = useState(""), [input, setInput] = useState("");
  const [report, setReport] = useState<Report | null>(null), [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null), [q, setQ] = useState(""), [onlyWallet, setOnlyWallet] = useState(false);

  useEffect(() => {
    const fromLink = new URLSearchParams(location.hash.slice(1)).get("key");
    if (fromLink) { try { localStorage.setItem(KEY, fromLink); } catch {} history.replaceState(null, "", location.pathname); }
    let saved = fromLink ?? "";
    try { saved ||= localStorage.getItem(KEY) ?? ""; } catch {}
    setKey(saved);
  }, []);

  useEffect(() => {
    if (!key) return;
    let stop = false;
    const load = () => fetch("/api/stats", { headers: { "x-stats-key": key } })
      .then(async (r) => { if (r.status === 401) throw new Error("Wrong key."); return r.json(); })
      .then((j) => { if (!stop) { setReport(j); setErr(""); } })
      .catch((e) => { if (!stop) { setErr(e.message); if (e.message === "Wrong key.") { try { localStorage.removeItem(KEY); } catch {} setKey(""); } } });
    load();
    const t = setInterval(load, 10_000);
    return () => { stop = true; clearInterval(t); };
  }, [key]);

  if (!key) return (
    <div className="st-page"><div className="st-gate">
      <h1>Visitor stats</h1>
      <p>Enter the stats key.</p>
      <form onSubmit={(e) => { e.preventDefault(); try { localStorage.setItem(KEY, input.trim()); } catch {} setKey(input.trim()); }}>
        <input type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Stats key" autoFocus />
        <button type="submit">Open</button>
      </form>
      {err && <p className="st-err">{err}</p>}
    </div><style>{css}</style></div>
  );

  const term = q.trim().toLowerCase();
  const rows = (report?.list ?? []).filter((s) => (!onlyWallet || s.wallets.length) && (!term || s.ips.some((i) => i.includes(term)) || s.wallets.some((w) => w.includes(term)) || s.sid.includes(term)));
  return (
    <div className="st-page">
      <header className="st-head">
        <h1>Visitor stats</h1>
        <span>{report ? `updated ${time(report.now)} IST · refreshes every 10 s` : "loading…"}</span>
        <button onClick={() => { try { localStorage.removeItem(KEY); } catch {} setKey(""); setReport(null); }}>Lock</button>
      </header>
      {err && <p className="st-err">{err}</p>}
      {report && <div className="st-tiles">
        <div><b>{report.liveNow}</b><span>live now</span></div>
        <div><b>{report.sessions}</b><span>sessions</span></div>
        <div><b>{report.uniqueIps}</b><span>unique IPs</span></div>
        <div><b>{report.uniqueWallets}</b><span>wallets</span></div>
        <div><b>{report.events}</b><span>events</span></div>
      </div>}
      <div className="st-tools">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by IP, wallet or session" />
        <label><input type="checkbox" checked={onlyWallet} onChange={(e) => setOnlyWallet(e.target.checked)} /> with wallet only</label>
      </div>
      <div className="st-table">
        <div className="st-row st-th"><span>Last seen (IST)</span><span>Time on site</span><span>IP</span><span>Wallet</span><span>Device</span><span>Pages</span></div>
        {rows.map((s) => (
          <div key={s.sid}>
            <button className={`st-row ${open === s.sid ? "on" : ""}`} onClick={() => setOpen(open === s.sid ? null : s.sid)}>
              <span>{s.live && <i className="st-live" />}{time(s.last)}</span>
              <span>{dur(s.seconds)}</span>
              <span className="mono">{s.ips.join(", ") || "—"}</span>
              <span className="mono">{s.wallets.length ? s.wallets.map((w) => `${w.slice(0, 6)}…${w.slice(-4)}`).join(", ") : "—"}</span>
              <span>{device(s.ua)}</span>
              <span>{s.pages}</span>
            </button>
            {open === s.sid && (
              <div className="st-detail">
                <p>Session <span className="mono">{s.sid}</span> · started {time(s.first)} · {s.ua}</p>
                {s.wallets.map((w) => <p key={w}>Wallet <a className="mono" href={`https://testnet.monadvision.com/address/${w}`} target="_blank" rel="noreferrer">{w}</a></p>)}
                <ol>{[...s.events].reverse().map((e, i) => <li key={i}><span className="mono">{time(e.t)}</span> {what(e)}</li>)}</ol>
              </div>
            )}
          </div>
        ))}
        {report && !rows.length && <p className="st-empty">No visitors yet.</p>}
      </div>
      <style>{css}</style>
    </div>
  );
}

const css = `
.st-page{position:fixed;inset:0;z-index:500;overflow:auto;background:#0e0b1f;color:#ece8ff;font:14px/1.45 Inter,system-ui,sans-serif;padding:20px 16px 40px}
.st-page h1{margin:0;font-size:22px}
.st-gate{max-width:360px;margin:15vh auto 0;display:flex;flex-direction:column;gap:10px}
.st-gate form{display:flex;gap:8px}
.st-page input{background:#1a1636;border:1px solid #3a3470;color:#fff;border-radius:8px;padding:9px 11px;font:inherit;flex:1}
.st-page button{background:#836ef9;border:0;color:#fff;border-radius:8px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer}
.st-head{display:flex;flex-wrap:wrap;align-items:center;gap:12px;max-width:1200px;margin:0 auto}
.st-head span{color:#9a93c7;font-size:12px;flex:1}
.st-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;max-width:1200px;margin:16px auto}
.st-tiles div{background:#1a1636;border:1px solid #2d2757;border-radius:12px;padding:12px}
.st-tiles b{display:block;font-size:26px}.st-tiles span{color:#9a93c7;font-size:12px}
.st-tools{display:flex;flex-wrap:wrap;gap:12px;align-items:center;max-width:1200px;margin:0 auto 10px}
.st-tools label{color:#9a93c7;display:flex;gap:6px;align-items:center}.st-tools label input{flex:none}
.st-table{max-width:1200px;margin:0 auto;border:1px solid #2d2757;border-radius:12px;overflow:hidden}
.st-row{display:grid;grid-template-columns:1.3fr .8fr 1.2fr 1.2fr 1fr .5fr;gap:10px;width:100%;text-align:left;background:transparent!important;border-radius:0!important;border-bottom:1px solid #2d2757!important;padding:10px 12px!important;font-weight:400!important;color:#ece8ff}
.st-row.on,.st-row:hover{background:#1a1636!important}
.st-th{font-size:12px;color:#9a93c7;background:#16122e!important}
.st-live{display:inline-block;width:8px;height:8px;border-radius:50%;background:#39d98a;box-shadow:0 0 8px #39d98a;margin-right:6px}
.st-detail{background:#13102a;padding:12px 16px;border-bottom:1px solid #2d2757;font-size:13px}
.st-detail p{margin:0 0 6px;color:#c9c2f0;overflow-wrap:anywhere}.st-detail a{color:#b9aaff}
.st-detail ol{margin:8px 0 0;padding-left:18px;max-height:340px;overflow:auto}.st-detail li{margin:2px 0}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px;overflow-wrap:anywhere}
.st-err{color:#ff8b8b;max-width:1200px;margin:8px auto}.st-empty{padding:20px;color:#9a93c7;margin:0}
@media(max-width:760px){.st-row{grid-template-columns:1fr 1fr}.st-th{display:none}}
`;

"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useAccount} from "wagmi";
import {usePrivy} from "@privy-io/react-auth";
import {useState} from "react";
import {ArrowUpRight,ChevronDown,Hexagon,Layers,Package,Swords,Vault,Wallet,X} from "lucide-react";
import {NetworkGuard} from "@/components/NetworkGuard";
const links=[{href:"/",name:"Arena",icon:Swords},{href:"/collection",name:"Collection",icon:Layers},{href:"/packs",name:"Packs",icon:Package},{href:"/decks",name:"Vault",icon:Vault}];
export default function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname(),game=path==="/"||path==="/collection"||path==="/packs";
  const {address,isConnected}=useAccount();
  const {ready,authenticated,login,logout}=usePrivy();
  const [walletOpen,setWalletOpen]=useState(false);
  // The owner's stats page has its own key, so it skips the sign-in screen and the site chrome.
  if(path.startsWith("/stats"))return <>{children}</>;
  // Every screen needs a connected wallet: until one is connected, only the connect screen shows.
  if(!authenticated)return <><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap"/>
    <div className="wallet-gate">
      <img className="wallet-gate-logo" src="/cardsdotgg-logo.jpg" alt="Cardsdotgg: collect, build, battle" draggable={false}/>
      <div className="wallet-gate-card">
        <h2>Sign in to play</h2>
        <p>Your deck, matches and yield live on Monad testnet, so every player needs a wallet.</p>
        <button className="cm-btn wallet-gate-btn" disabled={!ready} onClick={()=>login()}>{ready?"SIGN IN":"LOADING…"}</button>
        <small className="wallet-gate-note">Google gets you a wallet instantly. MetaMask, Rabby and other wallets work too.</small>
      </div>
    </div></>;
  return <><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap"/><header className="site-header"><Link className="brand-lockup" href="/" aria-label="Cardsdotgg home"><span className="brand-icon"><Layers size={23} strokeWidth={1.7}/></span><b>Cardsdotgg</b></Link><nav className="desktop-nav" aria-label="Main navigation">{links.map(({href,name,icon:Icon})=><Link className={(href==="/decks"?!game:path===href)?"active":""} href={href} key={href}><Icon size={16}/>{name}</Link>)}</nav><div className="header-right"><span className="network-label"><span/>MONAD TESTNET</span><button className="wallet-button" onClick={()=>setWalletOpen(true)}><Wallet size={15}/><span>{isConnected?`${address!.slice(0,5)}…${address!.slice(-4)}`:"Connect wallet"}</span><ChevronDown size={12}/></button></div></header>
    <main className={game?"game-main":"legacy-main"}>{game?children:<><div className="vault-subnav">{[["/deposit","Deposit"],["/decks","My vault"],["/arena","Onchain arena"],["/pool","Pool"],["/withdraw","Withdraw"]].map(([href,label])=><Link key={href} href={href} className={path===href?"active":""}>{label}</Link>)}</div><NetworkGuard>{children}</NetworkGuard></>}</main>
    <footer className="site-footer"><span><span className="footer-mark">◇</span> A little strategy. A little magic.</span><span>Cardsdotgg · Local preview<span className="footer-dot"/>Built on Monad<ArrowUpRight size={11}/></span></footer>
    <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(({href,name,icon:Icon})=><Link className={(href==="/decks"?!game:path===href)?"active":""} href={href} key={href}><Icon size={20}/><span>{name}</span></Link>)}</nav>
    {walletOpen&&<div className="modal-backdrop"><section className="confirmation wallet-dialog" role="dialog" aria-modal="true" aria-label="Wallet"><button className="round-button dismiss" onClick={()=>setWalletOpen(false)} aria-label="Close wallet dialog"><X size={18}/></button><span className="brand-icon"><Wallet size={23}/></span><h2>{isConnected?"Your wallet":"Connect your wallet"}</h2><p>Use your wallet for the existing Monad testnet vault and onchain challenges. Local practice and packs work without one.</p>{isConnected?<><code>{address}</code><button className="subtle-button" onClick={()=>{logout();setWalletOpen(false);}}>Sign out</button></>:<button className="primary-button" onClick={()=>{setWalletOpen(false);login();}}>Sign in<ArrowUpRight size={15}/></button>}</section></div>}
  </>;
}

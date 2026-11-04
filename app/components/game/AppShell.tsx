"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useAccount,useConnect,useDisconnect} from "wagmi";
import {useState} from "react";
import {ArrowUpRight,ChevronDown,Hexagon,Layers,Package,Swords,Vault,Wallet,X} from "lucide-react";
import {NetworkGuard} from "@/components/NetworkGuard";
const links=[{href:"/",name:"Arena",icon:Swords},{href:"/collection",name:"Collection",icon:Layers},{href:"/packs",name:"Packs",icon:Package},{href:"/decks",name:"Vault",icon:Vault}];
export default function AppShell({children}:{children:React.ReactNode}){
  const path=usePathname(),game=path==="/"||path==="/collection"||path==="/packs";
  const {address,isConnected}=useAccount(),{connect,connectors,isPending,error}=useConnect(),{disconnect}=useDisconnect();
  const [walletOpen,setWalletOpen]=useState(false);
  return <><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap"/><header className="site-header"><Link className="brand-lockup" href="/" aria-label="Cardsdotgg home"><span className="brand-icon"><Layers size={23} strokeWidth={1.7}/></span><b>Cardsdotgg</b></Link><nav className="desktop-nav" aria-label="Main navigation">{links.map(({href,name,icon:Icon})=><Link className={(href==="/decks"?!game:path===href)?"active":""} href={href} key={href}><Icon size={16}/>{name}</Link>)}</nav><div className="header-right"><span className="network-label"><span/>MONAD TESTNET</span><button className="wallet-button" onClick={()=>setWalletOpen(true)}><Wallet size={15}/><span>{isConnected?`${address!.slice(0,5)}…${address!.slice(-4)}`:"Connect wallet"}</span><ChevronDown size={12}/></button></div></header>
    <main className={game?"game-main":"legacy-main"}>{game?children:<><div className="vault-subnav">{[["/deposit","Deposit"],["/decks","My vault"],["/arena","Onchain arena"],["/withdraw","Withdraw"]].map(([href,label])=><Link key={href} href={href} className={path===href?"active":""}>{label}</Link>)}</div><NetworkGuard>{children}</NetworkGuard></>}</main>
    <footer className="site-footer"><span><span className="footer-mark">◇</span> A little strategy. A little magic.</span><span>Cardsdotgg · Local preview<span className="footer-dot"/>Built on Monad<ArrowUpRight size={11}/></span></footer>
    <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(({href,name,icon:Icon})=><Link className={(href==="/decks"?!game:path===href)?"active":""} href={href} key={href}><Icon size={20}/><span>{name}</span></Link>)}</nav>
    {walletOpen&&<div className="modal-backdrop"><section className="confirmation wallet-dialog" role="dialog" aria-modal="true" aria-label="Wallet"><button className="round-button dismiss" onClick={()=>setWalletOpen(false)} aria-label="Close wallet dialog"><X size={18}/></button><span className="brand-icon"><Wallet size={23}/></span><h2>{isConnected?"Your wallet":"Connect your wallet"}</h2><p>Use your wallet for the existing Monad testnet vault and onchain challenges. Local practice and packs work without one.</p>{isConnected?<><code>{address}</code><button className="subtle-button" onClick={()=>{disconnect();setWalletOpen(false);}}>Disconnect</button></>:connectors.length?connectors.map(c=><button className="primary-button" key={c.uid} disabled={isPending} onClick={()=>connect({connector:c},{onSuccess:()=>setWalletOpen(false)})}>{isPending?"Check your wallet…":`Connect ${c.name}`}<ArrowUpRight size={15}/></button>):<p>No browser wallet found. Open this app in your wallet’s browser or install a browser wallet extension.</p>}{error&&<p className="err">{error.message.slice(0,180)}</p>}</section></div>}
  </>;
}

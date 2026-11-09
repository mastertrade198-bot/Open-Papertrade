"use client";
import { useEffect, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import Link from "next/link";
import { userAPI, type SimulatedPosition } from "@/lib/api";
import { resolveAssetDisplayName } from "@/lib/assetDisplayName";

const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"USD"}).format(value);
const dateTime=(value:string|null)=>{if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);};

export default function PortfolioOperationsStatement(){
  const [positions,setPositions]=useState<SimulatedPosition[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [filter,setFilter]=useState<"ALL"|"OPEN"|"CLOSED">("ALL");
  const load=async()=>{try{const result=await userAPI.getPositions();setPositions(result.positions||[]);setError("");}catch{setError("Não foi possível carregar o extrato de operações.");}finally{setLoading(false);}};
  useEffect(()=>{void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},15000);const focus=()=>void load();window.addEventListener("focus",focus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",focus);};},[]);
  const sorted=positions.filter(p=>filter==="ALL"||p.status===filter).sort((a,b)=>new Date(b.openedAt).getTime()-new Date(a.openedAt).getTime());
  return <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-4">
      <div className="flex items-center gap-2"><ClipboardList size={18} className="text-[var(--accent-primary)]"/><div><h2 className="text-sm font-semibold">Extrato de operações</h2><p className="text-xs text-[var(--text-secondary)]">Entradas, encerramentos e resultados das operações manuais</p></div></div>
      <div className="flex items-center gap-2"><button type="button" onClick={()=>void load()} aria-label="Atualizar extrato" className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><RefreshCw size={14}/></button><Link href="/balance-history" className="text-xs text-[var(--accent-primary)] hover:underline">Extrato financeiro</Link></div>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-[var(--border-primary)] px-4 py-3">
      {([{key:"ALL",label:"Todas"},{key:"OPEN",label:"Abertas"},{key:"CLOSED",label:"Encerradas"}] as const).map(item=><button key={item.key} type="button" onClick={()=>setFilter(item.key)} aria-pressed={filter===item.key} className={`rounded-full border px-3 py-1.5 text-xs ${filter===item.key?"border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]":"border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>{item.label}</button>)}
    </div>
    {error&&<p role="alert" className="px-4 py-3 text-xs text-red-400">{error}</p>}
    {loading?<p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">Carregando operações...</p>:sorted.length===0?<div className="px-4 py-8 text-center"><p className="text-sm text-[var(--text-secondary)]">{filter==="ALL"?"Nenhuma operação manual registrada até o momento.":"Nenhuma operação nesta situação."}</p><p className="mt-2 text-xs text-[var(--text-secondary)]">As operações de robôs podem ser consultadas em <Link href="/robots" className="text-[var(--accent-primary)] hover:underline">Meus robôs</Link>.</p></div>:
      <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-xs"><thead className="bg-[var(--bg-card-inner)] text-[var(--text-secondary)]"><tr><th className="px-4 py-3">Ativo</th><th className="px-3 py-3">Abertura</th><th className="px-3 py-3">Encerramento</th><th className="px-3 py-3">Operação</th><th className="px-3 py-3">Situação</th><th className="px-4 py-3 text-right">Resultado</th></tr></thead><tbody className="divide-y divide-[var(--border-primary)]">{sorted.map(p=>{const pnl=p.status==="OPEN"?p.unrealizedPnl:p.realizedPnl;return <tr key={p.id}><td className="px-4 py-3 font-medium">{resolveAssetDisplayName(p.symbol,p.name)}</td><td className="whitespace-nowrap px-3 py-3 text-[var(--text-secondary)]">{dateTime(p.openedAt)}</td><td className="whitespace-nowrap px-3 py-3 text-[var(--text-secondary)]">{dateTime(p.closedAt)}</td><td className="px-3 py-3">{p.side==="LONG"?"Compra":"Venda"} · {p.leverage}x</td><td className="px-3 py-3">{p.status==="OPEN"?"Aberta":"Encerrada"}</td><td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${pnl==null?"text-[var(--text-secondary)]":pnl>=0?"text-[var(--accent-green)]":"text-[var(--accent-red)]"}`}>{pnl==null?"—":money(pnl)}</td></tr>})}</tbody></table></div>}
  </section>;
}

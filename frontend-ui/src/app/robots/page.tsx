"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { API_HOST } from "@/lib/api";

type Robot = {id:string;symbol:string;assetName:string;capital:number;equity:number;pnl:number;pnlPercent:number;status:string;createdAt:string};
type Asset = {symbol:string;name:string};
const presets:Record<string,Record<string,number>> = {
  ema:{fast:21,slow:50},macd:{fast:12,slow:26,signal:9},
  rsi:{period:14,overbought:70,oversold:30},bollinger:{period:20,deviation:2},
  stochastic:{k:14,d:3,smooth:3},adx:{period:14,threshold:25},
};
const names:Record<string,string>={ema:"EMA",macd:"MACD",rsi:"Índice de Força Relativa (IFR)",bollinger:"Bandas de Bollinger",stochastic:"Estocástico",adx:"ADX"};
const api = (path:string, options?:RequestInit) => fetch(`${API_HOST}/api/robots/${path}`,{credentials:"include",...options,headers:{"Content-Type":"application/json",...options?.headers}}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"Erro na API");return data;});
export default function RobotsPage(){
  const [robots,setRobots]=useState<Robot[]>([]);
  const [assets,setAssets]=useState<Asset[]>([]);
  const [symbol,setSymbol]=useState("BTC");
  const [value,setValue]=useState("1000");
  const [tp,setTp]=useState("5");
  const [sl,setSl]=useState("3");
  const [selected,setSelected]=useState<string[]>(["ema","macd","rsi"]);
  const [parameters,setParameters]=useState<Record<string,Record<string,number>>>(presets);
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const activeCount=robots.filter(r=>r.status==="ACTIVE").length;
  const invested=robots.reduce((sum,r)=>sum+r.capital,0);
  const totalPnl=robots.reduce((sum,r)=>sum+r.pnl,0);
  const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"USD"}).format(n);
  const signed=(n:number)=>`${n>0?"+":""}${n.toFixed(2)}%`;
  const reload=()=>api("").then(data=>setRobots(data.robots));
  useEffect(()=>{reload().catch(e=>setError(e.message)).finally(()=>setLoading(false));const timer=setInterval(()=>{reload().catch(()=>{});},5000);fetch(`${API_HOST}/api/stocks/catalog/?page=1`,{credentials:"include"}).then(r=>r.json()).then(d=>{if(Array.isArray(d.assets))setAssets(d.assets)}).catch(()=>{});return()=>clearInterval(timer);},[]);
  const create=async(e:React.FormEvent)=>{e.preventDefault();setCreating(true);setError("");try{await api("",{method:"POST",body:JSON.stringify({symbol,value,tp,sl,indicators:Object.fromEntries(selected.map(k=>[k,parameters[k]]))})});await reload();setShowForm(false);}catch(e){setError(e instanceof Error?e.message:"Falha ao criar robô")}finally{setCreating(false)}};
  return <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]"><Sidebar/><main className="mx-auto max-w-[1440px] px-4 py-8 lg:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-[var(--accent-primary)]">Ambiente de simulação</p><h1 className="text-2xl font-bold">Robôs de investimentos</h1><p className="text-sm text-[var(--text-secondary)]">Capital e operações fictícios. Nenhuma ordem é enviada ao mercado.</p></div><button onClick={()=>setShowForm(v=>!v)} className="rounded-lg bg-[var(--accent-primary)] px-5 py-3 text-sm font-bold text-white">{showForm?"Voltar à lista":"+ Iniciar novo robô"}</button></div>
    {error&&<p role="alert" className="mb-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-400">{error}</p>}
    {showForm&&<form onSubmit={create} className="mb-8 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5"><h2 className="mb-4 text-lg font-semibold">Configuração do robô simulado</h2>
      <div className="grid gap-4 md:grid-cols-4"><label className="text-xs">Ativo<select value={symbol} onChange={e=>setSymbol(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3">{[...new Map([{symbol:"BTC",name:"Bitcoin"},{symbol:"ETH",name:"Ethereum"},...assets].map(a=>[a.symbol,a])).values()].map(a=><option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</option>)}</select></label>{[["Valor (USD)",value,setValue],["TP (%)",tp,setTp],["SL (%)",sl,setSl]].map(([label,v,set])=><label key={label as string} className="text-xs">{label as string}<input required type="number" min="0.01" step="0.01" value={v as string} onChange={e=>(set as (s:string)=>void)(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3"/></label>)}</div>
      <h3 className="mb-3 mt-6 font-semibold">Indicadores técnicos</h3><div className="grid gap-3 md:grid-cols-2">{Object.keys(presets).map(key=><div key={key} className="rounded-lg border border-[var(--border-primary)] p-4"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={selected.includes(key)} onChange={e=>setSelected(s=>e.target.checked?[...s,key]:s.filter(x=>x!==key))}/>{names[key]}</label>{selected.includes(key)&&<div className="mt-3 grid grid-cols-3 gap-2">{Object.entries(parameters[key]).map(([param,num])=><label key={param} className="text-[11px] text-[var(--text-secondary)]">{param}<input type="number" min="0.01" max="1000" step="any" value={num} onChange={e=>setParameters(p=>({...p,[key]:{...p[key],[param]:Number(e.target.value)}}))} className="mt-1 w-full rounded border border-[var(--border-primary)] bg-[var(--bg-primary)] p-2 text-[var(--text-primary)]"/></label>)}</div>}</div>)}</div>
      <p className="my-4 text-xs text-[var(--text-secondary)]">O valor será reservado do saldo fictício. O robô inicia com resultado de 0%. As operações demonstrativas são aleatórias, com preços sintéticos, e dependem do processo de simulação ativo no servidor.</p><button disabled={creating||selected.length===0} className="rounded-lg bg-[var(--accent-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{creating?"Criando...":"Criar robô simulado"}</button></form>}
    <section aria-label="Resumo dos robôs" className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {label:"Total de robôs",value:String(robots.length),hint:"Estratégias cadastradas"},
        {label:"Em execução",value:String(activeCount),hint:"Simulações ativas"},
        {label:"Capital alocado",value:money(invested),hint:"Saldo fictício reservado"},
        {label:"Resultado acumulado",value:money(totalPnl),hint:"P/L demonstrativo",tone:totalPnl>=0?"positive":"negative"},
      ].map(item=><div key={item.label} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 shadow-sm">
        <p className="text-xs font-medium text-[var(--text-secondary)]">{item.label}</p>
        <p className={`mt-3 break-words text-2xl font-semibold tracking-tight ${item.tone==="positive"?"text-emerald-400":item.tone==="negative"?"text-rose-400":""}`}>{item.value}</p>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">{item.hint}</p>
      </div>)}
    </section>
    <section aria-labelledby="robots-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 id="robots-heading" className="text-lg font-semibold">Meus robôs</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Acompanhe suas estratégias e abra os detalhes de cada simulação.</p></div><span className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs text-[var(--text-secondary)]">{robots.length} cadastrados</span></div>
      {loading?<div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-secondary)]">Carregando robôs...</div>:robots.length===0?<div className="rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-card)] px-6 py-14 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 text-xl text-[var(--accent-primary)]">↗</div><h3 className="font-semibold">Seu painel está pronto</h3><p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-secondary)]">Crie seu primeiro robô para acompanhar operações demonstrativas e resultados simulados.</p><button type="button" onClick={()=>setShowForm(true)} className="mt-5 rounded-lg bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-white">Criar primeiro robô</button></div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {robots.map(r=><article key={r.id} className="group flex min-w-0 flex-col rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 shadow-sm transition-colors hover:border-[var(--accent-primary)]/50">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">{r.symbol}</p><h3 className="mt-1 truncate text-lg font-semibold" title={r.assetName}>{r.assetName}</h3></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${r.status==="ACTIVE"?"border-emerald-500/30 bg-emerald-500/10 text-emerald-400":r.status==="PAUSED"?"border-amber-500/30 bg-amber-500/10 text-amber-400":"border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>{r.status==="ACTIVE"?"● Ativo":r.status==="PAUSED"?"Pausado":r.status==="CLOSED"?"Encerrado":r.status}</span></div>
          <div className="mt-5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4"><p className="text-xs text-[var(--text-secondary)]">Resultado do robô · simulado</p><div className="mt-2 flex flex-wrap items-baseline justify-between gap-2"><strong className={`text-2xl font-semibold tracking-tight ${r.pnl>=0?"text-emerald-400":"text-rose-400"}`}>{money(r.pnl)}</strong><span className={`rounded-md px-2 py-1 text-xs font-semibold ${r.pnl>=0?"bg-emerald-500/10 text-emerald-400":"bg-rose-500/10 text-rose-400"}`}>{signed(r.pnlPercent)}</span></div></div>
          <div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-xs text-[var(--text-secondary)]">Capital inicial</p><p className="mt-1 font-mono text-sm font-semibold">{money(r.capital)}</p></div><div><p className="text-xs text-[var(--text-secondary)]">Patrimônio atual</p><p className="mt-1 font-mono text-sm font-semibold">{money(r.equity)}</p></div></div>
          <div className="mt-5 border-t border-[var(--border-primary)] pt-4"><Link href={`/robots/${r.id}`} className="flex items-center justify-between rounded-lg bg-[var(--accent-primary)]/10 px-4 py-3 text-sm font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20"><span>Ver painel do robô</span><span aria-hidden="true">→</span></Link></div>
        </article>)}
      </div>}
    </section>
  </main></div>;
}

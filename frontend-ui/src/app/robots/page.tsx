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
    <h2 className="mb-4 text-lg font-semibold">Meus robôs</h2>{loading?<p>Carregando...</p>:robots.length===0?<div className="rounded-xl border border-[var(--border-primary)] p-10 text-center text-sm text-[var(--text-secondary)]">Nenhum robô cadastrado. Inicie um novo robô para acompanhar uma simulação.</div>:<div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]"><table className="w-full text-left text-sm"><thead className="bg-[var(--bg-card)] text-[var(--text-secondary)]"><tr>{["Ativo","Capital simulado","P/L","Rentabilidade","Status",""].map(x=><th key={x} className="p-4">{x}</th>)}</tr></thead><tbody>{robots.map(r=><tr key={r.id} className="border-t border-[var(--border-primary)]"><td className="p-4 font-semibold">{r.assetName} · {r.symbol}</td><td className="p-4">${r.capital.toFixed(2)}</td><td className="p-4">${r.pnl.toFixed(2)}</td><td className="p-4">{r.pnlPercent.toFixed(2)}%</td><td className="p-4">{r.status}</td><td className="p-4"><Link className="text-[var(--accent-primary)] underline" href={`/robots/${r.id}`}>Visualizar</Link></td></tr>)}</tbody></table></div>}
  </main></div>;
}

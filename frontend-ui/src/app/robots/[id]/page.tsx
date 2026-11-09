"use client";
import {use, useCallback, useEffect, useState} from "react";
import Sidebar from "@/components/Sidebar";
import AdvancedChart from "@/components/chart/AdvancedChart";
import Link from "next/link";
import {Activity, ArrowLeft, Clock3, TrendingUp} from "lucide-react";
import {API_HOST} from "@/lib/api";
type Op={id:string;side:string;status:string;pnl:number;pnlPercent:number;openedAt:string;closedAt:string|null;entryPrice:number;exitPrice:number|null};
type Pagination={page:number;pageSize:number;totalPages:number;totalOperations:number;hasPrevious:boolean;hasNext:boolean};
type Robot={id:string;displayNumber:number;symbol:string;assetName:string;capital:number;equity:number;pnl:number;pnlPercent:number;tp:number;sl:number;status:string;operations:Op[];pagination:Pagination;indicators:Record<string,unknown>};
const robotAssetLabel = (name: string, symbol: string) => {
 const normalized = symbol.toUpperCase().replace(/[-/]?USD(T)?$/, "");
 const names: Record<string,string> = {BTC:"Bitcoin",ETH:"Ethereum",SOL:"Solana",XRP:"XRP",ADA:"Cardano",DOGE:"Dogecoin",BNB:"BNB",LTC:"Litecoin",AVAX:"Avalanche",DOT:"Polkadot"};
 const supplied = (name || "").trim();
 if (names[normalized] && (!supplied || supplied.toUpperCase() === symbol.toUpperCase() || supplied.toUpperCase() === normalized || /^([A-Z0-9]+)[-/]USD(T)?$/i.test(supplied))) return names[normalized];
 return supplied || names[normalized] || symbol;
};
export default function RobotDetail({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);const [robot,setRobot]=useState<Robot|null>(null);const [error,setError]=useState("");const [page,setPage]=useState(1);
 const refresh=useCallback(()=>fetch(`${API_HOST}/api/robots/${id}/?page=${page}`,{credentials:"include"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Falha ao carregar");setRobot(d);setError("");}).catch(e=>setError(e.message)),[id,page]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer)},[refresh]);
 const close=()=>{window.alert("Operação em andamento, caso você finalize agora poderá ter prejuízo.");};

 const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"USD"}).format(n);
 const positive=(robot?.pnl??0)>=0;
 const operationDate=(value:string|null)=>{if(!value)return "—";const date=new Date(value);return Number.isNaN(date.getTime())?"—":new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(date);};
 return <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]"><Sidebar/><main className="mx-auto max-w-[1600px] px-4 py-5 lg:px-8">
 <Link href="/robots" className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)]"><ArrowLeft size={15}/> Todos os robôs</Link>
 {error&&<p role="alert" className="my-4 text-red-400">{error}</p>}
 {!robot?<p className="mt-6">Carregando robô...</p>:<>
 <header className="my-6 flex flex-wrap items-center justify-between gap-4">
 <div><div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]"><span className="rounded-md bg-[var(--bg-muted)] px-2 py-1 font-semibold">ROBÔ #{String(robot.displayNumber).padStart(2,"0")}</span><span className="rounded-md border border-[var(--border-primary)] px-2 py-1">{robot.status==="ACTIVE"?"Ativo":robot.status==="CLOSED"?"Encerrado":robot.status}</span></div>
 <h1 className="text-2xl font-bold tracking-tight">{robotAssetLabel(robot.assetName,robot.symbol)}</h1><p className="mt-1 text-xs text-[var(--text-secondary)]">Simulação de mercado · dados demonstrativos</p></div>
 {robot.status!=="CLOSED"&&<button type="button" onClick={close} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] px-4 py-2 text-sm hover:opacity-80">Encerrar robô</button>}
 </header>
 <section aria-label="Resumo do robô" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
 <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"><p className="text-xs text-[var(--text-secondary)]">Ativo negociado</p><p className="mt-2 text-lg font-semibold">{robotAssetLabel(robot.assetName,robot.symbol)}</p></div>
 <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"><p className="text-xs text-[var(--text-secondary)]">Valor investido</p><p className="mt-2 text-lg font-semibold tabular-nums">{money(robot.capital)}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Capital inicial</p></div>
 <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"><p className="flex items-center gap-1 text-xs text-[var(--text-secondary)]"><TrendingUp size={13}/> Lucro / prejuízo</p><p className={`mt-2 text-lg font-semibold tabular-nums ${positive?"text-emerald-500":"text-red-500"}`}>{money(robot.pnl)} <span className="text-sm">({robot.pnlPercent.toFixed(2)}%)</span></p><p className="mt-1 text-xs text-[var(--text-secondary)]">Patrimônio: {money(robot.equity)}</p></div>
 <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"><p className="text-xs text-[var(--text-secondary)]">Limites definidos</p><p className="mt-2 text-lg font-semibold tabular-nums">+{robot.tp}% / -{robot.sl}%</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Take profit / Stop loss</p></div>
 </section>
 <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
 <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] shadow-sm">
 <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-primary)] px-5 py-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><Activity size={16}/> Histórico de preços</h2><span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]"><Clock3 size={13}/> Mais antigo → mais recente</span></div>
 <div className="robot-chart-no-drawings min-w-0"><AdvancedChart symbol={robot.symbol} symbolName={robotAssetLabel(robot.assetName,robot.symbol)} height={610} disableDrawings minimalHeader fitHistoryOnLoad initialState={{timeframe:"1M",indicators:[]}}/></div>
 <p className="border-t border-[var(--border-primary)] px-5 py-3 text-xs text-[var(--text-secondary)]">Arraste para navegar pelo histórico. Use o zoom para aproximar ou afastar. A extensão depende dos dados disponíveis.</p>
 </div>
 <aside className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
 <div className="border-b border-[var(--border-primary)] px-5 py-4"><h2 className="text-base font-semibold">Operações concluídas</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{robot.pagination?.totalOperations??robot.operations.length} operações registradas</p></div>
 <div className="overflow-x-auto px-5"><table className="w-full text-left text-sm"><thead><tr className="text-[var(--text-secondary)]"><th className="py-3">Ativo</th><th className="px-2">Data e hora</th><th>Resultado</th><th className="text-right">P/L</th></tr></thead><tbody>{robot.operations.map(op=><tr key={op.id} className="border-t border-[var(--border-primary)]"><td className="py-4 font-medium">{robotAssetLabel(robot.assetName,robot.symbol)}<span className="block text-[10px] font-normal text-[var(--text-secondary)]">{op.status}</span></td><td className="px-2 text-xs tabular-nums whitespace-nowrap text-[var(--text-secondary)]" title="Data e hora do encerramento">{operationDate(op.closedAt)}</td><td className={op.pnl>=0?"text-emerald-500":"text-red-500"}>{op.pnlPercent.toFixed(2)}%</td><td className={`text-right tabular-nums ${op.pnl>=0?"text-emerald-500":"text-red-500"}`}>{money(op.pnl)}</td></tr>)}</tbody></table>
 {robot.operations.length===0&&<p className="py-8 text-center text-xs text-[var(--text-secondary)]">Nenhuma operação concluída ainda.</p>}</div>
 {robot.pagination&&robot.pagination.totalPages>1&&<div className="flex items-center justify-between gap-2 border-t border-[var(--border-primary)] px-4 py-3 text-xs"><span className="text-[var(--text-secondary)]">{robot.pagination.page} / {robot.pagination.totalPages}</span><div className="flex gap-2"><button type="button" disabled={!robot.pagination.hasPrevious} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-md border border-[var(--border-primary)] px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={!robot.pagination.hasNext} onClick={()=>setPage(p=>p+1)} className="rounded-md border border-[var(--border-primary)] px-3 py-2 disabled:opacity-40">Próxima</button></div></div>}
 </aside></section>
  <style jsx global>{`
  /* Defense in depth: hide all drawing controls in robot detail only. */
  .robot-chart-no-drawings [aria-label="Ferramentas de desenho"],
  .robot-chart-no-drawings [data-drawing-toolbar],
  .robot-chart-no-drawings [data-drawing-help] { display: none !important; }
 `}</style>
 </>}</main></div>
}

"use client";
import { useEffect, useRef, useState } from "react";
import { X, Search, ChevronDown, Check } from "lucide-react";
import { resolveAssetDisplayName } from "@/lib/assetDisplayName";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { API_HOST } from "@/lib/api";
import { usePortfolio } from "@/context/PortfolioContext";

type Robot = {id:string;displayNumber:number;symbol:string;assetName:string;capital:number;equity:number;pnl:number;pnlPercent:number;status:string;configured:boolean;createdAt:string};
type Asset = {symbol:string;name:string;category?:string;assetType?:string;type?:string};
const cryptoNames:Record<string,string>={BTC:"Bitcoin",ETH:"Ethereum",SOL:"Solana",XRP:"XRP",ADA:"Cardano",DOGE:"Dogecoin",BNB:"BNB",LTC:"Litecoin",DOT:"Polkadot",AVAX:"Avalanche",LINK:"Chainlink"};
const displayName=(asset:Asset)=>{
  const base=asset.symbol.toUpperCase().replace(/[-/]USD(T)?$/,"");
  if(cryptoNames[base]&&(!asset.name||asset.name.toUpperCase()===asset.symbol.toUpperCase()||asset.name.toUpperCase()===base))return cryptoNames[base];
  return resolveAssetDisplayName(asset.symbol,asset.name);
};
const hasName=(asset:Asset)=>displayName(asset).toUpperCase()!==asset.symbol.toUpperCase();
const categoryFor=(asset:Asset)=>{const type=(asset.category||asset.assetType||asset.type||"").toUpperCase();if(/CRYPTO|COIN|CRIPTO/.test(type)||cryptoNames[asset.symbol.toUpperCase().replace(/[-/]USD(T)?$/,"")])return "Criptomoedas";if(/ETF|FUND/.test(type))return "ETFs";if(/FOREX|CURRENCY|FX|MOEDA/.test(type))return "Moedas";if(/INDEX|INDICE|ÍNDICE/.test(type))return "Índices";if(/COMMODITY|METAL/.test(type))return "Commodities";return "Ações";};
const presets:Record<string,Record<string,number>> = {
  ema:{fast:21,slow:50},macd:{fast:12,slow:26,signal:9},
  rsi:{period:14,overbought:70,oversold:30},bollinger:{period:20,deviation:2},
  stochastic:{k:14,d:3,smooth:3},adx:{period:14,threshold:25},
};
const indicatorSettings:Record<string,{field:string;label:string;min:number;max:number;help:string}>={
  ema:{field:"fast",label:"Período rápido",min:2,max:200,help:"Menor valor acompanha movimentos mais recentes."},
  macd:{field:"signal",label:"Período do sinal",min:2,max:100,help:"Controla a suavização do sinal MACD."},
  rsi:{field:"period",label:"Período do IFR",min:2,max:100,help:"Menor valor torna o indicador mais sensível."},
  bollinger:{field:"period",label:"Período das bandas",min:2,max:200,help:"Quantidade de períodos usados nas bandas."},
  stochastic:{field:"k",label:"Período %K",min:2,max:100,help:"Quantidade de períodos observados."},
  adx:{field:"period",label:"Período do ADX",min:2,max:100,help:"Janela usada para medir a força da tendência."},
};
const api = (path:string, options?:RequestInit) => fetch(`${API_HOST}/api/robots/${path}`,{credentials:"include",...options,headers:{"Content-Type":"application/json",...options?.headers}}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||"Erro na API");return data;});
export default function RobotsPage(){
  const { refreshUserData } = usePortfolio();
  const [robots,setRobots]=useState<Robot[]>([]);
  const [assets,setAssets]=useState<Asset[]>([]);
  const [symbol,setSymbol]=useState("BTC");
  const [assetSearch,setAssetSearch]=useState("");
  const [assetCategory,setAssetCategory]=useState("Todas");
  const [assetPickerOpen,setAssetPickerOpen]=useState(false);
  const [value,setValue]=useState("");
  const [tp,setTp]=useState("5");
  const [sl,setSl]=useState("3");
  const [selected,setSelected]=useState<string[]>(["ema","macd","rsi"]);
  const [indicatorParams,setIndicatorParams]=useState<Record<string,Record<string,number>>>(()=>Object.fromEntries(Object.entries(presets).map(([key,params])=>[key,{...params}])));
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const modalRef=useRef<HTMLDivElement>(null);
  const openForm=()=>{setError("");setValue("");setShowForm(true)};
  const closeForm=()=>{if(!creating){setShowForm(false);setError("")}};
  useEffect(()=>{
    if(!showForm)return;
    const previousOverflow=document.body.style.overflow;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow="hidden";
    modalRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!creating)closeForm();
      if(event.key==="Tab"&&modalRef.current){
        const controls=Array.from(modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'));
        if(!controls.length)return;
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    };
    document.addEventListener("keydown",onKey);
    return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener("keydown",onKey);previousFocus?.focus()};
  },[showForm,creating]);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("ALL");
  const visibleRobots=robots.filter(r=>(statusFilter==="ALL"||(statusFilter==="VERIFYING"&&r.status==="ACTIVE"&&!r.configured)||(statusFilter==="ACTIVE"&&r.status==="ACTIVE"&&r.configured)||r.status===statusFilter&&statusFilter!=="ACTIVE")&&`${r.assetName} ${r.symbol}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  const selectableAssets=[...new Map([...assets,{symbol:"BTC",name:"Bitcoin",category:"Criptomoedas"},{symbol:"ETH",name:"Ethereum",category:"Criptomoedas"}].map(a=>[a.symbol.toUpperCase(),a])).values()].filter(hasName);
  const assetCategories=["Todas",...Array.from(new Set(selectableAssets.map(categoryFor)))];
  const filteredAssets=selectableAssets.filter(a=>(assetCategory==="Todas"||categoryFor(a)===assetCategory)&&`${displayName(a)} ${a.symbol}`.toLocaleLowerCase("pt-BR").includes(assetSearch.trim().toLocaleLowerCase("pt-BR"))).sort((a,b)=>displayName(a).localeCompare(displayName(b),"pt-BR"));
  const chosenAsset=selectableAssets.find(a=>a.symbol===symbol);
  const activeCount=robots.filter(r=>r.status==="ACTIVE"&&r.configured).length;
  const invested=robots.reduce((sum,r)=>sum+r.capital,0);
  const totalPnl=robots.reduce((sum,r)=>sum+r.pnl,0);
  const money=(n:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"USD"}).format(n);
  const signed=(n:number)=>`${n>0?"+":""}${n.toFixed(2)}%`;
  const reload=()=>api("").then(data=>setRobots(data.robots));
  useEffect(()=>{reload().catch(e=>setError(e.message)).finally(()=>setLoading(false));const timer=setInterval(()=>{reload().catch(()=>{});},5000);(async()=>{try{const all:Asset[]=[];for(let page=1;page<=30;page++){const response=await fetch(`${API_HOST}/api/stocks/catalog/?page=${page}`,{credentials:"include"});if(!response.ok)break;const data=await response.json();if(!Array.isArray(data.assets))break;all.push(...data.assets);if(!data.hasMore)break;}setAssets(all);}catch{}})();return()=>clearInterval(timer);},[]);
  const create=async(e:React.FormEvent)=>{e.preventDefault();if(!value.trim()||!Number.isFinite(Number(value))||Number(value)<=0){setError("Informe o valor em USD que deseja reservar para este robô.");return;}if(!Number.isFinite(Number(tp))||!Number.isFinite(Number(sl))||Number(tp)<=0||Number(sl)<=0||selected.length===0||selected.some(key=>{const config=indicatorSettings[key];const n=indicatorParams[key][config.field];return !Number.isInteger(n)||n<config.min||n>config.max;})){setError("Confira os limites e selecione pelo menos um indicador.");return;}setCreating(true);setError("");try{await api("",{method:"POST",body:JSON.stringify({symbol,value,tp,sl,indicators:Object.fromEntries(selected.map(key=>[key,indicatorParams[key]]))})});await Promise.all([reload(), refreshUserData()]);setShowForm(false);}catch(e){setError(e instanceof Error?e.message:"Falha ao criar robô")}finally{setCreating(false)}};
  return <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]"><Sidebar/><main className="mx-auto max-w-[1440px] px-4 py-8 lg:px-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-[var(--accent-primary)]">Ambiente de demonstração</p><h1 className="text-2xl font-bold">Meus robôs de investimento</h1><p className="text-sm text-[var(--text-secondary)]">Acompanhe estratégias, indicadores e resultados em um único painel.</p></div><button onClick={openForm} className="rounded-lg bg-[var(--accent-primary)] px-5 py-3 text-sm font-bold text-white">+ Iniciar novo robô</button></div>
    {error&&!showForm&&<p role="alert" className="mb-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-400">{error}</p>}
    {showForm&&<div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)closeForm()}}>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[3px]" aria-hidden="true"/>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="robot-create-title" tabIndex={-1} className="relative z-10 flex max-h-[min(90vh,850px)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] shadow-2xl outline-none">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-primary)] px-5 py-4 sm:px-7">
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--accent-primary)]">Nova estratégia</p><h2 id="robot-create-title" className="text-xl font-semibold">Iniciar novo robô</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Escolha um ativo e informe o valor que deseja reservar.</p></div>
        <button type="button" onClick={closeForm} disabled={creating} aria-label="Fechar janela" className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] disabled:opacity-40"><X size={18}/></button>
      </div>
      <form onSubmit={create} className="flex min-h-0 flex-col">
      <div className="overflow-y-auto px-5 py-5 sm:px-7">
      {error&&<p role="alert" className="mb-4 rounded-lg border border-red-500/40 p-3 text-sm text-red-400">{error}</p>}
      <div className="space-y-5">
        <section aria-labelledby="robot-asset-heading">
          <h3 id="robot-asset-heading" className="mb-2 text-sm font-semibold">Ativo</h3>
          <p className="mb-2 text-xs text-[var(--text-secondary)]">Selecione uma empresa, criptomoeda ou outro investimento.</p>
          <button type="button" aria-expanded={assetPickerOpen} aria-controls="robot-asset-options" onClick={()=>setAssetPickerOpen(v=>!v)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3 text-left hover:border-[var(--accent-primary)]">
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{chosenAsset?displayName(chosenAsset):"Escolher ativo"}</span><span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{chosenAsset?categoryFor(chosenAsset):"Toque para pesquisar"}</span></span>
            <ChevronDown size={18} className={`shrink-0 text-[var(--text-secondary)] transition-transform ${assetPickerOpen?"rotate-180":""}`}/>
          </button>
          {assetPickerOpen&&<div id="robot-asset-options" className="mt-2 overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)]">
            <div className="space-y-2 border-b border-[var(--border-primary)] p-3">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 focus-within:border-[var(--accent-primary)]">
                <Search size={16} className="shrink-0 text-[var(--text-secondary)]"/>
                <input autoFocus type="search" value={assetSearch} onChange={e=>setAssetSearch(e.target.value)} placeholder="Buscar por nome ou código" aria-label="Pesquisar ativos" className="min-w-0 w-full bg-transparent py-2.5 text-sm outline-none"/>
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Categorias de ativos">
                {assetCategories.map(c=><button key={c} type="button" onClick={()=>setAssetCategory(c)} aria-pressed={assetCategory===c} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${assetCategory===c?"border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white":"border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>{c}</button>)}
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-1.5" role="listbox" aria-label="Ativos encontrados">
              {filteredAssets.length===0?<p className="px-3 py-4 text-xs text-[var(--text-secondary)]">Nenhum ativo com nome disponível nesta categoria.</p>:filteredAssets.map(a=><button key={a.symbol} type="button" role="option" aria-selected={symbol===a.symbol} onClick={()=>{setSymbol(a.symbol);setAssetPickerOpen(false);setAssetSearch("");}} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[var(--bg-muted)] ${symbol===a.symbol?"bg-[var(--accent-primary)]/10":""}`}>
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{displayName(a)}</span><span className="block text-[11px] text-[var(--text-secondary)]">{categoryFor(a)}</span></span>
                {symbol===a.symbol?<Check size={17} className="shrink-0 text-[var(--accent-primary)]"/>:<span className="shrink-0 text-[11px] text-[var(--text-secondary)]">{a.symbol}</span>}
              </button>)}
            </div>
          </div>}
        </section>
        <section aria-labelledby="robot-investment-heading" className="rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5 p-4 sm:p-5">
          <h3 id="robot-investment-heading" className="text-sm font-semibold">Valor do investimento</h3>
          <p id="robot-capital-help" className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">Informe quanto do seu saldo de demonstração deseja reservar para este robô.</p>
          <label htmlFor="robot-capital" className="mt-4 block text-xs font-semibold">Valor do investimento (USD) <span className="text-red-400">*</span></label>
          <div className="mt-2 flex overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/40">
            <span className="flex items-center border-r border-[var(--border-primary)] px-4 text-sm font-semibold text-[var(--text-secondary)]">US$</span>
            <input id="robot-capital" required type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="Digite o valor" aria-describedby="robot-capital-help" value={value} onChange={e=>setValue(e.target.value)} className="min-w-0 w-full bg-transparent px-4 py-3 text-base font-semibold outline-none placeholder:font-normal placeholder:text-[var(--text-secondary)]"/>
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">O valor será reservado ao iniciar e poderá variar com os resultados simulados.</p>
        </section>
        <section className="overflow-hidden rounded-lg border border-[var(--border-primary)]">
          <div className="border-b border-[var(--border-primary)] px-4 py-3">
            <h3 className="text-sm font-semibold">Configurações avançadas</h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Personalize metas e indicadores, se desejar. Os valores padrão já estão preenchidos.</p>
          </div>
          <div className="space-y-4 px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium">Meta de ganho (%)<input required type="number" min="0.01" step="0.01" value={tp} onChange={e=>setTp(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm"/></label>
              <label className="text-xs font-medium">Limite de perda (%)<input required type="number" min="0.01" step="0.01" value={sl} onChange={e=>setSl(e.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm"/></label>
            </div>
            <div><p className="mb-2 text-xs font-semibold">Indicadores utilizados</p>
              <div className="space-y-2">{([["ema","Médias móveis"],["macd","MACD"],["rsi","Força relativa (IFR)"],["bollinger","Bandas de Bollinger"],["stochastic","Estocástico"],["adx","Força da tendência (ADX)"]] as const).map(([key,label])=>{
                const setting=indicatorSettings[key];
                return <div key={key} className="rounded-lg border border-[var(--border-primary)] p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={selected.includes(key)} onChange={e=>setSelected(current=>e.target.checked?[...current,key]:current.filter(item=>item!==key))}/>{label}</label>
                  {selected.includes(key)&&<div className="mt-3 pl-5">
                    <label className="flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]"><span>{setting.label}</span><input aria-label={setting.label+" de "+label} type="number" required min={setting.min} max={setting.max} step="1" value={indicatorParams[key][setting.field]} onChange={e=>setIndicatorParams(current=>({...current,[key]:{...current[key],[setting.field]:e.target.value===""?0:Number(e.target.value)}}))} className="w-24 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-right text-sm text-[var(--text-primary)]"/></label>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{setting.help}</p>
                  </div>}
                </div>;
              })}</div>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">Os valores ajustam os parâmetros registrados para cada indicador. Atualmente, eles não comandam as operações nem determinam os resultados demonstrativos.</p>
          </div>
        </section>
      </div>
      <div className="mt-5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4"><p className="text-xs font-semibold">Resumo antes de iniciar</p><div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-[var(--text-secondary)]">Valor que será reservado</span><strong className="tabular-nums">{value&&Number(value)>0?money(Number(value)):"Informe um valor"}</strong></div><p className="mt-2 text-xs text-[var(--text-secondary)]">Ao confirmar, esse valor será reservado do seu saldo de demonstração. O robô começa com resultado de 0%.</p></div>
      </div><div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border-primary)] bg-[var(--bg-card)] px-5 py-4 sm:px-7"><button type="button" disabled={creating} onClick={closeForm} className="rounded-lg border border-[var(--border-primary)] px-5 py-3 text-sm font-semibold disabled:opacity-40">Cancelar</button><button disabled={creating||!value||Number(value)<=0||selected.length===0} className="rounded-lg bg-[var(--accent-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{creating?"Criando...":"Iniciar robô"}</button></div></form></div></div>}
    <section aria-label="Resumo dos robôs" className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {label:"Total de robôs",value:String(robots.length),hint:"Estratégias cadastradas"},
        {label:"Em execução",value:String(activeCount),hint:"Robôs em execução"},
        {label:"Capital alocado",value:money(invested),hint:"Capital reservado"},
        {label:"Resultado acumulado",value:money(totalPnl),hint:"Lucro / prejuízo",tone:totalPnl>=0?"positive":"negative"},
      ].map(item=><div key={item.label} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 shadow-sm">
        <p className="text-xs font-medium text-[var(--text-secondary)]">{item.label}</p>
        <p className={`mt-3 break-words text-2xl font-semibold tracking-tight ${item.tone==="positive"?"text-emerald-400":item.tone==="negative"?"text-rose-400":""}`}>{item.value}</p>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">{item.hint}</p>
      </div>)}
    </section>
    <section aria-labelledby="robots-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 id="robots-heading" className="text-lg font-semibold">Meus robôs</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">Acompanhe suas estratégias e consulte os detalhes de cada robô.</p></div><span className="rounded-full border border-[var(--border-primary)] px-3 py-1 text-xs text-[var(--text-secondary)]">{robots.length} cadastrados</span></div>
      <div className="mb-4 flex flex-wrap gap-3"><label className="min-w-[180px] flex-1 text-xs text-[var(--text-secondary)]">Buscar por ativo ou símbolo<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ex.: Bitcoin ou BTC" className="mt-1 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-primary)]"/></label><label className="text-xs text-[var(--text-secondary)]">Situação<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="mt-1 block rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-primary)]"><option value="ALL">Todos</option><option value="VERIFYING">Realizando verificação</option><option value="ACTIVE">Ativos</option><option value="PAUSED">Pausados</option><option value="CLOSED">Encerrados</option></select></label></div>
      {loading?<div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-secondary)]">Carregando robôs...</div>:robots.length===0?<div className="rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--bg-card)] px-6 py-14 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 text-xl text-[var(--accent-primary)]">↗</div><h3 className="font-semibold">Seu painel está pronto</h3><p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-secondary)]">Crie seu primeiro robô para acompanhar operações e resultados.</p><button type="button" onClick={openForm} className="mt-5 rounded-lg bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-semibold text-white">Criar primeiro robô</button></div>:visibleRobots.length===0?<div className="rounded-xl border border-[var(--border-primary)] p-8 text-center text-sm text-[var(--text-secondary)]">Nenhum robô corresponde aos filtros. <button type="button" onClick={()=>{setSearch("");setStatusFilter("ALL")}} className="font-semibold text-[var(--accent-primary)] underline">Limpar filtros</button></div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleRobots.map(r=><article key={r.id} className="group flex min-w-0 flex-col rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 shadow-sm transition-colors hover:border-[var(--accent-primary)]/50">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">ROBÔ #{String(r.displayNumber).padStart(2,"0")} · {r.symbol}</p><h3 className="mt-1 truncate text-lg font-semibold" title={r.assetName}>{r.assetName}</h3></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${r.status==="ACTIVE"&&r.configured?"border-emerald-500/30 bg-emerald-500/10 text-emerald-400":r.status==="PAUSED"?"border-amber-500/30 bg-amber-500/10 text-amber-400":"border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>{r.status==="ACTIVE"?(r.configured?"● Ativo":"◌ Realizando verificação"):r.status==="PAUSED"?"Pausado":r.status==="CLOSED"?"Encerrado":r.status}</span></div>
          <div className="mt-5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4"><p className="text-xs text-[var(--text-secondary)]">Ganho ou perda acumulada</p><div className="mt-2 flex flex-wrap items-baseline justify-between gap-2"><strong className={`text-2xl font-semibold tracking-tight ${r.pnl>=0?"text-emerald-400":"text-rose-400"}`}>{money(r.pnl)}</strong><span className={`rounded-md px-2 py-1 text-xs font-semibold ${r.pnl>=0?"bg-emerald-500/10 text-emerald-400":"bg-rose-500/10 text-rose-400"}`}>{signed(r.pnlPercent)}</span></div></div>
          <div className="mt-4 grid grid-cols-2 gap-4"><div><p className="text-xs text-[var(--text-secondary)]">Capital alocado</p><p className="mt-1 font-mono text-sm font-semibold">{money(r.capital)}</p></div><div><p className="text-xs text-[var(--text-secondary)]">Saldo atual do robô</p><p className="mt-1 font-mono text-sm font-semibold">{money(r.equity)}</p></div></div>
          <p className="mt-4 text-[11px] text-[var(--text-muted)]">Simulação · operações e resultados demonstrativos programados.</p><div className="mt-5 border-t border-[var(--border-primary)] pt-4"><Link href={`/robots/${r.id}`} className="flex items-center justify-between rounded-lg bg-[var(--accent-primary)]/10 px-4 py-3 text-sm font-semibold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20"><span>Ver painel do robô</span><span aria-hidden="true">→</span></Link></div>
        </article>)}
      </div>}
    </section>
  </main></div>;
}

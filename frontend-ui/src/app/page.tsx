"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, BarChart3, CandlestickChart,
  ShieldCheck, Activity, Wallet, TrendingUp, Globe2, Layers3, LockKeyhole,
  ChartNoAxesCombined, ChevronDown, Menu, X, Check, CircleHelp,
  Zap, Target, BookOpen, MonitorSmartphone, MoveUpRight, Landmark,
  LineChart, Bitcoin, Coins, Building2, ChartCandlestick, Headphones
} from "lucide-react";

const nav = [
  { label: "Início", href: "#inicio" },
  { label: "Mercados", href: "#mercados" },
  { label: "Plataforma", href: "#plataforma" },
  { label: "Tecnologia", href: "#tecnologia" },
  { label: "Sobre nós", href: "#sobre" },
];

const markets = [
  { name: "Forex", subtitle: "Pares de moedas globais", icon: Globe2, symbols: "EUR/USD · GBP/USD · USD/JPY", accent: "text-blue-600", bg: "bg-blue-50" },
  { name: "Criptomoedas", subtitle: "Ativos digitais", icon: Bitcoin, symbols: "BTC · ETH · SOL", accent: "text-indigo-600", bg: "bg-indigo-50" },
  { name: "Índices", subtitle: "Referências de mercados", icon: BarChart3, symbols: "S&P 500 · NASDAQ · DAX", accent: "text-cyan-600", bg: "bg-cyan-50" },
  { name: "Ações", subtitle: "Empresas internacionais", icon: Building2, symbols: "AAPL · MSFT · NVDA", accent: "text-blue-700", bg: "bg-slate-100" },
  { name: "Commodities", subtitle: "Matérias-primas globais", icon: Coins, symbols: "Ouro · Petróleo · Prata", accent: "text-amber-600", bg: "bg-amber-50" },
];

const instruments = [
  { symbol: "EUR/USD", name: "Euro / Dólar", value: "1,0842", change: "+0,32%", positive: true },
  { symbol: "BTC/USD", name: "Bitcoin / Dólar", value: "67.842,50", change: "+1,84%", positive: true },
  { symbol: "NASDAQ", name: "Índice de tecnologia", value: "18.432,60", change: "+0,76%", positive: true },
  { symbol: "XAU/USD", name: "Ouro / Dólar", value: "2.354,20", change: "−0,18%", positive: false },
];

const tools = [
  { icon: ChartCandlestick, title: "Gráficos e análise técnica", description: "Visualize tendências e movimentos de preço em um ambiente projetado para decisões mais informadas." },
  { icon: Target, title: "Gestão de posições", description: "Acompanhe entradas, exposição e resultados de suas operações simuladas em um só lugar." },
  { icon: Wallet, title: "Visão integrada da carteira", description: "Consulte saldo, patrimônio e histórico de atividade em uma interface organizada." },

];

const faqs = [
  { q: "O que é a Master Trade?", a: "A Master Trade é uma plataforma de trading simulado para explorar mercados, acompanhar gráficos e praticar estratégias de negociação. As operações demonstrativas não representam transações executadas em mercados reais." },
  { q: "Preciso criar uma conta para conhecer a plataforma?", a: "A página institucional é pública. Para acessar o terminal, a carteira e as funcionalidades internas, é necessário entrar com uma conta." },
  { q: "Os preços exibidos nesta página são em tempo real?", a: "Não. Os valores e gráficos desta página são exclusivamente ilustrativos. Informações de mercado no ambiente interno dependem das fontes de dados integradas à plataforma." },
  { q: "A Master Trade garante resultados financeiros?", a: "Não. O desempenho de uma estratégia em simulação não garante resultados futuros e o conteúdo apresentado não constitui recomendação de investimento." },
];

function MarketIllustration() {
  const candles = [
    [126,153,119,170,1],[148,140,130,164,1],[137,158,126,172,0],[159,122,110,167,1],
    [124,111,99,140,1],[112,129,105,142,0],[132,105,92,140,1],[107,85,73,115,1],
    [87,101,79,113,0],[102,80,66,112,1],[81,63,51,93,1],[66,75,58,87,0],
    [76,54,40,85,1],[57,44,30,67,1],[46,58,36,71,0],[59,39,25,69,1],
    [42,29,16,53,1],[30,46,22,57,0],[47,26,13,56,1],[28,19,7,39,1]
  ];
  return (
    <svg viewBox="0 0 660 220" className="h-auto w-full" role="img" aria-label="Gráfico de candles demonstrativo sem dados de mercado em tempo real">
      {[40,85,130,175].map(y => <line key={y} x1="0" x2="660" y1={y} y2={y} stroke="#dbe4f0" strokeDasharray="4 5" />)}
      {candles.map(([open,close,high,low,up],i) => {
        const x=20+i*30; const green=up===1; const top=Math.min(open,close);
        return <g key={i}><line x1={x+7} x2={x+7} y1={high} y2={low} stroke={green?"#16866A":"#D34F65"} strokeWidth="2"/><rect x={x} y={top} width="14" height={Math.max(3,Math.abs(close-open))} rx="2" fill={green?"#16866A":"#D34F65"}/></g>;
      })}
    </svg>
  );
}

function TerminalPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#d8e2ee] bg-white shadow-[0_18px_48px_rgba(7,22,41,.09)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-[#f7f9fc] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#18364A] text-white"><ChartCandlestick size={18}/></span><div><p className="text-xs font-bold tracking-wide text-[#0C1726]">MASTER TRADE</p><p className="text-[10px] text-slate-500">Visão ilustrativa do terminal</p></div></div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-bold text-[#18364A]">MODO DEMONSTRAÇÃO</span>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_190px]">
        <div className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">BTC / USD · Exemplo</p><p className="mt-1 text-2xl font-semibold tracking-tight text-[#0C1726]">67.842,50 <span className="text-xs font-medium text-slate-400">USD</span></p></div><span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">+1,84% ilustrativo</span></div>
          <div className="mt-7"><MarketIllustration /></div>
          <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400"><span>09:00</span><span>10:00</span><span>11:00</span><span>12:00</span><span>13:00</span><span>14:00</span></div>
        </div>
        <div className="border-t border-slate-200 bg-[#f8fafc] p-4 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold text-[#0C1726]">Nova operação</p><p className="mt-1 text-[10px] text-slate-500">Exemplo visual, sem execução</p>
          <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-md bg-emerald-600 py-2 text-center text-xs font-semibold text-white">Comprar</div><div className="rounded-md bg-rose-500 py-2 text-center text-xs font-semibold text-white">Vender</div></div>
          <div className="mt-5 space-y-3 text-xs"><div><p className="mb-1 text-slate-500">Instrumento</p><div className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-[#0C1726]">BTC/USD</div></div><div><p className="mb-1 text-slate-500">Quantidade</p><div className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-[#0C1726]">0,10</div></div><div><p className="mb-1 text-slate-500">Tipo de ordem</p><div className="rounded-md border border-slate-200 bg-white px-3 py-2 font-medium text-[#0C1726]">Mercado</div></div></div>
          <Link href="/login" className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-[#18364A] px-3 py-3 text-xs font-semibold text-white transition hover:bg-[#20558e]">Acessar terminal <ArrowRight size={14}/></Link>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen,setMenuOpen]=useState(false);
  const [active,setActive]=useState("inicio");
  const [scrolled,setScrolled]=useState(false);
  const [expanded,setExpanded]=useState<number|null>(0);
  useEffect(()=>{
    const onScroll=()=>{
      setScrolled(window.scrollY>20);
      const ids=["inicio","mercados","plataforma","tecnologia","sobre"];
      for(const id of [...ids].reverse()){const el=document.getElementById(id);if(el&&el.getBoundingClientRect().top<=140){setActive(id);break;}}
    };
    window.addEventListener("scroll",onScroll,{passive:true});onScroll();
    return()=>window.removeEventListener("scroll",onScroll);
  },[]);
  return (
    <div className="min-h-screen bg-white font-primary text-[#0C1726] motion-safe:[scroll-behavior:smooth]">
      <a href="#conteudo-principal" className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-[#326BFF] px-4 py-3 font-semibold text-white focus:not-sr-only">Ir para o conteúdo principal</a>
      <header className={`sticky top-0 z-50 border-b border-slate-200/80 transition-all duration-300 ${scrolled?"bg-white/95 shadow-sm backdrop-blur-xl":"bg-white"}`}>
        <nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Master Trade - Início"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#18364A] text-white"><ChartNoAxesCombined size={22}/></span><span className="text-[15px] font-extrabold tracking-[.1em]">MASTER <span className="text-[#326BFF]">TRADE</span></span></Link>
          <div className="hidden items-center gap-7 lg:flex">{nav.map(n=><a key={n.href} href={n.href} className={`relative py-7 text-[13px] font-medium transition-colors hover:text-[#326BFF] ${active===n.href.slice(1)?"text-[#18364A]":"text-slate-500"}`}>{n.label}{active===n.href.slice(1)&&<span className="absolute bottom-5 left-0 h-0.5 w-full rounded-full bg-[#326BFF]"/>}</a>)}</div>
          <div className="hidden items-center gap-4 lg:flex"><Link href="/login" className="text-sm font-semibold text-[#18364A] hover:text-[#326BFF]">Entrar</Link><Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-[#326BFF] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2454D4]">Criar conta <ArrowUpRight size={15}/></Link></div>
          <button type="button" aria-label={menuOpen?"Fechar menu":"Abrir menu"} aria-expanded={menuOpen} onClick={()=>setMenuOpen(!menuOpen)} aria-controls="menu-principal" className="rounded-lg border border-slate-200 p-2 text-[#18364A] lg:hidden">{menuOpen?<X size={22}/>:<Menu size={22}/>}</button>
        </nav>
        {menuOpen&&<div id="menu-principal" className="border-t border-slate-100 bg-white px-5 py-5 shadow-lg lg:hidden"><div className="mx-auto flex max-w-7xl flex-col gap-1">{nav.map(n=><a key={n.href} href={n.href} onClick={()=>setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">{n.label}</a>)}<div className="mt-3 flex gap-3 border-t border-slate-100 pt-4"><Link href="/login" className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-center text-sm font-semibold">Entrar</Link><Link href="/signup" className="flex-1 rounded-lg bg-[#326BFF] px-4 py-3 text-center text-sm font-semibold text-white">Criar conta</Link></div></div></div>}
      </header>

      <main id="conteudo-principal">
        <section id="inicio" className="relative overflow-hidden bg-[#F5F8FC]">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-[45%] bg-[radial-gradient(ellipse_at_top_right,rgba(52,120,246,.10),transparent_65%)]"/>
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[.94fr_1.06fr] lg:gap-16 lg:pb-28 lg:pt-28">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#326BFF]">Master Trade · Trading simulado</p>
              <h1 className="mt-7 text-[40px] font-semibold leading-[1.13] tracking-[-.04em] text-[#0C1726] sm:text-[54px] lg:text-[58px]">Uma nova perspectiva sobre os <span className="text-[#326BFF]">mercados financeiros.</span></h1>
              <p className="mt-7 max-w-lg text-[16px] leading-8 text-[#607386]">Explore os mercados globais em uma plataforma de trading simulado desenvolvida para oferecer tecnologia, ferramentas de análise e uma experiência intuitiva.</p>
              <div className="mt-9 flex flex-wrap gap-3"><a href="#plataforma" className="inline-flex items-center gap-2 rounded-lg bg-[#326BFF] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2454D4]">Explorar plataforma <ArrowRight size={17}/></a><Link href="/signup" className="inline-flex items-center gap-2 rounded-lg border border-[#cdd9e6] bg-white px-6 py-3.5 text-sm font-semibold text-[#18364A] transition hover:border-[#326BFF]">Criar conta <MoveUpRight size={16}/></Link></div>
              <p className="mt-9 border-t border-slate-200 pt-5 text-xs leading-6 text-[#607386]">Ambiente de simulação · Sem execução de ordens em mercados reais</p>
            </div>
            <div className="relative"><TerminalPreview/><p className="mt-3 text-center text-[11px] text-slate-500">Prévia ilustrativa. Valores e gráfico fictícios, sem cotação em tempo real.</p></div>
          </div>
        </section>

        <section id="mercados" className="scroll-mt-24 bg-white py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#326BFF]">Mercados financeiros</p><h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[42px]">Diversos mercados.<br/>Uma única plataforma.</h2><p className="mt-4 max-w-2xl leading-7 text-[#607386]">Conheça as classes de ativos que fazem parte do universo de análise e simulação da Master Trade.</p></div><Link href="/login" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#18364A] hover:text-[#326BFF]">Acessar mercados <ArrowRight size={16}/></Link></div>
          <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{markets.map(m=><div key={m.name} className="group rounded-xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_14px_35px_rgba(7,22,41,.07)]"><span className={`flex h-12 w-12 items-center justify-center rounded-xl ${m.bg} ${m.accent}`}><m.icon size={24}/></span><h3 className="mt-6 text-lg font-semibold">{m.name}</h3><p className="mt-2 min-h-10 text-sm text-[#607386]">{m.subtitle}</p><p className="mt-5 border-t border-slate-100 pt-4 text-[11px] font-medium text-slate-500">{m.symbols}</p></div>)}</div>
          <div className="mt-14 overflow-hidden rounded-2xl border border-slate-200"><div className="flex flex-wrap items-center justify-between gap-3 bg-[#F5F8FC] px-5 py-4"><div><h3 className="text-sm font-semibold">Visão geral de instrumentos</h3><p className="mt-1 text-xs text-[#607386]">Painel demonstrativo para apresentação da interface</p></div><span className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#18364A]">Valores fictícios</span></div><div className="divide-y divide-slate-100">{instruments.map(m=><div key={m.symbol} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 transition hover:bg-[#f8fafc] sm:grid-cols-[1.3fr_1fr_1fr]"><div><p className="text-sm font-semibold">{m.symbol}</p><p className="mt-1 text-xs text-[#607386]">{m.name}</p></div><span className="text-right text-sm font-semibold tabular-nums">{m.value}</span><span className={`flex items-center justify-end gap-1 text-right text-xs font-semibold tabular-nums ${m.positive?"text-emerald-600":"text-rose-600"}`}>{m.positive?<ArrowUpRight size={15}/>:<ArrowDownRight size={15}/>} {m.change}</span></div>)}</div></div>
        </div></section>

        <section id="plataforma" className="scroll-mt-24 bg-[#0C1726] py-24 text-white"><div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#7fb0ff]">Nossa plataforma</p><h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-[42px]">Tecnologia que coloca a experiência de negociação em primeiro lugar.</h2><p className="mt-6 leading-8 text-slate-300">Do acompanhamento de preços à análise de posições, a Master Trade reúne ferramentas em um ambiente visual organizado para quem deseja explorar os mercados.</p><div className="mt-8 space-y-5">{[["Painel personalizado","Acompanhe as informações da sua carteira em um só lugar."],["Terminal de negociação","Explore instrumentos e pratique operações simuladas."],["Histórico e acompanhamento","Consulte movimentações e acompanhe sua evolução."]].map(([a,b])=><div key={a} className="flex gap-4"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#326BFF]/20 text-[#9ac0ff]"><Check size={15}/></span><div><p className="font-semibold">{a}</p><p className="mt-1 text-sm leading-6 text-slate-400">{b}</p></div></div>)}</div><Link href="/login" className="mt-9 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-[#18364A] transition hover:bg-blue-50">Conhecer o terminal <ArrowRight size={16}/></Link></div><div className="rounded-2xl bg-[#e9eff7] p-3 sm:p-5"><TerminalPreview/></div></div></section>

        <section id="tecnologia" className="scroll-mt-24 bg-[#F5F8FC] py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#326BFF]">Recursos e tecnologia</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-[42px]">Uma experiência pensada em cada detalhe.</h2><p className="mt-4 leading-7 text-[#607386]">Ferramentas essenciais para estudar o comportamento dos mercados, acompanhar posições e navegar com clareza.</p></div><div className="mt-11 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{tools.map(({icon:Icon,title,description})=><div key={title} className="group rounded-xl border border-[#e0e7ef] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_14px_30px_rgba(7,22,41,.06)]"><span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#eef4ff] text-[#326BFF]"><Icon size={23}/></span><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-[#607386]">{description}</p></div>)}</div></div></section>

        <section id="sobre" className="scroll-mt-24 bg-white py-24"><div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr]"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#326BFF]">Sobre a Master Trade</p><h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-[42px]">Uma plataforma criada para explorar possibilidades.</h2><p className="mt-6 leading-8 text-[#607386]">A Master Trade reúne recursos de acompanhamento de mercado e negociação simulada em uma experiência digital moderna. Nosso foco é oferecer uma interface clara para explorar instrumentos, acompanhar posições e praticar estratégias.</p><p className="mt-4 leading-8 text-[#607386]">A página institucional apresenta as funcionalidades da plataforma, sem representar serviços de corretagem regulamentada ou execução real de ordens.</p><a href="#como-funciona" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#18364A] hover:text-[#326BFF]">Veja como começar <ArrowRight size={16}/></a></div><div className="grid gap-4 sm:grid-cols-2">{[{icon:Globe2,title:"Visão global",text:"Categorias de ativos e mercados internacionais."},{icon:LineChart,title:"Análise visual",text:"Gráficos e ferramentas de acompanhamento."},{icon:LockKeyhole,title:"Acesso por conta",text:"Área interna acessível após autenticação."},{icon:BookOpen,title:"Aprendizado prático",text:"Ambiente para testar estratégias simuladas."}].map(({icon:Icon,title,text})=><div key={title} className="rounded-xl border border-slate-200 p-6"><Icon size={25} className="text-[#326BFF]"/><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-7 text-[#607386]">{text}</p></div>)}</div></div></section>

        <section id="como-funciona" className="bg-[#F5F8FC] py-24"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#326BFF]">Como começar</p><h2 className="mt-4 text-3xl font-semibold sm:text-[42px]">Seu acesso em três etapas.</h2></div><div className="mt-12 grid gap-5 md:grid-cols-3">{[["01","Conheça a plataforma","Explore a página institucional e os recursos disponíveis."],["02","Entre ou crie sua conta","Acesse a área de login e autentique-se com suas credenciais."],["03","Acesse seu dashboard","Visualize informações da carteira, mercados e operações simuladas."]].map(([number,title,description])=><div key={number} className="rounded-xl border border-slate-200 bg-white p-7"><span className="text-3xl font-semibold text-[#326BFF]">{number}</span><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-[#607386]">{description}</p></div>)}</div></div></section>

        <section className="bg-white py-24"><div className="mx-auto max-w-4xl px-5 sm:px-8"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#326BFF]">Perguntas frequentes</p><h2 className="mt-4 text-3xl font-semibold sm:text-[42px]">Dúvidas frequentes</h2></div><div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">{faqs.map((f,i)=><div key={f.q}><button type="button" aria-expanded={expanded===i} onClick={()=>setExpanded(expanded===i?null:i)} className="flex w-full items-center justify-between gap-5 py-6 text-left text-sm font-semibold sm:text-base"><span>{f.q}</span><ChevronDown size={20} className={`shrink-0 text-[#326BFF] transition-transform ${expanded===i?"rotate-180":""}`}/></button>{expanded===i&&<p className="max-w-3xl pb-6 text-sm leading-7 text-[#607386]">{f.a}</p>}</div>)}</div></div></section>

        <section className="bg-[#18364A] py-20 text-white"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-200">Comece agora</p><h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Descubra uma nova forma de explorar os mercados.</h2><p className="mt-4 text-sm leading-7 text-blue-100">Conheça a plataforma e acesse seu ambiente de trading simulado.</p></div><div className="flex shrink-0 flex-wrap gap-3"><Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-[#18364A] transition hover:bg-blue-50">Criar conta <ArrowRight size={16}/></Link><Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">Entrar</Link></div></div></section>
      </main>

      <footer className="bg-[#0C1726] text-slate-300"><div className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-4"><div><Link href="/" className="flex items-center gap-2 text-sm font-extrabold tracking-[.1em] text-white"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#326BFF]"><ChartNoAxesCombined size={19}/></span>MASTER TRADE</Link><p className="mt-5 max-w-xs text-sm leading-7 text-slate-400">Uma experiência digital para explorar mercados e praticar estratégias de trading em ambiente simulado.</p></div><div><p className="text-sm font-semibold text-white">Explorar</p><div className="mt-5 flex flex-col gap-3 text-sm text-slate-400"><a href="#mercados" className="hover:text-white">Mercados</a><a href="#plataforma" className="hover:text-white">Plataforma</a><a href="#tecnologia" className="hover:text-white">Tecnologia</a></div></div><div><p className="text-sm font-semibold text-white">Master Trade</p><div className="mt-5 flex flex-col gap-3 text-sm text-slate-400"><a href="#sobre" className="hover:text-white">Sobre nós</a><a href="#como-funciona" className="hover:text-white">Como começar</a><a href="#inicio" className="hover:text-white">Voltar ao início</a></div></div><div><p className="text-sm font-semibold text-white">Acesso</p><div className="mt-5 flex flex-col gap-3 text-sm text-slate-400"><Link href="/login" className="hover:text-white">Entrar</Link><Link href="/signup" className="hover:text-white">Criar conta</Link><a href="#inicio" className="hover:text-white">Página inicial</a></div></div></div><div className="mx-auto max-w-7xl border-t border-white/10 px-5 py-7 sm:px-8"><p className="max-w-5xl text-xs leading-6 text-slate-400"><strong className="font-semibold text-slate-300">Aviso importante:</strong> a Master Trade é apresentada como plataforma de trading simulado. As cotações, variações e gráficos demonstrativos desta página são fictícios e não representam preços em tempo real. O conteúdo não constitui recomendação de investimento, promessa de rentabilidade ou indicação de autorização regulatória.</p><div className="mt-6 flex flex-col justify-between gap-3 text-xs text-slate-500 sm:flex-row"><span>© {new Date().getFullYear()} Master Trade. Todos os direitos reservados.</span><span>Plataforma de simulação · Conteúdo informativo</span></div></div></footer>
    </div>
  );
}

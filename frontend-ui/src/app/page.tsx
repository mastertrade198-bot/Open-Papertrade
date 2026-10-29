"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChartNoAxesCombined, ChevronDown, Menu, X, ArrowDownRight, ArrowUpRight as TrendUp } from "lucide-react";

const navigation = [
  { label: "Plataforma", href: "#plataforma" },
  { label: "Mercados", href: "#mercados" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Perguntas", href: "#perguntas" },
];

const markets = [
  { ticker: "EUR/USD", name: "Câmbio", description: "Pares de moedas internacionais" },
  { ticker: "BTC/USD", name: "Criptoativos", description: "Principais ativos digitais" },
  { ticker: "S&P 500", name: "Índices", description: "Referências dos mercados globais" },
  { ticker: "AAPL", name: "Ações", description: "Empresas de diferentes setores" },
];

const faqs = [
  { question: "A Master Trade utiliza dinheiro real?", answer: "Não. A Master Trade é um ambiente de trading simulado. As operações demonstrativas não representam ordens executadas em mercados reais." },
  { question: "As cotações da página são em tempo real?", answer: "Não. Todos os valores e gráficos apresentados nesta página são ilustrativos. Os dados disponíveis na área autenticada dependem das fontes integradas à plataforma." },
  { question: "Preciso criar uma conta?", answer: "A apresentação da plataforma é pública. Para acessar a área de negociação simulada e acompanhar sua carteira, é necessário criar uma conta." },
  { question: "O desempenho simulado garante resultados?", answer: "Não. Resultados em ambiente simulado não garantem desempenho futuro e não constituem recomendação de investimento." },
];

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" aria-label="Master Trade, página inicial" className="inline-flex shrink-0 items-center gap-3">
    <span className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${inverse ? "bg-white text-[#0C1726]" : "bg-[#0C1726] text-white"}`}><ChartNoAxesCombined size={19} strokeWidth={1.8} /></span>
    <span className={`text-[14px] font-extrabold tracking-[.055em] ${inverse ? "text-white" : "text-[#152538]"}`}>MASTER <span className={inverse ? "text-[#9FB9FF]" : "text-[#326BFF]"}>TRADE</span></span>
  </Link>;
}

function TerminalPreview() {
  const values = [46, 42, 45, 37, 40, 33, 35, 31, 34, 28, 32, 25, 29, 23, 26, 19, 22, 17, 20, 14, 17, 11, 15, 9, 12, 6, 10, 5, 7, 3];
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 680},${v * 3.8 + 18}`).join(" ");
  return <div className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_22px_64px_rgba(12,23,38,.09)]">
    <div className="flex items-center justify-between gap-3 border-b border-[#E3EAF1] px-5 py-4 sm:px-6">
      <div className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#16866A]" /><span className="text-[12px] font-semibold text-[#152538]">Visão do terminal</span><span className="hidden text-[11px] text-[#607386] sm:inline">· Demonstração visual</span></div>
      <span className="rounded-md bg-[#F0F4F9] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#607386]">Simulado</span>
    </div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_180px]">
      <div className="min-w-0 px-5 pb-5 pt-6 sm:px-7 sm:pb-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[11px] font-medium uppercase tracking-[.12em] text-[#607386]">BTC / USD · Ilustrativo</p><p className="mt-2 text-[29px] font-semibold tracking-[-.04em] text-[#152538] sm:text-[34px]">67.842,50 <span className="text-sm font-normal text-[#607386]">USD</span></p></div>
          <span className="flex items-center gap-1 rounded-md bg-[#E9F5F0] px-2.5 py-1.5 text-xs font-semibold text-[#16866A]"><TrendUp size={13}/> +1,84%</span>
        </div>
        <div className="mt-7 overflow-hidden rounded-lg bg-[#F8FAFD] px-3 py-4">
          <svg viewBox="0 0 680 235" role="img" aria-label="Linha de preço fictícia em tendência de alta, apenas ilustrativa" className="h-auto w-full">
            {[45,105,165,225].map(y=><line key={y} x1="0" y1={y} x2="680" y2={y} stroke="#E3EAF1" strokeDasharray="4 7"/>)}
            <defs><linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#326BFF" stopOpacity=".12"/><stop offset="1" stopColor="#326BFF" stopOpacity="0"/></linearGradient></defs>
            <polygon points={`0,235 ${points} 680,235`} fill="url(#chartFade)"/>
            <polyline points={points} fill="none" stroke="#326BFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-[#8294A6]"><span>09:00</span><span>10:00</span><span>11:00</span><span>12:00</span><span>13:00</span></div>
        </div>
        <p className="mt-4 text-[11px] leading-5 text-[#607386]">Gráfico e valores fictícios, sem cotação em tempo real.</p>
      </div>
      <div className="border-t border-[#E3EAF1] bg-[#FBFCFE] p-5 lg:border-l lg:border-t-0">
        <p className="text-xs font-semibold text-[#152538]">Nova operação</p>
        <p className="mt-1 text-[11px] text-[#607386]">Prévia não interativa</p>
        <div className="mt-6 grid grid-cols-2 gap-2 text-center text-[11px] font-semibold"><span className="rounded-md bg-[#E6F4EF] py-2 text-[#16866A]">Comprar</span><span className="rounded-md bg-[#FBECEF] py-2 text-[#D34F65]">Vender</span></div>
        <div className="mt-6 space-y-4">{[["Ativo","BTC/USD"],["Tipo de ordem","Mercado"],["Quantidade","0,10"]].map(([label,value])=><div key={label} className="border-b border-[#E3EAF1] pb-3"><p className="text-[10px] text-[#607386]">{label}</p><p className="mt-1 text-xs font-semibold text-[#152538]">{value}</p></div>)}</div>
        <Link href="/login" className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-[#326BFF] px-3 py-3 text-xs font-semibold text-white transition hover:bg-[#2454D4]">Abrir plataforma <ArrowRight size={14}/></Link>
      </div>
    </div>
  </div>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  return <div className="min-h-screen bg-white font-primary text-[#152538]">
    <a href="#conteudo" className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-[#326BFF] px-4 py-3 font-semibold text-white focus:not-sr-only">Ir para o conteúdo</a>
    <header className="sticky top-0 z-50 border-b border-[#E3EAF1] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Brand/>
        <nav aria-label="Navegação institucional" className="hidden items-center gap-8 lg:flex">{navigation.map(item=><a key={item.href} href={item.href} className="text-[13px] font-medium text-[#607386] transition hover:text-[#152538]">{item.label}</a>)}</nav>
        <div className="hidden items-center gap-5 lg:flex"><Link href="/login" className="text-[13px] font-semibold text-[#152538] hover:text-[#326BFF]">Entrar</Link><Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-[#326BFF] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#2454D4]">Criar conta <ArrowUpRight size={15}/></Link></div>
        <button type="button" aria-label={menuOpen?"Fechar menu":"Abrir menu"} aria-expanded={menuOpen} aria-controls="menu-institucional" onClick={()=>setMenuOpen(v=>!v)} className="rounded-lg border border-[#E3EAF1] p-2 lg:hidden">{menuOpen?<X size={21}/>:<Menu size={21}/>}</button>
      </div>
      {menuOpen&&<nav id="menu-institucional" aria-label="Navegação móvel" className="border-t border-[#E3EAF1] bg-white px-5 py-4 lg:hidden"><div className="mx-auto flex max-w-6xl flex-col gap-1">{navigation.map(item=><a key={item.href} href={item.href} onClick={()=>setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-[#152538] hover:bg-[#F5F8FC]">{item.label}</a>)}<div className="mt-3 flex gap-3 border-t border-[#E3EAF1] pt-4"><Link href="/login" className="flex-1 rounded-lg border border-[#E3EAF1] px-3 py-3 text-center text-sm font-semibold">Entrar</Link><Link href="/signup" className="flex-1 rounded-lg bg-[#326BFF] px-3 py-3 text-center text-sm font-semibold text-white">Criar conta</Link></div></div></nav>}
    </header>
    <main id="conteudo">
      <section className="border-b border-[#E3EAF1] bg-[#F8FAFD]">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[.88fr_1.12fr] lg:gap-16 lg:py-28">
          <div className="max-w-[490px]">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#326BFF]">Trading simulado · Master Trade</p>
            <h1 className="mt-6 text-[43px] font-semibold leading-[1.13] tracking-[-.045em] sm:text-[55px]">O mercado em perspectiva. Suas decisões em foco.</h1>
            <p className="mt-7 max-w-[440px] text-[16px] leading-[1.85] text-[#607386]">Explore instrumentos, acompanhe posições e pratique estratégias em um ambiente de negociação simulado, organizado para oferecer clareza em cada etapa.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-[#326BFF] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2454D4]">Começar a simular <ArrowRight size={17}/></Link><a href="#plataforma" className="inline-flex items-center gap-2 px-2 py-3 text-sm font-semibold text-[#152538] hover:text-[#326BFF]">Conhecer a plataforma <ArrowUpRight size={16}/></a></div>
            <p className="mt-10 border-t border-[#DCE5EF] pt-5 text-xs leading-6 text-[#607386]">Ambiente de prática com operações fictícias. Sem execução de ordens em mercados reais.</p>
          </div>
          <TerminalPreview/>
        </div>
      </section>
      <section id="plataforma" className="scroll-mt-24 bg-white py-24 lg:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-10 md:grid-cols-[.85fr_1.15fr] md:gap-20">
            <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#326BFF]">A plataforma</p><h2 className="mt-5 max-w-[440px] text-[34px] font-semibold leading-[1.2] tracking-[-.035em] sm:text-[42px]">Tudo o que importa. Sem distrações.</h2></div>
            <div className="divide-y divide-[#E3EAF1] border-t border-[#E3EAF1]">
              {[["01","Análise de mercado","Explore gráficos e instrumentos em uma interface pensada para facilitar a leitura de informações."],["02","Gestão de operações","Acompanhe posições simuladas e informações essenciais em um único ambiente."],["03","Visão da carteira","Consulte seu capital virtual e o histórico de atividades de forma organizada."]].map(([n,title,desc])=><div key={n} className="grid grid-cols-[40px_1fr] gap-4 py-7"><span className="pt-1 text-xs font-semibold text-[#326BFF]">{n}</span><div><h3 className="text-lg font-semibold tracking-tight">{title}</h3><p className="mt-2 max-w-lg text-sm leading-7 text-[#607386]">{desc}</p></div></div>)}
            </div>
          </div>
        </div>
      </section>
      <section id="mercados" className="scroll-mt-24 border-y border-[#E3EAF1] bg-[#F8FAFD] py-24 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#326BFF]">Mercados</p><h2 className="mt-4 text-[34px] font-semibold tracking-[-.035em] sm:text-[42px]">Uma visão mais ampla.</h2></div><p className="max-w-sm text-sm leading-7 text-[#607386]">Explore diferentes categorias de instrumentos no ambiente de simulação.</p></div>
          <div className="mt-10 overflow-hidden rounded-xl border border-[#E3EAF1] bg-white"><div className="hidden grid-cols-[1fr_1.4fr_auto] gap-4 border-b border-[#E3EAF1] px-6 py-4 text-[11px] font-semibold uppercase tracking-[.1em] text-[#607386] sm:grid"><span>Referência</span><span>Categoria</span><span>Ambiente</span></div>{markets.map((item,i)=><div key={item.ticker} className={`grid gap-2 px-6 py-5 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center sm:gap-4 ${i>0?"border-t border-[#E3EAF1]":""}`}><span className="text-sm font-semibold">{item.ticker}</span><div><p className="text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-[#607386]">{item.description}</p></div><span className="text-xs text-[#607386]">Simulação</span></div>)}</div>
          <p className="mt-4 text-xs leading-6 text-[#607386]">Exemplos de instrumentos e categorias; a disponibilidade efetiva depende do catálogo configurado na plataforma.</p>
        </div>
      </section>
      <section id="como-funciona" className="scroll-mt-24 bg-white py-24 lg:py-28"><div className="mx-auto max-w-6xl px-5 sm:px-8"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#326BFF]">Como funciona</p><h2 className="mt-4 text-[34px] font-semibold tracking-[-.035em] sm:text-[42px]">Simples desde o primeiro acesso.</h2><div className="mt-12 grid gap-10 border-t border-[#E3EAF1] pt-10 md:grid-cols-3">{[["01","Crie sua conta","Cadastre-se para acessar seu ambiente pessoal."],["02","Explore o terminal","Conheça os instrumentos e as ferramentas de análise."],["03","Pratique e acompanhe","Realize operações simuladas e acompanhe sua carteira virtual."]].map(([n,title,desc])=><div key={n}><p className="text-sm font-semibold text-[#326BFF]">{n}</p><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-3 max-w-xs text-sm leading-7 text-[#607386]">{desc}</p></div>)}</div></div></section>
      <section id="perguntas" className="scroll-mt-24 border-t border-[#E3EAF1] bg-[#F8FAFD] py-24 lg:py-28"><div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:gap-20"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#326BFF]">Informações essenciais</p><h2 className="mt-4 text-[34px] font-semibold tracking-[-.035em] sm:text-[42px]">Perguntas frequentes.</h2></div><div className="divide-y divide-[#DCE5EF] border-t border-[#DCE5EF]">{faqs.map((item,i)=><div key={item.question}><button type="button" aria-expanded={openFaq===i} aria-controls={`faq-${i}`} onClick={()=>setOpenFaq(openFaq===i?null:i)} className="flex w-full items-center justify-between gap-5 py-6 text-left text-sm font-semibold text-[#152538]"><span>{item.question}</span><ChevronDown size={18} className={`shrink-0 text-[#607386] transition-transform ${openFaq===i?"rotate-180":""}`}/></button>{openFaq===i&&<p id={`faq-${i}`} className="max-w-xl pb-6 text-sm leading-7 text-[#607386]">{item.answer}</p>}</div>)}</div></div></section>
      <section className="bg-[#0C1726] py-20 text-white"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 px-5 sm:px-8 md:flex-row md:items-center"><div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#9FB9FF]">Seu próximo passo</p><h2 className="mt-4 max-w-xl text-[30px] font-semibold leading-tight tracking-[-.03em] sm:text-[38px]">Uma experiência de mercado mais clara começa aqui.</h2></div><Link href="/signup" className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-[#326BFF] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2454D4]">Criar conta <ArrowRight size={17}/></Link></div></section>
    </main>
    <footer className="bg-[#0C1726] text-white"><div className="mx-auto max-w-6xl border-t border-white/15 px-5 py-10 sm:px-8"><div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-center"><Brand inverse/><div className="flex flex-wrap gap-x-7 gap-y-3 text-xs text-[#B7C5D5]"><a href="#plataforma" className="hover:text-white">Plataforma</a><a href="#mercados" className="hover:text-white">Mercados</a><Link href="/login" className="hover:text-white">Entrar</Link><Link href="/signup" className="hover:text-white">Criar conta</Link></div></div><p className="mt-10 max-w-4xl text-xs leading-6 text-[#B7C5D5]">A Master Trade é apresentada como plataforma de trading simulado. As cotações, variações e gráficos demonstrativos desta página são fictícios e não representam preços em tempo real. O conteúdo não constitui recomendação de investimento, promessa de rentabilidade ou indicação de autorização regulatória.</p><div className="mt-7 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 text-[11px] text-[#93A6BC] sm:flex-row"><span>© {new Date().getFullYear()} Master Trade. Todos os direitos reservados.</span><span>Trading simulado · Conteúdo informativo</span></div></div></footer>
  </div>;
}

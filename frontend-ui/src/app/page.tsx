import Link from "next/link";
import { ArrowRight, BarChart3, CandlestickChart, ShieldCheck, Activity, Wallet, TrendingUp, CheckCircle2 } from "lucide-react";

const features = [
  { icon: CandlestickChart, title: "Terminal de negociação", description: "Explore gráficos, acompanhe ativos e pratique estratégias em um ambiente intuitivo." },
  { icon: Activity, title: "Acompanhamento de posições", description: "Visualize suas operações e acompanhe a evolução dos resultados simulados." },
  { icon: Wallet, title: "Carteira em um só lugar", description: "Consulte seu saldo, patrimônio e histórico de movimentações com clareza." },
  { icon: ShieldCheck, title: "Ambiente de simulação", description: "Desenvolva sua experiência com operações simuladas e ferramentas de análise." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#090b10] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090b10]/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-bold tracking-[.12em]">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6b22]/15 text-[#ff782f]"><BarChart3 size={21} /></span>
            <span className="text-sm sm:text-base">MASTER <span className="text-[#ff782f]">TRADE</span></span>
          </Link>
          <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#plataforma" className="hover:text-white">Plataforma</a>
            <a href="#recursos" className="hover:text-white">Recursos</a>
            <a href="#como-funciona" className="hover:text-white">Como funciona</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-zinc-200 hover:text-white">Entrar</Link>
            <Link href="/signup" className="rounded-lg bg-[#ff6b22] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#ff8a4c]">Criar conta</Link>
          </div>
        </nav>
      </header>

      <main>
        <section id="plataforma" className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-48 top-0 h-[650px] w-[650px] rounded-full bg-[#ff6b22]/10 blur-[130px]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-24 pt-20 sm:px-8 lg:grid-cols-2 lg:py-32">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ff6b22]/30 bg-[#ff6b22]/10 px-4 py-2 text-xs font-semibold tracking-wide text-[#ff9c64]"><span className="h-2 w-2 rounded-full bg-[#ff782f]" /> SUA EVOLUÇÃO COMEÇA AQUI</span>
              <h1 className="mt-7 max-w-2xl text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">O mercado em suas mãos. <span className="text-[#ff782f]">Sua estratégia em movimento.</span></h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-zinc-400 sm:text-lg">Uma experiência moderna para explorar mercados, acompanhar gráficos e desenvolver suas estratégias de negociação em um ambiente de trading simulado.</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-[#ff6b22] px-6 py-3.5 font-semibold text-black transition hover:bg-[#ff8a4c]">Começar agora <ArrowRight size={18} /></Link>
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 font-semibold transition hover:bg-white/10">Já tenho uma conta</Link>
              </div>
              <p className="mt-5 text-xs text-zinc-500">Plataforma de simulação. Resultados não representam garantia de desempenho futuro.</p>
            </div>
            <div className="relative rounded-2xl border border-white/10 bg-[#11151d] p-5 shadow-2xl shadow-black/50 sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-xs uppercase tracking-widest text-zinc-500">Visão da plataforma</p><p className="mt-1 text-xl font-semibold">Terminal Master Trade</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-400">Demonstração</span></div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[["Mercados","Multiativos"],["Gráficos","Análise"],["Operações","Simuladas"]].map(([a,b])=><div key={a} className="rounded-xl border border-white/10 bg-white/[.03] p-3"><p className="text-xs text-zinc-500">{a}</p><p className="mt-2 text-sm font-semibold">{b}</p></div>)}
              </div>
              <div className="mt-5 rounded-xl border border-white/10 bg-[#0b0e14] p-4">
                <div className="mb-5 flex items-center justify-between"><span className="text-sm font-semibold">Análise de mercado</span><span className="text-xs text-zinc-500">Visualização ilustrativa</span></div>
                <svg viewBox="0 0 560 210" className="h-auto w-full" role="img" aria-label="Gráfico ilustrativo de mercado">
                  {[35,80,125,170].map(y=><line key={y} x1="0" x2="560" y1={y} y2={y} stroke="#ffffff" strokeOpacity=".07" />)}
                  <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff782f" stopOpacity=".25"/><stop offset="1" stopColor="#ff782f" stopOpacity="0"/></linearGradient></defs>
                  <path d="M0 175 L35 160 L70 166 L105 135 L140 146 L175 120 L210 134 L245 88 L280 104 L315 90 L350 115 L385 75 L420 88 L455 55 L490 65 L525 28 L560 38 L560 210 L0 210 Z" fill="url(#area)"/>
                  <path d="M0 175 L35 160 L70 166 L105 135 L140 146 L175 120 L210 134 L245 88 L280 104 L315 90 L350 115 L385 75 L420 88 L455 55 L490 65 L525 28 L560 38" fill="none" stroke="#ff782f" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="mt-5 flex items-center gap-2 text-sm text-zinc-400"><TrendingUp size={16} className="text-[#ff782f]"/> Ferramentas para acompanhar cada movimento</div>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-y border-white/10 bg-[#0e1118] py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#ff782f]">Recursos</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Tudo o que você precisa para explorar o mercado.</h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({icon:Icon,title,description})=><div key={title} className="rounded-2xl border border-white/10 bg-[#141923] p-6 transition hover:border-[#ff782f]/50"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#ff782f]/10 text-[#ff782f]"><Icon size={24}/></div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-zinc-400">{description}</p></div>)}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-[#ff782f]">Como funciona</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Comece em poucos passos.</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[["01","Crie sua conta","Cadastre-se para acessar o ambiente da plataforma."],["02","Explore os mercados","Conheça os ativos, gráficos e ferramentas disponíveis."],["03","Pratique estratégias","Abra e acompanhe operações em ambiente simulado."]].map(([n,title,desc])=><div key={n} className="border-t border-white/15 pt-6"><span className="text-3xl font-semibold text-[#ff782f]">{n}</span><h3 className="mt-5 text-xl font-semibold">{title}</h3><p className="mt-3 text-zinc-400">{desc}</p></div>)}
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-8"><div className="mx-auto max-w-7xl rounded-3xl border border-[#ff782f]/20 bg-gradient-to-br from-[#2c1b16] to-[#11151d] px-7 py-14 text-center sm:px-14"><h2 className="text-3xl font-semibold sm:text-4xl">Pronto para conhecer a Master Trade?</h2><p className="mx-auto mt-4 max-w-xl text-zinc-400">Entre na plataforma e descubra uma nova maneira de praticar e acompanhar suas estratégias.</p><Link href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#ff6b22] px-7 py-3.5 font-semibold text-black hover:bg-[#ff8a4c]">Criar minha conta <ArrowRight size={18}/></Link></div></section>
      </main>
      <footer className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 py-8 text-sm text-zinc-500 sm:flex-row sm:px-8"><span>© {new Date().getFullYear()} Master Trade. Todos os direitos reservados.</span><span>Ambiente de trading simulado · Não constitui recomendação de investimento.</span></div></footer>
    </div>
  );
}

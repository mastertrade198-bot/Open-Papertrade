import Link from "next/link";
import { ArrowRight, BarChart3, CandlestickChart, LockKeyhole, ShieldCheck, TrendingUp } from "lucide-react";

const features = [
  { icon: CandlestickChart, title: "Terminal de negociação", description: "Acompanhe gráficos, cotações e instrumentos em uma interface organizada." },
  { icon: TrendingUp, title: "Gestão de posições", description: "Visualize posições, margem, alavancagem e níveis de proteção em um só lugar." },
  { icon: BarChart3, title: "Visão de mercado", description: "Explore ativos e acompanhe as informações essenciais para sua análise." },
];

export default function InicioPage() {
  return (
    <div className="min-h-screen bg-[#080d17] text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6 lg:px-10">
        <Link href="/inicio" className="flex items-center gap-3" aria-label="Página inicial Open Papertrade">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
            <CandlestickChart className="h-5 w-5 text-cyan-300" />
          </div>
          <span className="text-sm font-bold tracking-[0.2em] sm:text-base">OPEN <span className="text-cyan-300">PAPERTRADE</span></span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-200 transition hover:text-white">Entrar</Link>
          <Link href="/signup" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">Criar conta</Link>
        </nav>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-y border-white/10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-28 top-0 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:px-10 lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> Plataforma de trading
              </div>
              <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Seu mercado. <span className="text-cyan-300">Sua estratégia.</span> Uma plataforma.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
                Uma experiência de negociação com acompanhamento de ativos, gráficos, gestão de posições e ferramentas para analisar suas estratégias.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">
                  Começar agora <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
                  Já tenho uma conta
                </Link>
              </div>
            </div>
            <div className="relative rounded-2xl border border-white/10 bg-[#101b2b] p-5 shadow-2xl shadow-black/30 sm:p-7">
              <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                <div><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Visão da plataforma</p><p className="mt-2 text-lg font-semibold">Terminal de negociação</p></div>
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">Interface integrada</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["Ativos", "Gráficos", "Posições"].map((label) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-xs font-semibold text-slate-300 sm:p-4">{label}</div>
                ))}
              </div>
              <div className="mt-5 flex h-44 items-end gap-2 overflow-hidden rounded-xl border border-white/10 bg-[#0b1422] p-5" aria-label="Ilustração de gráfico de mercado">
                {[35, 49, 40, 64, 55, 70, 59, 78, 67, 86, 75, 92, 82, 95, 87, 100].map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-sm bg-gradient-to-t from-cyan-800/30 to-cyan-400/80" style={{ height: `${height}%` }} />
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">Prévia ilustrativa da experiência de negociação.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="mb-10 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Recursos</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Tudo em um único ambiente</h2></div>
          <div className="grid gap-5 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><Icon className="h-6 w-6" /></div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="border-t border-white/10 bg-[#0b1422]">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-14 md:flex-row md:items-center lg:px-10">
            <div><h2 className="text-2xl font-semibold">Pronto para acessar a plataforma?</h2><p className="mt-2 text-sm text-slate-400">Entre com sua conta ou faça seu cadastro.</p></div>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300">Acessar plataforma <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-slate-500 lg:px-10">
        <span>© {new Date().getFullYear()} Open Papertrade</span>
        <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Acesso protegido por autenticação <LockKeyhole className="h-3 w-3" /></span>
      </footer>
    </div>
  );
}

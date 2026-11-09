"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { usePortfolio } from "@/context/PortfolioContext";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, ImageIcon, RefreshCw, ShieldCheck, TrendingUp, Wallet } from "lucide-react";

type Project = { id: string; name: string; category: string; categoryLabel: string; asset: string; description: string; imageUrl: string; durationDays: number; expectedReturnPercent: number; minimumAmount: number; isActive: boolean };
type Participation = { id: string; projectId: string; projectName: string; category: string; categoryLabel: string; principal: number; percent: number; simulatedValue: number; status: string; startedAt: string };
const CATEGORIES = [["ALL", "Todos"], ["REAL_ESTATE", "Fundos Imobiliários"], ["FIXED_INCOME", "Renda Fixa"], ["STOCKS", "Ações"], ["ETF", "ETF"]] as const;
const hasValidCents = (value: number) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const run = () => fetch(BASE + path, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...options?.headers } });
  let response = await run();
  if (response.status === 401) {
    const refresh = await fetch(BASE + "/auth/refresh/", { method: "POST", credentials: "include" });
    if (refresh.ok) response = await run();
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload.detail === "string" ? payload.detail : "Não foi possível concluir a operação.");
  }
  return response.json();
}

function ProjectCover({ project, large = false }: { project: Project; large?: boolean }) {
  const image = project.imageUrl?.startsWith("https://") ? project.imageUrl : "";
  return <div className={`relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-blue-950 ${large ? "h-48 sm:h-56" : "h-44"}`}>
    {image ? <div role="img" aria-label={`Capa do projeto ${project.name}`} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${image.replace(/[\\"]/g, "")}")` }}/> :
      <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="text-white/25" size={52}/></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/10"/>
    <span className="absolute bottom-4 left-4 rounded-md border border-white/20 bg-black/35 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">{project.categoryLabel}</span>
  </div>;
}

export default function ProjectsPage() {
  const { refreshUserData } = usePortfolio();
  const [projects, setProjects] = useState<Project[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [category, setCategory] = useState("ALL");
  const [selected, setSelected] = useState<Project | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [catalog, mine] = await Promise.all([
        request<{ projects: Project[] }>("/projects/"),
        request<{ participations: Participation[] }>("/projects/mine/"),
      ]);
      setProjects(catalog.projects); setParticipations(mine.participations); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar os projetos."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(() => projects.filter(p => category === "ALL" || p.category === category), [projects, category]);
  const active = participations.filter(p => p.status === "ACTIVE");
  const invested = active.reduce((sum, p) => sum + p.principal, 0);
  // Average accrued synthetic gain per active participation; not settled cash.
  const averageSimulatedGain = active.length
    ? active.reduce((sum, p) => sum + (p.simulatedValue - p.principal), 0) / active.length
    : 0;
  const previewAmount = selected ? Number(amounts[selected.id] || 0) : 0;
  const validAmount = selected && Number.isFinite(previewAmount) && previewAmount >= selected.minimumAmount && hasValidCents(previewAmount);
  const previewGain = selected && validAmount ? previewAmount * selected.expectedReturnPercent / 100 : 0;

  const join = async (project: Project) => {
    const raw = amounts[project.id] || "";
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < project.minimumAmount || !hasValidCents(amount)) {
      setError("Informe um valor válido, com até duas casas decimais e acima do mínimo."); return;
    }
    if (!window.confirm(`Confirmar aplicação de ${money(amount)} no projeto ${project.name}? O valor será reservado do saldo da sua conta.`)) return;
    setBusy(project.id); setError("");
    try {
      await request(`/projects/${project.id}/join/`, { method: "POST", body: JSON.stringify({ amount: raw }) });
      setAmounts(old => ({ ...old, [project.id]: "" }));
      setSelected(null);
      await Promise.all([load(), refreshUserData()]);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível participar."); }
    finally { setBusy(null); }
  };

  return <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <Sidebar/>
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-6 lg:py-9">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">Master Trade / Investimentos</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Explore oportunidades</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">Conheça os projetos disponíveis, compare características e acompanhe suas participações em um só lugar.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold"><RefreshCw size={15}/> Atualizar</button>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5"><p className="text-xs text-[var(--text-muted)]">Projetos disponíveis</p><p className="mt-2 text-2xl font-bold tabular-nums">{projects.filter(p => p.isActive).length}</p></div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5"><p className="text-xs text-[var(--text-muted)]">Participações ativas</p><p className="mt-2 text-2xl font-bold tabular-nums">{active.length}</p></div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5"><p className="text-xs text-[var(--text-muted)]">Capital aplicado</p><p className="mt-2 text-2xl font-bold tabular-nums">{money(invested)}</p></div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5"><p className="text-xs text-[var(--text-muted)]">Lucro médio acumulado (simulado)</p><p className={`mt-2 text-2xl font-bold tabular-nums ${averageSimulatedGain >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{money(averageSimulatedGain)}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Média por participação ativa; não é lucro realizado ou disponível para saque.</p></div>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/5 p-4 text-sm text-red-500">{error}</p>}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Projetos disponíveis</h2><p className="text-xs text-[var(--text-muted)]">Escolha um projeto para conhecer os detalhes e simular um cenário.</p></div></div>
        <div className="flex flex-wrap gap-2" aria-label="Filtrar projetos por categoria">{CATEGORIES.map(([key, label]) =>
          <button key={key} type="button" onClick={() => setCategory(key)} aria-pressed={category === key}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${category === key ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white" : "border-[var(--border-primary)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]"}`}>{label}</button>)}</div>
        {loading ? <p className="py-8 text-sm text-[var(--text-muted)]">Carregando projetos...</p> : visible.length === 0 ? <p className="rounded-xl border border-[var(--border-primary)] p-6 text-sm text-[var(--text-muted)]">Nenhum projeto disponível nesta categoria.</p> :
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(project => <article key={project.id} className="group overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] transition-shadow hover:shadow-lg">
            <ProjectCover project={project}/>
            <div className="space-y-4 p-5"><div><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">{project.asset}</span><span className="text-[11px] text-[var(--text-muted)]">{project.isActive ? "Disponível" : "Encerrado"}</span></div>
              <h3 className="mt-2 text-lg font-bold">{project.name}</h3><p className="mt-1 line-clamp-2 min-h-10 text-sm text-[var(--text-muted)]">{project.description || "Conheça os detalhes deste projeto."}</p></div>
              <div className="grid grid-cols-2 gap-3 border-y border-[var(--border-primary)] py-4"><div><p className="text-[11px] text-[var(--text-muted)]">Prazo</p><p className="mt-1 flex items-center gap-1 text-sm font-semibold"><CalendarDays size={14}/>{project.durationDays} dias</p></div><div><p className="text-[11px] text-[var(--text-muted)]">Retorno esperado*</p><p className="mt-1 text-sm font-semibold text-[var(--accent-primary)]">{project.expectedReturnPercent.toFixed(2)}%</p></div></div>
              <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] text-[var(--text-muted)]">Aplicação mínima</p><p className="text-sm font-bold">{money(project.minimumAmount)}</p></div>
                <button type="button" onClick={() => setSelected(project)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-bold text-white">Ver detalhes <ArrowRight size={14}/></button></div>
            </div>
          </article>)}</div>}
        <p className="text-[11px] text-[var(--text-muted)]">*Estimativas informadas no cadastro do projeto, sujeitas a riscos. Não representam rentabilidade garantida.</p>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Minha carteira de projetos</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Acompanhe o capital aplicado e os resultados indicativos das suas participações.</p></div><Link href="/dashboard" className="text-xs font-semibold text-[var(--accent-primary)]">Ver patrimônio <ArrowRight className="inline" size={13}/></Link></div>
        {!participations.length ? <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-8 text-center"><Wallet className="mx-auto text-[var(--text-muted)]" size={26}/><p className="mt-3 text-sm font-semibold">Você ainda não possui participações</p><p className="mt-1 text-xs text-[var(--text-muted)]">Explore os projetos acima para começar.</p></div> :
          <div className="grid gap-3 lg:grid-cols-2">{participations.map(item => <article key={item.id} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-[var(--accent-primary)]">{item.categoryLabel}</p><h3 className="mt-1 truncate text-lg font-bold">{item.projectName}</h3></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--bg-secondary)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"><CheckCircle2 size={12}/>{item.status === "ACTIVE" ? "Em andamento" : "Encerrado"}</span></div>
            <div className="mt-5 grid grid-cols-2 gap-4"><div><p className="text-xs text-[var(--text-muted)]">Capital aplicado</p><p className="mt-1 text-xl font-bold tabular-nums">{money(item.principal)}</p></div><div><p className="text-xs text-[var(--text-muted)]">Resultado indicativo</p><p className={`mt-1 text-xl font-bold tabular-nums ${item.percent >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{item.percent >= 0 ? "+" : ""}{item.percent.toFixed(2)}%</p></div></div>
            <div className="mt-4 flex items-center gap-2 border-t border-[var(--border-primary)] pt-3 text-xs text-[var(--text-muted)]"><Clock3 size={13}/> Iniciado em {new Date(item.startedAt).toLocaleDateString("pt-BR")}</div>
          </article>)}</div>}
        <p className="text-[11px] text-[var(--text-muted)]">Resultados indicativos não são valores liquidados nem disponíveis para saque.</p>
      </section>
      {selected && <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}>
        <div role="dialog" aria-modal="true" aria-label={`Detalhes de ${selected.name}`} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[var(--bg-card)] shadow-2xl">
          <ProjectCover project={selected} large/>
          <div className="space-y-5 p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--accent-primary)]">{selected.asset}</p><h2 className="mt-1 text-2xl font-bold">{selected.name}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Fechar detalhes" className="rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold">Fechar</button></div>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">{selected.description || "Consulte os detalhes e as condições do projeto."}</p>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--bg-secondary)] p-4 text-center"><div><p className="text-[11px] text-[var(--text-muted)]">Prazo</p><p className="mt-1 text-sm font-bold">{selected.durationDays} dias</p></div><div><p className="text-[11px] text-[var(--text-muted)]">Retorno esperado</p><p className="mt-1 text-sm font-bold">{selected.expectedReturnPercent.toFixed(2)}%</p></div><div><p className="text-[11px] text-[var(--text-muted)]">Mínimo</p><p className="mt-1 text-sm font-bold">{money(selected.minimumAmount)}</p></div></div>
            <div className="space-y-3"><div><h3 className="text-sm font-bold">Simule antes de aplicar</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Cálculo ilustrativo baseado na expectativa cadastrada, sem garantia de resultado.</p></div>
              <label className="block text-xs font-semibold" htmlFor="project-amount">Valor da aplicação (USD)</label>
              <input id="project-amount" type="number" min={selected.minimumAmount} step="0.01" placeholder="Informe o valor" value={amounts[selected.id] || ""} onChange={event => setAmounts(old => ({ ...old, [selected.id]: event.target.value }))} className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] px-4 py-3 text-base font-semibold"/>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--border-primary)] p-4"><div><p className="text-[11px] text-[var(--text-muted)]">Ganho estimado*</p><p className="mt-1 text-lg font-bold">{validAmount ? money(previewGain) : "—"}</p></div><div><p className="text-[11px] text-[var(--text-muted)]">Total estimado*</p><p className="mt-1 text-lg font-bold">{validAmount ? money(previewAmount + previewGain) : "—"}</p></div></div>
              <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">*Simulação matemática, sem considerar impostos, custos ou perdas. Não é promessa de rentabilidade nem valor disponível para saque.</p>
              <button type="button" disabled={!selected.isActive || !validAmount || busy !== null} onClick={() => void join(selected)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === selected.id ? "Processando..." : selected.isActive ? "Confirmar aplicação" : "Projeto encerrado"}<ArrowRight size={16}/></button>
            </div>
          </div>
        </div>
      </div>}
    </main>
  </div>;
}

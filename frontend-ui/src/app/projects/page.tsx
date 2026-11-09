"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { usePortfolio } from "@/context/PortfolioContext";
import { RefreshCw, TrendingUp, Clock3, ShieldCheck, ArrowRight } from "lucide-react";

type Project = { id: string; name: string; category: string; categoryLabel: string; asset: string; description: string; durationDays: number; expectedReturnPercent: number; minimumAmount: number; isActive: boolean };
type Point = { percent: number; at: string };
type Participation = { id: string; projectId: string; projectName: string; category: string; categoryLabel: string; principal: number; percent: number; simulatedValue: number; status: string; startedAt: string; points: Point[] };
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
    throw new Error(JSON.stringify(payload));
  }
  return response.json();
}
function Curve({ points }: { points: Point[] }) {
  if (!points.length) return <p className="text-xs text-[var(--text-muted)]">Sem histórico ainda.</p>;
  const values = points.map(point => point.percent);
  const min = Math.min(0, ...values), max = Math.max(1, ...values);
  const coords = values.map((value, index) => `${8 + (index / Math.max(1, values.length - 1)) * 284},${98 - (value - min) / (max - min || 1) * 84}`).join(" ");
  return <svg role="img" aria-label="Curva ilustrativa, não representa rendimento realizado" viewBox="0 0 300 110" className="h-28 w-full">
    <line x1="8" y1="98" x2="292" y2="98" stroke="currentColor" strokeOpacity=".16"/>
    <polyline points={coords} fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>;
}
export default function ProjectsPage() {
  const { refreshUserData } = usePortfolio();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [category, setCategory] = useState('ALL');
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [amounts, setAmounts] = useState<Record<string,string>>({});
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
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar projetos."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000); return () => window.clearInterval(timer); }, [load]);
  const join = async (project: Project) => {
    const raw = amounts[project.id] || "";
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < project.minimumAmount) { setError("Informe um valor válido acima da aplicação mínima."); return; }
    if (!window.confirm(`Aplicar ${money(amount)} no projeto ${project.name}?`)) return;
    setBusy(project.id); setError("");
    try {
      await request(`/projects/${project.id}/join/`, { method: "POST", body: JSON.stringify({ amount: raw }) });
      setAmounts(old => ({...old, [project.id]: ""}));
      await Promise.all([load(), refreshUserData()]);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível participar."); }
    finally { setBusy(null); }
  };
  return <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <Sidebar/>
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent-primary)]">Master Trade · Projetos</p>
          <h1 className="mt-1 text-2xl font-bold">Projetos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Acompanhe projetos e participações usando o mesmo saldo da sua conta.</p></div>
        <button onClick={() => void load()} aria-label="Atualizar projetos" className="rounded-lg border border-[var(--border-primary)] p-2"><RefreshCw size={17}/></button>
      </header>
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold"><ShieldCheck size={17}/> Saldo unificado · projetos e negociação</span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Durante os testes, os valores da conta são de demonstração. A curva é uma projeção administrável, não rendimento liquidado ou saldo disponível para saque.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-400/40 p-3 text-sm text-red-500">{error}</p>}
      <section><h2 className="mb-3 text-lg font-semibold">Projetos disponíveis</h2>
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Filtrar categoria">
          {[["ALL", "Todos"], ["REAL_ESTATE", "Fundos Imobiliários"], ["FIXED_INCOME", "Renda Fixa"], ["STOCKS", "Ações"], ["ETF", "ETF"]].map(([key, label]) =>
            <button key={key} type="button" onClick={() => setCategory(key)} aria-pressed={category === key}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${category === key ? "border-[var(--accent-primary)] text-[var(--accent-primary)]" : "border-[var(--border-primary)] text-[var(--text-muted)]"}`}>{label}</button>)}
        </div>
        {loading ? <p>Carregando...</p> : projects.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Nenhum projeto cadastrado. Adicione um projeto no Django Admin.</p> :
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.filter(project => category === 'ALL' || project.category === category).map(project => <article key={project.id} className="min-w-0 space-y-4 rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5">
          <div><p className="text-xs font-semibold uppercase text-[var(--accent-primary)]">{project.categoryLabel} · {project.asset}</p><h3 className="mt-1 text-lg font-bold">{project.name}</h3><p className="mt-2 text-sm text-[var(--text-muted)]">{project.description || "Projeto de investimento simulado."}</p></div>
          <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-[var(--text-muted)]">Prazo</p><p className="flex items-center gap-1 font-semibold"><Clock3 size={14}/>{project.durationDays} dias</p></div>
          <div><p className="text-xs text-[var(--text-muted)]">Expectativa simulada</p><p className="flex items-center gap-1 font-semibold text-[var(--accent-primary)]"><TrendingUp size={14}/>{project.expectedReturnPercent.toFixed(2)}%</p></div></div>
          <p className="text-xs text-[var(--text-muted)]">Aplicação mínima prevista: {money(project.minimumAmount)}</p>
          <div className="flex gap-2"><input type="number" min={project.minimumAmount} step=".01" value={amounts[project.id] || ""} onChange={event => setAmounts(old => ({...old, [project.id]: event.target.value}))} placeholder="Valor (USD)" aria-label={`Valor para ${project.name}`} className="min-w-0 flex-1 rounded-lg border border-[var(--border-primary)] bg-transparent px-3 py-2 text-sm"/>
            <button disabled={!project.isActive || busy !== null} onClick={() => void join(project)} className="rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === project.id ? "Aguarde" : project.isActive ? "Participar" : "Encerrado"} <ArrowRight className="inline" size={14}/></button></div>
        </article>)}</div>}
      </section>
      <section><h2 className="mb-3 text-lg font-semibold">Minhas participações</h2>
        {!participations.length ? <p className="text-sm text-[var(--text-muted)]">Você ainda não possui participações em projetos.</p> :
        <div className="grid gap-4 md:grid-cols-2">{participations.map(item => <article key={item.id} className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center justify-between gap-2"><div><h3 className="font-semibold">{item.projectName}</h3><p className="text-xs text-[var(--text-muted)]">{item.categoryLabel}</p></div><span className="text-xs text-[var(--text-muted)]">{item.status === "ACTIVE" ? "Em andamento" : "Encerrado"}</span></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-[var(--text-muted)]">Aplicado</p><strong>{money(item.principal)}</strong></div><div><p className="text-xs text-[var(--text-muted)]">Resultado</p><strong>{item.percent >= 0 ? "+" : ""}{item.percent.toFixed(2)}%</strong></div><div><p className="text-xs text-[var(--text-muted)]">Projeção ilustrativa</p><strong>{money(item.simulatedValue)}</strong></div></div>
          <Curve points={item.points}/><p className="text-xs text-[var(--text-muted)]">Projeção ilustrativa. Não representa valorização efetiva ou saldo resgatável.</p>
        </article>)}</div>}
      </section>
    </main>
  </div>;
}

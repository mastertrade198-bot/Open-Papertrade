"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Newspaper, RefreshCw } from "lucide-react";

type Article = { id: string; title: string; description: string; url: string; source: string; publishedAt: string | null };
type NewsResponse = { articles: Article[]; configured: boolean; stale?: boolean; message?: string };
const CATEGORIES = [
  ["all", "Todas"], ["stocks", "Ações"], ["crypto", "Criptomoedas"],
  ["etfs", "ETFs"], ["economy", "Economia"],
] as const;

export default function MarketNews() {
  const [category, setCategory] = useState("all");
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true); setError("");
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || "/api";
        const response = await fetch(`${base}/stocks/market-news/?category=${encodeURIComponent(category)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Serviço de notícias indisponível.");
        const result: NewsResponse = await response.json();
        if (!controller.signal.aborted) setData(result);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Falha ao carregar notícias.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [category, reload]);
  return <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-4 sm:px-5">
      <div className="flex items-center gap-2"><Newspaper size={18} className="text-[var(--accent-primary)]"/><div><h2 className="text-sm font-bold">Notícias do mercado</h2><p className="text-xs text-[var(--text-muted)]">Manchetes de veículos externos via agregador</p></div></div>
      <button type="button" onClick={() => setReload(v => v + 1)} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs font-semibold disabled:opacity-50"><RefreshCw size={13} className={loading ? "animate-spin" : ""}/> Atualizar</button>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-[var(--border-primary)] px-4 py-3 sm:px-5" aria-label="Categorias de notícias">
      {CATEGORIES.map(([key, label]) => <button key={key} type="button" onClick={() => setCategory(key)} aria-pressed={category === key} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${category === key ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white" : "border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>{label}</button>)}
    </div>
    {loading ? <p className="p-6 text-sm text-[var(--text-muted)]">Carregando notícias...</p> :
      error ? <p role="alert" className="p-6 text-sm text-[var(--text-muted)]">{error}</p> :
      !data?.articles.length ? <div className="p-6 text-sm text-[var(--text-muted)]">{data?.message || "Nenhuma notícia disponível para esta categoria."}{!data?.configured && <p className="mt-2 text-xs">Configure MARKETAUX_API_TOKEN no backend para ativar as notícias reais.</p>}</div> :
      <div className="grid gap-px bg-[var(--border-primary)] md:grid-cols-2">
        {data.articles.slice(0, 8).map(article => <a key={article.id} href={article.url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 flex-col gap-2 bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-secondary)] sm:p-5">
          <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-bold uppercase text-[var(--accent-primary)]">{article.source}</span><ArrowUpRight size={14} className="shrink-0 text-[var(--text-muted)]"/></div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-relaxed text-[var(--text-primary)] group-hover:underline">{article.title}</h3>
          {article.description && <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">{article.description}</p>}
          {article.publishedAt && !Number.isNaN(Date.parse(article.publishedAt)) && <time dateTime={article.publishedAt} className="mt-auto pt-1 text-[11px] text-[var(--text-muted)]">{new Date(article.publishedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>}
        </a>)}
      </div>}
    {data?.stale && <p className="border-t border-[var(--border-primary)] px-4 py-2 text-xs text-[var(--text-muted)]">Exibindo notícias armazenadas anteriormente.</p>}
    <p className="border-t border-[var(--border-primary)] px-4 py-3 text-[11px] text-[var(--text-muted)]">As manchetes pertencem aos respectivos veículos. Clique para ler no site de origem. A disponibilidade das fontes depende do agregador.</p>
  </section>;
}

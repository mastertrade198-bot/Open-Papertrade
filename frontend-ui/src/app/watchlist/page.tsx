"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, Star, Bell, Trash2, ArrowUpRight, Plus, X, Loader2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import { usePortfolio } from "@/context/PortfolioContext";
import { stockAPI, SearchResult } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";

type Filter = "all" | "starred" | "gainers" | "losers";

export default function WatchlistPage() {
  const { watchlist, alerts, stocks, crypto, market, addToWatchlist, removeFromWatchlist, toggleWatchlistStar, addAlert, removeAlert } = usePortfolio();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"name" | "price" | "change">("name");
  const [busy, setBusy] = useState<string | null>(null);
  const [alertSymbol, setAlertSymbol] = useState<string | null>(null);
  const [alertCondition, setAlertCondition] = useState<"above" | "below">("above");
  const [alertPrice, setAlertPrice] = useState("");
  const searchId = useRef(0);

  useEffect(() => {
    const id = ++searchId.current;
    const query = search.trim();
    if (query.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await stockAPI.search(query, market);
        if (id === searchId.current) setResults(response.results.filter(item => !watchlist.some(w => w.symbol.toUpperCase() === item.symbol.toUpperCase())).slice(0, 7));
      } catch {
        if (id === searchId.current) setResults([]);
      } finally {
        if (id === searchId.current) setSearching(false);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search, market, watchlist]);

  const prices = useMemo(() => new Map([...stocks, ...crypto].map(item => [item.symbol.toUpperCase(), item])), [stocks, crypto]);
  const rows = useMemo(() => watchlist.map(item => {
    const live = prices.get(item.symbol.toUpperCase());
    return { ...item, price: live?.price && live.price > 0 ? live.price : item.price, change: live?.change ?? item.change, changePercent: live?.changePercent ?? item.changePercent, currency: live?.currency || item.currency || "USD" };
  }).filter(item =>
    (filter === "all" || (filter === "starred" && item.starred) || (filter === "gainers" && item.changePercent > 0) || (filter === "losers" && item.changePercent < 0)) &&
    (item.name + " " + item.symbol).toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))
  ).sort((a, b) => sort === "price" ? b.price - a.price : sort === "change" ? b.changePercent - a.changePercent : a.name.localeCompare(b.name)), [watchlist, prices, filter, search, sort]);

  const add = async (symbol: string, name: string) => {
    setBusy(symbol);
    try { await addToWatchlist(symbol, name); setSearch(""); setResults([]); }
    finally { setBusy(null); }
  };
  const submitAlert = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(alertPrice);
    if (!alertSymbol || !Number.isFinite(price) || price <= 0) return;
    setBusy(alertSymbol);
    try { await addAlert(alertSymbol, alertCondition, price); setAlertSymbol(null); setAlertPrice(""); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex min-h-full flex-col bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-6 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title="Favoritos" subtitle="Sua lista de ativos, sincronizada com Mercados e Negociar." />
          <Link href="/markets" className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)]">Explorar mercados</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Ativos favoritos", watchlist.length],
            ["Em alta", rows.filter(item => item.changePercent > 0).length],
            ["Em queda", rows.filter(item => item.changePercent < 0).length],
            ["Alertas cadastrados", alerts.length],
          ].map(([label,value]) => <div key={label} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{value}</p></div>)}
        </div>
        <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-primary)] p-4">
            <div className="relative min-w-[210px] flex-1">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2"><Search size={16} className="text-[var(--text-muted)]"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar ou adicionar ativo" aria-label="Buscar ou adicionar ativo" className="w-full bg-transparent text-xs text-[var(--text-primary)] outline-none"/>{searching && <Loader2 size={14} className="animate-spin text-[var(--text-muted)]"/>}</div>
              {results.length > 0 && <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] shadow-xl">{results.map(item => <button key={item.symbol} type="button" disabled={busy === item.symbol} onClick={() => void add(item.symbol, item.name)} className="flex w-full items-center justify-between gap-3 border-b border-[var(--border-primary)] px-3 py-3 text-left text-xs text-[var(--text-primary)] last:border-0 hover:bg-[var(--bg-muted)]"><span className="truncate"><strong>{item.symbol}</strong> · {item.name}</span><Plus size={15}/></button>)}</div>}
            </div>
            <div className="flex flex-wrap gap-1">{([["all","Todos"],["starred","Destaques"],["gainers","Altas"],["losers","Quedas"]] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-lg px-3 py-2 text-xs font-medium ${filter === key ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"}`}>{label}</button>)}</div>
            <select aria-label="Ordenar favoritos" value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] px-2 py-2 text-xs text-[var(--text-secondary)]"><option value="name">Nome</option><option value="price">Preço</option><option value="change">Variação</option></select>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-[var(--border-primary)] text-[var(--text-muted)]"><tr><th className="px-4 py-3 font-medium">Ativo / símbolo</th><th className="px-4 py-3 text-right font-medium">Preço</th><th className="px-4 py-3 text-right font-medium">Variação</th><th className="px-4 py-3 text-right font-medium">Ações</th></tr></thead><tbody>{rows.map(item => <tr key={item.symbol} className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-muted)]"><td className="px-4 py-3"><div className="font-semibold text-[var(--text-primary)]">{item.name || item.symbol}</div><div className="mt-1 text-[var(--text-muted)]">{item.symbol}</div></td><td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--text-primary)]">{item.price > 0 ? formatCurrency(item.price, false, { sourceCurrency: item.currency }) : "Indisponível"}</td><td className={`px-4 py-3 text-right font-semibold tabular-nums ${item.changePercent >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{item.price > 0 ? formatPercent(item.changePercent) : "—"}</td><td className="px-4 py-3"><div className="flex items-center justify-end gap-1.5"><button title="Marcar destaque" aria-label="Marcar destaque" onClick={() => void toggleWatchlistStar(item.symbol)} className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--accent-primary)]"><Star size={15} fill={item.starred ? "currentColor" : "none"}/></button><button title="Criar alerta" aria-label="Criar alerta" onClick={() => { setAlertSymbol(item.symbol); setAlertPrice(item.price > 0 ? String(item.price) : ""); }} className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-secondary)]"><Bell size={15}/></button><button title="Remover favorito" aria-label="Remover favorito" onClick={() => void removeFromWatchlist(item.symbol)} className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-secondary)]"><Trash2 size={15}/></button><Link href={`/trade?symbol=${encodeURIComponent(item.symbol)}`} className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 py-2 font-semibold text-white">Negociar <ArrowUpRight size={13}/></Link></div></td></tr>)}</tbody></table>
          {rows.length === 0 && <div className="p-10 text-center text-sm text-[var(--text-muted)]">{watchlist.length === 0 ? "Sua lista está vazia. Busque um ativo acima ou explore Mercados." : "Nenhum favorito corresponde aos filtros."}</div>}</div>
        </section>
        {alerts.length > 0 && <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"><h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Alertas cadastrados</h2><div className="space-y-2">{alerts.map(alert => <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-primary)] p-3 text-xs"><span className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{alert.symbol}</strong> · {alert.condition === "above" ? "Acima de" : "Abaixo de"} {formatCurrency(alert.targetPrice, false, { sourceCurrency: "USD" })}</span><button title="Excluir alerta" aria-label="Excluir alerta" onClick={() => void removeAlert(alert.id)} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]"><X size={16}/></button></div>)}</div></section>}
        <p className="text-xs text-[var(--text-muted)]">Cotações podem estar atrasadas. Dados destinados ao ambiente de simulação.</p>
      </main>
      {alertSymbol && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"><form onSubmit={event => void submitAlert(event)} className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-[var(--text-primary)]">Novo alerta · {alertSymbol}</h2><button type="button" aria-label="Fechar" onClick={() => setAlertSymbol(null)}><X size={18}/></button></div><label className="block text-xs text-[var(--text-secondary)]">Condição<select value={alertCondition} onChange={event => setAlertCondition(event.target.value as "above" | "below")} className="mt-2 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-sm"><option value="above">Preço acima de</option><option value="below">Preço abaixo de</option></select></label><label className="block text-xs text-[var(--text-secondary)]">Preço-alvo (USD)<input type="number" min="0.000001" step="any" required value={alertPrice} onChange={event => setAlertPrice(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-sm"/></label><button type="submit" disabled={busy === alertSymbol || !(Number(alertPrice) > 0)} className="w-full rounded-lg bg-[var(--accent-primary)] p-3 text-sm font-semibold text-white disabled:opacity-50">Criar alerta</button></form></div>}
    </div>
  );
}

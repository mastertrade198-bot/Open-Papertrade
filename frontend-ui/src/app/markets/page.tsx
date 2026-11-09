"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Star, ArrowUpRight, TrendingUp, TrendingDown, RefreshCw, Bell, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import { usePortfolio } from "@/context/PortfolioContext";
import { formatCurrency, formatPercent } from "@/lib/utils";

type Filter = "all" | "stocks" | "crypto" | "favorites";

export default function MarketsPage() {
  return <Suspense><MarketsContent /></Suspense>;
}

function MarketsContent() {
  const params = useSearchParams();
  const { stocks, crypto, watchlist, alerts, addAlert, removeAlert, toggleWatchlistStar, addToWatchlist, removeFromWatchlist, refreshPrices, isLoading, lastUpdated } = usePortfolio();
  const [filter, setFilter] = useState<Filter>(params.get("tab") === "favorites" ? "favorites" : "all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "change" | "price">("name");
  const [busy, setBusy] = useState<string | null>(null);
  const [alertSymbol, setAlertSymbol] = useState<string | null>(null);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCondition, setAlertCondition] = useState<"above" | "below">("above");

  const favoriteSet = useMemo(() => new Set(watchlist.map(item => item.symbol.toUpperCase())), [watchlist]);
  const assets = useMemo(() => {
    const combined = [
      ...stocks.map(item => ({ ...item, kind: "stocks" as const })),
      ...crypto.map(item => ({ ...item, kind: "crypto" as const })),
    ];
    // Favorites may include assets not present in the popular market lists.
    const unique = [...new Map([...combined, ...watchlist.map(item => ({ ...item, kind: "stocks" as const }))].map(item => [item.symbol.toUpperCase(), item])).values()];
    return unique.filter(item =>
      (filter === "all" || (filter === "favorites" ? favoriteSet.has(item.symbol.toUpperCase()) : item.kind === filter)) &&
      (item.symbol + " " + item.name).toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))
    ).sort((a, b) => sort === "change" ? b.changePercent - a.changePercent : sort === "price" ? b.price - a.price : a.name.localeCompare(b.name));
  }, [stocks, crypto, watchlist, filter, favoriteSet, search, sort]);

  const all = [...stocks, ...crypto];
  const positive = all.filter(item => item.changePercent > 0).length;
  const negative = all.filter(item => item.changePercent < 0).length;
  const toggle = async (symbol: string, name: string) => {
    if (busy) return;
    setBusy(symbol);
    try {
      if (favoriteSet.has(symbol.toUpperCase())) await removeFromWatchlist(symbol);
      else await addToWatchlist(symbol, name);
    } finally { setBusy(null); }
  };

  return (
    <div className="flex min-h-full flex-col bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-6 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title="Mercados" subtitle="Explore ativos, acompanhe cotações e acesse a negociação." />
          <button type="button" onClick={() => void refreshPrices()} disabled={isLoading} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"><RefreshCw size={14} className={isLoading ? "animate-spin" : ""}/> Atualizar</button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Ativos acompanhados", value: all.length, icon: Search },
            { label: "Em alta", value: positive, icon: TrendingUp },
            { label: "Em queda", value: negative, icon: TrendingDown },
            { label: "Meus favoritos", value: favoriteSet.size, icon: Star },
          ].map(item => <div key={item.label} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"><div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-muted)]"><item.icon size={14}/>{item.label}</div><div className="text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{item.value}</div></div>)}
        </div>
        <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-primary)] p-4">
            <div className="flex flex-wrap gap-1.5">{([["all","Todos"],["stocks","Ações"],["crypto","Criptomoedas"],["favorites","Favoritos"]] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === key ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"}`}>{label}</button>)}</div>
            <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-[var(--text-muted)]"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nome ou símbolo" aria-label="Buscar ativos" className="w-36 bg-transparent text-xs text-[var(--text-primary)] outline-none sm:w-48"/></label>
              <select aria-label="Ordenar ativos" value={sort} onChange={event => setSort(event.target.value as typeof sort)} className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card)] px-2 py-2 text-xs text-[var(--text-secondary)]"><option value="name">Nome</option><option value="change">Variação</option><option value="price">Preço</option></select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="border-b border-[var(--border-primary)] text-[var(--text-muted)]"><tr><th className="px-4 py-3 font-medium">Ativo / símbolo</th><th className="px-4 py-3 text-right font-medium">Preço</th><th className="px-4 py-3 text-right font-medium">Variação</th><th className="px-4 py-3 text-right font-medium">Ações</th></tr></thead>
              <tbody>{assets.map(asset => <tr key={asset.symbol} className="border-b border-[var(--border-primary)] last:border-0 hover:bg-[var(--bg-muted)]">
                <td className="px-4 py-3"><div className="font-semibold text-[var(--text-primary)]">{asset.name || asset.symbol}</div><div className="mt-0.5 text-[var(--text-muted)]">{asset.symbol}</div></td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--text-primary)]">{asset.price > 0 ? formatCurrency(asset.price, false, { sourceCurrency: asset.currency || "USD" }) : "Indisponível"}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${asset.changePercent >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{asset.price > 0 ? formatPercent(asset.changePercent) : "—"}</td>
                <td className="px-4 py-3"><div className="flex items-center justify-end gap-2"><button type="button" disabled={busy === asset.symbol} aria-label={favoriteSet.has(asset.symbol.toUpperCase()) ? "Remover dos favoritos" : "Adicionar aos favoritos"} title={favoriteSet.has(asset.symbol.toUpperCase()) ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={() => void toggle(asset.symbol, asset.name)} className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--accent-primary)] disabled:opacity-50"><Star size={15} fill={favoriteSet.has(asset.symbol.toUpperCase()) ? "currentColor" : "none"}/></button>{favoriteSet.has(asset.symbol.toUpperCase()) && <button type="button" title="Criar alerta" aria-label={`Criar alerta para ${asset.symbol}`} onClick={() => { setAlertSymbol(asset.symbol); setAlertPrice(asset.price > 0 ? String(asset.price) : ""); }} className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-secondary)]"><Bell size={15}/></button>}{favoriteSet.has(asset.symbol.toUpperCase()) && <button type="button" title="Marcar destaque" aria-label={`Destacar ${asset.symbol}`} onClick={() => void toggleWatchlistStar(asset.symbol)} className="rounded-lg border border-[var(--border-primary)] px-2 py-1 text-xs text-[var(--text-secondary)]">Destaque</button>}<Link href={`/trade?symbol=${encodeURIComponent(asset.symbol)}`} className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-3 py-2 font-semibold text-white">Negociar <ArrowUpRight size={13}/></Link></div></td>
              </tr>)}</tbody>
            </table>
            {assets.length === 0 && <p className="p-10 text-center text-sm text-[var(--text-muted)]">Nenhum ativo encontrado para os filtros selecionados.</p>}
          </div>
        </section>
        {filter === "favorites" && alerts.length > 0 && <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4"><h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Alertas de preço</h2><div className="space-y-2">{alerts.map(alert => <div key={alert.id} className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] py-2 text-xs"><span className="text-[var(--text-secondary)]">{alert.symbol} · {alert.condition === "above" ? "Acima de" : "Abaixo de"} {formatCurrency(alert.targetPrice, false, { sourceCurrency: "USD" })}</span><button type="button" onClick={() => void removeAlert(alert.id)} title="Excluir alerta" aria-label="Excluir alerta" className="text-[var(--text-muted)]"><X size={15}/></button></div>)}</div></section>}
        <p className="text-xs text-[var(--text-muted)]">Cotações sujeitas a atraso conforme o provedor. {lastUpdated ? `Última atualização da lista: ${lastUpdated.toLocaleTimeString("pt-BR")}.` : ""} Dados destinados ao ambiente de simulação.</p>
      </main>
      {alertSymbol && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"><form onSubmit={event => { event.preventDefault(); const price = Number(alertPrice); if (Number.isFinite(price) && price > 0) { void addAlert(alertSymbol, alertCondition, price); setAlertSymbol(null); } }} className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-[var(--text-primary)]">Criar alerta · {alertSymbol}</h2><button type="button" onClick={() => setAlertSymbol(null)} aria-label="Fechar"><X size={18}/></button></div><label className="block text-xs text-[var(--text-secondary)]">Condição<select value={alertCondition} onChange={event => setAlertCondition(event.target.value as "above" | "below")} className="mt-2 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-sm"><option value="above">Acima de</option><option value="below">Abaixo de</option></select></label><label className="block text-xs text-[var(--text-secondary)]">Preço-alvo (USD)<input type="number" min="0.000001" step="any" required value={alertPrice} onChange={event => setAlertPrice(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] p-3 text-sm"/></label><button type="submit" disabled={!(Number(alertPrice) > 0)} className="w-full rounded-lg bg-[var(--accent-primary)] p-3 text-sm font-semibold text-white disabled:opacity-50">Criar alerta</button></form></div>}
    </div>
  );
}

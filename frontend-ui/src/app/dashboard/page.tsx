"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PieChart,
  BarChart3,
  Clock,
  Star,
  RefreshCw,
  Loader2,
  ChevronRight,
  Zap,
  Target,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import LeveragedTradeHistory from "@/components/LeveragedTradeHistory";
import { usePortfolio } from "@/context/PortfolioContext";
import { stockAPI, StockQuote } from "@/lib/api";
import { formatCurrency, formatPercent, formatDateTime } from "@/lib/utils";

export default function Dashboard() {
  const router = useRouter();
  const {
    user,
    totalPortfolioValue,
    totalInvested,
    totalReturns,
    returnsPercent,
    dayGain,
    dayGainPercent,
    buyingPower,
    holdings,
    watchlist,
    transactions,
    stocks,
    crypto,
    isLoading,
    lastUpdated,
    refreshPrices,
    refreshUserData,
    settings,
    market,
    notifications,
  } = usePortfolio();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [indices, setIndices] = useState<StockQuote[]>([]);
  const [tickerQuotes, setTickerQuotes] = useState<StockQuote[]>([]);
  const tickerSymbols = ["BRL=X", "GC=F", "CL=F", "AAPL", "MSFT", "NVDA", "AMZN", "TSLA", "ETH-USD"];
  const tickerNames: Record<string, string> = {
    "BRL=X": "USD/BRL", "GC=F": "OURO", "CL=F": "PETRÓLEO",
    AAPL: "APPLE", MSFT: "MICROSOFT", NVDA: "NVIDIA",
    AMZN: "AMAZON", TSLA: "TESLA", "ETH-USD": "ETH",
  };

  // Fetch market indices whenever the market changes
  useEffect(() => {
    stockAPI.getIndices(market).then((res) => {
      setIndices(res.indices);
    }).catch((err) => {
      console.error("Failed to fetch indices:", err);
    });
  }, [market]);

  useEffect(() => {
    let active = true;
    const refreshTicker = async () => {
      try {
        const response = await stockAPI.getQuotes(tickerSymbols);
        if (!active) return;
        setTickerQuotes(tickerSymbols.flatMap((symbol) => {
          const result = response.quotes[symbol];
          return result?.success && result.data ? [result.data] : [];
        }));
      } catch (error) {
        console.error("Falha ao carregar cotações do painel:", error);
      }
    };
    void refreshTicker();
    const interval = window.setInterval(() => void refreshTicker(), 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  // Top holdings by value
  const topHoldings = [...holdings]
    .map((h) => ({
      ...h,
      value: h.shares * h.currentPrice,
      gain: (h.currentPrice - h.avgCost) * h.shares,
      gainPercent: h.avgCost > 0 ? ((h.currentPrice - h.avgCost) / h.avgCost) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

  // Best and worst performers
  const performers = [...holdings]
    .map((h) => ({
      ...h,
      gainPercent: h.avgCost > 0 ? ((h.currentPrice - h.avgCost) / h.avgCost) * 100 : 0,
    }))
    .sort((a, b) => b.gainPercent - a.gainPercent);

  const bestPerformer = performers[0];
  const worstPerformer = performers[performers.length - 1];

  // Market movers from stocks
  const gainers = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
  const losers = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);

  // Starred watchlist items
  const starredWatchlist = watchlist.filter((w) => w.starred).slice(0, 4);

  // Portfolio allocation - detect crypto by checking against loaded crypto symbols
  const cryptoSymbolSet = new Set(crypto.map((c) => c.symbol));
  const stockValue = holdings
    .filter((h) => !cryptoSymbolSet.has(h.symbol))
    .reduce((sum, h) => sum + h.shares * h.currentPrice, 0);
  const cryptoValue = holdings
    .filter((h) => cryptoSymbolSet.has(h.symbol))
    .reduce((sum, h) => sum + h.shares * h.currentPrice, 0);
  const cashValue = buyingPower;
  const totalValue = stockValue + cryptoValue + cashValue;

  const allocation = [
    { label: "Ações", value: stockValue, percent: totalValue > 0 ? (stockValue / totalValue) * 100 : 0, color: "var(--accent-primary)" },
    { label: "Criptomoedas", value: cryptoValue, percent: totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0, color: "var(--accent-green)" },
    { label: "Saldo", value: cashValue, percent: totalValue > 0 ? (cashValue / totalValue) * 100 : 0, color: "var(--text-muted)" },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshUserData(), refreshPrices()]);
    setIsRefreshing(false);
  };

  return (
    <div className="flex h-full bg-[var(--bg-primary)]">
      <Sidebar />

      <main className="flex-1 flex flex-col gap-6 py-8 px-10 overflow-auto">
        {/* Header */}
        <header className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="font-primary text-2xl font-semibold tracking-normal text-[var(--text-primary)]">
                Bem-vindo de volta{user.name ? `, ${user.name.split(" ")[0]}` : ""}
              </h1>
              {lastUpdated && (
                <span className="text-xs text-[var(--text-dim)] flex items-center gap-1.5">
                  <Clock size={12} />
                  {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Confira o resumo da sua carteira de hoje
            </p>
          </div>
        </header>

        {/* Scrolling market ticker: duplicated sequence for seamless motion */}
        {(() => {
          const btc = crypto.find((item) => item.symbol === "BTC");
          const items = [
            ...indices.map((item) => ({ ...item, label: item.symbol })),
            ...(btc ? [{ ...btc, label: "BTC" }] : []),
            ...tickerQuotes.map((item) => ({ ...item, label: tickerNames[item.symbol] || item.symbol })),
          ];
          if (!items.length) return null;
          return (
            <div className="shrink-0 min-h-[48px] flex items-center overflow-hidden bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] py-3" aria-label="Cotações de mercado">
              <style>{`@keyframes dashboardTickerScroll { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(-50%, 0, 0); } }
                .dashboard-ticker-track { display: flex; flex: none; width: max-content; min-width: max-content; will-change: transform; animation: dashboardTickerScroll 45s linear infinite; }`}</style>
              <div className="dashboard-ticker-track items-center">
                {[0, 1].map((copy) => (
                  <div key={copy} className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={copy === 1}>
                    {items.map((item, index) => (
                      <div key={`${copy}-${item.symbol}-${index}`} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">{item.label}</span>
                        <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
                          {item.label === "USD/BRL" ? `R$ ${item.price.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}` : item.price.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                        </span>
                        <span className={`font-mono text-xs font-medium ${item.changePercent >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                          {formatPercent(item.changePercent)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Main Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          {/* Total Portfolio */}
          <div className="group bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)] flex flex-col gap-3 transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)] hover:shadow-[0_0_22px_rgba(50,107,255,0.12)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-muted)]">Patrimônio total</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
                <span className="text-[10px] font-medium text-[var(--accent-green)]">Ao vivo</span>
              </div>
            </div>
            <span className="font-mono text-[28px] font-semibold text-[var(--text-primary)] tracking-tight">
              {formatCurrency(totalPortfolioValue, false)}
            </span>
            <div className="flex items-center gap-1.5">
              {dayGain >= 0 ? (
                <ArrowUpRight size={14} className="text-[var(--accent-green)]" />
              ) : (
                <ArrowDownRight size={14} className="text-[var(--accent-red)]" />
              )}
              <span className={`text-xs font-medium ${dayGain >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                {dayGain >= 0 ? "+" : ""}{formatCurrency(dayGain, false)} ({formatPercent(dayGainPercent)}) hoje
              </span>
            </div>
          </div>

          {/* Total Returns / Total Invested */}
          {settings.showProfitLoss ? (
            <div className="group bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)] flex flex-col gap-3 transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)] hover:shadow-[0_0_22px_rgba(50,107,255,0.12)]">
              <span className="text-xs font-medium text-[var(--text-muted)]">Retorno total</span>
              <span className={`font-mono text-[28px] font-semibold tracking-tight ${totalReturns >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                {totalReturns >= 0 ? "+" : ""}{formatCurrency(totalReturns, false)}
              </span>
              <div className="flex items-center gap-1.5">
                {totalReturns >= 0 ? (
                  <TrendingUp size={14} className="text-[var(--accent-green)]" />
                ) : (
                  <TrendingDown size={14} className="text-[var(--accent-red)]" />
                )}
                <span className={`text-xs font-medium ${totalReturns >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                  {formatPercent(returnsPercent)} desde o início
                </span>
              </div>
            </div>
          ) : (
            <div className="group bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)] flex flex-col gap-3 transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)] hover:shadow-[0_0_22px_rgba(50,107,255,0.12)]">
              <span className="text-xs font-medium text-[var(--text-muted)]">Total investido</span>
              <span className="font-mono text-[28px] font-semibold text-[var(--text-primary)] tracking-tight">
                {formatCurrency(totalInvested, false)}
              </span>
              <div className="flex items-center gap-1.5">
                <Wallet size={14} className="text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-muted)]">
                  Across {holdings.length} positions
                </span>
              </div>
            </div>
          )}

          {/* Buying Power */}
          <div className="group bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)] flex flex-col gap-3 transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)] hover:shadow-[0_0_22px_rgba(50,107,255,0.12)]">
            <span className="text-xs font-medium text-[var(--text-muted)]">Saldo disponível</span>
            <span className="font-mono text-[28px] font-semibold text-[var(--text-primary)] tracking-tight">
              {formatCurrency(buyingPower, false, { convertFromUSD: false })}
            </span>
            <div className="flex items-center gap-1.5">
              <Wallet size={14} className="text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">
                Disponível para negociar
              </span>
            </div>
          </div>

          {/* Active Positions */}
          <div className="group bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)] flex flex-col gap-3 transition-all duration-200 hover:bg-[var(--bg-hover)] hover:border-[var(--accent-primary)] hover:shadow-[0_0_22px_rgba(50,107,255,0.12)]">
            <span className="text-xs font-medium text-[var(--text-muted)]">Posições abertas</span>
            <span className="font-mono text-[28px] font-semibold text-[var(--accent-primary)] tracking-tight">
              {holdings.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">
                {holdings.filter((h) => !cryptoSymbolSet.has(h.symbol)).length} stocks, {holdings.filter((h) => cryptoSymbolSet.has(h.symbol)).length} crypto
              </span>
            </div>
          </div>
        </div>

        {/* Content Row */}
        <div className="grid grid-cols-3 gap-5">
          {/* Left Column - Holdings & Performance */}
          <div className="col-span-2 flex flex-col gap-5">
            {/* Top Holdings */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-[var(--accent-primary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Principais ativos</span>
                </div>
                <Link href="/portfolio" className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                  Ver todos <ChevronRight size={12} />
                </Link>
              </div>

              {holdings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <PieChart size={32} className="text-[var(--text-dim)] mb-3" />
                  <span className="text-sm text-[var(--text-muted)] mb-1">Nenhum ativo na carteira</span>
                  <span className="text-xs text-[var(--text-dim)]">Comece a negociar para montar sua carteira</span>
                  <Link
                    href="/trade"
                    className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-xs font-semibold text-black hover:brightness-110 transition-all"
                  >
                    Faça sua primeira operação
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-primary)]">
                  {topHoldings.map((holding) => (
                    <div
                      key={holding.symbol}
                      onClick={() => router.push(`/trade?symbol=${holding.symbol}`)}
                      className={`flex items-center justify-between px-5 ${settings.compactMode ? "py-2.5" : "py-4"} hover:bg-[var(--bg-muted)] cursor-pointer transition-colors`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center font-mono text-sm font-bold text-[var(--text-primary)]">
                          {holding.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">{holding.symbol}</div>
                          <div className="text-xs text-[var(--text-muted)]">{holding.shares} shares</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                          {formatCurrency(holding.value, false, { sourceCurrency: holding.currency || "USD" })}
                        </div>
                        {settings.showProfitLoss ? (
                          <div className={`text-xs font-medium flex items-center justify-end gap-1 ${holding.gainPercent >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                            {holding.gainPercent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                            {formatPercent(holding.gainPercent)}
                          </div>
                        ) : (
                          <div className="text-xs text-[var(--text-muted)]">
                            {formatCurrency(holding.currentPrice, false, { sourceCurrency: holding.currency || "USD" })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Best/Worst Performers */}
            {holdings.length > 0 && settings.showProfitLoss && (
              <div className="grid grid-cols-2 gap-4">
                {/* Best Performer */}
                <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-md bg-[var(--accent-green)]/20 flex items-center justify-center">
                      <TrendingUp size={14} className="text-[var(--accent-green)]" />
                    </div>
                    <span className="text-xs font-medium text-[var(--text-muted)]">Melhor desempenho</span>
                  </div>
                  {bestPerformer && (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-lg font-semibold text-[var(--text-primary)]">{bestPerformer.symbol}</div>
                        <div className="text-xs text-[var(--text-muted)]">{bestPerformer.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-semibold text-[var(--accent-green)]">
                          {formatPercent(bestPerformer.gainPercent)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Worst Performer */}
                <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-md bg-[var(--accent-red)]/20 flex items-center justify-center">
                      <TrendingDown size={14} className="text-[var(--accent-red)]" />
                    </div>
                    <span className="text-xs font-medium text-[var(--text-muted)]">Requer atenção</span>
                  </div>
                  {worstPerformer && worstPerformer.gainPercent < 0 ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-lg font-semibold text-[var(--text-primary)]">{worstPerformer.symbol}</div>
                        <div className="text-xs text-[var(--text-muted)]">{worstPerformer.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg font-semibold text-[var(--accent-red)]">
                          {formatPercent(worstPerformer.gainPercent)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--text-muted)]">Todas as posições estão positivas!</div>
                  )}
                </div>
              </div>
            )}

            {/* Weekly Summary */}
            {notifications.weeklyReport && (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-[var(--accent-primary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Resumo semanal</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--text-muted)]">Operações nesta semana</span>
                    <span className="font-mono text-lg font-semibold text-[var(--text-primary)]">
                      {transactions.filter((tx) => {
                        const txDate = new Date(tx.date);
                        const now = new Date();
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        return txDate >= weekAgo;
                      }).length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--text-muted)]">Variação da carteira</span>
                    <span className={`font-mono text-lg font-semibold ${totalReturns >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                      {totalReturns >= 0 ? "+" : ""}{formatCurrency(totalReturns, false)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--text-muted)]">Posições abertas</span>
                    <span className="font-mono text-lg font-semibold text-[var(--text-primary)]">
                      {holdings.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-[var(--text-muted)]">Saldo disponível</span>
                    <span className="font-mono text-lg font-semibold text-[var(--text-primary)]">
                      {formatCurrency(buyingPower, false, { convertFromUSD: false })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Market Movers */}
            {notifications.marketNews && (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-[var(--accent-primary)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Destaques do mercado</span>
                  </div>
                  <Link href="/markets" className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                    Ver mercados <ChevronRight size={12} />
                  </Link>
                </div>

                <div className="grid grid-cols-2 divide-x divide-[var(--border-primary)]">
                  {/* Gainers */}
                  <div className="p-4">
                    <div className="text-[10px] font-semibold text-[var(--accent-green)] uppercase tracking-wider mb-3">Maiores altas</div>
                    <div className="flex flex-col gap-2">
                      {gainers.length > 0 ? gainers.map((stock) => (
                        <div
                          key={stock.symbol}
                          onClick={() => router.push(`/trade?symbol=${stock.symbol}`)}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--bg-muted)] cursor-pointer transition-colors"
                        >
                          <span className="font-mono text-sm font-medium text-[var(--text-primary)]">{stock.symbol}</span>
                          <span className="font-mono text-xs font-semibold text-[var(--accent-green)]">{formatPercent(stock.changePercent)}</span>
                        </div>
                      )) : (
                        <span className="text-xs text-[var(--text-dim)] py-2">Carregando...</span>
                      )}
                    </div>
                  </div>

                  {/* Losers */}
                  <div className="p-4">
                    <div className="text-[10px] font-semibold text-[var(--accent-red)] uppercase tracking-wider mb-3">Maiores quedas</div>
                    <div className="flex flex-col gap-2">
                      {losers.length > 0 ? losers.map((stock) => (
                        <div
                          key={stock.symbol}
                          onClick={() => router.push(`/trade?symbol=${stock.symbol}`)}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--bg-muted)] cursor-pointer transition-colors"
                        >
                          <span className="font-mono text-sm font-medium text-[var(--text-primary)]">{stock.symbol}</span>
                          <span className="font-mono text-xs font-semibold text-[var(--accent-red)]">{formatPercent(stock.changePercent)}</span>
                        </div>
                      )) : (
                        <span className="text-xs text-[var(--text-dim)] py-2">Carregando...</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Allocation, Watchlist, Recent */}
          <div className="flex flex-col gap-5">
            {/* Portfolio Allocation */}
            <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)]">
              <div className="flex items-center gap-2 mb-4">
                <PieChart size={16} className="text-[var(--accent-primary)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">Alocação</span>
              </div>

              {/* Allocation Bar */}
              <div className="h-3 rounded-full overflow-hidden flex mb-4 bg-[var(--bg-muted)]">
                {allocation.map((item, idx) => (
                  item.percent > 0 && (
                    <div
                      key={item.label}
                      className="h-full transition-all"
                      style={{
                        width: `${item.percent}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  )
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-3">
                {allocation.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[var(--text-primary)]">{formatCurrency(item.value, false)}</span>
                      <span className="font-mono text-[10px] text-[var(--text-dim)] w-10 text-right">{item.percent.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Watchlist Highlights */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-[var(--accent-primary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Lista de acompanhamento</span>
                </div>
                <Link href="/watchlist" className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                  Ver todos <ChevronRight size={12} />
                </Link>
              </div>

              {watchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Star size={24} className="text-[var(--text-dim)] mb-2" />
                  <span className="text-xs text-[var(--text-muted)]">Nenhum ativo na lista</span>
                  <Link href="/watchlist" className="text-[11px] text-[var(--accent-primary)] mt-1 hover:underline">
                    Add stocks to watch
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-primary)]">
                  {(starredWatchlist.length > 0 ? starredWatchlist : watchlist.slice(0, 4)).map((item) => (
                    <div
                      key={item.symbol}
                      onClick={() => router.push(`/trade?symbol=${item.symbol}`)}
                      className="flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-muted)] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {item.starred && <Star size={10} className="text-[var(--accent-primary)] fill-[var(--accent-primary)]" />}
                        <span className="font-mono text-sm font-medium text-[var(--text-primary)]">{item.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[var(--text-muted)]">
                          {formatCurrency(item.price, false, { sourceCurrency: item.currency || "USD" })}
                        </span>
                        <span className={`font-mono text-xs font-medium ${item.changePercent >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                          {formatPercent(item.changePercent)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] flex flex-col overflow-hidden flex-1">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-[var(--accent-primary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Atividade recente</span>
                </div>
                <Link href="/history" className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                  Ver todos <ChevronRight size={12} />
                </Link>
              </div>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4 flex-1">
                  <Target size={24} className="text-[var(--text-dim)] mb-2" />
                  <span className="text-xs text-[var(--text-muted)]">Nenhuma transação ainda</span>
                  <Link href="/trade" className="text-[11px] text-[var(--accent-primary)] mt-1 hover:underline">
                    Start trading
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-primary)] overflow-auto">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className={`flex items-center justify-between px-5 ${settings.compactMode ? "py-2" : "py-3"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === "BUY" ? "bg-[var(--accent-green)]/20" : "bg-[var(--accent-red)]/20"}`}>
                          {tx.type === "BUY" ? (
                            <ArrowUpRight size={14} className="text-[var(--accent-green)]" />
                          ) : (
                            <ArrowDownRight size={14} className="text-[var(--accent-red)]" />
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-[var(--text-primary)]">
                            {tx.type === "BUY" ? "COMPRA" : "VENDA"} {tx.symbol}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)]">
                            {tx.shares} unidades a {formatCurrency(tx.price, false)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono text-xs font-medium ${tx.type === "BUY" ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]"}`}>
                          {tx.type === "BUY" ? "-" : "+"}{formatCurrency(tx.total, false)}
                        </div>
                        <div className="text-[10px] text-[var(--text-dim)]">
                          {new Date(tx.date).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4">
          <Link
            href="/trade"
            className="flex items-center gap-4 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center group-hover:bg-[var(--accent-primary)]/30 transition-colors">
              <Plus size={18} className="text-[var(--accent-primary)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Nova operação</div>
              <div className="text-xs text-[var(--text-muted)]">Compre ou venda ações</div>
            </div>
          </Link>

          <Link
            href="/markets"
            className="flex items-center gap-4 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-green)]/20 flex items-center justify-center group-hover:bg-[var(--accent-green)]/30 transition-colors">
              <TrendingUp size={18} className="text-[var(--accent-green)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Mercados</div>
              <div className="text-xs text-[var(--text-muted)]">Explore ações e criptomoedas</div>
            </div>
          </Link>

          <Link
            href="/portfolio"
            className="flex items-center gap-4 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--text-muted)]/20 flex items-center justify-center group-hover:bg-[var(--text-muted)]/30 transition-colors">
              <PieChart size={18} className="text-[var(--text-muted)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Carteira</div>
              <div className="text-xs text-[var(--text-muted)]">Visualize seus ativos</div>
            </div>
          </Link>

          <Link
            href="/history"
            className="flex items-center gap-4 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] hover:border-[var(--accent-primary)] transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--border-muted)]/30 flex items-center justify-center group-hover:bg-[var(--border-muted)]/50 transition-colors">
              <Clock size={18} className="text-[var(--text-dim)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">Histórico</div>
              <div className="text-xs text-[var(--text-muted)]">Transações anteriores</div>
            </div>
          </Link>
        </div>
      <div className="mt-6"><LeveragedTradeHistory /></div>
      </main>
    </div>
  );
}

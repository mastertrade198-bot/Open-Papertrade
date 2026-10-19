"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import { usePortfolio } from "@/context/PortfolioContext";
import { stockAPI, StockQuote } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default function MarketsPage() {
  const { stocks, crypto, addToWatchlist, watchlist, market } = usePortfolio();
  const [indices, setIndices] = useState<StockQuote[]>([]);

  // Fetch market indices whenever the market changes
  useEffect(() => {
    stockAPI.getIndices(market).then((res) => {
      setIndices(res.indices);
    }).catch((err) => {
      console.error("Failed to fetch indices:", err);
    });
  }, [market]);

  const allAssets = [...stocks, ...crypto];

  // Sort by change percent for gainers/losers
  const sortedByVariação = [...allAssets].sort((a, b) => b.changePercent - a.changePercent);
  const gainers = sortedByVariação.slice(0, 3);
  const losers = sortedByVariação.slice(-3).reverse();

  const btcIndex = crypto.find((c) => c.symbol === "BTC");

  const isInWatchlist = (symbol: string) => watchlist.some((w) => w.symbol === symbol);

  return (
    <div classNome="flex h-full bg-[var(--bg-primary)]">
      <Sidebar />
      <main classNome="flex-1 flex flex-col gap-7 py-8 px-10 overflow-auto">
        <PageHeader
          title="Markets"
          subtitle="Acompanhe os mercados e descubra oportunidades de negociação"
        />

        {/* Metrics Row */}
        <div classNome="flex gap-4">
          {indices.map((idx) => (
            <MetricCard
              key={idx.symbol}
              label={idx.symbol}
              value={idx.price.toLocaleString()}
              change={formatPercent(idx.changePercent)}
              isPositive={idx.changePercent >= 0}
            />
          ))}
          <MetricCard
            label="BITCOIN"
            value={btcIndex ? formatCurrency(btcIndex.price, false, { sourceCurrency: btcIndex.currency || 'USD' }) : "—"}
            valueColor="var(--accent-primary)"
            subtext={btcIndex ? formatPercent(btcIndex.changePercent) : ""}
          />
        </div>

        {/* Content Row */}
        <div classNome="flex gap-4 flex-1 min-h-0">
          {/* Ações populares Table */}
          <div classNome="flex-1 bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-primary)] flex flex-col gap-4">
            <div classNome="flex items-center justify-between">
              <span classNome="text-sm font-semibold text-[var(--text-primary)]">
                Ações populares
              </span>
              <Link
                href="/watchlist"
                classNome="text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
              >
                Ver todos
              </Link>
            </div>

            {/* Table Header */}
            <div classNome="flex gap-4 py-3">
              <span classNome="flex-1 text-[11px] font-semibold tracking-[0.5px] text-[var(--text-muted)]">
                Ativo
              </span>
              <span classNome="flex-1 text-[11px] font-semibold tracking-[0.5px] text-[var(--text-muted)]">
                Nome
              </span>
              <span classNome="w-24 text-right text-[11px] font-semibold tracking-[0.5px] text-[var(--text-muted)]">
                Preço
              </span>
              <span classNome="w-24 text-right text-[11px] font-semibold tracking-[0.5px] text-[var(--text-muted)]">
                Variação
              </span>
              <span classNome="w-20 text-right text-[11px] font-semibold tracking-[0.5px] text-[var(--text-muted)]">
                Ação
              </span>
            </div>

            {/* Table Body */}
            <div classNome="flex flex-col flex-1 overflow-auto">
              {stocks.map((stock) => (
                <div
                  key={stock.symbol}
                  classNome="flex gap-4 py-4 border-t border-[var(--border-primary)] items-center"
                >
                  <span classNome="flex-1 font-mono text-[13px] font-semibold text-[var(--text-primary)]">
                    {stock.symbol}
                  </span>
                  <span classNome="flex-1 text-[13px] text-[var(--text-secondary)]">
                    {stock.name}
                  </span>
                  <span classNome="w-24 text-right font-mono text-[13px] text-[var(--text-primary)]">
                    {formatCurrency(stock.price, false, { sourceCurrency: stock.currency || 'USD' })}
                  </span>
                  <span
                    classNome={`w-24 text-right font-mono text-[13px] ${
                      stock.changePercent >= 0
                        ? "text-[var(--accent-green)]"
                        : "text-[var(--accent-red)]"
                    }`}
                  >
                    {formatPercent(stock.changePercent)}
                  </span>
                  <div classNome="w-20 flex justify-end gap-2">
                    <Link
                      href="/trade"
                      classNome="px-2 py-1 rounded text-[10px] font-semibold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-secondary)]"
                    >
                      Negociar
                    </Link>
                    {!isInWatchlist(stock.symbol) && (
                      <button
                        onClick={() => addToWatchlist(stock.symbol)}
                        classNome="px-2 py-1 rounded text-[10px] font-medium border border-[var(--border-muted)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Maiores movimentos Panel */}
          <div classNome="w-[360px] bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-primary)] flex flex-col gap-5">
            <div classNome="flex items-center justify-between">
              <span classNome="text-sm font-semibold text-[var(--text-primary)]">
                Maiores movimentos
              </span>
              <Link href="/watchlist" classNome="text-[11px] font-medium text-[var(--accent-primary)] hover:underline">
                Ver todos
              </Link>
            </div>

            <div classNome="flex flex-col gap-5 flex-1 overflow-auto">
              {/* Gainers */}
              <div classNome="flex flex-col gap-3">
                <span classNome="text-[10px] font-bold tracking-[1px] text-[var(--accent-green)]">
                  ALTAS
                </span>
                {gainers.map((item) => (
                  <div key={item.symbol} classNome="flex items-center justify-between">
                    <div classNome="flex flex-col gap-0.5">
                      <span classNome="font-mono text-[13px] font-semibold text-[var(--text-primary)]">
                        {item.symbol}
                      </span>
                      <span classNome="text-[11px] text-[var(--text-muted)]">
                        {item.name}
                      </span>
                    </div>
                    <span classNome="px-2.5 py-1.5 rounded-md bg-[#22C55E20] font-mono text-xs font-medium text-[var(--accent-green)]">
                      {formatPercent(item.changePercent)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Losers */}
              <div classNome="flex flex-col gap-3">
                <span classNome="text-[10px] font-bold tracking-[1px] text-[var(--accent-red)]">
                  QUEDAS
                </span>
                {losers.map((item) => (
                  <div key={item.symbol} classNome="flex items-center justify-between">
                    <div classNome="flex flex-col gap-0.5">
                      <span classNome="font-mono text-[13px] font-semibold text-[var(--text-primary)]">
                        {item.symbol}
                      </span>
                      <span classNome="text-[11px] text-[var(--text-muted)]">
                        {item.name}
                      </span>
                    </div>
                    <span classNome="px-2.5 py-1.5 rounded-md bg-[#EF444420] font-mono text-xs font-medium text-[var(--accent-red)]">
                      {formatPercent(item.changePercent)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

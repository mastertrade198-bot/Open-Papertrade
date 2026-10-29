"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  ChevronDown,
  Minus,
  Plus,
  TrendingUp,
  TrendingDown,
  X,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import PageHeader from "@/components/PageHeader";
import MetricCard from "@/components/MetricCard";
import StockChart from "@/components/StockChart";

import { usePortfolio } from "@/context/PortfolioContext";
import { formatCurrency, formatPercent, formatTime, getMarketStatus, getMarketStatusLocal, MarketStatus } from "@/lib/utils";
import { stockAPI, userAPI, StockQuote, SearchResult, SimulatedPosition, CatalogAsset } from "@/lib/api";

export default function TradePage() {
  return (
    <Suspense>
      <TradePageContent />
    </Suspense>
  );
}

function TradePageContent() {
  const searchParams = useSearchParams();
  const {
    stocks,
    crypto,
    holdings,
    buyingPower,
    refreshUserData,
    settings,
    getStockBySymbol,
    market,
  } = usePortfolio();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Trade state
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");
  const [selectedQuote, setSelectedQuote] = useState<StockQuote | null>(null);
  const [showAssetMenu, setShowAssetMenu] = useState(false);
  const [expandedAssetCategory, setExpandedAssetCategory] = useState<string | null>("Ações");
  const [catalogAssets, setCatalogAssets] = useState<CatalogAsset[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const all: CatalogAsset[] = [];
      let page = 1;
      let more = true;
      while (more && page <= 30) {
        const response = await stockAPI.getAssetCatalog(page);
        all.push(...response.assets.filter(asset => asset.currency === "USD"));
        more = response.hasMore;
        page += 1;
      }
      setCatalogAssets(all);
    } catch (error) {
      console.error("Catalog error:", error);
      setCatalogError("Não foi possível carregar o catálogo de ativos.");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showAssetMenu) void refreshCatalog();
  }, [showAssetMenu, refreshCatalog]);

  const availableAssets = useMemo(() => {
    const bySymbol = new Map<string, CatalogAsset>();
    for (const asset of catalogAssets) {
      if (asset.currency === "USD") bySymbol.set(asset.symbol, asset);
    }
    // Keep verified USD instruments from the live portfolio feed visible.
    for (const asset of stocks) {
      if (asset.currency === "USD" && !/\\.(NS|BO)$/i.test(asset.symbol) && !bySymbol.has(asset.symbol)) {
        bySymbol.set(asset.symbol, { symbol: asset.symbol, name: asset.name || asset.symbol, category: "Ações", currency: "USD" });
      }
    }
    for (const asset of crypto) {
      if (asset.currency === "USD" && !bySymbol.has(asset.symbol)) {
        bySymbol.set(asset.symbol, { symbol: asset.symbol, name: asset.name || asset.symbol, category: "Criptomoedas", currency: "USD" });
      }
    }
    return Array.from(bySymbol.values()).sort((a, b) => a.category.localeCompare(b.category, "pt-BR") || a.symbol.localeCompare(b.symbol));
  }, [catalogAssets, stocks, crypto]);

  const displaySymbol = (symbol: string) =>
    catalogAssets.find(asset => asset.symbol === symbol)?.displaySymbol || symbol;

  const assetCategories = useMemo(() => {
    const groups = new Map<string, typeof availableAssets>();
    for (const asset of availableAssets) {
      if (!groups.has(asset.category)) groups.set(asset.category, []);
      groups.get(asset.category)!.push(asset);
    }
    return Array.from(groups, ([name, assets]) => ({ name, assets }));
  }, [availableAssets]);

  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [marginInput, setMarginInput] = useState("100.00");
  const [stopLossInput, setStopLossInput] = useState("");
  const [takeProfitInput, setTakeProfitInput] = useState("");
  const [leverage, setLeverage] = useState(10);
  const [marginBalance, setMarginBalance] = useState<number | null>(null);
  const [positions, setPositions] = useState<SimulatedPosition[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const refreshPositions = useCallback(async () => {
    try {
      const data = await userAPI.getPositions();
      setMarginBalance(data.buyingPower);
      setPositions(data.positions);
    } catch (error) {
      console.error("Failed to load simulated positions:", error);
    }
  }, []);

  useEffect(() => {
    void refreshPositions();
    const interval = window.setInterval(() => void refreshPositions(), 15000);
    return () => window.clearInterval(interval);
  }, [refreshPositions]);

  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [positionsTab, setPositionsTab] = useState<"OPEN" | "CLOSED">("OPEN");

  const closeSimulatedPosition = async (id: string) => {
    if (!window.confirm("Encerrar esta posição pelo preço atual?")) return;
    setClosingPositionId(id);
    try {
      const result = await userAPI.closePosition(id);
      setMarginBalance(result.buyingPower);
      setMessage({ type: "success", text: `Posição encerrada. Resultado: ${result.position.realizedPnl !== null && result.position.realizedPnl !== undefined ? formatCurrency(result.position.realizedPnl, false, { convertFromUSD: false }) : "indisponível"}. Saldo disponível atualizado.` });
      await Promise.all([refreshPositions(), refreshUserData()]);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao encerrar posição." });
    } finally {
      setClosingPositionId(null);
    }
  };

  // All orders in this panel open leveraged simulated positions.

  // Confirm dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Re-check market status every 30 seconds
  const [marketTick, setMarketTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setMarketTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Market status (async, holiday-aware via backend)
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(() =>
    getMarketStatusLocal(market, selectedSymbol)
  );

  useEffect(() => {
    // Crypto is handled synchronously — no API call needed
    if (selectedSymbol.toUpperCase().includes('-USD')) {
      setMarketStatus(getMarketStatusLocal(market, selectedSymbol));
      return;
    }

    let cancelled = false;
    getMarketStatus(market, selectedSymbol).then((status) => {
      if (!cancelled) setMarketStatus(status);
    });
    return () => { cancelled = true; };
  }, [market, selectedSymbol, marketTick]);

  // Get holding for selected symbol
  const selectedHolding = holdings.find((h) => h.symbol === selectedSymbol);

// Use selected quote price or fall back to context
  const currentPrice = selectedQuote?.price || getStockBySymbol(selectedSymbol)?.price || 0;
  const effectivePrice = currentPrice;
  const margin = Number(marginInput);
  const quantity = currentPrice > 0 && leverage > 0 && Number.isFinite(margin) ? (margin * leverage) / currentPrice : 0;
  const estimatedTotal = margin * leverage;
  // Projections use a 1% underlying-price movement unless SL/TP percentages are provided.
  const projectedNotional = Number.isFinite(estimatedTotal) && estimatedTotal > 0 ? estimatedTotal : 0;
  const projectedProfitPercent = Number(takeProfitInput) > 0 && Number.isFinite(Number(takeProfitInput)) ? Number(takeProfitInput) : 1;
  const projectedLossPercent = Number(stopLossInput) > 0 && Number.isFinite(Number(stopLossInput)) ? Number(stopLossInput) : 1;
  const projectedProfit = projectedNotional * projectedProfitPercent / 100;
  const projectedLoss = projectedNotional * projectedLossPercent / 100;
  const hasProjectedProfitTarget = takeProfitInput.trim() !== "" && Number(takeProfitInput) > 0;
  const hasProjectedLossTarget = stopLossInput.trim() !== "" && Number(stopLossInput) > 0;
  const sourceCurrency = selectedQuote?.currency || getStockBySymbol(selectedSymbol)?.currency || 'USD';


  // Set symbol from URL query param
  useEffect(() => {
    const symbolParam = searchParams.get("symbol");
    if (symbolParam) {
      setSelectedSymbol(symbolParam.toUpperCase());
      fetchQuote(symbolParam.toUpperCase());
    }
  }, [searchParams]);

  // Update default symbol when market changes (only if no URL param is set)
  useEffect(() => {
    const symbolParam = searchParams.get("symbol");
    if (symbolParam) return;
    const defaultSymbol = "AAPL";
    setSelectedSymbol(defaultSymbol);
    setSelectedQuote(null);
    fetchQuote(defaultSymbol);
  }, [market]);

  // Fetch quote for selected symbol
  const fetchQuote = useCallback(async (symbol: string) => {
    setIsLoadingQuote(true);
    try {
      const result = await stockAPI.getQuote(symbol);
      if (result.success && result.data) {
        setSelectedQuote(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch quote:", error);
    } finally {
      setIsLoadingQuote(false);
    }
  }, []);

  // Search for stocks
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const results = await stockAPI.search(query, market);
      setSearchResults(results.results.slice(0, 8));
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [market]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Select a stock from search
  const selectStock = (result: SearchResult) => {
    // Newly searched symbols join the shared catalog only after backend USD verification.
    void stockAPI.registerCatalogAsset(result.symbol, result.type).then(asset => {
      setCatalogAssets(current => current.some(item => item.symbol === asset.symbol) ? current : [...current, asset]);
    }).catch(() => { /* Non-USD or unavailable instruments are not added to the catalog. */ });
    setSelectedSymbol(result.symbol);
    setSelectedQuote(null);
    setSearchQuery("");
    setShowSearchResults(false);
    fetchQuote(result.symbol);
  };

  // Handle trade execution (or show confirm dialog)
  const handleTradeClick = () => {
    if (settings.confirmTrades) {
      setShowConfirmDialog(true);
    } else {
      executeTradeOrOrder();
    }
  };

  // Execute an isolated-margin paper position; BUY=LONG, SELL=SHORT.
  const executeTradeOrOrder = async () => {
    setShowConfirmDialog(false);
    if (!canTrade || submitting) return;
    setSubmitting(true);
    try {
      await userAPI.openPosition({
        symbol: selectedSymbol,
        side: orderType === "BUY" ? "LONG" : "SHORT",
        margin,
        leverage,
        stopLoss,
        takeProfit,
      });
      setMessage({ type: "success", text: `${orderType} ${selectedSymbol} · USD ${margin.toFixed(2)} de margem · ${leverage}x — posição aberta` });
      await Promise.all([refreshPositions(), refreshUserData()]);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao abrir posição." });
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedMargin = margin;
  // Percentages describe the underlying asset's price movement from entry.
  // Backend continues to receive absolute price levels.
  const stopLossPercent = stopLossInput.trim() ? Number(stopLossInput) : null;
  const takeProfitPercent = takeProfitInput.trim() ? Number(takeProfitInput) : null;
  const stopLoss = stopLossPercent !== null && currentPrice > 0
    ? currentPrice * (1 + (orderType === "BUY" ? -1 : 1) * stopLossPercent / 100) : null;
  const takeProfit = takeProfitPercent !== null && currentPrice > 0
    ? currentPrice * (1 + (orderType === "BUY" ? 1 : -1) * takeProfitPercent / 100) : null;
  const validStopLoss = stopLossPercent === null || (Number.isFinite(stopLossPercent) && stopLossPercent > 0 && stopLoss !== null && stopLoss > 0);
  const validTakeProfit = takeProfitPercent === null || (Number.isFinite(takeProfitPercent) && takeProfitPercent > 0 && takeProfit !== null && takeProfit > 0);
  const canTrade = marketStatus.isOpen && sourceCurrency === "USD" && Number.isFinite(margin) &&
    margin >= 0.01 && /^\d+(\.\d{1,2})?$/.test(marginInput) &&
    Number.isFinite(leverage) && leverage >= 1 && leverage <= 100 && currentPrice > 0 &&
    marginBalance !== null && margin <= marginBalance && validStopLoss && validTakeProfit && !submitting;

  const setMarginPercent = (percent: number) => {
    if (marginBalance === null) return;
    setMarginInput((Math.floor(marginBalance * percent * 100) / 100).toFixed(2));
  };

  const getButtonText = () => {
    if (!marketStatus.isOpen) return `${marketStatus.marketName} Mercado fechado`;
    if (sourceCurrency !== "USD") return "Apenas ativos em USD";
    if (marginBalance === null) return "Carregando saldo disponível";
    if (!validStopLoss || !validTakeProfit) return "Preço inválido de SL / TP";
    if (margin > marginBalance) return "Margem insuficiente";
    return `${orderType === "BUY" ? "Comprar" : "Vender"} ${selectedSymbol} · $${Number.isFinite(margin) ? margin.toFixed(2) : "0.00"} de margem · ${leverage}x`;
  };

  return (
    <div className="flex h-full bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="trade-workspace flex-1 min-w-0 flex flex-col gap-4 py-4 px-3 sm:px-5 lg:px-6 overflow-auto">
        <PageHeader
          title="Negociar"
          subtitle="Acompanhe o mercado, configure sua ordem e gerencie posições em um único lugar"
        />

        {/* Success/Error Message */}
        {message && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
              message.type === "success"
                ? "bg-[#22C55E20] text-[var(--accent-green)]"
                : "bg-[#EF444420] text-[var(--accent-red)]"
            }`}
          >
            {message.type === "success" ? (
              <TrendingUp size={18} />
            ) : (
              <TrendingDown size={18} />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Main Trade Area */}
        <div className="trade-workspace-grid grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,310px)] gap-4 items-start min-w-0">
          {/* Left Panel - Stock Selection */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Compact trading instrument toolbar */}
            <div className="flex flex-col md:flex-row gap-2.5 items-stretch">
            <div className="relative min-w-0 md:w-[245px] md:shrink-0">
              <button
                type="button"
                aria-expanded={showAssetMenu}
                aria-haspopup="listbox"
                onClick={() => setShowAssetMenu((open) => !open)}
                className="h-12 w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] px-3 py-1.5 text-left hover:border-[var(--accent-primary)]"
              >
                <span className="min-w-0">
                  <span className="block text-[10px] text-[var(--text-muted)]">Selecionar ativo</span>
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{displaySymbol(selectedSymbol)} — {selectedQuote?.name || "Ativo selecionado"}</span>
                </span>
                <ChevronDown size={18} className="shrink-0 text-[var(--text-muted)]" />
              </button>
              {showAssetMenu && (
                <div aria-label="Ativos por categoria" className="absolute left-0 top-full z-40 mt-2 w-[min(440px,calc(100vw-48px))] max-h-[420px] overflow-y-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] shadow-2xl">
                  <div className="sticky top-0 z-10 border-b border-[var(--border-primary)] bg-[var(--bg-card)] px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Mercados disponíveis</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{catalogLoading ? "Carregando catálogo..." : `${availableAssets.length} ativos USD · Escolha uma categoria`}</p>
                    {catalogError && <p role="alert" className="mt-1 text-[11px] text-[var(--accent-red)]">{catalogError}</p>}
                  </div>
                  {assetCategories.map(({ name, assets }) => (
                    <div key={name} className="border-b border-[var(--border-primary)] last:border-b-0">
                      <button
                        type="button"
                        aria-expanded={expandedAssetCategory === name}
                        onClick={() => setExpandedAssetCategory(current => current === name ? null : name)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg-muted)] transition-colors"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)]">{name}</span>
                          <span className="rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">{assets.length}</span>
                        </span>
                        <ChevronDown size={16} className={`shrink-0 text-[var(--text-muted)] transition-transform ${expandedAssetCategory === name ? "rotate-180" : ""}`} />
                      </button>
                      {expandedAssetCategory === name && (
                        <div className="border-t border-[var(--border-primary)] bg-[var(--bg-card-inner)] py-1">
                          {assets.map(asset => (
                            <button
                              type="button"
                              key={asset.symbol}
                              aria-current={selectedSymbol === asset.symbol ? "true" : undefined}
                              onClick={() => {
                                selectStock({ symbol: asset.symbol, name: asset.name, provider: "catalog" });
                                setShowAssetMenu(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-muted)] transition-colors ${selectedSymbol === asset.symbol ? "text-[var(--accent-primary)]" : "text-[var(--text-primary)]"}`}
                            >
                              <span className="min-w-0">
                                <span className="block font-mono text-xs font-semibold">{asset.displaySymbol || asset.symbol}</span>
                                <span className="block truncate text-[11px] text-[var(--text-muted)]">{asset.name}</span>
                              </span>
                              {selectedSymbol === asset.symbol && <span className="shrink-0 text-[10px] text-[var(--accent-primary)]">Selecionado</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {assetCategories.length === 0 && <p className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">Nenhum ativo carregado</p>}
                </div>
              )}
            </div>

            <div className="relative min-w-0 flex-1">
              <div className="flex h-12 items-center gap-3 px-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] focus-within:border-[var(--accent-primary)] transition-colors">
                <Search size={20} className="text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  placeholder="Buscar ativo por nome ou símbolo..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchResults(false);
                    }}
                    className="p-1 hover:bg-[var(--bg-muted)] rounded"
                  >
                    <X size={16} className="text-[var(--text-muted)]" />
                  </button>
                )}
                {isSearching && (
                  <Loader2 size={18} className="text-[var(--accent-primary)] animate-spin" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] shadow-xl z-20 overflow-hidden">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="text-[var(--accent-primary)] animate-spin" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="py-2">
                      {searchResults.map((result) => (
                        <button
                          key={result.symbol}
                          onClick={() => selectStock(result)}
                          className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-muted)] transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center">
                            <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                              {result.symbol.slice(0, 2)}
                            </span>
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                              {result.symbol}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {result.name}
                            </div>
                          </div>
                          {result.type && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-muted)] text-[var(--text-muted)]">
                              {result.type}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Search size={24} className="text-[var(--text-dim)] mb-2" />
                      <span className="text-sm text-[var(--text-muted)]">
                        Nenhum resultado para &quot;{searchQuery}&quot;
                      </span>
                      <span className="text-xs text-[var(--text-dim)] mt-1">
                        Tente outro símbolo
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            </div>

            {/* Selected Stock Card */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-bold text-[var(--text-primary)]">
                      {displaySymbol(selectedSymbol)}
                    </span>
                    {isLoadingQuote && (
                      <Loader2 size={18} className="text-[var(--accent-primary)] animate-spin" />
                    )}
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">
                    {selectedQuote?.name || getStockBySymbol(selectedSymbol)?.name || selectedSymbol}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xl font-bold text-[var(--text-primary)]">
                    {formatCurrency(currentPrice, false, { sourceCurrency })}
                  </div>
                  {selectedQuote && (
                    <div
                      className={`flex items-center justify-end gap-1 font-mono text-sm ${
                        selectedQuote.changePercent >= 0
                          ? "text-[var(--accent-green)]"
                          : "text-[var(--accent-red)]"
                      }`}
                    >
                      {selectedQuote.changePercent >= 0 ? (
                        <ArrowUpRight size={16} />
                      ) : (
                        <ArrowDownRight size={16} />
                      )}
                      {formatCurrency(Math.abs(selectedQuote.change), false, { sourceCurrency })} ({formatPercent(selectedQuote.changePercent)})
                    </div>
                  )}
                </div>
              </div>

              {/* Stock Stats */}
              {selectedQuote && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 px-4 py-2.5 bg-[var(--bg-card-inner)] border-t border-[var(--border-primary)]">
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Abertura</span>
                    <div className="font-mono text-sm text-[var(--text-primary)]">
                      {formatCurrency(selectedQuote.open, false, { sourceCurrency })}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Máxima</span>
                    <div className="font-mono text-sm text-[var(--accent-green)]">
                      {formatCurrency(selectedQuote.high, false, { sourceCurrency })}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Mínima</span>
                    <div className="font-mono text-sm text-[var(--accent-red)]">
                      {formatCurrency(selectedQuote.low, false, { sourceCurrency })}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Fechamento anterior</span>
                    <div className="font-mono text-sm text-[var(--text-primary)]">
                      {formatCurrency(selectedQuote.previousClose, false, { sourceCurrency })}
                    </div>
                  </div>
                </div>
              )}

              {/* Holding info */}
              {selectedHolding && (
                <div className="px-5 py-3 border-t border-[var(--border-primary)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">Sua posição</span>
                    <div className="text-right">
                      <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
                        {selectedHolding.shares} ações
                      </span>
                      <span className="text-[var(--text-muted)] mx-2">&bull;</span>
                      <span className="font-mono text-sm text-[var(--text-muted)]">
                        {formatCurrency(selectedHolding.shares * currentPrice, false, { sourceCurrency })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Price Chart */}
            <StockChart symbol={selectedSymbol} />

          </div>

          {/* Right Panel - Order Form */}
          <aside aria-label="Painel de ordens" className="trade-order-panel w-full min-w-0 flex flex-col gap-3 lg:sticky lg:top-3">
            {/* Order Form */}
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-primary)] flex flex-col gap-4 shadow-[0_10px_30px_rgba(0,0,0,.045)]">
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.14em] text-[var(--text-muted)]">Boleta de negociação</p><h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">Nova ordem · {displaySymbol(selectedSymbol)}</h2></div><span className="rounded-md bg-[var(--bg-muted)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">Mercado</span></div>
              {/* Saldo disponível */}
              <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card-inner)] p-2.5" aria-live="polite">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Saldo disponível (USD)</span>
                  <button type="button" onClick={() => void refreshPositions()} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Atualizar saldo disponível">Atualizar</button>
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-[var(--text-primary)] tabular-nums">
                  {marginBalance === null ? "Carregando…" : formatCurrency(marginBalance, false, { convertFromUSD: false })}
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Saldo disponível para margem das operações</p>
              </div>

              {/* Buy/Sell Toggle */}
              <div className="flex p-1 rounded-lg bg-[var(--bg-card-inner)]">
                <button
                  onClick={() => setOrderType("BUY")}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                    orderType === "BUY"
                      ? "bg-[var(--accent-green)] text-black shadow-lg"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Comprar
                </button>
                <button
                  onClick={() => setOrderType("SELL")}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                    orderType === "SELL"
                      ? "bg-[var(--accent-red)] text-white shadow-lg"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Vender
                </button>
              </div>

              {/* Market Closed Banner (only for market orders) */}
              {!marketStatus.isOpen && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F59E0B20] border border-[#F59E0B40]">
                  <Clock size={16} className="text-[#F59E0B] shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-[#F59E0B]">Mercado fechado</span>
                    <p className="text-xs text-[#F59E0B]/80 mt-0.5">{marketStatus.reason}</p>
                  </div>
                </div>
              )}

              {/* Exact margin, leverage and optional exit price levels */}
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                  Margem (USD)
                  <input type="number" min="0.01" step="0.01" value={marginInput} onChange={(e) => setMarginInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-muted)] bg-transparent font-mono text-base text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                  Alavancagem (1–100x)
                  <select value={leverage} onChange={(e) => setLeverage(Number(e.target.value))}
                    className="p-2 rounded-lg border border-[var(--border-muted)] bg-[var(--bg-card)] text-[var(--text-primary)]">
                    {[1, 2, 5, 10, 20, 25, 50, 100].map(value => <option key={value} value={value}>{value}x</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                    Stop Loss (%)
                    <input type="number" min="0.01" step="0.01" placeholder="Ex.: 2" value={stopLossInput} onChange={(e) => setStopLossInput(e.target.value)}
                      className="min-w-0 w-full px-2 py-2 rounded-lg border border-[var(--border-muted)] bg-transparent font-mono text-sm text-[var(--text-primary)]" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
                    Take Profit (%)
                    <input type="number" min="0.01" step="0.01" placeholder="Ex.: 5" value={takeProfitInput} onChange={(e) => setTakeProfitInput(e.target.value)}
                      className="min-w-0 w-full px-2 py-2 rounded-lg border border-[var(--border-muted)] bg-transparent font-mono text-sm text-[var(--text-primary)]" />
                  </label>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">Percentual de variação do preço do ativo (não da margem). A alavancagem amplia o resultado sobre a margem.</p>
                {(stopLoss !== null || takeProfit !== null) && currentPrice > 0 && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {stopLoss !== null && validStopLoss ? `SL estimado: ${formatCurrency(stopLoss, false, { sourceCurrency })}` : ""}
                    {stopLoss !== null && takeProfit !== null && validStopLoss && validTakeProfit ? " · " : ""}
                    {takeProfit !== null && validTakeProfit ? `TP estimado: ${formatCurrency(takeProfit, false, { sourceCurrency })}` : ""}
                  </p>
                )}
                {(!validStopLoss || !validTakeProfit) && <p className="text-xs text-[var(--accent-red)]">Informe percentuais positivos que resultem em preços válidos para a operação.</p>}
                <div className="flex gap-2">
                  {[0.25, 0.5, 0.75, 1].map(pct => <button key={pct} type="button" onClick={() => setMarginPercent(pct)}
                    className="flex-1 py-1.5 rounded-md text-[11px] bg-[var(--bg-card-inner)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]">{pct * 100}%</button>)}
                </div>
              </div>

              {/* Secondary calculations stay accessible without competing with order entry. */}
              <details className="group rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card-inner)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-xs font-semibold text-[var(--text-secondary)] marker:hidden">
                  Detalhes e projeções da ordem
                  <ChevronDown size={15} className="text-[var(--text-muted)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-[var(--border-primary)] px-3 py-2">
              {/* Order Summary */}
              <div className="flex flex-col gap-0 border-y border-[var(--border-primary)]">
                <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-primary)]">
                  <span className="text-xs text-[var(--text-muted)]">
                    Preço de mercado
                  </span>
                  <span className="font-mono text-xs text-[var(--text-primary)]">
                    {formatCurrency(effectivePrice, false, { sourceCurrency })}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-primary)]">
                  <span className="text-xs text-[var(--text-muted)]">Quantidade estimada</span>
                  <span className="font-mono text-xs text-[var(--text-primary)]">
                    {quantity > 0 ? quantity.toFixed(8) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--border-primary)]">
                  <span className="text-xs text-[var(--text-muted)]">Possível lucro ({hasProjectedProfitTarget ? "Take Profit" : "alta favorável de 1%"})</span>
                  <span className="font-mono text-xs font-bold text-[var(--accent-green)]">+{formatCurrency(projectedProfit, false, { convertFromUSD: false })}</span>
                </div>
                <div className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--border-primary)]">
                  <span className="text-xs text-[var(--text-muted)]">Possível prejuízo ({hasProjectedLossTarget ? "Stop Loss" : "queda desfavorável de 1%"})</span>
                  <span className="font-mono text-xs font-bold text-[var(--accent-red)]">-{formatCurrency(projectedLoss, false, { convertFromUSD: false })}</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[var(--border-primary)]">
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    Margem estimada
                  </span>
                  <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                    {formatCurrency(estimatedMargin, false, { sourceCurrency })}
                  </span>
                </div>
              </div>

                </div>
              </details>

              {/* Available Balance */}
              <div className="hidden items-center justify-between text-xs py-1">
                <span className="text-[var(--text-muted)]">
                  Margem disponível (USD)
                </span>
                <span className="font-mono text-[var(--text-primary)]">
                  {marginBalance === null ? "—" : formatCurrency(marginBalance, false, { convertFromUSD: false })}
                </span>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handleTradeClick}
                disabled={!canTrade}
                className={`w-full py-4 rounded-lg text-sm font-bold transition-all ${
                  canTrade
                    ? orderType === "BUY"
                      ? "bg-[var(--accent-green)] text-black hover:brightness-110 shadow-lg shadow-[var(--accent-green)]/20"
                      : "bg-[var(--accent-red)] text-white hover:brightness-110 shadow-lg shadow-[var(--accent-red)]/20"
                    : "bg-[var(--bg-muted)] text-[var(--text-muted)] cursor-not-allowed"
                }`}
              >
                {getButtonText()}
              </button>
              <p className="text-[10px] leading-4 text-[var(--text-muted)]">Ambiente de demonstração: as ordens não são encaminhadas a uma bolsa.</p>
            </div>


          </aside>
        </div>
        <div className="w-full min-w-0 shrink-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Acompanhamento</p><h2 className="mt-1 text-base font-semibold text-[var(--text-primary)]">Posições e histórico</h2></div><span className="text-xs text-[var(--text-muted)]">{positions.filter(p => p.status === "OPEN").length} posições abertas</span></div>
            {/* Positions tab: the same positions opened by the Buy/Sell ticket. */}
            <section id="trade-positions" className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-3">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setPositionsTab("OPEN")} className={`text-sm font-semibold pb-1 ${positionsTab === "OPEN" ? "text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}>
                    Posições ({positions.filter(p => p.status === "OPEN").length})
                  </button>
                  <button type="button" onClick={() => setPositionsTab("CLOSED")} className={`text-sm font-semibold pb-1 ${positionsTab === "CLOSED" ? "text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}>
                    Histórico
                  </button>
                </div>
                <button type="button" onClick={() => void refreshPositions()} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Atualizar</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] text-xs text-left">
                  <thead className="text-[var(--text-muted)] bg-[var(--bg-card-inner)]">
                    <tr>
                      {["Ativo", "Direção", "Quantidade", "Entrada", "Alavancagem", "Margem", "Mercado", "Lucro/Prejuízo", "Ação"].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.filter(p => p.status === positionsTab).map(p => {
                      const pnl = p.status === "OPEN" ? p.unrealizedPnl : p.realizedPnl;
                      return (
                        <tr key={p.id} className="border-t border-[var(--border-primary)] text-[var(--text-primary)]">
                          <td className="px-3 py-3 font-semibold">{p.symbol}</td>
                          <td className={`px-3 py-3 font-semibold ${p.side === "LONG" ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{p.side === "LONG" ? "BUY" : "SELL"}</td>
                          <td className="px-3 py-3 font-mono">{p.quantity}</td>
                          <td className="px-3 py-3 font-mono">${p.entryPrice.toFixed(2)}</td>
                          <td className="px-3 py-3">{p.leverage}x</td>
                          <td className="px-3 py-3 font-mono">${p.margin.toFixed(2)}</td>
                          <td className="px-3 py-3 font-mono">{p.marketPrice === undefined ? (p.exitPrice === null ? "—" : `${p.exitPrice.toFixed(2)}`) : `${p.marketPrice.toFixed(2)}`}</td>
                          <td className={`px-3 py-3 font-mono ${pnl === undefined || pnl === null ? "" : pnl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{pnl === undefined || pnl === null ? "—" : `${pnl.toFixed(2)}`}</td>
                          <td className="px-3 py-3">
                            {p.status === "OPEN" ? <button type="button" disabled={closingPositionId !== null} onClick={() => void closeSimulatedPosition(p.id)} className="rounded border border-[var(--border-primary)] px-2 py-1 hover:bg-[var(--bg-muted)] disabled:opacity-50">{closingPositionId === p.id ? "Encerrando…" : "Encerrar"}</button> : <span className="text-[var(--text-muted)]">Encerrada</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {positions.filter(p => p.status === positionsTab).length === 0 && <p className="p-5 text-sm text-[var(--text-muted)]">Nenhuma {positionsTab === "OPEN" ? "posição aberta" : "posição encerrada"}.</p>}
              </div>
            </section>

        </div>
      </main>

      {/* Confirm Trade Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-[var(--bg-card)] rounded-xl p-5 sm:p-6 w-full max-w-[420px] max-h-[90vh] overflow-y-auto border border-[var(--border-primary)] shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-[var(--accent-primary)]" />
                <span className="text-base font-semibold text-[var(--text-primary)]">
                  Confirmar operação alavancada
                </span>
              </div>
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="p-1 rounded-md hover:bg-[var(--bg-muted)] transition-colors"
              >
                <X size={18} className="text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--bg-card-inner)] mb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Ação</span>
                <span className={`text-sm font-semibold ${orderType === "BUY" ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                  {orderType}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Ativo</span>
                <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{selectedSymbol}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Tipo de ordem</span>
                <span className="text-sm text-[var(--text-primary)]">LEVERAGED MARKET · {leverage}x</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">
                  Preço de mercado
                </span>
                <span className="font-mono text-sm text-[var(--text-primary)]">
                  {formatCurrency(effectivePrice, false, { sourceCurrency })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Quantidade estimada</span>
                <span className="font-mono text-sm text-[var(--text-primary)]">{quantity.toFixed(8)}</span>
              </div>
              <div className="flex items-center justify-between"><span className="text-sm text-[var(--text-muted)]">Stop Loss / Take Profit</span><span className="font-mono text-xs text-[var(--text-primary)]">{stopLossInput || "—"} / {takeProfitInput || "—"}</span></div>
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-[var(--text-muted)]">Possível lucro ({hasProjectedProfitTarget ? "TP" : "1%"} )</span><span className="font-mono text-[var(--accent-green)]">+{formatCurrency(projectedProfit, false, { convertFromUSD: false })}</span></div>
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-[var(--text-muted)]">Possível prejuízo ({hasProjectedLossTarget ? "SL" : "1%"})</span><span className="font-mono text-[var(--accent-red)]">-{formatCurrency(projectedLoss, false, { convertFromUSD: false })}</span></div>
              <div className="h-px bg-[var(--border-primary)]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">Margem estimada</span>
                <span className="font-mono text-lg font-bold text-[var(--text-primary)]">
                  {formatCurrency(estimatedMargin, false, { sourceCurrency })}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-3 rounded-lg bg-[var(--bg-muted)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeTradeOrOrder}
                disabled={submitting || !canTrade}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                  orderType === "BUY"
                    ? "bg-[var(--accent-green)] text-black hover:brightness-110"
                    : "bg-[var(--accent-red)] text-white hover:brightness-110"
                }`}
              >
                Confirmar {orderType === "BUY" ? "compra" : "venda"} · {leverage}x
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

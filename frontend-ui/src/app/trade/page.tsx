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
import { stockAPI, userAPI, StockQuote, SearchResult, SimulatedPosition } from "@/lib/api";

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
    transactions,
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
  const [selectedSymbol, setSelectedSymbol] = useState(market === "IN" ? "RELIANCE.NS" : "AAPL");
  const [selectedQuote, setSelectedQuote] = useState<StockQuote | null>(null);
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState(1);
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
    if (!window.confirm("Encerrar esta posição simulada pelo preço atual?")) return;
    setClosingPositionId(id);
    try {
      await userAPI.closePosition(id);
      setMessage({ type: "success", text: "Posição simulada encerrada." });
      await refreshPositions();
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
  const estimatedTotal = quantity * effectivePrice;
  const sourceCurrency = selectedQuote?.currency || getStockBySymbol(selectedSymbol)?.currency || 'USD';

  // Recent transactions
  const recentTrades = transactions.slice(0, 5);


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
    const defaultSymbol = market === "IN" ? "RELIANCE.NS" : "AAPL";
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
    setSelectedSymbol(result.symbol);
    setSelectedQuote(null);
    setSearchQuery("");
    setShowSearchResults(false);
    setQuantity(1);
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
        quantity,
        leverage,
      });
      setMessage({ type: "success", text: `${orderType} ${quantity} ${selectedSymbol} · ${leverage}x — posição simulada aberta` });
      setQuantity(1);
      await refreshPositions();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Falha ao abrir posição simulada." });
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedMargin = leverage > 0 ? estimatedTotal / leverage : Infinity;
  const canTrade = marketStatus.isOpen && sourceCurrency === "USD" && Number.isFinite(quantity) && quantity > 0 &&
    Number.isFinite(leverage) && leverage >= 1 && leverage <= 100 && currentPrice > 0 &&
    marginBalance !== null && estimatedMargin > 0 && estimatedMargin <= marginBalance && !submitting;

  const setQuantityPercent = (percent: number) => {
    if (currentPrice <= 0 || marginBalance === null) return;
    const maxShares = Math.floor((marginBalance * leverage * percent) / currentPrice);
    setQuantity(Math.max(1, maxShares));
  };

  const getButtonText = () => {
    if (!marketStatus.isOpen) return `${marketStatus.marketName} Market Closed`;
    if (sourceCurrency !== "USD") return "Only USD assets supported";
    if (marginBalance === null) return "Loading margin balance";
    if (estimatedMargin > marginBalance) return "Insufficient Margin";
    return `${orderType} ${quantity} ${selectedSymbol} · ${leverage}x`;
  };

  return (
    <div className="flex h-full bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 flex flex-col gap-6 py-8 px-10 overflow-auto">
        <PageHeader
          title="Trade"
          subtitle="Search any stock or crypto to start trading"
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
        <div className="flex gap-6 items-start shrink-0 min-w-0">
          {/* Left Panel - Stock Selection */}
          <div className="flex-1 min-w-0 flex flex-col gap-5">
            {/* Search Bar */}
            <div className="relative">
              <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] focus-within:border-[var(--accent-primary)] transition-colors">
                <Search size={20} className="text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  placeholder="Search by name or symbol (e.g., AAPL, Tesla, BTC)..."
                  className="flex-1 bg-transparent text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
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
                        No results for &quot;{searchQuery}&quot;
                      </span>
                      <span className="text-xs text-[var(--text-dim)] mt-1">
                        Try a different symbol
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Stock Card */}
            <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-primary)]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                      {selectedSymbol}
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
                  <div className="font-mono text-3xl font-bold text-[var(--text-primary)]">
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
                <div className="grid grid-cols-4 gap-4 pt-4 border-t border-[var(--border-primary)]">
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Open</span>
                    <div className="font-mono text-sm text-[var(--text-primary)]">
                      {formatCurrency(selectedQuote.open, false, { sourceCurrency })}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">High</span>
                    <div className="font-mono text-sm text-[var(--accent-green)]">
                      {formatCurrency(selectedQuote.high, false, { sourceCurrency })}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Low</span>
                    <div className="font-mono text-sm text-[var(--accent-red)]">
                      {formatCurrency(selectedQuote.low, false, { sourceCurrency })}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Prev Close</span>
                    <div className="font-mono text-sm text-[var(--text-primary)]">
                      {formatCurrency(selectedQuote.previousClose, false, { sourceCurrency })}
                    </div>
                  </div>
                </div>
              )}

              {/* Holding info */}
              {selectedHolding && (
                <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-muted)]">Your Position</span>
                    <div className="text-right">
                      <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
                        {selectedHolding.shares} shares
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
          <div className="w-[380px] shrink-0 flex flex-col gap-5">
            {/* Order Form */}
            <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-primary)] flex flex-col gap-5">
              {/* Buy/Sell Toggle */}
              <div className="flex p-1 rounded-lg bg-[var(--bg-card-inner)]">
                <button
                  onClick={() => setOrderType("BUY")}
                  className={`flex-1 py-3 rounded-md text-sm font-semibold transition-all ${
                    orderType === "BUY"
                      ? "bg-[var(--accent-green)] text-black shadow-lg"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setOrderType("SELL")}
                  className={`flex-1 py-3 rounded-md text-sm font-semibold transition-all ${
                    orderType === "SELL"
                      ? "bg-[var(--accent-red)] text-white shadow-lg"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Market Closed Banner (only for market orders) */}
              {!marketStatus.isOpen && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#F59E0B20] border border-[#F59E0B40]">
                  <Clock size={16} className="text-[#F59E0B] shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-[#F59E0B]">Market Closed</span>
                    <p className="text-xs text-[#F59E0B]/80 mt-0.5">{marketStatus.reason}</p>
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    Quantity
                  </span>

                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 rounded-lg bg-[var(--bg-card-inner)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 px-4 py-3 rounded-lg border border-[var(--border-muted)] bg-transparent font-mono text-lg text-center text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-12 rounded-lg bg-[var(--bg-card-inner)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">Leverage (1–100x)
                  <select value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="p-3 rounded-lg border border-[var(--border-muted)] bg-[var(--bg-card)] text-[var(--text-primary)]">
                    {[1, 2, 5, 10, 20, 25, 50, 100].map((value) => <option key={value} value={value}>{value}x</option>)}
                  </select>
                </label>

                {/* Quick Quantity Buttons */}
                <div className="flex gap-2 mt-1">
                  {[0.25, 0.5, 0.75, 1].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setQuantityPercent(pct)}
                      className="flex-1 py-1.5 rounded-md text-[11px] font-medium bg-[var(--bg-card-inner)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="flex flex-col gap-3 p-4 rounded-lg bg-[var(--bg-card-inner)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">
                    Market Price
                  </span>
                  <span className="font-mono text-sm text-[var(--text-primary)]">
                    {formatCurrency(effectivePrice, false, { sourceCurrency })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-muted)]">Quantity</span>
                  <span className="font-mono text-sm text-[var(--text-primary)]">
                    {quantity}
                  </span>
                </div>
                <div className="h-px bg-[var(--border-primary)]" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Estimated Margin
                  </span>
                  <span className="font-mono text-lg font-bold text-[var(--text-primary)]">
                    {formatCurrency(estimatedMargin, false, { sourceCurrency })}
                  </span>
                </div>
              </div>

              {/* Available Balance */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)]">
                  Available Margin (USD)
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
            </div>

            {/* Pending Orders */}
            {/* Recent Trades */}
            <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-primary)] flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={14} className="text-[var(--text-muted)]" />
                <span className="text-[10px] font-bold tracking-[1px] text-[var(--text-muted)]">
                  RECENT TRADES
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {recentTrades.length > 0 ? (
                  recentTrades.map((trade) => (
                    <div
                      key={trade.id}
                      className={`flex items-center justify-between border-b border-[var(--border-primary)] last:border-0 ${settings.compactMode ? "py-1.5" : "py-2"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            trade.type === "BUY"
                              ? "bg-[#22C55E20] text-[var(--accent-green)]"
                              : "bg-[#EF444420] text-[var(--accent-red)]"
                          }`}
                        >
                          {trade.type}
                        </span>
                        <span className="font-mono text-sm text-[var(--text-primary)]">
                          {trade.symbol}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-[var(--text-primary)]">
                          {trade.shares} @ {formatCurrency(trade.price)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm text-[var(--text-muted)]">
                    No recent trades
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="w-full min-w-0 shrink-0 space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Positions &amp; Trade History</h2>
            {/* Positions tab: the same positions opened by the Buy/Sell ticket. */}
            <section id="trade-positions" className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-3">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setPositionsTab("OPEN")} className={`text-sm font-semibold pb-1 ${positionsTab === "OPEN" ? "text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}>
                    Positions ({positions.filter(p => p.status === "OPEN").length})
                  </button>
                  <button type="button" onClick={() => setPositionsTab("CLOSED")} className={`text-sm font-semibold pb-1 ${positionsTab === "CLOSED" ? "text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}>
                    History
                  </button>
                </div>
                <button type="button" onClick={() => void refreshPositions()} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Refresh</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[740px] text-xs text-left">
                  <thead className="text-[var(--text-muted)] bg-[var(--bg-card-inner)]">
                    <tr>
                      {["Symbol", "Side", "Quantity", "Entry", "Leverage", "Margin", "Market", "P&L", "Action"].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}
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
                            {p.status === "OPEN" ? <button type="button" disabled={closingPositionId !== null} onClick={() => void closeSimulatedPosition(p.id)} className="rounded border border-[var(--border-primary)] px-2 py-1 hover:bg-[var(--bg-muted)] disabled:opacity-50">{closingPositionId === p.id ? "Closing…" : "Close"}</button> : <span className="text-[var(--text-muted)]">Closed</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {positions.filter(p => p.status === positionsTab).length === 0 && <p className="p-5 text-sm text-[var(--text-muted)]">No {positionsTab === "OPEN" ? "open positions" : "closed positions"}.</p>}
              </div>
            </section>

        </div>
      </main>

      {/* Confirm Trade Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] rounded-xl p-6 w-[400px] border border-[var(--border-primary)] shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-[var(--accent-primary)]" />
                <span className="text-base font-semibold text-[var(--text-primary)]">
                  Confirm Leveraged Trade
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
                <span className="text-sm text-[var(--text-muted)]">Action</span>
                <span className={`text-sm font-semibold ${orderType === "BUY" ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                  {orderType}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Symbol</span>
                <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{selectedSymbol}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Order Type</span>
                <span className="text-sm text-[var(--text-primary)]">LEVERAGED MARKET · {leverage}x</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">
                  Market Price
                </span>
                <span className="font-mono text-sm text-[var(--text-primary)]">
                  {formatCurrency(effectivePrice, false, { sourceCurrency })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-muted)]">Quantity</span>
                <span className="font-mono text-sm text-[var(--text-primary)]">{quantity}</span>
              </div>
              <div className="h-px bg-[var(--border-primary)]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">Estimated Margin</span>
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
                Cancel
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
                Confirm {orderType === "BUY" ? "Buy" : "Sell"} · {leverage}x
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

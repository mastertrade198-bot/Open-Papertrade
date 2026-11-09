/**
 * Public Binance spot stream for supported USD-equivalent USDT crypto pairs.
 * Updates are indicative USDT prices, NOT executable USD quotes.
 * Unsupported symbols keep their backend-cached quotes.
 */
import type { StockQuote } from "./api";

const SUPPORTED = new Set("BTC ETH SOL XRP BNB ADA DOGE AVAX LINK SHIB DOT LTC BCH UNI AAVE ATOM NEAR ICP FIL ETC XLM ALGO HBAR PEPE".split(" "));
export type StreamPrice = Pick<StockQuote, "symbol" | "price" | "change" | "changePercent" | "currency" | "provider">;
export function subscribeCryptoPrices(symbols: string[], onPrices: (quotes: StreamPrice[]) => void): () => void {
  const selected = [...new Set(symbols.map(s => s.toUpperCase()))].filter(s => SUPPORTED.has(s)).slice(0, 30);
  if (!selected.length || typeof WebSocket === "undefined") return () => {};
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let attempts = 0;
  const connect = () => {
    if (closed || document.visibilityState === "hidden" || !navigator.onLine) return;
    const streams = selected.map(s => `${s.toLowerCase()}usdt@ticker`).join("/");
    socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    socket.onopen = () => { attempts = 0; };
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as { data?: { s?: string; c?: string; p?: string; P?: string } };
        const tick = message.data;
        if (!tick?.s?.endsWith("USDT")) return;
        const symbol = tick.s.slice(0, -4);
        if (!selected.includes(symbol)) return;
        const price = Number(tick.c), change = Number(tick.p), changePercent = Number(tick.P);
        if (![price, change, changePercent].every(Number.isFinite) || price <= 0) return;
        onPrices([{ symbol, price, change, changePercent, currency: "USD", provider: "Binance USDT (indicativo)" }]);
      } catch { /* Ignore malformed provider messages. */ }
    };
    socket.onclose = () => {
      if (!closed && document.visibilityState === "visible" && navigator.onLine) {
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)));
      }
    };
    socket.onerror = () => socket?.close();
  };
  const resume = () => {
    if (document.visibilityState === "hidden" || !navigator.onLine) {
      if (retry) clearTimeout(retry);
      retry = null;
      socket?.close();
    } else if (!socket || socket.readyState === WebSocket.CLOSED) {
      if (retry) clearTimeout(retry);
      retry = null;
      connect();
    }
  };
  connect();
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("online", resume);
  window.addEventListener("offline", resume);
  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("online", resume);
    window.removeEventListener("offline", resume);
    socket?.close();
  };
}

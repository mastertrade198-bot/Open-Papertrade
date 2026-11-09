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
  let endpointIndex = 0;
  let receivedTick = false;
  const endpoints = ["wss://stream.binance.com:443", "wss://data-stream.binance.vision:443", "wss://stream.binance.com:9443"];
  const connect = () => {
    if (closed || document.visibilityState === "hidden" || !navigator.onLine) return;
    const streams = selected.map(s => `${s.toLowerCase()}usdt@ticker`).join("/");
    socket = new WebSocket(`${endpoints[endpointIndex]}/stream?streams=${streams}`);
    socket.onopen = () => { attempts = 0; console.info("[Master Trade] Crypto WebSocket connected:", endpoints[endpointIndex]); };
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as { data?: { s?: string; c?: string; p?: string; P?: string } };
        const tick = message.data;
        if (!tick?.s?.endsWith("USDT")) return;
        const symbol = tick.s.slice(0, -4);
        if (!selected.includes(symbol)) return;
        const price = Number(tick.c), change = Number(tick.p), changePercent = Number(tick.P);
        if (![price, change, changePercent].every(Number.isFinite) || price <= 0) return;
        receivedTick = true;
        onPrices([{ symbol, price, change, changePercent, currency: "USD", provider: "Binance USDT (indicativo)" }]);
      } catch { /* Ignore malformed provider messages. */ }
    };
    socket.onclose = (event) => {
      if (!closed && document.visibilityState === "visible" && navigator.onLine) {
        console.warn("[Master Trade] Crypto stream disconnected:", event.code, endpoints[endpointIndex]);
        if (!receivedTick) endpointIndex = (endpointIndex + 1) % endpoints.length;
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)));
      }
    };
    socket.onerror = () => { console.warn("[Master Trade] Crypto stream connection error:", endpoints[endpointIndex]); socket?.close(); };
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

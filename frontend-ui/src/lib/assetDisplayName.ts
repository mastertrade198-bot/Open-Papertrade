/** Canonical display labels for symbols whose providers return only a ticker. */
const STOCK_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.", AMD: "Advanced Micro Devices, Inc.", AMZN: "Amazon.com, Inc.",
  BA: "The Boeing Company", DIS: "The Walt Disney Company", GOOGL: "Alphabet Inc.",
  GOOG: "Alphabet Inc.", INTC: "Intel Corporation", JPM: "JPMorgan Chase & Co.",
  KO: "The Coca-Cola Company", MA: "Mastercard Incorporated", META: "Meta Platforms, Inc.",
  MSFT: "Microsoft Corporation", NFLX: "Netflix, Inc.", NVDA: "NVIDIA Corporation",
  ORCL: "Oracle Corporation", PEP: "PepsiCo, Inc.", PLTR: "Palantir Technologies Inc.",
  PYPL: "PayPal Holdings, Inc.", QQQ: "Invesco QQQ Trust", SPY: "SPDR S&P 500 ETF Trust",
  TSLA: "Tesla, Inc.", UBER: "Uber Technologies, Inc.", V: "Visa Inc.",
  CRM: "Salesforce, Inc.", BRK_B: "Berkshire Hathaway Inc.",
};

export function resolveAssetDisplayName(symbol: string, name?: string | null): string {
  const ticker = symbol.trim().toUpperCase();
  const label = name?.trim();
  if (label && label.toUpperCase() !== ticker) return label;
  return STOCK_NAMES[ticker.replace(".", "_")] || label || ticker;
}

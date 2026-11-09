/** Human-readable labels when market providers supply ticker codes as names. */
const STOCK_NAMES: Record<string, string> = {
  AAL: "American Airlines Group", AAPL: "Apple Inc.", ABBV: "AbbVie Inc.",
  ABNB: "Airbnb, Inc.", ADBE: "Adobe Inc.", AMD: "Advanced Micro Devices",
  AMZN: "Amazon.com, Inc.", AVGO: "Broadcom Inc.", BAC: "Bank of America",
  BA: "The Boeing Company", BABA: "Alibaba Group", CAT: "Caterpillar Inc.",
  COST: "Costco Wholesale", CRM: "Salesforce, Inc.", CSCO: "Cisco Systems",
  CVX: "Chevron Corporation", DIS: "The Walt Disney Company",
  GOOGL: "Alphabet Inc.", GOOG: "Alphabet Inc.", HD: "The Home Depot",
  INTC: "Intel Corporation", JNJ: "Johnson & Johnson", JPM: "JPMorgan Chase & Co.",
  KO: "The Coca-Cola Company", MA: "Mastercard Incorporated",
  META: "Meta Platforms, Inc.", MSFT: "Microsoft Corporation",
  NFLX: "Netflix, Inc.", NKE: "Nike, Inc.", NVDA: "NVIDIA Corporation",
  ORCL: "Oracle Corporation", PEP: "PepsiCo, Inc.", PFE: "Pfizer Inc.",
  PLTR: "Palantir Technologies Inc.", PYPL: "PayPal Holdings, Inc.",
  QCOM: "Qualcomm Incorporated", QQQ: "Invesco QQQ Trust",
  SHOP: "Shopify Inc.", SPY: "SPDR S&P 500 ETF Trust", SQ: "Block, Inc.",
  T: "AT&T Inc.", TSM: "Taiwan Semiconductor Manufacturing",
  TSLA: "Tesla, Inc.", UBER: "Uber Technologies, Inc.", UNH: "UnitedHealth Group",
  V: "Visa Inc.", VZ: "Verizon Communications", WMT: "Walmart Inc.",
  XOM: "Exxon Mobil Corporation", BRK_B: "Berkshire Hathaway Inc.",
};
const CRYPTO_NAMES: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", ADA: "Cardano", AVAX: "Avalanche",
  SOL: "Solana", XRP: "XRP", DOGE: "Dogecoin", BNB: "BNB",
  DOT: "Polkadot", LTC: "Litecoin", LINK: "Chainlink", UNI: "Uniswap",
  ATOM: "Cosmos", BCH: "Bitcoin Cash", XLM: "Stellar", TRX: "TRON",
  NEAR: "NEAR Protocol", APT: "Aptos", SUI: "Sui", FIL: "Filecoin",
  ETC: "Ethereum Classic", SHIB: "Shiba Inu", PEPE: "Pepe",
};

export function resolveAssetDisplayName(symbol: string, name?: string | null): string {
  const ticker = symbol.trim().toUpperCase();
  const label = name?.trim();
  const base = ticker.replace(/[-/](USD|USDT|USDC)$/i, "");
  const known = STOCK_NAMES[ticker.replace(".", "_")] || CRYPTO_NAMES[base];
  // Providers sometimes return the quote pair or the base symbol as its name.
  if (known && (!label || label.toUpperCase() === ticker || label.toUpperCase() === base || /^[A-Z0-9]+[-/](USD|USDT|USDC)$/i.test(label))) return known;
  if (label && label.toUpperCase() !== ticker && label.toUpperCase() !== base) return label;
  return known || label || ticker;
}

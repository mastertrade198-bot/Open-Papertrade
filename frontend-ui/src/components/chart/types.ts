import { Time } from "lightweight-charts";

export type ChartMode = "candlestick" | "bar" | "line" | "area" | "heikinAshi";

export type Timeframe = "1D" | "1W" | "1M" | "6M" | "1Y" | "5Y";

export type IndicatorId =
  | "ma20"
  | "ma50"
  | "ma200"
  | "ema9"
  | "ema21"
  | "bollinger"
  | "vwap"
  | "volume"
  | "rsi"
  | "macd"
  | "stochastic"
  | "atr"
  | "obv";

export interface IndicatorMeta {
  id: IndicatorId;
  label: string;
  shortLabel: string;
  description: string;
  pane: "main" | "sub";
  color: string;
  category: "trend" | "momentum" | "volume" | "volatility";
  /** Minimum number of bars required to compute the first indicator value. */
  minBars: number;
}

export const INDICATOR_CATALOG: Record<IndicatorId, IndicatorMeta> = {
  ma20: {
    id: "ma20",
    label: "Média móvel simples (20)",
    shortLabel: "MA20",
    description: "Média simples dos últimos 20 candles",
    pane: "main",
    color: "#FFD700",
    category: "trend",
    minBars: 20,
  },
  ma50: {
    id: "ma50",
    label: "Média móvel simples (50)",
    shortLabel: "MA50",
    description: "Média simples dos últimos 50 candles",
    pane: "main",
    color: "#FF8C00",
    category: "trend",
    minBars: 50,
  },
  ma200: {
    id: "ma200",
    label: "Média móvel simples (200)",
    shortLabel: "MA200",
    description: "Média simples dos últimos 200 candles",
    pane: "main",
    color: "#FF4500",
    category: "trend",
    minBars: 200,
  },
  ema9: {
    id: "ema9",
    label: "Média móvel exponencial (9)",
    shortLabel: "EMA9",
    description: "Média exponencial dos últimos 9 candles",
    pane: "main",
    color: "#00E5FF",
    category: "trend",
    minBars: 9,
  },
  ema21: {
    id: "ema21",
    label: "Média móvel exponencial (21)",
    shortLabel: "EMA21",
    description: "Média exponencial dos últimos 21 candles",
    pane: "main",
    color: "#7C4DFF",
    category: "trend",
    minBars: 21,
  },
  bollinger: {
    id: "bollinger",
    label: "Bandas de Bollinger",
    shortLabel: "BOLL",
    description: "Bandas de 20 períodos e 2 desvios-padrão",
    pane: "main",
    color: "#9CA3AF",
    category: "volatility",
    minBars: 20,
  },
  vwap: {
    id: "vwap",
    label: "VWAP",
    shortLabel: "VWAP",
    description: "Preço médio ponderado por volume na sessão",
    pane: "main",
    color: "#EC4899",
    category: "volume",
    minBars: 1,
  },
  volume: {
    id: "volume",
    label: "Volume",
    shortLabel: "VOL",
    description: "Histograma do volume negociado",
    pane: "sub",
    color: "#6B7280",
    category: "volume",
    minBars: 1,
  },
  rsi: {
    id: "rsi",
    label: "Índice de Força Relativa (IFR)",
    shortLabel: "RSI",
    description: "IFR de 14 períodos, com níveis de 30 e 70",
    pane: "sub",
    color: "#A855F7",
    category: "momentum",
    minBars: 15,
  },
  macd: {
    id: "macd",
    label: "MACD",
    shortLabel: "MACD",
    description: "Convergência e divergência de médias móveis (12, 26, 9)",
    pane: "sub",
    color: "#06B6D4",
    category: "momentum",
    minBars: 35,
  },
  stochastic: {
    id: "stochastic",
    label: "Oscilador estocástico",
    shortLabel: "STOCH",
    description: "Oscilador estocástico de 14 períodos, suavização 3",
    pane: "sub",
    color: "#F59E0B",
    category: "momentum",
    minBars: 17,
  },
  atr: {
    id: "atr",
    label: "Amplitude média verdadeira (ATR)",
    shortLabel: "ATR",
    description: "Medida de volatilidade de 14 períodos",
    pane: "sub",
    color: "#10B981",
    category: "volatility",
    minBars: 15,
  },
  obv: {
    id: "obv",
    label: "Volume acumulado (OBV)",
    shortLabel: "OBV",
    description: "Volume acumulado conforme a direção dos fechamentos",
    pane: "sub",
    color: "#F97316",
    category: "volume",
    minBars: 2,
  },
};

export type DrawingTool =
  | "cursor"
  | "trendline"
  | "horizontalLine"
  | "verticalLine"
  | "rectangle"
  | "fibonacci"
  | "text";

export interface DrawingBase {
  id: string;
  tool: DrawingTool;
  color: string;
}

export interface PricePoint {
  time: Time;
  price: number;
}

export interface TrendlineDrawing extends DrawingBase {
  tool: "trendline";
  start: PricePoint;
  end: PricePoint;
}

export interface HorizontalLineDrawing extends DrawingBase {
  tool: "horizontalLine";
  price: number;
}

export interface VerticalLineDrawing extends DrawingBase {
  tool: "verticalLine";
  time: Time;
}

export interface RectangleDrawing extends DrawingBase {
  tool: "rectangle";
  start: PricePoint;
  end: PricePoint;
}

export interface FibonacciDrawing extends DrawingBase {
  tool: "fibonacci";
  start: PricePoint;
  end: PricePoint;
}

export interface TextDrawing extends DrawingBase {
  tool: "text";
  point: PricePoint;
  text: string;
}

export type Drawing =
  | TrendlineDrawing
  | HorizontalLineDrawing
  | VerticalLineDrawing
  | RectangleDrawing
  | FibonacciDrawing
  | TextDrawing;

export interface ChartState {
  symbol: string;
  timeframe: Timeframe;
  mode: ChartMode;
  logScale: boolean;
  indicators: IndicatorId[];
  drawings: Drawing[];
}

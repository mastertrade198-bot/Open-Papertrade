"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, BarChart3, LineChart, AreaChart } from "lucide-react";
import { stockAPI, HistoricalBar, TimeRange } from "@/lib/api";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  AreaData,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  ColorType,
  CrosshairMode,
  Time,
  SeriesType,
} from "lightweight-charts";

type ChartType = "candlestick" | "line" | "area";

const TIME_RANGES: TimeRange[] = ["1D", "1W", "1M", "6M", "1Y", "5Y"];

interface StockChartProps {
  symbol: string;
}

export default function StockChart({ symbol }: StockChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [bars, setBars] = useState<HistoricalBar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sma20, setSma20] = useState(false);
  const [sma50, setSma50] = useState(false);
  const [lineMode, setLineMode] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  useEffect(() => { setLevels([]); setLineMode(false); }, [symbol]);

  // Fetch data — clear bars immediately so stale data doesn't render
  // with a new timeRange (which would cause a format mismatch → NaN times).
  const fetchHistory = useCallback(async () => {
    setBars([]);
    setIsLoading(true);
    try {
      const result = await stockAPI.getHistory(symbol, timeRange);
      if (result.success && result.bars.length > 0) {
        setBars(result.bars);
      } else {
        setBars([]);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
      setBars([]);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Render chart
  useEffect(() => {
    if (!chartContainerRef.current || bars.length === 0) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const container = chartContainerRef.current;

    // Detect format from the data itself (not timeRange) to avoid stale-state mismatches.
    // Intraday bars have pure-digit Unix timestamps; daily bars have "YYYY-MM-DD" strings.
    const isIntraday = bars.length > 0 && /^\d+$/.test(bars[0].time);

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9db0c3",
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "rgba(95, 155, 255, 0.45)", width: 1, style: 2 },
        horzLine: { color: "rgba(255, 92, 0, 0.3)", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: isIntraday,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    const formatTime = (bar: HistoricalBar): Time => {
      if (isIntraday) {
        return Number(bar.time) as Time;
      }
      return bar.time as Time;
    };

    if (chartType === "candlestick") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#26c7a2",
        downColor: "#f36b78",
        borderUpColor: "#26c7a2",
        borderDownColor: "#f36b78",
        wickUpColor: "#26c7a2",
        wickDownColor: "#f36b78",
      });
      const data: CandlestickData[] = bars.map((bar) => ({
        time: formatTime(bar),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));
      series.setData(data);
      seriesRef.current = series;
    } else if (chartType === "line") {
      const series = chart.addSeries(LineSeries, {
        color: "#528bff",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: "#528bff",
      });
      const data: LineData[] = bars.map((bar) => ({
        time: formatTime(bar),
        value: bar.close,
      }));
      series.setData(data);
      seriesRef.current = series;
    } else {
      const series = chart.addSeries(AreaSeries, {
        topColor: "rgba(255, 92, 0, 0.4)",
        bottomColor: "rgba(255, 92, 0, 0.02)",
        lineColor: "#528bff",
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: "#528bff",
      });
      const data: AreaData[] = bars.map((bar) => ({
        time: formatTime(bar),
        value: bar.close,
      }));
      series.setData(data);
      seriesRef.current = series;
    }

    // Optional moving averages, calculated from historical close prices.
    const addSma = (period: number, color: string) => {
      if (bars.length < period) return;
      const values: LineData[] = [];
      let sum = 0;
      for (let i = 0; i < bars.length; i++) {
        sum += bars[i].close;
        if (i >= period) sum -= bars[i - period].close;
        if (i >= period - 1) values.push({ time: formatTime(bars[i]), value: sum / period });
      }
      const indicator = chart.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      indicator.setData(values);
    };
    if (sma20) addSma(20, "#f6b94c");
    if (sma50) addSma(50, "#9d8cff");

    const primary = seriesRef.current;
    if (primary) {
      levels.forEach(price => primary.createPriceLine({price,color:"#5b9aff",lineWidth:1,lineStyle:2,axisLabelVisible:true,title:"Nível"}));
    }
    const onClick = (param: {point?: {x:number;y:number}}) => {
      if (!lineMode || !param.point || !seriesRef.current) return;
      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (typeof price === "number" && Number.isFinite(price) && price > 0) {
        setLevels(prev => [...prev, Number(price.toFixed(4))]);
        setLineMode(false);
      }
    };
    chart.subscribeClick(onClick);
    chart.timeScale().fitContent();

    // Responsive resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      chart.unsubscribeClick(onClick);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [bars, chartType, sma20, sma50, levels, lineMode]);

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-primary)]">
        {/* Time range buttons */}
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                timeRange === range
                  ? "bg-[var(--accent-primary)] text-black"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Chart type toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setChartType("candlestick")}
            title="Candlestick"
            className={`p-1.5 rounded-md transition-all ${
              chartType === "candlestick"
                ? "bg-[var(--bg-muted)] text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <BarChart3 size={16} />
          </button>
          <button
            onClick={() => setChartType("line")}
            title="Line"
            className={`p-1.5 rounded-md transition-all ${
              chartType === "line"
                ? "bg-[var(--bg-muted)] text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <LineChart size={16} />
          </button>
          <button
            onClick={() => setChartType("area")}
            title="Area"
            className={`p-1.5 rounded-md transition-all ${
              chartType === "area"
                ? "bg-[var(--bg-muted)] text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <AreaChart size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-primary)] px-3 py-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Ferramentas</span>
        <button type="button" onClick={() => setLineMode(v => !v)} aria-pressed={lineMode} className={`rounded-md px-3 py-1.5 text-xs ${lineMode ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}`}>{lineMode ? "Clique no gráfico..." : "Linha horizontal"}</button>
        <button type="button" onClick={() => setLevels([])} disabled={!levels.length} className="rounded-md px-2 py-1.5 text-xs text-[var(--text-muted)] disabled:opacity-40">Limpar linhas ({levels.length})</button>
        <span className="mx-1 h-4 w-px bg-[var(--border-primary)]" />
        <button type="button" onClick={() => setSma20(v => !v)} aria-pressed={sma20} className={`rounded-md px-3 py-1.5 text-xs ${sma20 ? "bg-amber-500/20 text-amber-300" : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}`}>Média 20</button>
        <button type="button" onClick={() => setSma50(v => !v)} aria-pressed={sma50} className={`rounded-md px-3 py-1.5 text-xs ${sma50 ? "bg-violet-500/20 text-violet-300" : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}`}>Média 50</button>
      </div>

      {/* Chart area */}
      <div className="relative" style={{ height: 520 }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/80 z-10">
            <Loader2 size={28} className="text-[var(--accent-primary)] animate-spin" />
          </div>
        )}
        {!isLoading && bars.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)]">
            Dados históricos indisponíveis
          </div>
        ) : (
          <div ref={chartContainerRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}

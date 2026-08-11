/**
 * ============================================================================
 * Toroloom — TradingView Lightweight Charts Demo (browser)
 * ============================================================================
 *
 * A TradingView-style candlestick chart built with the official open-source
 * `lightweight-charts` library (Apache 2.0 — display-only, licensed for
 * commercial use). Data is deterministic mock OHLC per symbol so the chart is
 * stable across theme toggles / remounts.
 *
 * Features:
 *   - Symbol selector (6 Indian large-caps)
 *   - Timeframe selector (1D/5D/1M/6M/1Y) with intraday time axis on 1D/5D
 *   - Volume histogram overlay
 *   - Theme-aware colors via the app's real `useTheme()` (dark/light)
 *   - Crosshair OHLC legend (TradingView-style)
 *   - Live tick simulation toggle (`series.update()` — the real-time path)
 *   - Responsive via `autoSize`
 * ============================================================================
 */

import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineStyle,
  createChart,
  createTextWatermark,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ITextWatermarkPluginApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTheme } from '../src/context/ThemeContext';

/* ─── Demo symbols — real Indian large-caps, base prices match demoStocks ─── */
const SYMBOLS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', base: 2890.5 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', base: 3650 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', base: 1680.2 },
  { symbol: 'INFY', name: 'Infosys', base: 1520.4 },
  { symbol: 'ITC', name: 'ITC', base: 442.6 },
  { symbol: 'SBIN', name: 'State Bank of India', base: 812.4 },
] as const;

type SymbolKey = (typeof SYMBOLS)[number]['symbol'];

type TfKey = '1D' | '5D' | '1M' | '6M' | '1Y';

const TIMEFRAMES: Record<TfKey, { bars: number; stepMs: number; vol: number; label: string }> = {
  '1D': { bars: 75, stepMs: 60_000, vol: 0.0011, label: '1D' },
  '5D': { bars: 60, stepMs: 300_000, vol: 0.0016, label: '5D' },
  '1M': { bars: 30, stepMs: 86_400_000, vol: 0.0035, label: '1M' },
  '6M': { bars: 130, stepMs: 86_400_000, vol: 0.0042, label: '6M' },
  '1Y': { bars: 52, stepMs: 604_800_000, vol: 0.0055, label: '1Y' },
};

const TF_KEYS = Object.keys(TIMEFRAMES) as TfKey[];

/* ─── Deterministic PRNG so charts are stable across theme toggles/remounts ── */
function hashSeed(str: string): number {
  let h = 1779033703;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CandleBar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface SeriesData {
  candles: CandlestickData<Time>[];
  volumes: HistogramData<Time>[];
  rand: () => number;
  price: number;
  lastTime: number;
}

const MINUTE = 60;
const fmtINR = (n: number): string => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildSeries(symbolKey: SymbolKey, tfKey: TfKey, up: string, down: string): SeriesData {
  const cfg = TIMEFRAMES[tfKey];
  const rand = mulberry32(hashSeed(`${symbolKey}:${tfKey}`));
  const base = SYMBOLS.find((s) => s.symbol === symbolKey)!.base;
  let price = base * (0.86 + rand() * 0.28);
  const stepSec = cfg.stepMs / 1000;
  const nowSec = Math.floor(Date.now() / 1000);
  let time = (nowSec - (cfg.bars - 1) * stepSec) as UTCTimestamp;

  const candles: CandlestickData<Time>[] = [];
  const volumes: HistogramData<Time>[] = [];

  for (let i = 0; i < cfg.bars; i++) {
    const drift = (rand() - 0.47) * cfg.vol;
    const open = price;
    const close = open * (1 + drift + (rand() - 0.5) * cfg.vol * 0.7);
    const high = Math.max(open, close) * (1 + rand() * cfg.vol * 0.8);
    const low = Math.min(open, close) * (1 - rand() * cfg.vol * 0.8);
    const volume = Math.round((200_000 + rand() * 1_800_000) * (cfg.bars > 40 ? 1 : 0.55));

    candles.push({ time, open, high, low, close });
    volumes.push({ time, value: volume, color: close >= open ? up : down });

    price = close;
    time = (time + stepSec) as UTCTimestamp;
  }

  return { candles, volumes, rand, price, lastTime: time - stepSec };
}

export default function LightweightChartDemo() {
  const { isDark, colors } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const crosshairHandlerRef = useRef<((param: MouseEventParams<Time>) => void) | null>(null);
  const liveRef = useRef<{ rand: () => number; price: number; lastTime: number; firstClose: number } | null>(null);
  const legendKeyRef = useRef('');

  const [symbolKey, setSymbolKey] = useState<SymbolKey>('RELIANCE');
  const [tfKey, setTfKey] = useState<TfKey>('1M');
  const [live, setLive] = useState(false);
  const [legendBar, setLegendBar] = useState<CandlestickData<Time> | null>(null);
  const [lastQuote, setLastQuote] = useState<{ price: number; changePct: number } | null>(null);

  const up = colors.success;
  const down = colors.secondary;
  const grid = colors.border;
  const border = colors.border;
  const text = colors.text;
  const muted = colors.textMuted;

  /* ─── Create chart once ──────────────────────────────────────────────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: text,
        fontSize: 12,
        fontFamily: "'Inter', 'Noto Sans Devanagari', system-ui, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: grid, style: LineStyle.Dotted },
        horzLines: { color: grid, style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: colors.primary, width: 1, style: LineStyle.LargeDashed, labelBackgroundColor: colors.primary },
        horzLine: { color: colors.primary, width: 1, style: LineStyle.LargeDashed, labelBackgroundColor: colors.primary },
      },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border, timeVisible: false, secondsVisible: false },
    });

    const watermark = createTextWatermark(chart.panes()[0], {
      horzAlign: 'center',
      vertAlign: 'center',
      lines: [
        {
          text: 'TOROLOOM',
          color: 'rgba(59,130,246,0.12)',
          fontSize: 42,
          fontStyle: 'bold',
          fontFamily: "'Inter', system-ui, sans-serif",
        },
      ],
    });
    watermarkRef.current = watermark;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });

    const onCrosshairMove = (param: MouseEventParams<Time>) => {
      const bar = param.seriesData.get(candle) as CandlestickData<Time> | undefined;
      const key = bar ? `${bar.time}|${bar.open}|${bar.high}|${bar.low}|${bar.close}` : '';
      if (key !== legendKeyRef.current) {
        legendKeyRef.current = key;
        setLegendBar(bar ?? null);
      }
    };
    chart.subscribeCrosshairMove(onCrosshairMove);
    crosshairHandlerRef.current = onCrosshairMove;

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;

    return () => {
      if (crosshairHandlerRef.current) chart.unsubscribeCrosshairMove(crosshairHandlerRef.current);
      watermarkRef.current?.detach();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      watermarkRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── (Re)build data when symbol / timeframe / theme changes ──────────── */
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    const volume = volumeRef.current;
    if (!chart || !candle || !volume) return;

    const data = buildSeries(symbolKey, tfKey, up, down);
    candle.setData(data.candles);
    volume.setData(data.volumes);
    chart.timeScale().applyOptions({
      timeVisible: tfKey === '1D' || tfKey === '5D',
      secondsVisible: false,
    });
    chart.timeScale().fitContent();

    liveRef.current = { rand: data.rand, price: data.price, lastTime: data.lastTime, firstClose: data.candles[0]?.close ?? data.price };
    legendKeyRef.current = '';
    setLegendBar(null);
    setLastQuote({
      price: data.price,
      changePct: ((data.price - (data.candles[0]?.close ?? data.price)) / (data.candles[0]?.close ?? data.price)) * 100,
    });
  }, [symbolKey, tfKey, up, down]);

  /* ─── Re-apply theme colors without rebuilding data ──────────────────── */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      layout: { textColor: text },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border },
    });
    const candle = candleRef.current;
    if (candle) {
      // up/down are identical across themes (#22C55E / #EF4444), so candles
      // and volume colors need no data rebuild — only the layout recolor.
      candle.applyOptions({ upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  /* ─── Live tick simulation ───────────────────────────────────────────── */
  useEffect(() => {
    if (!live) return;
    const candle = candleRef.current;
    const volume = volumeRef.current;
    if (!candle || !volume) return;

    const id = window.setInterval(() => {
      const lr = liveRef.current;
      if (!lr) return;
      const cfg = TIMEFRAMES[tfKey];
      const stepSec = cfg.stepMs / 1000;
      const open = lr.price;
      const close = open * (1 + (lr.rand() - 0.47) * cfg.vol * 2.2);
      const high = Math.max(open, close) * (1 + lr.rand() * cfg.vol);
      const low = Math.min(open, close) * (1 - lr.rand() * cfg.vol);
      const time = (lr.lastTime + stepSec) as UTCTimestamp;

      const volScale = cfg.bars > 40 ? 1 : 0.55;
      candle.update({ time, open, high, low, close });
      volume.update({ time, value: Math.round((200_000 + lr.rand() * 1_800_000) * volScale), color: close >= open ? up : down });

      lr.price = close;
      lr.lastTime = time;
      setLastQuote({
        price: close,
        changePct: ((close - lr.firstClose) / lr.firstClose) * 100,
      });
    }, 1100);

    return () => window.clearInterval(id);
  }, [live, tfKey, up, down]);

  const symbol = SYMBOLS.find((s) => s.symbol === symbolKey)!;
  const quoteUp = (lastQuote?.changePct ?? 0) >= 0;
  const displayBar = legendBar ?? null;

  return (
    <div className="card chart-demo">
      <div className="chart-toolbar">
        <div className="chart-symbols">
          {SYMBOLS.map((s) => (
            <button
              key={s.symbol}
              type="button"
              className={`chart-chip ${s.symbol === symbolKey ? 'active' : ''}`}
              aria-pressed={s.symbol === symbolKey}
              onClick={() => setSymbolKey(s.symbol)}
            >
              {s.symbol}
            </button>
          ))}
        </div>
        <div className="chart-live">
          {TF_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              className={`chart-chip ${k === tfKey ? 'active' : ''}`}
              aria-pressed={k === tfKey}
              onClick={() => setTfKey(k)}
            >
              {TIMEFRAMES[k].label}
            </button>
          ))}
          <button
            type="button"
            className={`chart-chip chart-live-btn ${live ? 'active' : ''}`}
            data-testid="chart-live-toggle"
            aria-pressed={live}
            onClick={() => setLive((v) => !v)}
          >
            {live ? <span className="chart-live-dot" /> : null}
            {live ? 'LIVE' : '▶ LIVE'}
          </button>
        </div>
      </div>

      <div className="chart-body">
        <div className="chart-legend" data-testid="chart-legend">
          <span className="chart-sym">{symbol.symbol}</span>
          <span className="chart-name">{symbol.name}</span>
          {displayBar ? (
            <>
              <span>O <b className={displayBar.close >= displayBar.open ? 'chart-up' : 'chart-down'}>{fmtINR(displayBar.open)}</b></span>
              <span>H <b className="chart-up">{fmtINR(displayBar.high)}</b></span>
              <span>L <b className="chart-down">{fmtINR(displayBar.low)}</b></span>
              <span>C <b className={displayBar.close >= displayBar.open ? 'chart-up' : 'chart-down'}>{fmtINR(displayBar.close)}</b></span>
            </>
          ) : lastQuote ? (
            <>
              <span className={quoteUp ? 'chart-up' : 'chart-down'}>{fmtINR(lastQuote.price)}</span>
              <span className={quoteUp ? 'chart-up' : 'chart-down'}>
                {quoteUp ? '▲' : '▼'} {Math.abs(lastQuote.changePct).toFixed(2)}%
              </span>
            </>
          ) : null}
        </div>
        <div ref={containerRef} className="chart-canvas" data-testid="chart-canvas" />
      </div>

      <div className="chart-foot">
        <span className="chart-license">
          Charts by{' '}
          <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer">
            TradingView Lightweight Charts™
          </a>{' '}
          (open-source, display-only) · mock OHLC data
        </span>
        {live ? <span className="chart-live-badge">simulating live ticks — 1.1s interval</span> : null}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';
import type { CandlestickData, Time, IChartApi, ISeriesApi } from 'lightweight-charts';
import type { KlineData, ConnectionStatus, ChartPositionData } from '@/lib/trading/types';
import { SCHEDULER_CONFIG } from '@/lib/timeline/constants';

// Extract colors from SCHEDULER_CONFIG
const TRADER_COLORS = SCHEDULER_CONFIG.defaultColors;

// Price line with associated position data (not currently used but kept for reference)
// interface PositionPriceLine {
//   line: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>;
//   position: ChartPositionData;
//   currentPnl: number;
// }

// Get trader color from TRADER_COLORS based on trader ID (same logic as timeline)
function getTraderColor(traderId: number): string {
  return TRADER_COLORS[traderId % TRADER_COLORS.length];
}

// Convert hex to HSL and return variants for entry, profit, stop lines
function getColorVariants(hexColor: string) {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  const hue = h * 360;
  const sat = s * 100;

  return {
    entry: hexColor, // Original color for entry line (thicker)
    profit: `hsl(${hue}, ${sat * 0.6}%, 75%)`, // Lighter for take profit (thinner)
    stop: `hsl(${hue}, ${sat * 0.6}%, 70%)`, // Slightly darker for stop loss (thinner)
  };
}

interface ExtendedWebSocket extends WebSocket {
  __cleanupTimeout?: ReturnType<typeof setTimeout>;
}

interface TradingChartProps {
  symbol: string;
  interval: string;
  isRunning: boolean;
  onStatusChange: (status: ConnectionStatus) => void;
  positions?: ChartPositionData[];
  onConnectionFailed?: () => void; // Callback when connection fails after 3 attempts
}

// Real-time market data display
interface MarketData {
  trades: number;
  takerBuyVolume: number;
  takerBuyRatio: number;
}

export default function TradingChart({
  symbol,
  interval,
  isRunning,
  onStatusChange,
  positions = [],
  onConnectionFailed,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const wsRef = useRef<ExtendedWebSocket | null>(null);
  const wsGenerationRef = useRef(0);

  // Store current price for PnL calculation
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Store price lines for each position
  const positionLinesRef = useRef<
    Map<
      number,
      {
        entryLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>;
        stopLossLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null;
        takeProfitLine: ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null;
      }
    >
  >(new Map());

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const connectionAttemptRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0); // Track reconnection attempts
  const onConnectionFailedRef = useRef(onConnectionFailed);
  onConnectionFailedRef.current = onConnectionFailed;
  const isMountedRef = useRef(true); // Track if component is mounted

  // Real-time market data
  const [marketData, setMarketData] = useState<MarketData>({
    trades: 0,
    takerBuyVolume: 0,
    takerBuyRatio: 0,
  });

  // Use ref to store the latest onStatusChange callback
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth || 800;
    const initialHeight = container.clientHeight || 400;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: initialWidth,
      height: initialHeight,
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(42, 46, 57, 0.5)',
        rightOffset: 10, // Add space on right for price labels
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
    });

    // Candlestick series (K-line)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Volume histogram series (at the bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    // Set volume scale to bottom (adjust margins to prevent overlapping with candlesticks)
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85, // Volume chart takes bottom 15%
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize with ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartRef.current) return;

      const entry = entries[0];
      const newWidth = entry.contentRect.width;
      const newHeight = entry.contentRect.height;

      if (newWidth > 0 && newHeight > 0) {
        chartRef.current.applyOptions({
          width: newWidth,
          height: newHeight,
        });
      }
    });

    resizeObserver.observe(container);

    const handleWindowResize = () => {
      if (container && chartRef.current) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
        }
      }
    };

    window.addEventListener('resize', handleWindowResize);

    // Initial resize with multiple attempts to ensure proper sizing
    const initialResizeTimeout = setTimeout(() => {
      if (container && chartRef.current) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
          chartRef.current.timeScale().fitContent();
        }
      }
    }, 100);

    // Second resize to catch any layout shifts
    const secondResizeTimeout = setTimeout(() => {
      if (container && chartRef.current) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
          chartRef.current.applyOptions({ width, height });
        }
      }
    }, 500);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
      clearTimeout(initialResizeTimeout);
      clearTimeout(secondResizeTimeout);

      // Use requestAnimationFrame to avoid the "Object is disposed" error
      // by allowing lightweight-charts to finish any pending renders
      requestAnimationFrame(() => {
        chart.remove();
      });
    };
  }, []);

  // Load historical data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const loadHistoricalData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/trading/history?symbol=${symbol}&interval=${interval}&limit=500`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch data');
        }

        const data: KlineData[] = await response.json();

        // Convert to lightweight-charts format
        const candlestickData: CandlestickData[] = data.map((d) => ({
          time: d.time as Time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        }));

        // Volume data with color based on price movement
        const volumeData: Array<{
          time: Time;
          value: number;
          color: string;
        }> = data.map((d) => ({
          time: d.time as Time,
          value: d.volume,
          color: d.close >= d.open ? '#22c55e80' : '#ef444480', // Semi-transparent green/red
        }));

        candlestickSeriesRef.current?.setData(candlestickData);
        volumeSeriesRef.current?.setData(volumeData);
      } catch (error) {
        console.error('Error loading historical data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    loadHistoricalData();
  }, [symbol, interval]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;

    if (!isRunning || !candlestickSeriesRef.current || !volumeSeriesRef.current) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        onStatusChangeRef.current('disconnected');
      }
      if (connectionAttemptRef.current) {
        clearTimeout(connectionAttemptRef.current);
        connectionAttemptRef.current = null;
      }
      reconnectAttemptsRef.current = 0;
      return;
    }

    // Reset reconnection attempts when starting fresh
    reconnectAttemptsRef.current = 0;

    const connectWebSocket = (attemptNumber: number): (() => void) => {
      const currentGeneration = ++wsGenerationRef.current;

      if (wsRef.current && wsRef.current.__cleanupTimeout) {
        clearTimeout(wsRef.current.__cleanupTimeout);
        delete wsRef.current.__cleanupTimeout;
      }

      // Only show connecting state on first attempt
      if (attemptNumber === 0) {
        onStatusChangeRef.current('connecting');
        setWsError(null);
      }

      const wsSymbol = symbol.toLowerCase();
      const wsUrl = `wss://fstream.binance.com/ws/${wsSymbol}_perpetual@continuousKline_${interval}`;
      const ws = new WebSocket(wsUrl) as ExtendedWebSocket;

      wsRef.current = ws;

      ws.onopen = () => {
        if (currentGeneration === wsGenerationRef.current && isMountedRef.current) {
          console.log(`[TradingChart] WebSocket connected (attempt ${attemptNumber + 1})`);
          onStatusChangeRef.current('connected');
          setWsError(null);
          reconnectAttemptsRef.current = 0; // Reset on successful connection
        }
      };

      ws.onmessage = (event) => {
        if (currentGeneration === wsGenerationRef.current && isMountedRef.current) {
          try {
            const message = JSON.parse(event.data);
            const kline = message.k;

            if (kline && candlestickSeriesRef.current && volumeSeriesRef.current) {
              const isUp = parseFloat(kline.c) >= parseFloat(kline.o);
              const color = isUp ? '#22c55e80' : '#ef444480';

              // Update candlestick
              const candlestickData: CandlestickData<Time> = {
                time: Math.floor(kline.t / 1000) as Time,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
              };

              candlestickSeriesRef.current.update(candlestickData);

              // Update volume
              const volumeData = {
                time: Math.floor(kline.t / 1000) as Time,
                value: parseFloat(kline.v),
                color,
              };

              volumeSeriesRef.current.update(volumeData);

              // Update current price for PnL calculation
              setCurrentPrice(parseFloat(kline.c));

              // Update real-time market data
              setMarketData({
                trades: parseInt(kline.n),
                takerBuyVolume: parseFloat(kline.V),
                takerBuyRatio: parseFloat(kline.V) / parseFloat(kline.v),
              });
            }
          } catch (error) {
            console.error('[TradingChart] Error parsing WebSocket message:', error);
          }
        }
      };

      ws.onerror = (error) => {
        if (currentGeneration === wsGenerationRef.current && isMountedRef.current) {
          console.error(`[TradingChart] WebSocket error (attempt ${attemptNumber + 1}):`, error);
          setWsError('WebSocket connection failed. Please check your network or proxy settings.');
          onStatusChangeRef.current('disconnected');
        }
      };

      ws.onclose = (event) => {
        if (currentGeneration === wsGenerationRef.current) {
          console.log(
            `[TradingChart] WebSocket closed (attempt ${attemptNumber + 1}):`,
            event.code,
            event.reason
          );

          // Only update status and attempt reconnect if component is still mounted
          if (isMountedRef.current) {
            onStatusChangeRef.current('disconnected');

            // Auto-reconnect logic - only if component is still mounted
            if (isRunning && !event.wasClean) {
              const nextAttempt = attemptNumber + 1;

              if (nextAttempt < 3) {
                // Retry after 3 seconds
                console.log(
                  `[TradingChart] Reconnecting in 3 seconds... (attempt ${nextAttempt + 1}/3)`
                );
                connectionAttemptRef.current = window.setTimeout(() => {
                  if (isMountedRef.current) {
                    connectWebSocket(nextAttempt);
                  }
                }, 3000);
              } else {
                // 3 attempts failed, notify parent to close the chart
                console.error('[TradingChart] Connection failed after 3 attempts, closing chart');
                setWsError('Connection failed. Chart closed automatically.');
                onConnectionFailedRef.current?.();
              }
            }
          }
        }
      };

      return () => {
        if (ws.__cleanupTimeout) {
          clearTimeout(ws.__cleanupTimeout);
          delete ws.__cleanupTimeout;
        }

        const cleanupTimeout = setTimeout(() => {
          if (wsRef.current === ws) {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
              ws.close();
            }
            wsRef.current = null;
          }
        }, 100);

        if (wsRef.current === ws) {
          ws.__cleanupTimeout = cleanupTimeout;
        }
      };
    };

    const cleanup = connectWebSocket(0);

    return () => {
      // Mark component as unmounted BEFORE cleanup
      isMountedRef.current = false;

      if (connectionAttemptRef.current) {
        clearTimeout(connectionAttemptRef.current);
        connectionAttemptRef.current = null;
      }
      cleanup();
      reconnectAttemptsRef.current = 0;
    };
  }, [isRunning, symbol, interval]); // onConnectionFailed is stored in ref, not needed in deps

  // Handle position data changes - add/remove price lines for all positions
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    const series = candlestickSeriesRef.current;
    const newLinesMap = new Map();

    // Remove old lines
    for (const lines of positionLinesRef.current.values()) {
      series.removePriceLine(lines.entryLine);
      if (lines.stopLossLine) series.removePriceLine(lines.stopLossLine);
      if (lines.takeProfitLine) series.removePriceLine(lines.takeProfitLine);
    }
    positionLinesRef.current.clear();

    // Create new lines for each position
    for (const position of positions) {
      // Calculate initial PnL for display
      const initialPnl = currentPrice
        ? (position.side === 'long'
            ? (currentPrice - position.entryPrice) / position.entryPrice
            : (position.entryPrice - currentPrice) / position.entryPrice) * 100
        : 0;

      // Get color variants based on trader ID (consistent with timeline)
      const traderColor = getTraderColor(position.traderId);
      const { entry, profit, stop } = getColorVariants(traderColor);

      // Entry line - shows P&L and percentage (thicker line)
      const pnlText = initialPnl >= 0 ? `+${initialPnl.toFixed(1)}%` : `${initialPnl.toFixed(1)}%`;
      const entryLine = series.createPriceLine({
        price: position.entryPrice,
        color: entry,
        lineWidth: 3, // Thicker for entry line
        lineStyle: 2, // Solid
        axisLabelVisible: true,
        title: pnlText,
      });

      // Stop loss line (thinner, dotted) - no label
      let stopLossLine = null;
      if (position.stopLossPrice) {
        stopLossLine = series.createPriceLine({
          price: position.stopLossPrice,
          color: stop,
          lineWidth: 1, // Thinner
          lineStyle: 1, // Dotted (·····)
          axisLabelVisible: false,
        });
      }

      // Take profit line (thinner, dashed) - no label
      let takeProfitLine = null;
      if (position.takeProfitPrice) {
        takeProfitLine = series.createPriceLine({
          price: position.takeProfitPrice,
          color: profit,
          lineWidth: 1, // Thinner
          lineStyle: 2, // Dashed (-~-~-~)
          axisLabelVisible: false,
        });
      }

      newLinesMap.set(position.positionId, {
        entryLine,
        stopLossLine,
        takeProfitLine,
        traderName: position.traderName, // Store for hover tooltip
        side: position.side,
        entryPrice: position.entryPrice,
      });
    }

    positionLinesRef.current = newLinesMap;

    // Cleanup on unmount
    return () => {
      for (const lines of positionLinesRef.current.values()) {
        series.removePriceLine(lines.entryLine);
        if (lines.stopLossLine) series.removePriceLine(lines.stopLossLine);
        if (lines.takeProfitLine) series.removePriceLine(lines.takeProfitLine);
      }
      positionLinesRef.current.clear();
    };
  }, [positions, currentPrice]);

  // Update entry line titles with P&L when price changes
  useEffect(() => {
    if (!currentPrice || !chartRef.current) return;

    for (const lines of positionLinesRef.current.values()) {
      const pnl =
        lines.side === 'long'
          ? (currentPrice - lines.entryPrice) / lines.entryPrice
          : (lines.entryPrice - currentPrice) / lines.entryPrice;

      const pnlText = pnl >= 0 ? `+${(pnl * 100).toFixed(1)}%` : `${(pnl * 100).toFixed(1)}%`;
      lines.entryLine.applyOptions({ title: pnlText });
    }
  }, [currentPrice]);

  // Add crosshair move event to show trader name on hover
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    const handleCrosshairMove = (param: { time?: unknown; seriesData: Map<unknown, unknown> }) => {
      if (!param || !param.time || positionLinesRef.current.size === 0) {
        // Reset all titles when crosshair leaves chart
        for (const lines of positionLinesRef.current.values()) {
          if (currentPrice) {
            const pnl =
              lines.side === 'long'
                ? (currentPrice - lines.entryPrice) / lines.entryPrice
                : (lines.entryPrice - currentPrice) / lines.entryPrice;

            const pnlText = pnl >= 0 ? `+${(pnl * 100).toFixed(1)}%` : `${(pnl * 100).toFixed(1)}%`;
            lines.entryLine.applyOptions({ title: pnlText });
          }
        }
        return;
      }

      // Get price from crosshair
      const seriesData = param.seriesData.get(candlestickSeriesRef.current);
      if (!seriesData) return;

      const price = (seriesData as { value?: number }).value;
      if (!price) return;

      // Check if crosshair is near any entry line (within 0.5% of price range)
      for (const lines of positionLinesRef.current.values()) {
        const priceRangePercent = (Math.abs(price - lines.entryPrice) / lines.entryPrice) * 100;
        const threshold = 0.5; // 0.5% threshold

        if (priceRangePercent < threshold) {
          // Show trader name when hovering near entry line
          lines.entryLine.applyOptions({
            title: `${lines.traderName} (${lines.entryPrice.toFixed(2)})`,
          });
        } else {
          // Reset to P&L when not hovering
          if (currentPrice) {
            const pnl =
              lines.side === 'long'
                ? (currentPrice - lines.entryPrice) / lines.entryPrice
                : (lines.entryPrice - currentPrice) / lines.entryPrice;

            const pnlText = pnl >= 0 ? `+${(pnl * 100).toFixed(1)}%` : `${(pnl * 100).toFixed(1)}%`;
            lines.entryLine.applyOptions({ title: pnlText });
          }
        }
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [currentPrice]);

  return (
    <div className="relative h-full w-full box-border">
      {/* Chart container - positioned absolutely to fill entire parent */}
      <div
        ref={chartContainerRef}
        className="absolute inset-0 rounded-lg border border-gray-700/50"
      />

      {/* Market Data Panel - adjusted positioning */}
      <div className="absolute left-2 top-2 z-10 flex gap-1 md:gap-2 rounded-lg bg-gray-900/95 border border-gray-700/50 px-1.5 py-1 md:px-3 md:py-1.5 text-[9px] md:text-[10px]">
        <div className="flex flex-col">
          <span className="text-gray-400">Trades</span>
          <span className="text-xs md:text-sm font-semibold text-white">
            {marketData.trades.toLocaleString()}
          </span>
        </div>
        <div className="w-px bg-gray-700" />
        <div className="flex flex-col">
          <span className="text-gray-400">Buy Vol</span>
          <span className="text-xs md:text-sm font-semibold text-emerald-400">
            {marketData.takerBuyVolume.toFixed(0)}
          </span>
        </div>
        <div className="w-px bg-gray-700 hidden sm:block" />
        <div className="flex flex-col hidden sm:flex">
          <span className="text-gray-400">Buy Ratio</span>
          <span
            className={`text-xs md:text-sm font-semibold ${
              marketData.takerBuyRatio >= 0.5 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {(marketData.takerBuyRatio * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Position Info Panels removed - info now shown on chart lines */}

      {/* Loading indicator */}
      {isLoading && !wsError && (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 rounded-lg bg-gray-800/90 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm text-white">
            <div className="h-3 w-3 md:h-4 md:w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <span>Loading...</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {(error || wsError) && !isLoading && (
        <div className="absolute left-1/2 top-1/2 z-10 flex w-11/12 max-w-lg -translate-x-1/2 -translate-y-1/2">
          <div className="w-full rounded-lg bg-red-500/10 border border-red-500/50 p-3 md:p-6 text-center">
            <p className="mb-2 text-sm md:text-lg font-semibold text-red-400">
              {wsError ? 'WebSocket Connection Failed' : 'Data Loading Failed'}
            </p>
            <p className="text-xs md:text-sm text-gray-300">{wsError || error}</p>
            <p className="mt-3 md:mt-4 text-[10px] md:text-xs text-gray-400">
              {wsError
                ? 'Tip: WebSocket connection failed. Please ensure Clash is in global mode, or check your network connection.'
                : 'Tip: Binance API may be restricted in some regions. Please try using a VPN or proxy server.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

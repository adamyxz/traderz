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
import type { KlineData, ConnectionStatus } from '@/lib/trading/types';

interface ExtendedWebSocket extends WebSocket {
  __cleanupTimeout?: ReturnType<typeof setTimeout>;
}

interface TradingChartProps {
  symbol: string;
  interval: string;
  isRunning: boolean;
  onStatusChange: (status: ConnectionStatus) => void;
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
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const wsRef = useRef<ExtendedWebSocket | null>(null);
  const wsGenerationRef = useRef(0);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const connectionAttemptRef = useRef<number | null>(null);

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
      height: 700, // Increased height to accommodate volume chart
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
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

    // Set volume scale to bottom
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
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

      if (newWidth > 0) {
        chartRef.current.applyOptions({
          width: newWidth,
        });
      }
    });

    resizeObserver.observe(container);

    const handleWindowResize = () => {
      if (container && chartRef.current) {
        const width = container.clientWidth;
        if (width > 0) {
          chartRef.current.applyOptions({ width });
        }
      }
    };

    window.addEventListener('resize', handleWindowResize);

    const initialResizeTimeout = setTimeout(() => {
      if (container && chartRef.current) {
        const width = container.clientWidth;
        if (width > 0) {
          chartRef.current.applyOptions({ width });
        }
      }
    }, 100);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      resizeObserver.disconnect();
      clearTimeout(initialResizeTimeout);
      chart.remove();
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
      return;
    }

    const currentGeneration = ++wsGenerationRef.current;

    if (wsRef.current && wsRef.current.__cleanupTimeout) {
      clearTimeout(wsRef.current.__cleanupTimeout);
      delete wsRef.current.__cleanupTimeout;
    }

    onStatusChangeRef.current('connecting');
    setWsError(null);

    const wsSymbol = symbol.toLowerCase();
    const wsUrl = `wss://fstream.binance.com/ws/${wsSymbol}_perpetual@continuousKline_${interval}`;
    const ws = new WebSocket(wsUrl) as ExtendedWebSocket;

    wsRef.current = ws;

    ws.onopen = () => {
      if (currentGeneration === wsGenerationRef.current) {
        onStatusChangeRef.current('connected');
        setWsError(null);
      }
    };

    ws.onmessage = (event) => {
      if (currentGeneration === wsGenerationRef.current) {
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

            // Update real-time market data
            setMarketData({
              trades: parseInt(kline.n), // Number of trades
              takerBuyVolume: parseFloat(kline.V), // Taker buy base asset volume
              takerBuyRatio: parseFloat(kline.V) / parseFloat(kline.v), // Buy ratio
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      }
    };

    ws.onerror = (error) => {
      if (currentGeneration === wsGenerationRef.current) {
        console.error('WebSocket error:', error);
        setWsError('WebSocket 连接失败，请检查网络或代理设置');
        onStatusChangeRef.current('disconnected');
      }
    };

    ws.onclose = (event) => {
      if (currentGeneration === wsGenerationRef.current) {
        console.log('WebSocket closed:', event.code, event.reason);
        onStatusChangeRef.current('disconnected');
        if (isRunning && !event.wasClean) {
          connectionAttemptRef.current = window.setTimeout(() => {
            console.log('Attempting to reconnect...');
          }, 3000);
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
  }, [isRunning, symbol, interval]);

  return (
    <div className="relative">
      {/* Market Data Panel */}
      <div className="absolute left-4 top-4 z-10 flex gap-4 rounded-lg bg-gray-900/95 border border-gray-700/50 px-4 py-2 text-xs">
        <div className="flex flex-col">
          <span className="text-gray-400">交易次数</span>
          <span className="text-lg font-semibold text-white">
            {marketData.trades.toLocaleString()}
          </span>
        </div>
        <div className="w-px bg-gray-700" />
        <div className="flex flex-col">
          <span className="text-gray-400">主动买入量</span>
          <span className="text-lg font-semibold text-emerald-400">
            {marketData.takerBuyVolume.toFixed(4)}
          </span>
        </div>
        <div className="w-px bg-gray-700" />
        <div className="flex flex-col">
          <span className="text-gray-400">买入比例</span>
          <span
            className={`text-lg font-semibold ${
              marketData.takerBuyRatio >= 0.5 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {(marketData.takerBuyRatio * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && !wsError && (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 rounded-lg bg-gray-800/90 px-4 py-2 text-white">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <span>加载中...</span>
          </div>
        </div>
      )}

      {/* Error display */}
      {(error || wsError) && !isLoading && (
        <div className="absolute left-1/2 top-1/2 z-10 flex w-full max-w-lg -translate-x-1/2 -translate-y-1/2">
          <div className="w-full rounded-lg bg-red-500/10 border border-red-500/50 p-6 text-center">
            <p className="mb-2 text-lg font-semibold text-red-400">
              {wsError ? 'WebSocket 连接失败' : '数据加载失败'}
            </p>
            <p className="text-sm text-gray-300">{wsError || error}</p>
            <p className="mt-4 text-xs text-gray-400">
              {wsError
                ? '提示：WebSocket 连接失败。请确保 Clash 已切换到全局模式，或检查网络连接。'
                : '提示：Binance API 在某些地区可能受到限制。请尝试使用 VPN 或代理服务器访问。'}
            </p>
          </div>
        </div>
      )}

      {/* Chart container */}
      <div ref={chartContainerRef} className="rounded-lg border border-gray-700/50" />
    </div>
  );
}

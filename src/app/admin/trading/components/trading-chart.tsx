'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { CandlestickData, Time, IChartApi } from 'lightweight-charts';
import type { KlineData, ConnectionStatus } from '@/lib/trading/types';

interface TradingChartProps {
  symbol: string;
  interval: string;
  isRunning: boolean;
  onStatusChange: (status: ConnectionStatus) => void;
}

export default function TradingChart({
  symbol,
  interval,
  isRunning,
  onStatusChange,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<CandlestickSeries<Time> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsGenerationRef = useRef(0); // Track WebSocket generation

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);
  const connectionAttemptRef = useRef<number | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 600,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Load historical data
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

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

        candlestickSeriesRef.current.setData(candlestickData);
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
    if (!isRunning || !candlestickSeriesRef.current) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        onStatusChange('disconnected');
      }
      if (connectionAttemptRef.current) {
        clearTimeout(connectionAttemptRef.current);
        connectionAttemptRef.current = null;
      }
      return;
    }

    // Increment generation for this effect run
    const currentGeneration = ++wsGenerationRef.current;

    // Cancel any pending cleanup
    if (wsRef.current && wsRef.current.__cleanupTimeout) {
      clearTimeout(wsRef.current.__cleanupTimeout);
      delete wsRef.current.__cleanupTimeout;
    }

    onStatusChange('connecting');
    setWsError(null);

    const wsSymbol = symbol.toLowerCase();
    const wsUrl = `wss://fstream.binance.com/ws/${wsSymbol}@kline_${interval}`;
    const ws = new WebSocket(wsUrl);

    wsRef.current = ws;

    ws.onopen = () => {
      // Only process events for the current generation
      if (currentGeneration === wsGenerationRef.current) {
        onStatusChange('connected');
        setWsError(null);
      }
    };

    ws.onmessage = (event) => {
      // Only process events for the current generation
      if (currentGeneration === wsGenerationRef.current) {
        try {
          const message = JSON.parse(event.data);
          const kline = message.k;

          if (kline && candlestickSeriesRef.current) {
            const candlestickData: CandlestickData<Time> = {
              time: Math.floor(kline.t / 1000) as Time,
              open: parseFloat(kline.o),
              high: parseFloat(kline.h),
              low: parseFloat(kline.l),
              close: parseFloat(kline.c),
            };

            candlestickSeriesRef.current.update(candlestickData);
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
        onStatusChange('disconnected');
      }
    };

    ws.onclose = (event) => {
      if (currentGeneration === wsGenerationRef.current) {
        console.log('WebSocket closed:', event.code, event.reason);
        onStatusChange('disconnected');
        // Auto-reconnect after 3 seconds if not intentionally stopped
        if (isRunning && !event.wasClean) {
          connectionAttemptRef.current = window.setTimeout(() => {
            console.log('Attempting to reconnect...');
          }, 3000);
        }
      }
    };

    return () => {
      // Cancel any pending cleanup timeout on this WebSocket
      if (ws.__cleanupTimeout) {
        clearTimeout(ws.__cleanupTimeout);
        delete ws.__cleanupTimeout;
      }

      // Delay cleanup slightly to avoid warning in Strict Mode
      const cleanupTimeout = setTimeout(() => {
        if (wsRef.current === ws) {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
          wsRef.current = null;
        }
      }, 100);

      // Store the cleanup timeout so it can be cancelled
      if (wsRef.current === ws) {
        ws.__cleanupTimeout = cleanupTimeout;
      }
    };
  }, [isRunning, symbol, interval, onStatusChange]);

  return (
    <div className="relative">
      {isLoading && !wsError && (
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-2 rounded-lg bg-gray-800/90 px-4 py-2 text-white">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <span>加载中...</span>
          </div>
        </div>
      )}
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
      <div ref={chartContainerRef} className="rounded-lg border border-gray-700/50" />
    </div>
  );
}

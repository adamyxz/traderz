'use client';

import { useCallback } from 'react';
import { Maximize2, X } from 'lucide-react';
import TradingChart from './trading-chart';
import type {
  ChartConfig,
  TradingPair,
  KlineInterval,
  ConnectionStatus,
} from '@/lib/trading/types';

interface ChartCardProps {
  config: ChartConfig;
  pairs: TradingPair[];
  intervals: KlineInterval[];
  isFullscreen: boolean;
  onConfigChange: (id: string, updates: Partial<ChartConfig>) => void;
  onDelete: (id: string) => void;
  onFullscreen: (id: string) => void;
  onExitFullscreen: () => void;
}

export default function ChartCard({
  config,
  pairs,
  intervals,
  isFullscreen,
  onConfigChange,
  onDelete,
  onFullscreen,
  onExitFullscreen,
}: ChartCardProps) {
  const handleSymbolChange = useCallback(
    (symbol: string) => {
      onConfigChange(config.id, { symbol });
    },
    [config.id, onConfigChange]
  );

  const handleIntervalChange = useCallback(
    (interval: string) => {
      onConfigChange(config.id, { interval });
    },
    [config.id, onConfigChange]
  );

  const handleStatusChange = useCallback(
    (newStatus: ConnectionStatus) => {
      onConfigChange(config.id, { connectionStatus: newStatus });
    },
    [config.id, onConfigChange]
  );

  const handleConnectionFailed = useCallback(() => {
    // Auto-close chart when connection fails after 3 attempts
    onDelete(config.id);
  }, [config.id, onDelete]);

  const handleDelete = useCallback(() => {
    onDelete(config.id);
  }, [config.id, onDelete]);

  const handleFullscreen = useCallback(() => {
    if (isFullscreen) {
      onExitFullscreen();
    } else {
      onFullscreen(config.id);
    }
  }, [isFullscreen, config.id, onFullscreen, onExitFullscreen]);

  return (
    <div
      className={`
        relative flex flex-col overflow-hidden rounded-lg border transition-all
        ${isFullscreen ? 'fixed inset-4 z-50 border-sky-500' : 'border-gray-700/50 hover:border-gray-600'}
        bg-gray-900
      `}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-700/50 bg-gray-800/50 px-2 py-1.5 md:px-3 md:py-2">
        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Trading Pair Selector */}
          <select
            value={config.symbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            disabled
            className="
              rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 md:px-2 md:py-1 text-[10px] md:text-xs text-white
              focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {pairs.map((pair) => (
              <option key={pair.id} value={pair.symbol}>
                {pair.symbol}
              </option>
            ))}
          </select>

          {/* Interval Selector */}
          <select
            value={config.interval}
            onChange={(e) => handleIntervalChange(e.target.value)}
            disabled
            className="
              rounded border border-gray-700 bg-gray-900 px-1.5 py-0.5 md:px-2 md:py-1 text-[10px] md:text-xs text-white
              focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {intervals.map((interval) => (
              <option key={interval.id} value={interval.code}>
                {interval.label}
              </option>
            ))}
          </select>

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-1 md:gap-1.5">
            <div
              className={`h-1.5 w-1.5 md:h-2 md:w-2 rounded-full ${
                config.connectionStatus === 'connected'
                  ? 'bg-emerald-500'
                  : config.connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-gray-500'
              }`}
            />
            <span className="text-[10px] md:text-xs text-gray-400 hidden sm:block">
              {config.connectionStatus === 'connected'
                ? 'Connected'
                : config.connectionStatus === 'connecting'
                  ? 'Connecting'
                  : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {/* Fullscreen Button */}
          <button
            onClick={handleFullscreen}
            className="rounded p-0.5 md:p-1 text-gray-400 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            <Maximize2 className="h-3 w-3 md:h-4 md:w-4" />
          </button>

          {/* Delete Button (hide when fullscreen) */}
          {!isFullscreen && (
            <button
              onClick={handleDelete}
              className="rounded p-0.5 md:p-1 text-gray-400 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <X className="h-3 w-3 md:h-4 md:w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-[300px] md:min-h-[350px] box-border overflow-hidden p-2">
        <TradingChart
          symbol={config.symbol}
          interval={config.interval}
          isRunning={config.isRunning}
          onStatusChange={handleStatusChange}
          positions={config.positions}
          onConnectionFailed={handleConnectionFailed}
        />
      </div>
    </div>
  );
}

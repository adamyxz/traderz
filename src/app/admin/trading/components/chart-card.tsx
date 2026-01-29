'use client';

import { Maximize2, X, Play, Pause } from 'lucide-react';
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
  const handleSymbolChange = (symbol: string) => {
    onConfigChange(config.id, { symbol });
  };

  const handleIntervalChange = (interval: string) => {
    onConfigChange(config.id, { interval });
  };

  const handleToggleRunning = () => {
    onConfigChange(config.id, { isRunning: !config.isRunning });
  };

  const handleStatusChange = (newStatus: ConnectionStatus) => {
    onConfigChange(config.id, { connectionStatus: newStatus });
  };

  const handleDelete = () => {
    onDelete(config.id);
  };

  const handleFullscreen = () => {
    if (isFullscreen) {
      onExitFullscreen();
    } else {
      onFullscreen(config.id);
    }
  };

  return (
    <div
      className={`
        relative flex flex-col overflow-hidden rounded-lg border transition-all
        ${isFullscreen ? 'fixed inset-4 z-50 border-sky-500' : 'border-gray-700/50 hover:border-gray-600'}
        bg-gray-900
      `}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-700/50 bg-gray-800/50 px-3 py-2">
        <div className="flex items-center gap-3">
          {/* Trading Pair Selector */}
          <select
            value={config.symbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            disabled={config.isRunning}
            className="
              rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white
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
            disabled={config.isRunning}
            className="
              rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white
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
          <div className="flex items-center gap-1.5">
            <div
              className={`h-2 w-2 rounded-full ${
                config.connectionStatus === 'connected'
                  ? 'bg-emerald-500'
                  : config.connectionStatus === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-gray-500'
              }`}
            />
            <span className="text-xs text-gray-400">
              {config.connectionStatus === 'connected'
                ? '已连接'
                : config.connectionStatus === 'connecting'
                  ? '连接中'
                  : '未连接'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Start/Stop Button */}
          <button
            onClick={handleToggleRunning}
            className={`
              flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors
              ${
                config.isRunning
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }
            `}
            title={config.isRunning ? '停止' : '启动'}
          >
            {config.isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={handleFullscreen}
            className="rounded p-1 text-gray-400 hover:text-white transition-colors"
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Delete Button (hide when fullscreen) */}
          {!isFullscreen && (
            <button
              onClick={handleDelete}
              className="rounded p-1 text-gray-400 hover:text-red-400 transition-colors"
              title="删除"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-[400px]">
        <TradingChart
          symbol={config.symbol}
          interval={config.interval}
          isRunning={config.isRunning}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  );
}

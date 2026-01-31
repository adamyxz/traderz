'use client';

import { Play, Pause } from 'lucide-react';
import type { TradingPair, KlineInterval } from '@/lib/trading/types';

interface TradingControlsProps {
  isRunning: boolean;
  selectedPair: string;
  selectedInterval: string;
  pairs: TradingPair[];
  intervals: KlineInterval[];
  onStart: () => void;
  onStop: () => void;
  onPairChange: (pair: string) => void;
  onIntervalChange: (interval: string) => void;
}

export default function TradingControls({
  isRunning,
  selectedPair,
  selectedInterval,
  pairs,
  intervals,
  onStart,
  onStop,
  onPairChange,
  onIntervalChange,
}: TradingControlsProps) {
  return (
    <div className="mb-4 flex items-center gap-4 rounded-lg bg-gray-800/50 p-4">
      {/* Start/Stop Button */}
      <button
        onClick={isRunning ? onStop : onStart}
        className={`
          flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors
          ${
            isRunning
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
          }
        `}
      >
        {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {isRunning ? 'Stop' : 'Start'}
      </button>

      {/* Trading Pair Selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">Pair:</label>
        <select
          value={selectedPair}
          onChange={(e) => onPairChange(e.target.value)}
          disabled={isRunning}
          className="
            rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white
            focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          {pairs.map((pair) => (
            <option key={pair.id} value={pair.symbol}>
              {pair.symbol}
            </option>
          ))}
        </select>
      </div>

      {/* Interval Selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-400">Interval:</label>
        <select
          value={selectedInterval}
          onChange={(e) => onIntervalChange(e.target.value)}
          disabled={isRunning}
          className="
            rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white
            focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          {intervals.map((interval) => (
            <option key={interval.id} value={interval.code}>
              {interval.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
